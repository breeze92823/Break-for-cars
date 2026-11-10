import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  RepeatWrapping,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from 'three'
import { BASE, BLOCK_THEMES, CONVEYOR_SKINS, GARAGE_SKINS, LOBBY, MUTATIONS, RARITY_COLORS } from '../config.js'
import { boxSpan, brick, plastic } from '../lego.js'
import { fontReady, neon, solidBox, solidBoxQ } from '../propkit.js'
import { mulberry32 } from '../textures.js'
import { bakeMeshes } from '../bake.js'
import { buildCar } from './cars.js'
import { canvasTex, paintBlockFace, paintGarageScreen, paintStack, paintTruss, short } from './paint.js'
import { sparkleField } from './fx.js'

// A player's base: one garage per plot, six on the island (lobby/index.js). The local player's
// game (game/game.js) plays on one of them; the others show the other players' garages read-only
// (remoteBases.js) or stand free. Who owns it and what it earns is on the billboard (setOwner,
// setIncome); its interior lights are only on for the local player's one (setLit).
//  - Garage: a glass showroom (dark steel columns, glass walls with light X-truss
//    mullions and a mid rail, open front), a thick studded roof with a skylight
//    recess, and the owner's billboard on the front edge ("<name>'s Car Garage,
//    $x/s"). Inside: a studded floor with five parking bays a side and a bright
//    green collect pad by each bay along the centre aisle, ceiling light panels.
//  - Floors (BASE.floors, setFloors): each bought floor stacks another storey with its own
//    ten bays; a lego staircase climbs to it along the open front (alternating sides, glass
//    rails, a stairwell with a guard rail in the floor above). The roof and billboard ride on
//    the top floor; a glowing "[Upgrade] 2nd Floor" plate marks where the next stair goes.
//    A floor not bought is hidden and its colliders are off.
//  - Skin (GARAGE_SKINS, setSkin): recolours the frame, truss, slabs, glass and bays (the
//    garage owns those materials); the rainbow one cycles its hues.
//  - Apron: grey studded concrete in front of the garage.
//  - Conveyor: a sunken dark belt with moving chevrons between low studded walls,
//    a tunnel box at each end. Mystery blocks ride it from the entry tunnel to the
//    exit tunnel, each with a "name / rarity / $price" label; rarer blocks sparkle
//    and a Secret one is announced.
//  - Two limited cars (Omega, Bolido) parked beside the conveyor ends with their
//    "LIMITED CAR" signs and an UNSTEALABLE! tag.
// Local frame: +Z points at the road, X runs along it, origin at the plot centre.

const CONCRETE = '#878fb2'
const CONCRETE_LIGHT = '#98a0c2'
const STEEL = '#525a78'

// Weighted pick of a block theme key. `luck` (the conveyor upgrade) multiplies
// each theme's weight by luck^tier, tier = its place in BLOCK_THEMES (rarest last).
const THEME_KEYS = Object.keys(BLOCK_THEMES)
const luckWeight = (k, luck) => BLOCK_THEMES[k].weight * Math.pow(luck, THEME_KEYS.indexOf(k))
function pickTheme(rand, luck = 1) {
  const total = THEME_KEYS.reduce((s, k) => s + luckWeight(k, luck), 0)
  let r = rand() * total
  for (const k of THEME_KEYS) {
    r -= luckWeight(k, luck)
    if (r <= 0) return k
  }
  return THEME_KEYS[0]
}

function spriteFrom(stack, height) {
  const tex = new CanvasTexture(stack.canvas)
  tex.colorSpace = SRGBColorSpace
  const sprite = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }))
  const fit = () => sprite.scale.set((height * stack.canvas.width) / stack.canvas.height, height, 1)
  fit()
  fontReady.then(() => {
    stack.draw()
    tex.dispose()
    tex.needsUpdate = true
    fit()
  })
  return sprite
}

const blockLabelLines = (t) => [
  { size: 64, parts: [{ text: t.name, fill: '#ffffff' }] },
  { size: 50, parts: [{ text: t.rarity, fill: RARITY_COLORS[t.rarity] ?? '#ffffff' }] },
  { size: 56, parts: [{ text: '$' + short(t.price), fill: '#7dff3a' }] },
]

export function buildBase(scene, plot, bursts) {
  const B = BASE.building
  const H = B.height
  const F = B.floor
  const S = H // storey height (garage units): floor n stands n * S up
  const ST = BASE.stairs
  const FLOORS = BASE.floors
  const g = new Group()
  g.name = 'playerBase'
  // Face the road: west plots turn +Z to +X, east plots to -X.
  const yaw = plot.x < 0 ? Math.PI / 2 : -Math.PI / 2
  g.position.set(plot.x, 0, plot.z)
  g.rotation.y = yaw
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const toWorld = (lx, lz) => [plot.x + lx * cos + lz * sin, plot.z - lx * sin + lz * cos]
  // The garage is drawn at its design size (BASE.building) inside its own group,
  // scaled by BASE.garageScale and pushed back by garageOffsetZ; `into(garage)`
  // makes box/solid/add work in that frame (colliders are scaled to match).
  // Each floor is a group in the garage (`into(level, { ly })`: ly = its height in
  // garage units, added to the colliders); `sink` collects a floor's colliders so
  // they can be switched off while the floor is not bought.
  const garage = new Group()
  garage.scale.setScalar(BASE.garageScale)
  garage.position.z = BASE.garageOffsetZ
  g.add(garage)
  const gs = BASE.garageScale
  let parent = g
  let k = 1
  let oz = 0
  let ly = 0
  let sink = null
  const into = (target, { inGarage = target === garage, y = 0, colliders = null } = {}) => {
    parent = target
    k = inGarage ? gs : 1
    oz = inGarage ? BASE.garageOffsetZ : 0
    ly = y
    sink = colliders
  }
  // Collider for a local axis-aligned box.
  const solid = (x0, y0, z0, x1, y1, z1) => {
    const [wx, wz] = toWorld(((x0 + x1) / 2) * k, ((z0 + z1) / 2) * k + oz)
    const c = solidBox((Math.abs(x1 - x0) / 2) * k, (Math.abs(y1 - y0) / 2) * k, (Math.abs(z1 - z0) / 2) * k, wx, ((y0 + y1) / 2 + ly) * k, wz, yaw)
    sink?.push(c)
    return c
  }
  // Collider for a garage-frame box tilted by theta about the garage Z axis (stair ramps, rails).
  const qYaw = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw)
  const qTilt = new Quaternion()
  const Z_AXIS = new Vector3(0, 0, 1)
  const solidTilt = (cx, cy, cz, hx, hy, hz, theta) => {
    const [wx, wz] = toWorld(cx * gs, cz * gs + BASE.garageOffsetZ)
    const q = qTilt.setFromAxisAngle(Z_AXIS, theta).premultiply(qYaw)
    const c = solidBoxQ(hx * gs, hy * gs, hz * gs, wx, (cy + ly) * gs, wz, { x: q.x, y: q.y, z: q.z, w: q.w })
    sink?.push(c)
    return c
  }
  const box = (mat, x0, y0, z0, x1, y1, z1, shadow = true) => boxSpan(parent, mat, x0, y0, z0, x1, y1, z1, { shadow })
  const add = (m) => parent.add(m)
  // A box tilted by theta about Z (stair handrails and glass), centred at (cx, cy, cz).
  const tilted = (mat, cx, cy, cz, lx, lyy, lz, theta, shadow = true) => {
    const m = new Mesh(new BoxGeometry(lx, lyy, lz), mat)
    m.position.set(cx, cy, cz)
    m.rotation.z = theta
    m.castShadow = shadow
    m.receiveShadow = true
    parent.add(m)
    return m
  }

  const concrete = brick(CONCRETE, { roughness: 0.6 })
  const concreteLight = brick(CONCRETE_LIGHT, { roughness: 0.6 })
  // The garage's own materials (never shared with another garage): its skin recolours them (setSkin).
  const skinFrame = brick(STEEL, { roughness: 0.55, unique: true }) // columns, fascia, rails
  const skinSlab = brick(CONCRETE, { roughness: 0.6, unique: true }) // floors, stairs, roof
  const skinRail = new MeshStandardMaterial({ color: STEEL, roughness: 0.5 }) // sloped handrails (no studs on a slope)
  const trussTex = new CanvasTexture(paintTruss())
  trussTex.colorSpace = SRGBColorSpace
  trussTex.wrapS = trussTex.wrapT = RepeatWrapping
  trussTex.repeat.set(1, 4)
  const trussV = new MeshStandardMaterial({ map: trussTex, roughness: 0.5 })
  const trussHTex = trussTex.clone()
  trussHTex.center.set(0.5, 0.5)
  trussHTex.rotation = Math.PI / 2
  trussHTex.repeat.set(1, 16)
  trussHTex.needsUpdate = true
  const trussH = new MeshStandardMaterial({ map: trussHTex, roughness: 0.5 })
  const glass = new MeshPhysicalMaterial({ color: '#bdf1ff', metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.5 })

  // --- Apron + front step ----------------------------------------------------------------
  const A = BASE.apron
  box(concreteLight, A.minX, -0.2, A.minZ, A.maxX, 0.15, A.maxZ, false)
  solid(A.minX, 0, A.minZ, A.maxX, 0.15, A.maxZ)
  // brown dirt edging round the apron, like the plot border
  const dirt = brick(LOBBY.colors.plotBorder, { roughness: 0.75 })
  box(dirt, A.minX - 1.2, -0.2, A.maxZ, A.maxX + 1.2, 0.12, A.maxZ + 1.0, false)
  box(dirt, A.minX - 1.2, -0.2, A.minZ - 1.0, A.minX, 0.12, A.maxZ, false)
  box(dirt, A.maxX, -0.2, A.minZ - 1.0, A.maxX + 1.2, 0.12, A.maxZ, false)
  // A step up to the scaled garage floor (each rise stays under the player's autostep).
  const floorFront = (B.maxZ + 0.4) * gs + BASE.garageOffsetZ
  box(concrete, (B.minX - 0.6) * gs, 0, floorFront, (B.maxX + 0.6) * gs, (F * gs) / 2, floorFront + 1.4, false)
  solid((B.minX - 0.6) * gs, 0, floorFront, (B.maxX + 0.6) * gs, (F * gs) / 2, floorFront + 1.4)

  // ===== Garage (design size, scaled) =====
  const bayEdge = brick('#adb5d2', { roughness: 0.5, unique: true })
  const bayTop = brick('#c4cbe2', { roughness: 0.45, unique: true })
  const padMat = brick('#5cff24', { roughness: 0.4, emissive: '#3dff10', emissiveIntensity: 0.45 })
  const upgradeMat = brick('#29d8ff', { roughness: 0.35, emissive: '#10b8ff', emissiveIntensity: 0.55 })
  const upgradeEdge = brick('#1a8fd8', { roughness: 0.4 })
  const panel = neon('#f2f8ff', 1.5)
  const colW = 0.9
  const sideZ = [B.minZ, -15.8, -10.6, -5.4, -0.2, B.maxZ]
  const X0 = B.minX - 0.6
  const X1 = B.maxX + 0.6
  const Z0 = B.minZ - 0.6
  const Z1 = B.maxZ + 0.4
  // The staircase that climbs from floor n-1 to floor n (n >= 1): along the front strip, alternating sides.
  const stairOf = (n) => {
    const dir = n % 2 === 1 ? -1 : 1
    const foot = dir * ST.gap
    const top = dir * (ST.gap + ST.run)
    return { dir, foot, top, x0: Math.min(foot, top), x1: Math.max(foot, top) }
  }
  const live = new Set() // meshes kept out of the bake (toggled or recoloured on their own)
  const bays = [] // in garage design units (game/ places blocks and cars on them)
  const levels = [] // per floor: { group, colliders }

  function buildLevel(n) {
    const level = new Group()
    level.name = `garageFloor${n}`
    level.position.y = n * S
    garage.add(level)
    const colliders = []
    into(level, { inGarage: true, y: n * S, colliders })

    // --- Floor slab (an upper one has the stairwell of the stair coming up to it) ---
    if (n === 0) {
      box(skinSlab, X0, 0, Z0, X1, F, Z1, false)
      solid(X0, 0, Z0, X1, F, Z1)
    } else {
      const st = stairOf(n)
      for (const [a, b, c, d] of [[X0, Z0, X1, ST.z0], [X0, ST.z1, X1, Z1], [X0, ST.z0, st.x0, ST.z1], [st.x1, ST.z0, X1, ST.z1]]) {
        if (c - a < 0.01 || d - b < 0.01) continue
        box(skinSlab, a, 0, b, c, F, d)
        solid(a, 0, b, c, F, d)
      }
      // Guard rail round the stairwell: along its back edge and its foot end (the top end
      // stays open: that is where the stair arrives).
      const railH = 1.1
      const guard = (x0, z0, x1, z1) => {
        const m = box(glass, x0, F, z0, x1, F + railH, z1, false)
        m.renderOrder = 3
        box(skinFrame, x0 - 0.02, F + railH, z0 - 0.02, x1 + 0.02, F + railH + 0.14, z1 + 0.02)
        solid(x0, F, z0, x1, F + railH + 0.14, z1)
      }
      guard(st.x0, ST.z0 - 0.12, st.x1, ST.z0)
      if (st.dir < 0) guard(st.foot, ST.z0 - 0.12, st.foot + 0.12, ST.z1)
      else guard(st.foot - 0.12, ST.z0 - 0.12, st.foot, ST.z1)
      // Front parapet: the upper floors are open at the front like the ground floor.
      guard(B.minX, B.maxZ - 0.15, B.maxX, B.maxZ + 0.15)
      // The stair itself (drawn with this floor, so it shows once the floor is bought).
      buildStair(st, -S)
    }

    // --- Frame ---
    const column = (x, z) => {
      box(skinFrame, x - colW / 2, F, z - colW / 2, x + colW / 2, H, z + colW / 2)
      solid(x - colW / 2, F, z - colW / 2, x + colW / 2, H, z + colW / 2)
    }
    for (const z of sideZ) {
      column(B.minX, z)
      column(B.maxX, z)
    }
    for (const x of [-6, 0, 6]) column(x, B.minZ)

    // Glass walls (sides + back) with truss mullions: posts halfway between columns,
    // a sill, a mid rail and a head rail.
    const pane = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0)
      const m = new Mesh(new PlaneGeometry(len, H - F - 0.4), glass)
      m.position.set((x0 + x1) / 2, (F + H) / 2, (z0 + z1) / 2)
      m.rotation.y = x0 === x1 ? Math.PI / 2 : 0
      m.renderOrder = 3
      add(m)
    }
    const trussPost = (x, z) => box(trussV, x - 0.18, F, z - 0.18, x + 0.18, H, z + 0.18)
    const railAlongZ = (x, y, z0, z1, t = 0.32) => box(trussH, x - 0.18, y - t / 2, z0, x + 0.18, y + t / 2, z1)
    const railAlongX = (z, y, x0, x1, t = 0.32) => box(trussH, x0, y - t / 2, z - 0.18, x1, y + t / 2, z + 0.18)
    for (const x of [B.minX, B.maxX]) {
      pane(x, B.minZ, x, B.maxZ)
      for (let i = 0; i < sideZ.length - 1; i++) trussPost(x, (sideZ[i] + sideZ[i + 1]) / 2)
      railAlongZ(x, F + 0.25, B.minZ, B.maxZ, 0.5)
      railAlongZ(x, (F + H) / 2 + 0.3, B.minZ, B.maxZ)
      railAlongZ(x, H - 0.25, B.minZ, B.maxZ, 0.5)
      solid(x - 0.25, F, B.minZ, x + 0.25, H, B.maxZ)
    }
    pane(B.minX, B.minZ, B.maxX, B.minZ)
    for (const x of [-9, -3, 3, 9]) trussPost(x, B.minZ)
    railAlongX(B.minZ, F + 0.25, B.minX, B.maxX, 0.5)
    railAlongX(B.minZ, (F + H) / 2 + 0.3, B.minX, B.maxX)
    railAlongX(B.minZ, H - 0.25, B.minX, B.maxX, 0.5)
    solid(B.minX, F, B.minZ - 0.25, B.maxX, H, B.minZ + 0.25)
    // ceiling light panels
    for (const x of [-6, 6]) for (const z of [-16, -8, 0]) box(panel, x - 1.6, H - 0.08, z - 0.6, x + 1.6, H - 0.01, z + 0.6, false)

    // --- Parking bays + green collect pads ---
    const y = n * S // bay heights are in the garage frame (not this floor's)
    for (const side of [-1, 1]) {
      for (let i = 0; i < BASE.slots; i++) {
        const z = B.minZ + 3.2 + i * 4.6
        const x0 = side < 0 ? B.minX + 0.9 : 4.6
        const x1 = side < 0 ? -4.6 : B.maxX - 0.9
        const edge = box(bayEdge, x0, F, z - 1.85, x1, F + 0.12, z + 1.85, false)
        const top = box(bayTop, x0 + 0.3, F + 0.12, z - 1.55, x1 - 0.3, F + 0.17, z + 1.55, false)
        const px = side * 3.4
        const pad = box(padMat, px - 0.55, F, z - 1.1, px + 0.55, F + 0.16, z + 1.1, false)
        const bay = { level: n, side, x0, x1, z0: z - 1.85, z1: z + 1.85, cx: (x0 + x1) / 2, cz: z, top: y + F + 0.17, pad: { x: px, z, hx: 0.55, hz: 1.1, top: y + F + 0.16, mesh: pad }, locked: null }
        bays.push(bay)
        const lock = BASE.lockedSlots.find((l) => l.bay === bays.length - 1)
        if (lock) {
          // Locked until bought: the bay and its pad are hidden; a glowing cyan studded
          // plate with an "[Upgrade] / 10th Slot / $price" sign stands in its place.
          edge.visible = top.visible = pad.visible = false
          const plate = new Group()
          const cx = bay.cx
          boxSpan(plate, upgradeMat, cx - 1.3, F, z - 1.3, cx + 1.3, F + 0.18, z + 1.3, { shadow: false })
          boxSpan(plate, upgradeEdge, cx - 1.45, F, z - 1.45, cx + 1.45, F + 0.1, z + 1.45, { shadow: false })
          plate.add(sparkleField({ count: 22, center: { x: cx, y: F + 0.2, z }, box: { x: 1.2, y: 0.6, z: 1.2 }, rise: 0.55, life: 2, drift: 0.12, size: 0.13, color: '#5ff0ff', seed: 300 + bays.length }))
          add(plate)
          const sign = spriteFrom(
            paintStack([
              { size: 50, parts: [{ text: '[Upgrade]', fill: '#ffb21a' }] },
              { size: 54, parts: [{ text: lock.label, fill: '#3ff0ff' }] },
              { size: 54, parts: [{ text: '$' + short(lock.price), fill: '#7dff3a' }] },
            ]),
            1.25,
          )
          sign.position.set(cx, F + 2.0, z)
          add(sign)
          bay.locked = { price: lock.price, label: lock.label, meshes: [edge, top, pad], plate, sign }
          for (const o of [edge, top, pad, plate]) live.add(o)
        }
      }
    }
    levels.push({ group: level, colliders })
  }

  // A staircase in the current floor's group; y0 = the floor it starts from, relative to that group.
  // Lego steps (drawn) over a ramp collider through the middle of each tread, with blocks under it
  // (no walking beneath) and a glass rail with a handrail along both sides.
  function buildStair(st, y0) {
    const n = ST.steps
    const run = ST.run / n
    const r = S / n
    const zA = ST.z0
    const zB = ST.z1
    const base = y0 + F
    const at = (u) => st.foot + st.dir * u // distance up the stair -> garage x
    for (let j = 0; j < n; j++) {
      const xa = at(j * run)
      const xb = at((j + 1) * run)
      box(skinSlab, Math.min(xa, xb), base - 0.02, zA, Math.max(xa, xb), base + r * (j + 1), zB)
    }
    // ramp: y = base + r * (u / run + 0.5), from u = -run / 2 (the floor) to the slab above
    const u0 = -run / 2
    const u1 = ST.run - run / 2
    const alpha = Math.atan2(S, u1 - u0)
    const theta = st.dir * alpha
    const len = Math.hypot(u1 - u0, S)
    const nx = -Math.sin(theta) // up-normal of the slope (x, y)
    const ny = Math.cos(theta)
    const mx = at((u0 + u1) / 2)
    const my = base + S / 2
    const t = 0.3
    solidTilt(mx - (nx * t) / 2, my - (ny * t) / 2, (zA + zB) / 2, len / 2, t / 2, (zB - zA) / 2, theta)
    // the last half tread, flush with the floor above
    solid(Math.min(at(u1), at(ST.run)), base + S - r, zA, Math.max(at(u1), at(ST.run)), base + S, zB)
    // blocks under the ramp, two steps each
    for (let j = 2; j < n; j += 2) {
      const xa = at(j * run)
      const xb = at(Math.min(n, j + 2) * run)
      solid(Math.min(xa, xb), base, zA, Math.max(xa, xb), base + r * j, zB)
    }
    // side rails: glass panel + handrail, parallel to the ramp
    const railH = 1.1
    for (const z of [zA - 0.06, zB + 0.06]) {
      const gp = tilted(glass, mx + nx * (railH / 2), my + ny * (railH / 2), z, len, railH, 0.08, theta, false)
      gp.renderOrder = 3
      tilted(skinRail, mx + nx * (railH + 0.07), my + ny * (railH + 0.07), z, len + 0.2, 0.14, 0.16, theta)
      solidTilt(mx + nx * ((railH + 0.14) / 2), my + ny * ((railH + 0.14) / 2), z, len / 2, (railH + 0.14) / 2, 0.06, theta)
      // newel posts at both ends
      for (const u of [0, ST.run]) box(skinFrame, at(u) - 0.1, base + (u ? S : 0), z - 0.1, at(u) + 0.1, base + (u ? S : 0) + railH + 0.25, z + 0.1)
    }
  }

  for (let n = 0; n <= FLOORS.length; n++) buildLevel(n)

  // --- Buy-a-floor plates: where the next staircase will stand, on the floor below it -----------------
  const floorPlates = FLOORS.map((spec, i) => {
    const n = i + 1
    const st = stairOf(n)
    const holder = new Group()
    holder.position.y = (n - 1) * S
    garage.add(holder)
    const cz = (ST.z0 + ST.z1) / 2
    boxSpan(holder, upgradeMat, st.x0 + 0.15, F, ST.z0 + 0.15, st.x1 - 0.15, F + 0.18, ST.z1 - 0.15, { shadow: false })
    boxSpan(holder, upgradeEdge, st.x0, F, ST.z0, st.x1, F + 0.1, ST.z1, { shadow: false })
    holder.add(sparkleField({ count: 26, center: { x: (st.x0 + st.x1) / 2, y: F + 0.2, z: cz }, box: { x: (st.x1 - st.x0) * 0.9, y: 0.8, z: 1.8 }, rise: 0.6, life: 2, drift: 0.12, size: 0.13, color: '#5ff0ff', seed: 500 + n }))
    const sign = spriteFrom(
      paintStack([
        { size: 50, parts: [{ text: '[Upgrade]', fill: '#ffb21a' }] },
        { size: 54, parts: [{ text: spec.label, fill: '#3ff0ff' }] },
        { size: 54, parts: [{ text: '$' + short(spec.price), fill: '#7dff3a' }] },
      ]),
      1.5,
    )
    sign.position.set((st.x0 + st.x1) / 2, F + 2.3, cz)
    holder.add(sign)
    holder.visible = false
    live.add(holder)
    // in garage design units, for the game's prompt
    return { n, label: spec.label, price: spec.price, level: n - 1, x0: st.x0, x1: st.x1, z0: ST.z0, z1: ST.z1, cx: (st.x0 + st.x1) / 2, cz, top: (n - 1) * S + F + 0.18, holder }
  })

  // --- Roof (rides on the highest floor bought) ------------------------------------------------------
  const roof = new Group()
  roof.name = 'garageRoof'
  garage.add(roof)
  const roofColliders = []
  into(roof, { inGarage: true, y: 0, colliders: roofColliders })
  const ov = 0.9
  const roofTop = H + 1.0
  box(skinSlab, B.minX - ov, H, B.minZ - ov, B.maxX + ov, roofTop, B.maxZ + ov)
  box(skinFrame, B.minX - ov - 0.05, H, B.maxZ + ov - 0.3, B.maxX + ov + 0.05, H + 0.35, B.maxZ + ov + 0.05) // front fascia lip
  solid(B.minX - ov, H, B.minZ - ov, B.maxX + ov, roofTop, B.maxZ + ov)
  // skylight recess: a sunken darker square with a raised lip
  const sk = { x0: -4.5, x1: 3.5, z0: -13, z1: -5 }
  const recess = new Mesh(new PlaneGeometry(sk.x1 - sk.x0, sk.z1 - sk.z0), brick('#6f7ba8', { roughness: 0.6 }))
  recess.rotation.x = -Math.PI / 2
  recess.position.set((sk.x0 + sk.x1) / 2, roofTop + 0.01, (sk.z0 + sk.z1) / 2)
  recess.receiveShadow = true
  add(recess)
  box(skinFrame, sk.x0 - 0.4, roofTop, sk.z0 - 0.4, sk.x1 + 0.4, roofTop + 0.3, sk.z0)
  box(skinFrame, sk.x0 - 0.4, roofTop, sk.z1, sk.x1 + 0.4, roofTop + 0.3, sk.z1 + 0.4)
  box(skinFrame, sk.x0 - 0.4, roofTop, sk.z0, sk.x0, roofTop + 0.3, sk.z1)
  box(skinFrame, sk.x1, roofTop, sk.z0, sk.x1 + 0.4, roofTop + 0.3, sk.z1)
  const roofAt = roofColliders.map((c) => ({ ...c.translation() }))

  // --- Owner billboard on the front edge of the roof ----------------------------------------------
  const bbW = 9.4
  const bbH = 4.8
  const bbZ = B.maxZ + ov - 0.2
  box(plastic('#262c42', 0.5), -bbW / 2, roofTop - 0.6, bbZ - 0.5, bbW / 2, roofTop - 0.6 + bbH, bbZ)
  const screenCanvas = Object.assign(document.createElement('canvas'), { width: 640, height: 320 })
  const screenTex = canvasTex(screenCanvas)
  let owner = null // null = a free garage
  let income = 0
  const paintScreen = () => {
    paintGarageScreen(screenCanvas, owner, income)
    screenTex.needsUpdate = true
  }
  paintScreen()
  fontReady.then(paintScreen)
  const screen = new Mesh(new PlaneGeometry(bbW - 0.7, bbH - 0.7), new MeshStandardMaterial({ map: screenTex, emissiveMap: screenTex, emissive: '#ffffff', emissiveIntensity: 0.55, roughness: 0.4 }))
  screen.position.set(0, roofTop - 0.6 + bbH / 2, bbZ + 0.02)
  add(screen)
  live.add(screen)

  // interior lights (distances are world metres, so they grow with the scale); ground floor only
  into(garage)
  const lights = []
  for (const z of [-14, -3]) {
    const l = new PointLight('#e8f2ff', 14, 22 * gs, 2)
    l.position.set(0, H - 1, z)
    add(l)
    lights.push(l)
  }
  const padGlow = new PointLight('#5dff2a', 6, 14 * gs, 2)
  padGlow.position.set(0, F + 1.5, -8)
  add(padGlow)
  into(g)
  // ===== end of garage =====

  // --- Conveyor ---------------------------------------------------------------------------------
  const Cv = BASE.conveyor
  const cz = Cv.z
  const half = Cv.belt / 2
  // The conveyor owns its materials so its skins (CONVEYOR_SKINS) can recolour them.
  // brick() caches by colour + options, hence the odd roughness values: they keep
  // these from being the same objects as the garage's concrete.
  const wallMat = brick(CONCRETE, { roughness: 0.601 })
  const tunnelBody = brick(CONCRETE, { roughness: 0.602 })
  const tunnelCap = brick(CONCRETE_LIGHT, { roughness: 0.603 })
  const beltMat = brick('#262b38', { roughness: 0.851, strength: 0.8 })
  const beltY = 0.28
  box(brick('#4a5270', { roughness: 0.8 }), Cv.from, -0.2, cz - half, Cv.to, beltY - 0.02, cz + half, false)
  const belt = new Mesh(new PlaneGeometry(Cv.to - Cv.from, Cv.belt), beltMat)
  belt.rotation.x = -Math.PI / 2
  belt.position.set((Cv.from + Cv.to) / 2, beltY, cz)
  belt.receiveShadow = true
  g.add(belt)
  // moving chevrons on the belt
  const chev = document.createElement('canvas')
  chev.width = chev.height = 128
  const cg = chev.getContext('2d')
  cg.strokeStyle = '#ffffff'
  cg.lineWidth = 16
  cg.beginPath()
  cg.moveTo(40, 20)
  cg.lineTo(88, 64)
  cg.lineTo(40, 108)
  cg.stroke()
  const chevTex = new CanvasTexture(chev)
  chevTex.wrapS = chevTex.wrapT = RepeatWrapping
  const chevLen = 2.6
  chevTex.repeat.set((Cv.to - Cv.from) / chevLen, 1)
  const chevrons = new Mesh(new PlaneGeometry(Cv.to - Cv.from, Cv.belt * 0.86), new MeshStandardMaterial({ color: '#11141c', alphaMap: chevTex, transparent: true, opacity: 0.75, depthWrite: false, roughness: 0.9 }))
  chevrons.rotation.x = -Math.PI / 2
  chevrons.position.set((Cv.from + Cv.to) / 2, beltY + 0.01, cz)
  chevrons.renderOrder = 2
  g.add(chevrons)
  // walls
  for (const s of [-1, 1]) {
    const z0 = s < 0 ? cz - half - Cv.wall : cz + half
    const z1 = s < 0 ? cz - half : cz + half + Cv.wall
    box(wallMat, Cv.from, -0.2, z0, Cv.to, Cv.wallHeight, z1)
    solid(Cv.from, 0, z0, Cv.to, Cv.wallHeight, z1)
  }
  solid(Cv.from, 0, cz - half, Cv.to, beltY, cz + half)
  // tunnel boxes at both ends, opening onto the belt
  const tb = Cv.box
  const tunnelMat = new MeshStandardMaterial({ color: '#07080c', roughness: 1 })
  const frameMat = brick(STEEL, { roughness: 0.551 })
  for (const end of [-1, 1]) {
    const inner = end < 0 ? Cv.from : Cv.to
    const outer = inner + end * tb.length
    const xa = Math.min(inner, outer)
    const xb = Math.max(inner, outer)
    box(tunnelBody, xa, -0.2, cz - tb.width / 2, xb, tb.height, cz + tb.width / 2)
    box(tunnelCap, xa - 0.15, tb.height, cz - tb.width / 2 - 0.15, xb + 0.15, tb.height + 0.3, cz + tb.width / 2 + 0.15) // cap
    solid(xa, 0, cz - tb.width / 2, xb, tb.height + 0.3, cz + tb.width / 2)
    // the dark tunnel mouth + its frame, on the belt side
    const mouth = new Mesh(new PlaneGeometry(Cv.belt + 0.2, 2.35), tunnelMat)
    mouth.position.set(inner + end * -0.02, beltY + 1.17, cz)
    mouth.rotation.y = end < 0 ? Math.PI / 2 : -Math.PI / 2
    g.add(mouth)
    const fx = inner - end * 0.12
    box(frameMat, Math.min(fx, inner), beltY + 2.35, cz - half - 0.45, Math.max(fx, inner) + 0.001, beltY + 2.75, cz + half + 0.45)
    for (const s of [-1, 1]) box(frameMat, Math.min(fx, inner), beltY, cz + s * (half + 0.1) - 0.35, Math.max(fx, inner) + 0.001, beltY + 2.75, cz + s * (half + 0.1) + 0.35)
  }


  // --- Conveyor skins: the look evolves with the conveyor upgrade level ------------------------------------
  // Each tier recolours the conveyor materials and shows its own prop group:
  // trim (lime lego bands), neon (cyan edges + antenna orbs), ufo (spinning
  // saucers on the tunnels), temple (bronze towers, glowing domes, turning gears).
  const TAU = Math.PI * 2
  const tunnels = [-1, 1].map((end) => {
    const inner = end < 0 ? Cv.from : Cv.to
    const outer = inner + end * tb.length
    return { end, inner, xa: Math.min(inner, outer), xb: Math.max(inner, outer), xc: (inner + outer) / 2 }
  })
  const zA = cz - tb.width / 2
  const zB = cz + tb.width / 2
  const topY = tb.height + 0.3
  const innerWallZ = [cz - half, cz + half] // the belt-side face of each wall
  const decos = {}
  const spinners = [] // { obj, speed, axis, bob, y }
  const glowMats = [] // pulsing emissive materials of the current skin
  const deco = (name, build) => {
    const grp = new Group()
    grp.name = `conveyorSkin:${name}`
    grp.visible = false
    build(grp)
    g.add(grp)
    decos[name] = grp
  }
  const wallStrip = (d, mat, h = 0.14) => {
    for (const z of innerWallZ) {
      const zo = z < cz ? z - Cv.wall : z
      boxSpan(d, mat, Cv.from, Cv.wallHeight, zo, Cv.to, Cv.wallHeight + h, zo + Cv.wall, { shadow: false })
    }
  }
  const sphere = (r, mat, x, y, z, hemi = false) => {
    const m = new Mesh(new SphereGeometry(r, 20, 12, 0, TAU, 0, hemi ? Math.PI / 2 : Math.PI), mat)
    m.position.set(x, y, z)
    return m
  }
  function gear(r, mat, hubMat) {
    const grp = new Group()
    const disk = new Mesh(new CylinderGeometry(r, r, 0.22, 20), mat)
    disk.rotation.x = Math.PI / 2
    disk.castShadow = true
    grp.add(disk)
    const teeth = 10
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * TAU
      const t = new Mesh(new BoxGeometry(0.34, 0.34, 0.22), mat)
      t.position.set(Math.cos(a) * (r + 0.12), Math.sin(a) * (r + 0.12), 0)
      t.rotation.z = a
      grp.add(t)
    }
    const hub = new Mesh(new CylinderGeometry(r * 0.32, r * 0.32, 0.32, 12), hubMat)
    hub.rotation.x = Math.PI / 2
    grp.add(hub)
    return grp
  }

  deco('trim', (d) => {
    const lime = brick('#43e83a', { roughness: 0.452 })
    wallStrip(d, lime)
    for (const t of tunnels) {
      boxSpan(d, lime, t.xa - 0.1, 1.15, zA - 0.1, t.xb + 0.1, 1.55, zB + 0.1)
      boxSpan(d, lime, t.xa - 0.1, 2.45, zA - 0.1, t.xb + 0.1, 2.7, zB + 0.1)
    }
  })

  deco('neon', (d) => {
    const cyan = neon('#22e5ff', 3)
    const lime = brick('#5cff2a', { roughness: 0.453 })
    wallStrip(d, lime, 0.1)
    for (const z of innerWallZ) boxSpan(d, cyan, Cv.from, Cv.wallHeight + 0.1, z - 0.07, Cv.to, Cv.wallHeight + 0.2, z + 0.07, { shadow: false })
    for (const t of tunnels) {
      for (const x of [t.xa, t.xb]) for (const z of [zA, zB]) boxSpan(d, cyan, x - 0.1, 0, z - 0.1, x + 0.1, topY + 0.02, z + 0.1, { shadow: false })
      for (const z of [zA - 0.04, zB + 0.04]) boxSpan(d, cyan, t.xa, 1.75, z - 0.05, t.xb, 1.9, z + 0.05, { shadow: false })
      boxSpan(d, brick('#1b8fb0', { roughness: 0.554 }), t.xc - 0.09, topY, cz - 0.09, t.xc + 0.09, topY + 1.3, cz + 0.09)
      d.add(sphere(0.3, cyan, t.xc, topY + 1.45, cz))
      for (const s of [-1, 1]) d.add(sphere(0.18, cyan, t.xc + s * 1.2, topY + 0.2, cz + s * 1.6))
    }
  })

  deco('ufo', (d) => {
    const metal = new MeshStandardMaterial({ color: '#c3cbe0', metalness: 0.75, roughness: 0.25 })
    const dark = new MeshStandardMaterial({ color: '#4b5372', metalness: 0.5, roughness: 0.4 })
    const glassM = new MeshPhysicalMaterial({ color: '#8ff7ff', transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.1, clearcoat: 1, depthWrite: false })
    const pink = neon('#ff3fd8', 3)
    const lime = neon('#5dff4a', 2.6)
    for (const z of innerWallZ) boxSpan(d, pink, Cv.from, Cv.wallHeight - 0.02, z - 0.07, Cv.to, Cv.wallHeight + 0.08, z + 0.07, { shadow: false })
    for (const t of tunnels) {
      for (const z of [zA - 0.04, zB + 0.04]) boxSpan(d, pink, t.xa, 0.9, z - 0.05, t.xb, 1.02, z + 0.05, { shadow: false })
      boxSpan(d, dark, t.xc - 0.18, topY, cz - 0.18, t.xc + 0.18, topY + 1.35, cz + 0.18)
      const ufo = new Group()
      ufo.position.set(t.xc, topY + 1.65, cz)
      const disk = new Mesh(new CylinderGeometry(2.5, 1.1, 0.55, 36), metal)
      disk.castShadow = true
      ufo.add(disk)
      const top = new Mesh(new CylinderGeometry(1.3, 2.5, 0.25, 36), metal)
      top.position.y = 0.4
      ufo.add(top)
      const rim = new Mesh(new TorusGeometry(2.45, 0.12, 8, 44), pink)
      rim.rotation.x = Math.PI / 2
      rim.position.y = 0.05
      ufo.add(rim)
      ufo.add(sphere(1.15, glassM, 0, 0.5, 0, true))
      ufo.add(sphere(0.35, lime, 0, 0.75, 0))
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU
        ufo.add(sphere(0.13, lime, Math.cos(a) * 1.75, -0.24, Math.sin(a) * 1.75))
      }
      d.add(ufo)
      spinners.push({ obj: ufo, speed: 0.7 * t.end, axis: 'y', bob: 0.12, y: ufo.position.y })
    }
  })

  deco('temple', (d) => {
    const bronze = brick('#8a7448', { roughness: 0.71 })
    const dark = brick('#4f4128', { roughness: 0.72 })
    const goldM = new MeshStandardMaterial({ color: '#e0a628', metalness: 0.7, roughness: 0.3, emissive: '#7a4a00', emissiveIntensity: 0.4 })
    const ember = neon('#ff9a1a', 2.8)
    const domeM = new MeshStandardMaterial({ color: '#ffb02e', emissive: '#ff7a00', emissiveIntensity: 0.9, roughness: 0.18, metalness: 0.2 })
    glowMats.push(domeM)
    wallStrip(d, dark, 0.22)
    for (const z of innerWallZ) boxSpan(d, ember, Cv.from, Cv.wallHeight + 0.22, z - 0.05, Cv.to, Cv.wallHeight + 0.3, z + 0.05, { shadow: false })
    for (const t of tunnels) {
      // stepped tower: plinth, drum, ember ring, glowing dome, spire
      boxSpan(d, dark, t.xa + 0.2, topY, zA + 0.2, t.xb - 0.2, topY + 0.55, zB - 0.2)
      boxSpan(d, bronze, t.xa + 0.6, topY + 0.55, zA + 0.6, t.xb - 0.6, topY + 1.0, zB - 0.6)
      const drum = new Mesh(new CylinderGeometry(1.25, 1.45, 1.1, 14), bronze)
      drum.position.set(t.xc, topY + 1.55, cz)
      drum.castShadow = true
      d.add(drum)
      const ring = new Mesh(new TorusGeometry(1.3, 0.11, 8, 28), ember)
      ring.rotation.x = Math.PI / 2
      ring.position.set(t.xc, topY + 2.1, cz)
      d.add(ring)
      d.add(sphere(1.2, domeM, t.xc, topY + 2.1, cz, true))
      // corner pillars with ember caps
      for (const x of [t.xa + 0.35, t.xb - 0.35]) {
        for (const z of [zA + 0.35, zB - 0.35]) {
          boxSpan(d, dark, x - 0.3, 0, z - 0.3, x + 0.3, topY + 0.7, z + 0.3)
          d.add(sphere(0.2, ember, x, topY + 0.85, z))
        }
      }
      // gears turning on both long sides
      for (const s of [-1, 1]) {
        const g1 = gear(0.95, goldM, dark)
        g1.position.set(t.xc - 0.55, 1.55, cz + s * (tb.width / 2 + 0.16))
        d.add(g1)
        spinners.push({ obj: g1, speed: 0.9 * s, axis: 'z' })
        const g2 = gear(0.55, goldM, dark)
        g2.position.set(t.xc + 0.95, 2.45, cz + s * (tb.width / 2 + 0.16))
        d.add(g2)
        spinners.push({ obj: g2, speed: -1.6 * s, axis: 'z' })
      }
    }
  })
  let skin = -1
  const tunnelTop = new Vector3()

  // --- Blocks on the belt ------------------------------------------------------------------------
  const faceMats = {}
  const faceMat = (key) => {
    if (!faceMats[key]) {
      const face = paintBlockFace(BLOCK_THEMES[key])
      const tex = canvasTex(face.canvas)
      faceMats[key] = new MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.22, roughness: 0.4 })
      fontReady.then(() => {
        face.draw()
        tex.needsUpdate = true
      })
    }
    return faceMats[key]
  }
  // A variant block (event mutation, MUTATIONS) glows in the variant's colour.
  const MUT = Object.fromEntries(MUTATIONS.map((m) => [m.id, m]))
  const variantMats = {}
  const blockMat = (key, variant) => {
    if (!variant || variant === 'Normal' || !MUT[variant]) return faceMat(key)
    const k = `${key}|${variant}`
    if (!variantMats[k]) {
      const m = faceMat(key).clone()
      m.emissive.set(MUT[variant].color)
      m.emissiveIntensity = 0.6
      variantMats[k] = m
    }
    return variantMats[k]
  }
  const variantTex = {}
  const variantLabel = (variant) => {
    if (!variantTex[variant]) {
      const fill = variant === 'Rainbow' ? ['#ff3b4e', '#ffd21a', '#2dd84a', '#2f9bff', '#b23cff'] : MUT[variant].color
      const st = paintStack([{ size: 60, parts: [{ text: variant, fill }] }], { width: 480 })
      const tex = new CanvasTexture(st.canvas)
      tex.colorSpace = SRGBColorSpace
      variantTex[variant] = { tex, st }
      fontReady.then(() => {
        st.draw()
        tex.needsUpdate = true
      })
    }
    return variantTex[variant]
  }
  let variantRoll = null // () => variant id | null, set by the event system
  const labels = {}
  const labelFor = (key) => (labels[key] ??= { lines: blockLabelLines(BLOCK_THEMES[key]) })
  const rand = mulberry32(4242)
  const span = Cv.to - Cv.from + tb.length * 1.2 // a block travels this far before it recycles
  const count = Math.ceil(span / Cv.spacing)
  const loop = count * Cv.spacing
  const startX = Cv.from - tb.length * 0.6
  const blockGeo = new BoxGeometry(1.7, 1.7, 1.7)
  const blocks = []
  for (let i = 0; i < count; i++) {
    const holder = new Group()
    const cube = new Mesh(blockGeo, faceMat('gold'))
    cube.castShadow = true
    holder.add(cube)
    const label = new Sprite(new SpriteMaterial({ transparent: true, depthWrite: false, fog: false }))
    label.position.y = 2.25
    holder.add(label)
    const sparkle = sparkleField({ count: 16, center: { x: 0, y: -0.9, z: 0 }, box: { x: 1.1, y: 1.8, z: 1.1 }, rise: 0.6, life: 1.6, drift: 0.15, size: 0.22, color: '#ffffff', seed: 900 + i })
    holder.add(sparkle)
    const vlabel = new Sprite(new SpriteMaterial({ transparent: true, depthWrite: false, fog: false }))
    vlabel.position.y = 3.25
    vlabel.visible = false
    holder.add(vlabel)
    holder.position.set(startX + i * Cv.spacing, beltY + 0.85, cz)
    g.add(holder)
    blocks.push({ holder, cube, label, vlabel, sparkle, key: null, variant: null, taken: false, travelled: i * Cv.spacing, phase: rand() * 6 })
  }
  // shared label textures per theme
  const labelTex = {}
  const labelSprite = (key) => {
    if (!labelTex[key]) {
      const st = paintStack(labelFor(key).lines, { width: 600 })
      const tex = new CanvasTexture(st.canvas)
      tex.colorSpace = SRGBColorSpace
      labelTex[key] = { tex, st }
      fontReady.then(() => {
        st.draw()
        tex.dispose()
        tex.needsUpdate = true
      })
    }
    return labelTex[key]
  }
  let onAnnounce = null
  let luck = 1
  const assign = (b, key, announce) => {
    b.key = key
    const t = BLOCK_THEMES[key]
    const variant = (announce && variantRoll?.()) || null
    b.variant = variant
    b.cube.material = blockMat(key, variant)
    if (variant) {
      const vt = variantLabel(variant)
      b.vlabel.material.map = vt.tex
      b.vlabel.material.needsUpdate = true
      b.vlabel.scale.set((0.8 * vt.st.canvas.width) / vt.st.canvas.height, 0.8, 1)
    }
    const lt = labelSprite(key)
    b.label.material.map = lt.tex
    b.label.material.needsUpdate = true
    const h = 1.35
    b.label.scale.set((h * lt.st.canvas.width) / lt.st.canvas.height, h, 1)
    const rare = t.rarity !== 'Common'
    b.sparkle.visible = rare || !!variant
    b.sparkle.material.uniforms.uColor.value.set(variant ? MUT[variant].color : t.glow)
    if (announce && t.announce) onAnnounce?.(`${t.name} has spawned!`)
  }
  for (const b of blocks) assign(b, pickTheme(rand), false)

  // --- Limited cars --------------------------------------------------------------------------------
  const cars = []
  for (const spec of BASE.limitedCars) {
    const car = buildCar(spec.car)
    car.scale.setScalar(1.18)
    car.position.set(spec.x, 0.02, spec.z)
    car.rotation.y = spec.yaw
    g.add(car)
    const [wx, wz] = toWorld(spec.x, spec.z)
    solidBox(2.7, 0.7, 1.2, wx, 0.7, wz, yaw + spec.yaw)
    const sign = spriteFrom(
      paintStack([
        { size: 52, parts: [{ text: 'LIMITED ', fill: ['#7d4bff', '#3cc8ff', '#5dff4a'] }, { text: 'CAR', fill: '#ff2b3a' }] },
        { size: 54, parts: [{ text: spec.name, fill: '#ffffff' }] },
        { size: 50, parts: [{ text: 'Exclusive', fill: ['#ff3b4e', '#ff3fc8', '#8b2cff', '#3c9cff'] }] },
        { size: 46, parts: [{ text: `${spec.bonus}% of your best Car`, fill: '#ffe14a' }] },
      ]),
      2.6,
    )
    sign.position.set(spec.x, 3.6, spec.z)
    g.add(sign)
    const tag = spriteFrom(paintStack([{ size: 40, parts: [{ text: 'UNSTEALABLE!', fill: '#ff2b3a' }] }], { width: 360 }), 0.42)
    tag.position.set(spec.x + (spec.x < 0 ? 1.6 : -1.6), 1.55, spec.z + 0.6)
    g.add(tag)
    g.add(sparkleField({ count: 18, center: { x: spec.x, y: 0.1, z: spec.z }, box: { x: 2.6, y: 1.4, z: 1.4 }, rise: 0.5, life: 2.6, size: 0.2, color: spec.car === 'bolido' ? '#3ff0ff' : '#ff8a3a', seed: spec.bonus }))
    cars.push(car)
  }

  // --- Bake: every static mesh merged per material (six garages on the island; mobile) ----------
  // Kept live: the conveyor's blocks and skin props, a locked bay's hidden meshes and its plate,
  // the buy-a-floor plates and the billboard screen. Each floor and the roof are baked on their
  // own (a floor shows once bought, the roof moves up).
  for (const o of [...blocks.map((b) => b.holder), ...Object.values(decos)]) live.add(o)
  const sections = [...levels.map((l) => l.group), roof]
  const bakeSection = (root, skip) => {
    const casters = []
    const flat = []
    const collect = (o) => {
      if (skip.has(o)) return
      if (o.isMesh && !Array.isArray(o.material)) (o.castShadow ? casters : flat).push(o)
      for (const c of o.children) collect(c)
    }
    for (const c of root.children) collect(c)
    for (const [list, cast] of [[casters, true], [flat, false]]) {
      if (!list.length) continue
      const baked = bakeMeshes(list, root, cast)
      baked.traverse((o) => o.isMesh && (o.receiveShadow = true))
      for (const m of list) m.parent.remove(m)
      root.add(baked)
    }
  }
  bakeSection(g, new Set([...live, ...sections]))
  for (const s of sections) bakeSection(s, live)

  // --- Floors bought (setFloors) and skin (setSkin) ----------------------------------------------
  let floors = -1
  function showFloors(n) {
    n = Math.max(0, Math.min(FLOORS.length, n | 0))
    if (n === floors) return false
    floors = n
    levels.forEach((l, i) => {
      const on = i <= n
      l.group.visible = on
      for (const c of l.colliders) c.setEnabled(on)
    })
    for (const p of floorPlates) p.holder.visible = p.n === n + 1
    roof.position.y = n * S
    roofColliders.forEach((c, i) => c.setTranslation({ x: roofAt[i].x, y: roofAt[i].y + n * S * gs, z: roofAt[i].z }))
    return true
  }
  showFloors(0)
  let skinId = null
  let rainbow = false
  const skinMats = { frame: [skinFrame, skinRail], truss: [trussV, trussH], slab: [skinSlab], glass: [glass], bay: [bayEdge], bayTop: [bayTop] }
  function applySkin(id) {
    const sk = GARAGE_SKINS.find((s) => s.id === id) ?? GARAGE_SKINS[0]
    if (sk.id === skinId) return false
    skinId = sk.id
    for (const key in skinMats) for (const m of skinMats[key]) m.color.set(sk.colors[key])
    rainbow = !!sk.rainbow
    return true
  }
  applySkin(GARAGE_SKINS[0].id)

  scene.add(g)

  const [sx, sz] = toWorld(0, floorFront + 5)
  const spot = { x: sx, z: sz, facing: yaw + Math.PI } // on the apron, facing the garage
  let night = 0

  const v = new Vector3()
  return {
    group: g,
    garage,
    yaw,
    spot,
    bays,
    storey: S, // garage units between two floors
    floorPlates, // per extra floor: where it is bought (garage units) and its price
    get floors() {
      return floors
    },
    // Shows the first n extra floors (BASE.floors) with their stairs and colliders, the roof on
    // top and the plate to buy the next one; animate = sparks on the new floor.
    setFloors(n, animate = false) {
      const before = floors
      if (!showFloors(n) || !animate || !bursts || floors <= before) return
      for (let f = before + 1; f <= floors; f++) {
        for (const x of [-8, 0, 8]) {
          const p = garage.localToWorld(v.set(x, f * S + F + 1, -8))
          bursts.emit(p.x, p.y, p.z, '#5ff0ff', 30, 8)
          bursts.emit(p.x, p.y + 2, p.z, '#ffffff', 16, 6)
        }
      }
    },
    get skin() {
      return skinId
    },
    // Recolours the garage (GARAGE_SKINS id); animate = sparks around it.
    setSkin(id, animate = false) {
      if (!applySkin(id) || !animate || !bursts) return
      for (let f = 0; f <= floors; f++) {
        for (const x of [B.minX, 0, B.maxX]) {
          const p = garage.localToWorld(v.set(x, f * S + H * 0.6, 0))
          bursts.emit(p.x, p.y, p.z, GARAGE_SKINS.find((s) => s.id === skinId).colors.frame, 30, 8)
        }
      }
    },
    blocks,
    beltY,
    blockMaterial: blockMat, // (theme, variant?)
    // fn() -> variant id or null for each block that comes out of the tunnel (game/events.js).
    setVariantRoller(fn) {
      variantRoll = fn
    },
    // Garage design units -> the base group's own (unscaled) frame.
    garageToBase(x, y, z, out = new Vector3()) {
      return out.set(x * gs, y * gs, z * gs + BASE.garageOffsetZ)
    },
    // A world point -> garage design units.
    worldToGarage(p, out = new Vector3()) {
      return garage.worldToLocal(out.copy(p))
    },
    blockWorld(b, out = new Vector3()) {
      return b.holder.getWorldPosition(out)
    },
    // Can this belt block be bought right now (out on the belt, not taken)?
    onBelt(b) {
      const x = b.holder.position.x
      return !b.taken && x > Cv.from + 0.4 && x < Cv.to - 0.4
    },
    takeBlock(b) {
      b.taken = true
      b.holder.visible = false
      if (bursts) {
        const p = b.holder.getWorldPosition(v)
        bursts.emit(p.x, p.y, p.z, BLOCK_THEMES[b.key].glow, 16, 3)
      }
    },
    // Opens a locked bay (bought, or restored from the save).
    unlockBay(i, animate = true) {
      const lock = bays[i]?.locked
      if (!lock || lock.open) return
      lock.open = true
      for (const m of lock.meshes) m.visible = true
      lock.plate.visible = false
      lock.sign.visible = false
      if (animate && bursts) {
        const p = garage.localToWorld(v.set(bays[i].cx, bays[i].top + 0.5, bays[i].cz))
        bursts.emit(p.x, p.y, p.z, '#5ff0ff', 40, 6)
        bursts.emit(p.x, p.y, p.z, '#7dff3a', 24, 4)
      }
    },
    // Locks a bought bay again (the garage changed hands).
    lockBay(i) {
      const lock = bays[i]?.locked
      if (!lock || !lock.open) return
      lock.open = false
      for (const m of lock.meshes) m.visible = false
      lock.plate.visible = true
      lock.sign.visible = true
    },
    // Shows conveyor skin i (CONVEYOR_SKINS); animate = burst of sparks at the tunnels.
    setConveyorSkin(i, animate = false) {
      const sk = CONVEYOR_SKINS[Math.max(0, Math.min(CONVEYOR_SKINS.length - 1, i))]
      if (!sk || i === skin) return
      skin = i
      wallMat.color.set(sk.wall)
      tunnelBody.color.set(sk.body)
      tunnelCap.color.set(sk.cap)
      frameMat.color.set(sk.frame)
      beltMat.color.set(sk.belt)
      for (const name in decos) decos[name].visible = name === sk.deco
      if (animate && bursts) {
        for (const t of tunnels) {
          g.localToWorld(tunnelTop.set(t.xc, topY + 1, cz))
          bursts.emit(tunnelTop.x, tunnelTop.y, tunnelTop.z, '#ffffff', 30, 7)
          bursts.emit(tunnelTop.x, tunnelTop.y, tunnelTop.z, '#ffe14a', 30, 9)
        }
      }
    },
    conveyorWorld(out = new Vector3()) {
      return g.localToWorld(out.set(0, 2, cz))
    },
    setLuck(v) {
      luck = v
    },
    setIncome(perSecond) {
      if (income === perSecond) return
      income = perSecond
      paintScreen()
    },
    // The name on the billboard; null = a free garage.
    setOwner(name) {
      if (owner === name) return
      owner = name
      paintScreen()
    },
    // Interior point lights: only the local player's garage has them (each one costs every lit
    // material in the scene).
    setLit(on) {
      for (const l of lights) l.visible = on
      padGlow.visible = on
    },
    onAnnounce(fn) {
      onAnnounce = fn
    },
    setNight(n) {
      night = n
      for (const l of lights) l.intensity = 34 + n * 60
      padGlow.intensity = 14 + n * 30
    },
    update(dt, elapsed) {
      chevTex.offset.x -= (dt * Cv.speed) / chevLen
      for (const sp of spinners) {
        if (!sp.obj.parent.visible) continue
        if (sp.axis === 'y') sp.obj.rotation.y += sp.speed * dt
        else sp.obj.rotation.z += sp.speed * dt
        if (sp.bob) sp.obj.position.y = sp.y + Math.sin(elapsed * 1.6 + sp.speed) * sp.bob
      }
      for (const m of glowMats) m.emissiveIntensity = 0.75 + Math.sin(elapsed * 2.2) * 0.25
      const pulse = 0.35 + Math.sin(elapsed * 2.4) * 0.15 + night * 0.4
      padMat.emissiveIntensity = pulse
      upgradeMat.emissiveIntensity = 0.45 + Math.sin(elapsed * 3.2) * 0.2 + night * 0.4
      if (rainbow) {
        const hue = (elapsed * 0.07) % 1
        skinFrame.color.setHSL(hue, 0.85, 0.52)
        skinRail.color.setHSL(hue, 0.85, 0.52)
        trussV.color.setHSL((hue + 0.33) % 1, 0.9, 0.72)
        trussH.color.setHSL((hue + 0.33) % 1, 0.9, 0.72)
        glass.color.setHSL((hue + 0.66) % 1, 0.7, 0.85)
      }
      for (const b of blocks) {
        b.travelled += dt * Cv.speed
        if (b.travelled >= loop) {
          b.travelled -= loop
          b.taken = false
          assign(b, pickTheme(rand, luck), true)
        }
        const x = startX + b.travelled
        const prevX = b.holder.position.x
        b.holder.position.x = x
        // puffs where a block comes out of the entry tunnel / goes into the exit one
        if (bursts && ((prevX < Cv.from && x >= Cv.from) || (prevX < Cv.to - 0.9 && x >= Cv.to - 0.9))) {
          const [wx, wz] = toWorld(x < 0 ? Cv.from + 0.5 : Cv.to - 0.6, cz)
          bursts.emit(wx, beltY + 0.9, wz, BLOCK_THEMES[b.key].glow, 10, 2.2)
        }
        b.cube.position.y = Math.sin(elapsed * 2 + b.phase) * 0.06
        b.cube.rotation.y = Math.sin(elapsed * 0.9 + b.phase) * 0.12
        b.cube.rotation.z = Math.sin(elapsed * 1.3 + b.phase) * 0.04
        // only drawn between the tunnels; the label only while it is out on the belt
        b.holder.visible = !b.taken && x > Cv.from - tb.length + 1 && x < Cv.to + tb.length - 1
        b.label.visible = x > Cv.from - 0.3 && x < Cv.to + 0.3
        b.vlabel.visible = b.label.visible && !!b.variant
      }
    },
  }
}
