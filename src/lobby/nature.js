import { BoxGeometry, Group, Mesh } from 'three'
import { LOBBY } from '../config.js'
import { mulberry32 } from '../textures.js'
import { bake } from '../bake.js'
import { brick } from '../lego.js'
import { solidBox, solidPole } from '../propkit.js'

// Blocky lego trees (bent trunk of stacked bricks, layered studded canopies,
// sometimes a side branch with its own canopy), stacked-plate pines, flowering
// bushes and rocks made of stacked pale-blue plates. Scattered with a seeded
// PRNG away from the road, plaza, plots and shop, then baked to one mesh per
// material so the whole forest is a handful of draw calls.

const C = LOBBY.colors

function part(parent, mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new Mesh(new BoxGeometry(w, h, d), mat)
  m.position.set(x, y, z)
  m.rotation.set(rx, ry, rz)
  parent.add(m)
  return m
}

function tree(rand, s) {
  const g = new Group()
  const trunk = brick(C.trunk, { roughness: 0.8 })
  const trunkDark = brick(C.trunkDark, { roughness: 0.85 })
  const leaves = brick(C.leaves, { roughness: 0.6 })
  const leavesLight = brick(C.leavesLight, { roughness: 0.6 })

  // Root flare, then a trunk of 3-4 bricks that drifts sideways as it climbs.
  part(g, trunkDark, 1.7 * s, 0.5 * s, 1.7 * s, 0, 0.25 * s, 0)
  const segs = 3 + Math.floor(rand() * 2)
  const lean = (rand() - 0.5) * 0.9 * s
  const leanZ = (rand() - 0.5) * 0.6 * s
  let x = 0
  let y = 0.5 * s
  let z = 0
  for (let i = 0; i < segs; i++) {
    const h = (1.35 + rand() * 0.5) * s
    part(g, i % 2 ? trunkDark : trunk, 1.05 * s, h, 1.05 * s, x, y + h / 2, z)
    y += h
    x += lean * (0.5 + i * 0.35)
    z += leanZ * (0.4 + i * 0.25)
  }

  // Main canopy: wide plate, a narrower plate offset on top, a cap.
  const w = (5.2 + rand() * 1.8) * s
  const d = (4.4 + rand() * 1.4) * s
  part(g, leaves, w, 1.05 * s, d, x, y + 0.4 * s, z)
  part(g, leaves, w * 0.92, 0.7 * s, d * 0.86, x + 0.3 * s, y - 0.35 * s, z - 0.2 * s)
  const ox = (rand() - 0.5) * 1.2 * s
  const oz = (rand() - 0.5) * 1.0 * s
  part(g, leavesLight, w * 0.62, 0.95 * s, d * 0.66, x + ox, y + 1.35 * s, z + oz)
  part(g, leavesLight, w * 0.3, 0.7 * s, d * 0.34, x + ox * 1.4, y + 2.1 * s, z + oz * 1.2)
  // A few loose leaf bricks hanging off the edges.
  for (let i = 0; i < 3; i++) {
    const a = rand() * Math.PI * 2
    part(g, leaves, 1.2 * s, 0.6 * s, 1.2 * s, x + Math.cos(a) * w * 0.48, y - 0.1 * s, z + Math.sin(a) * d * 0.48)
  }

  // Side branch with a smaller canopy, on most trees.
  if (rand() < 0.75) {
    const dir = rand() < 0.5 ? -1 : 1
    const by = 0.5 * s + (segs - 1.6) * 1.45 * s
    const len = (2.2 + rand()) * s
    part(g, trunk, len, 0.7 * s, 0.7 * s, dir * len * 0.42, by, 0.2 * s, 0, 0, dir * 0.55)
    const bx = dir * len * 0.85
    const bTop = by + len * 0.3
    part(g, leaves, 3.1 * s, 0.9 * s, 2.8 * s, bx, bTop + 0.3 * s, 0.2 * s)
    part(g, leavesLight, 1.9 * s, 0.7 * s, 1.7 * s, bx + dir * 0.2 * s, bTop + 1.05 * s, 0.1 * s)
  }
  return g
}

function pine(rand, s) {
  const g = new Group()
  const trunk = brick(C.trunkDark, { roughness: 0.85 })
  const leaves = brick('#2fae22', { roughness: 0.6 })
  const leavesLight = brick(C.leavesLight, { roughness: 0.6 })
  part(g, trunk, 0.8 * s, 2.2 * s, 0.8 * s, 0, 1.1 * s, 0)
  const tiers = 5 + Math.floor(rand() * 2)
  let y = 1.6 * s
  for (let i = 0; i < tiers; i++) {
    const k = 1 - i / tiers
    const size = (0.9 + 2.9 * k) * s
    part(g, i % 2 ? leavesLight : leaves, size, 0.55 * s, size, 0, y, 0, 0, i % 2 ? Math.PI / 4 : 0, 0)
    part(g, trunk, 0.5 * s, 0.6 * s, 0.5 * s, 0, y + 0.55 * s, 0)
    y += 1.0 * s
  }
  part(g, leavesLight, 0.6 * s, 0.9 * s, 0.6 * s, 0, y, 0)
  return g
}

const FLOWERS = ['#ff3b4e', '#3a6dff', '#ffffff', '#ff8ad1', '#ffd23a']
function bush(rand, s) {
  const g = new Group()
  const leaves = brick(C.leavesLight, { roughness: 0.6 })
  const dark = brick(C.leaves, { roughness: 0.6 })
  const n = 2 + Math.floor(rand() * 2)
  for (let i = 0; i < n; i++) {
    const w = (1.1 + rand() * 0.9) * s
    part(g, i ? leaves : dark, w, (0.55 + rand() * 0.25) * s, w * (0.7 + rand() * 0.4), (rand() - 0.5) * 1.6 * s, 0.3 * s, (rand() - 0.5) * 1.2 * s)
  }
  const flower = brick(FLOWERS[Math.floor(rand() * FLOWERS.length)], { roughness: 0.5 })
  const flowers = 3 + Math.floor(rand() * 4)
  for (let i = 0; i < flowers; i++) part(g, flower, 0.26 * s, 0.26 * s, 0.26 * s, (rand() - 0.5) * 1.9 * s, 0.75 * s, (rand() - 0.5) * 1.3 * s)
  return g
}

function rock(rand, s) {
  const g = new Group()
  const light = brick(C.rock, { roughness: 0.55 })
  const dark = brick(C.rockDark, { roughness: 0.6 })
  const n = 2 + Math.floor(rand() * 3)
  let y = 0
  let w = (2.2 + rand() * 1.6) * s
  let d = (1.6 + rand() * 1.2) * s
  let ox = 0
  for (let i = 0; i < n; i++) {
    const h = (0.45 + rand() * 0.35) * s
    part(g, i % 2 ? dark : light, w, h, d, ox, y + h / 2, (rand() - 0.5) * 0.4 * s, 0, (rand() - 0.5) * 0.4, 0)
    y += h
    ox += (rand() - 0.5) * 0.7 * s
    w *= 0.62 + rand() * 0.2
    d *= 0.7 + rand() * 0.2
  }
  // a loose brick next to the pile
  if (rand() < 0.6) part(g, light, 0.9 * s, 0.4 * s, 0.7 * s, (rand() < 0.5 ? -1 : 1) * 1.6 * s, 0.2 * s, (rand() - 0.5) * 1.5 * s, 0, rand(), 0)
  return { g, height: y, w: (2.2 + 1.6) * s }
}

// Areas kept clear of scenery: [minX, minZ, maxX, maxZ].
function keepOut() {
  const R = LOBBY.road
  const hx = LOBBY.plotW / 2 + LOBBY.plotBorder + 3
  const hz = LOBBY.plotD / 2 + LOBBY.plotBorder + 3
  const rects = [[-R.halfWidth - R.curb - 1.5, R.north - 4, R.halfWidth + R.curb + 1.5, R.south + 4]]
  for (const Q of [LOBBY.northPlaza, LOBBY.southPlaza]) rects.push([Q.minX - 5, Q.minZ - 5, Q.maxX + 5, Q.maxZ + 5])
  const E = LOBBY.eventBoard
  rects.push([E.x - 8, E.z - 4, E.x + 8, E.z + 4])
  for (const p of LOBBY.plots) rects.push([p.x - hx, p.z - hz, p.x + hx, p.z + hz])
  return rects
}

export function buildNature(scene) {
  const rand = mulberry32(LOBBY.seed)
  const I = LOBBY.island
  const rects = keepOut()
  const placed = [] // [x, z, r]
  const free = (x, z, r) => {
    for (const [a, b, c, d] of rects) if (x > a - r && x < c + r && z > b - r && z < d + r) return false
    for (const [px, pz, pr] of placed) if (Math.hypot(px - x, pz - z) < pr + r) return false
    return x > I.minX + r + 2 && x < I.maxX - r - 2 && z > I.minZ + r + 2 && z < I.maxZ - r - 2
  }
  const spot = (r, tries = 60) => {
    for (let i = 0; i < tries; i++) {
      const x = I.minX + rand() * (I.maxX - I.minX)
      const z = I.minZ + rand() * (I.maxZ - I.minZ)
      if (free(x, z, r)) {
        placed.push([x, z, r])
        return [x, z]
      }
    }
    return null
  }

  const forest = new Group()
  const add = (obj, x, z, yaw) => {
    obj.position.set(x, 0, z)
    obj.rotation.y = yaw
    forest.add(obj)
  }

  // Trees dotted along both sides of the road in the gaps between plots (as in
  // the reference), then the rest scattered.
  for (let z = LOBBY.road.south - 6; z > LOBBY.road.north + 6; z -= 18 + rand() * 12) {
    for (const side of [-1, 1]) {
      const x = side * (11 + rand() * 5)
      if (free(x, z, 2.5)) {
        placed.push([x, z, 3.5])
        const s = 0.72 + rand() * 0.2
        add(tree(rand, s), x, z, rand() * Math.PI * 2)
        solidPole(0.6 * s, 6 * s, x, z)
      }
    }
  }
  for (let i = 0; i < LOBBY.trees; i++) {
    const p = spot(4)
    if (!p) continue
    const s = 0.75 + rand() * 0.35
    add(tree(rand, s), p[0], p[1], rand() * Math.PI * 2)
    solidPole(0.6 * s, 6 * s, p[0], p[1])
  }
  for (let i = 0; i < LOBBY.pines; i++) {
    const p = spot(2.5)
    if (!p) continue
    const s = 0.85 + rand() * 0.4
    add(pine(rand, s), p[0], p[1], rand() * Math.PI)
    solidPole(0.45 * s, 6 * s, p[0], p[1])
  }
  for (let i = 0; i < LOBBY.rocks; i++) {
    const p = spot(2.2)
    if (!p) continue
    const s = 0.7 + rand() * 0.6
    const r = rock(rand, s)
    const yaw = rand() * Math.PI * 2
    add(r.g, p[0], p[1], yaw)
    solidBox(r.w * 0.4, r.height / 2, r.w * 0.3, p[0], r.height / 2, p[1], yaw)
  }
  for (let i = 0; i < LOBBY.bushes; i++) {
    const p = spot(1.6)
    if (!p) continue
    add(bush(rand, 0.9 + rand() * 0.5), p[0], p[1], rand() * Math.PI * 2)
  }

  const baked = bake(forest, true)
  baked.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true
  })
  baked.name = 'nature'
  scene.add(baked)
  return baked
}

// Single props for hand placement elsewhere (shop corner, plaza).
export { tree as makeTree, rock as makeRock, bush as makeBush }
