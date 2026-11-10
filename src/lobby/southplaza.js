import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  TorusGeometry,
} from 'three'
import { LOBBY } from '../config.js'
import { boxAt, brick, plastic } from '../lego.js'
import { fontReady, label, neon, solidBox, solidPole } from '../propkit.js'
import { canvasTex } from './paint.js'
import { sparkleField } from './fx.js'

// The south plaza: three market stalls (striped awnings, wooden counters, a
// shopkeeper each, a glowing ring on the ground to stand in), the "Next Event"
// countdown billboard behind them, the blue Fuse Machine (chimney smoke,
// blinking antenna) and the Spin Wheel (blinking rim bulbs; it spins when you
// step into its ring). `zones` are the ground rings: main.js reports which one
// the player stands in.

const C = LOBBY.colors
const FONT = 'Fredoka, "Arial Black", sans-serif'

// Places `obj` at a prop spec's (x, z, yaw) and returns a local->world helper for colliders.
function place(obj, spec, y = 0.08) {
  obj.position.set(spec.x, y, spec.z)
  obj.rotation.y = spec.yaw ?? 0
  const c = Math.cos(obj.rotation.y)
  const s = Math.sin(obj.rotation.y)
  return (lx, lz) => [spec.x + lx * c + lz * s, spec.z - lx * s + lz * c]
}

function ring(color, radius = 1.7) {
  const g = new Group()
  const mat = neon(color, 2.6, { transparent: true, opacity: 0.9 })
  const torus = new Mesh(new TorusGeometry(radius, 0.09, 8, 72), mat)
  torus.rotation.x = -Math.PI / 2
  torus.position.y = 0.12
  g.add(torus)
  const inner = new Mesh(new TorusGeometry(radius - 0.22, 0.04, 6, 72), mat)
  inner.rotation.x = -Math.PI / 2
  inner.position.y = 0.11
  g.add(inner)
  g.userData.mat = mat
  return g
}

// --- Shopkeepers --------------------------------------------------------------------
const NPC_LOOKS = {
  suit: { shirt: '#22252e', pants: '#14161c', skin: '#f2c79a', hat: 'top', hatColor: '#121318' },
  miner: { shirt: '#ff8a1c', pants: '#3d4c7a', skin: '#e9b98f', hat: 'hard', hatColor: '#ffd21a' },
  chef: { shirt: '#f4f6fb', pants: '#d9dde8', skin: '#f5d2b0', hat: 'chef', hatColor: '#ffffff' },
}
function npc(kind) {
  const L = NPC_LOOKS[kind]
  const g = new Group()
  const shirt = plastic(L.shirt, 0.6)
  const skin = plastic(L.skin, 0.6)
  boxAt(g, plastic(L.pants, 0.6), -0.2, 0.45, 0, 0.38, 0.9, 0.42)
  boxAt(g, plastic(L.pants, 0.6), 0.2, 0.45, 0, 0.38, 0.9, 0.42)
  boxAt(g, shirt, 0, 1.3, 0, 0.82, 0.85, 0.44)
  const armL = boxAt(g, shirt, -0.6, 1.3, 0, 0.36, 0.85, 0.4)
  const armR = boxAt(g, shirt, 0.6, 1.3, 0, 0.36, 0.85, 0.4)
  boxAt(g, skin, 0, 2.0, 0, 0.56, 0.56, 0.56)
  const face = plastic('#111318', 0.5)
  boxAt(g, face, -0.12, 2.06, 0.285, 0.07, 0.11, 0.02, { shadow: false })
  boxAt(g, face, 0.12, 2.06, 0.285, 0.07, 0.11, 0.02, { shadow: false })
  boxAt(g, face, 0, 1.9, 0.285, 0.2, 0.04, 0.02, { shadow: false })
  const hat = plastic(L.hatColor, 0.5)
  if (L.hat === 'top') {
    boxAt(g, hat, 0, 2.31, 0, 0.8, 0.06, 0.8)
    boxAt(g, hat, 0, 2.55, 0, 0.5, 0.5, 0.5)
    boxAt(g, plastic('#c4161c', 0.5), 0, 2.38, 0, 0.52, 0.08, 0.52)
  } else if (L.hat === 'hard') {
    boxAt(g, hat, 0, 2.34, 0, 0.66, 0.2, 0.66)
    boxAt(g, hat, 0, 2.28, 0.18, 0.7, 0.06, 0.5)
    boxAt(g, neon('#fff6c0', 2), 0, 2.36, 0.34, 0.16, 0.12, 0.04, { shadow: false })
  } else {
    boxAt(g, hat, 0, 2.38, 0, 0.6, 0.22, 0.6)
    boxAt(g, hat, 0, 2.62, 0, 0.7, 0.3, 0.7)
  }
  g.userData.arms = [armL, armR]
  return g
}

// --- Stall -------------------------------------------------------------------------------
function paintSign(text, color) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const g = c.getContext('2d')
  const draw = () => {
    g.clearRect(0, 0, 512, 128)
    let size = 78
    g.font = `700 ${size}px ${FONT}`
    while (g.measureText(text).width > 470 && size > 30) g.font = `700 ${(size -= 4)}px ${FONT}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineJoin = 'round'
    g.lineWidth = 12
    g.strokeStyle = '#2a1206'
    g.strokeText(text, 256, 66)
    g.fillStyle = color
    g.fillText(text, 256, 66)
  }
  draw()
  return { canvas: c, draw }
}

function stall(spec) {
  const g = new Group()
  const wood = brick(C.wood, { roughness: 0.7 })
  const woodDark = brick(C.woodDark, { roughness: 0.75 })
  const W = 6.4
  const D = 3.2
  // floor deck + counter (front faces +Z, toward the road once yawed)
  boxAt(g, woodDark, 0, 0.12, 0, W + 0.4, 0.24, D + 0.6)
  boxAt(g, wood, 0, 0.75, D / 2 - 0.2, W - 0.4, 1.1, 0.6) // front counter
  boxAt(g, woodDark, 0, 1.36, D / 2 - 0.15, W - 0.2, 0.14, 0.95) // counter top
  boxAt(g, wood, -W / 2 + 0.5, 0.75, 0, 0.6, 1.1, D - 0.6) // side counters
  boxAt(g, wood, W / 2 - 0.5, 0.75, 0, 0.6, 1.1, D - 0.6)
  boxAt(g, woodDark, 0, 1.2, -D / 2 + 0.25, W - 0.6, 0.12, 0.6) // back shelf
  // goods on the counter: a few coloured crates
  const goods = { robux: ['#3dff6a', '#2ad35a', '#7dff9a'], pickaxes: ['#9aa6c8', '#6fd8ff', '#ffd21a'], sell: ['#ffd21a', '#ffffff', '#f0a020'] }[spec.kind]
  goods.forEach((col, i) => boxAt(g, plastic(col, 0.4), -1.4 + i * 1.4, 1.6, D / 2 - 0.15, 0.5, 0.36, 0.5))
  // posts
  for (const x of [-W / 2 + 0.2, W / 2 - 0.2]) {
    boxAt(g, woodDark, x, 2.0, D / 2 + 0.05, 0.32, 3.8, 0.32)
    boxAt(g, woodDark, x, 2.4, -D / 2 + 0.15, 0.32, 4.6, 0.32)
  }
  // awning: striped slats sloping down toward the front, plus a scalloped valance
  const aw = new Group()
  aw.position.set(0, 4.35, 0.1)
  aw.rotation.x = 0.32
  g.add(aw)
  const stripe = plastic(spec.awning, 0.5)
  const white = plastic('#ffffff', 0.5)
  const n = 9
  const sw = (W + 0.8) / n
  for (let i = 0; i < n; i++) boxAt(aw, i % 2 ? white : stripe, -((W + 0.8) / 2) + sw * (i + 0.5), 0, 0, sw, 0.16, D + 1.2)
  for (let i = 0; i < n; i++) boxAt(aw, i % 2 ? white : stripe, -((W + 0.8) / 2) + sw * (i + 0.5), -0.3, (D + 1.2) / 2 - 0.05, sw, 0.45, 0.1)
  boxAt(aw, plastic(spec.awning, 0.5), 0, 0.18, -(D + 1.2) / 2 + 0.1, W + 0.9, 0.22, 0.25) // ridge

  // shopkeeper behind the counter
  const keeper = npc(spec.npc)
  keeper.position.set(0, 0.24, -0.3)
  g.add(keeper)

  // sign on the counter front
  const sign = paintSign(spec.label, spec.kind === 'sell' ? '#7dff6a' : spec.kind === 'robux' ? '#ffe14a' : '#ff4a55')
  const tex = canvasTex(sign.canvas)
  const plate = new Mesh(new PlaneGeometry(3.6, 0.9), new MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6, depthWrite: false }))
  plate.position.set(0, 0.78, D / 2 + 0.12)
  g.add(plate)
  fontReady.then(() => {
    sign.draw()
    tex.needsUpdate = true
  })

  // ground ring in front
  const r = ring(spec.ring)
  r.position.set(0, 0, D / 2 + 3)
  g.add(r)
  g.add(sparkleField({ count: 14, center: { x: 0, y: 0.2, z: D / 2 + 3 }, box: { x: 1.3, y: 0.3, z: 1.3 }, rise: 0.8, life: 2.2, size: 0.22, color: spec.ring, seed: spec.x * 13 + 7 }))

  const toWorld = place(g, { ...spec, yaw: Math.PI }) // stalls face north, toward the road
  let [wx, wz] = toWorld(0, D / 2 - 0.2)
  solidBox(W / 2, 0.75, 0.5, wx, 0.75, wz, Math.PI)
  ;[wx, wz] = toWorld(0, 0)
  solidBox(W / 2 + 0.2, 0.2, D / 2 + 0.3, wx, 0.2, wz, Math.PI)
  for (const x of [-W / 2 + 0.5, W / 2 - 0.5]) {
    ;[wx, wz] = toWorld(x, 0)
    solidBox(0.3, 0.75, D / 2 - 0.3, wx, 0.75, wz, Math.PI)
  }
  const [rx, rz] = toWorld(0, D / 2 + 3)
  return { group: g, keeper, zone: { id: spec.kind, label: spec.label, x: rx, z: rz, r: 1.7, ring: r } }
}

// --- Next Event billboard --------------------------------------------------------------------
function paintCountdown(seconds) {
  const c = paintCountdown.canvas ?? (paintCountdown.canvas = Object.assign(document.createElement('canvas'), { width: 640, height: 340 }))
  const g = c.getContext('2d')
  g.fillStyle = '#c8d1f0'
  g.fillRect(0, 0, 640, 340)
  // faint stud grid on the panel
  g.fillStyle = 'rgba(80,90,140,0.12)'
  for (let y = 20; y < 340; y += 40) for (let x = 20; x < 640; x += 40) {
    g.beginPath()
    g.arc(x, y, 12, 0, Math.PI * 2)
    g.fill()
  }
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineJoin = 'round'
  g.font = `700 92px ${FONT}`
  g.lineWidth = 16
  g.strokeStyle = '#1d2236'
  g.fillStyle = '#ffffff'
  g.strokeText('Next Event in', 320, 112)
  g.fillText('Next Event in', 320, 112)
  const t = `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  g.strokeText(t, 320, 232)
  g.fillText(t, 320, 232)
  return c
}

function eventBoard(spec) {
  const g = new Group()
  const frame = brick('#8692c4', { roughness: 0.6 })
  const pole = brick('#4b557e', { roughness: 0.6 })
  boxAt(g, pole, 0, 0.5, 0, 3.2, 1, 2.2)
  boxAt(g, pole, 0, 5, 0, 1.8, 9, 1.4)
  boxAt(g, frame, 0, 12.6, 0, 13.4, 7.4, 1.0)
  const tex = canvasTex(paintCountdown(LOBBY.eventBoard.every))
  const panel = new Mesh(new PlaneGeometry(12.2, 6.4), new MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.55 }))
  panel.position.set(0, 12.6, 0.51)
  g.add(panel)
  // the back gets a plain panel too
  boxAt(g, brick('#6f7bab', { roughness: 0.6 }), 0, 12.6, -0.55, 12, 6.2, 0.1)
  place(g, spec)
  solidBox(1, 6, 0.8, spec.x, 6, spec.z)
  let last = -1
  return {
    group: g,
    update(elapsed) {
      const left = Math.ceil(spec.every - (elapsed % spec.every))
      if (left === last) return
      last = left
      paintCountdown(left)
      tex.needsUpdate = true
    },
  }
}

// --- Fuse Machine ---------------------------------------------------------------------------
function fuseMachine(spec) {
  const g = new Group()
  const blue = brick('#2f6dff', { roughness: 0.5 })
  const blueDark = brick('#1f4fd0', { roughness: 0.55 })
  const grey = brick('#7c86a6', { roughness: 0.6 })
  const greyDark = brick('#59617e', { roughness: 0.6 })
  // body: two blue blocks, the taller one in front with the shutter door
  boxAt(g, blueDark, 0, 0.25, 0, 6.2, 0.5, 4.8)
  boxAt(g, blue, 0, 2.2, 0.4, 5.4, 3.4, 3.6)
  boxAt(g, blueDark, -1.2, 1.6, -1.6, 3.4, 2.4, 1.6)
  // sloped roof of grey plates
  const roof = new Group()
  roof.position.set(0, 4.05, 0.3)
  roof.rotation.x = -0.28
  g.add(roof)
  boxAt(roof, grey, 0, 0, 0, 5.9, 0.35, 4.3)
  boxAt(roof, greyDark, 0, 0.3, -0.6, 4.6, 0.3, 2.6)
  // shutter door with slats
  const slat = plastic('#a3abc4', 0.5)
  boxAt(g, greyDark, 1.0, 1.85, 2.21, 2.2, 2.9, 0.1)
  for (let i = 0; i < 9; i++) boxAt(g, slat, 1.0, 0.65 + i * 0.3, 2.28, 1.95, 0.16, 0.06, { shadow: false })
  // control panel: lever with a red knob, two lights
  boxAt(g, grey, -1.4, 1.5, 2.3, 1.2, 1.4, 0.3)
  const knob = new Mesh(new SphereGeometry(0.2, 12, 10), plastic('#e3242b', 0.35))
  knob.position.set(-1.4, 2.55, 2.55)
  g.add(knob)
  boxAt(g, plastic('#30354a', 0.4), -1.4, 2.1, 2.5, 0.1, 0.9, 0.1).rotation.x = 0.4
  const lampOn = neon('#43ff6a', 2.6)
  const lampOff = neon('#ff3a3a', 2.6)
  boxAt(g, lampOn, -1.7, 1.7, 2.47, 0.2, 0.2, 0.06, { shadow: false })
  boxAt(g, lampOff, -1.1, 1.7, 2.47, 0.2, 0.2, 0.06, { shadow: false })
  // chimneys
  const pipe = new MeshStandardMaterial({ color: '#8d96b3', roughness: 0.45, metalness: 0.4 })
  const pipeTop = new MeshStandardMaterial({ color: '#2a2f3d', roughness: 0.6 })
  const chimneys = [[-1.8, -1.2, 2.2], [-0.6, -1.7, 1.6]]
  for (const [x, z, h] of chimneys) {
    const p = new Mesh(new CylinderGeometry(0.42, 0.42, h, 16), pipe)
    p.position.set(x, 4 + h / 2, z)
    p.castShadow = true
    g.add(p)
    const cap = new Mesh(new CylinderGeometry(0.52, 0.48, 0.25, 16), pipeTop)
    cap.position.set(x, 4 + h + 0.1, z)
    g.add(cap)
    g.add(sparkleField({ count: 18, center: { x, y: 4 + h + 0.2, z }, box: { x: 0.15, y: 0.1, z: 0.15 }, rise: 1.1, life: 3, drift: 0.45, size: 0.9, color: '#c9cfe0', opacity: 0.32, soft: true, seed: Math.round(x * 10 + 50) }))
  }
  // satellite dish + antenna with a blinking red tip
  const dish = new Group()
  dish.position.set(1.6, 4.9, -0.8)
  g.add(dish)
  boxAt(dish, greyDark, 0, 0.3, 0, 0.25, 0.8, 0.25)
  const bowl = new Mesh(new SphereGeometry(1.1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.6), new MeshStandardMaterial({ color: '#b8c0d8', roughness: 0.4, metalness: 0.3, side: 2 }))
  bowl.rotation.x = Math.PI - 0.7
  bowl.position.y = 1.0
  dish.add(bowl)
  const mast = new Mesh(new CylinderGeometry(0.04, 0.04, 1.4, 6), plastic('#30354a', 0.4))
  mast.position.set(0, 1.4, 0.35)
  mast.rotation.x = 0.7
  dish.add(mast)
  const tipMat = neon('#ff2b2b', 3)
  const tip = new Mesh(new SphereGeometry(0.12, 10, 8), tipMat)
  tip.position.set(0, 1.9, 0.82)
  dish.add(tip)

  const r = ring('#2f9bff', 2)
  r.position.set(1.0, 0, 4.4)
  g.add(r)

  const toWorld = place(g, spec)
  solidBox(3.1, 2.2, 2.4, spec.x, 2.2, spec.z, spec.yaw)
  const title = label('Fuse Machine', 0.95, { color: '#27c8ff', outline: '#0a1640' })
  const count = label(`0/${spec.needs}`, 0.7, { color: '#ffffff', outline: '#0a1640' })
  const [lx, lz] = toWorld(0, 0.5)
  title.position.set(lx, 7.8, lz)
  count.position.set(lx, 7.05, lz)
  const [rx, rz] = toWorld(1.0, 4.4)
  return { group: g, labels: [title, count], tipMat, zone: { id: 'fuse', label: 'Fuse Machine', x: rx, z: rz, r: 2, ring: r } }
}

// --- Spin Wheel --------------------------------------------------------------------------------
const WHEEL_SEGMENTS = [
  { color: '#8b2cff', text: 'x2' },
  { color: '#1f8bff', text: '$1M' },
  { color: '#20d65a', text: 'Block' },
  { color: '#ffd21a', text: 'Spin' },
  { color: '#ff8a1c', text: '$5M' },
  { color: '#f0202a', text: 'Car' },
  { color: '#ff3fc8', text: 'Luck' },
  { color: '#1fd8e8', text: '?' },
]
function paintWheel(size = 512) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  const draw = () => {
    const cx = size / 2
    const n = WHEEL_SEGMENTS.length
    g.clearRect(0, 0, size, size)
    WHEEL_SEGMENTS.forEach((seg, i) => {
      const a0 = (i / n) * Math.PI * 2 - Math.PI / 2
      const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2
      g.fillStyle = seg.color
      g.beginPath()
      g.moveTo(cx, cx)
      g.arc(cx, cx, cx, a0, a1)
      g.closePath()
      g.fill()
      g.strokeStyle = '#fff4b0'
      g.lineWidth = 6
      g.stroke()
      g.save()
      g.translate(cx, cx)
      g.rotate((a0 + a1) / 2)
      g.font = `700 ${size * 0.075}px ${FONT}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.lineWidth = 8
      g.lineJoin = 'round'
      g.strokeStyle = 'rgba(0,0,0,0.6)'
      g.strokeText(seg.text, cx * 0.62, 0)
      g.fillStyle = '#ffffff'
      g.fillText(seg.text, cx * 0.62, 0)
      g.restore()
    })
  }
  draw()
  return { canvas: c, draw }
}

function spinWheel(spec) {
  const g = new Group()
  const yellow = brick('#ffc21a', { roughness: 0.45 })
  const orange = brick('#ff9a12', { roughness: 0.5 })
  // base: a sloped yellow ramp block and a plinth
  boxAt(g, orange, 0, 0.3, 0, 3.6, 0.6, 2.6)
  boxAt(g, yellow, 0, 0.85, -0.2, 2.6, 0.5, 1.8)
  boxAt(g, yellow, 0, 2.2, -0.2, 0.9, 2.4, 0.8) // stand
  // wheel: rim, painted face, hub, pointer
  const wheel = new Group()
  wheel.position.set(0, 4.7, 0.25)
  g.add(wheel)
  const rim = new Mesh(new TorusGeometry(2.45, 0.28, 12, 64), new MeshStandardMaterial({ color: '#ffc21a', roughness: 0.35, metalness: 0.2 }))
  wheel.add(rim)
  const face = paintWheel()
  const faceTex = canvasTex(face.canvas)
  const disc = new Mesh(new CylinderGeometry(2.3, 2.3, 0.25, 64), [
    new MeshStandardMaterial({ color: '#e0a010', roughness: 0.5 }),
    new MeshStandardMaterial({ map: faceTex, roughness: 0.45, emissiveMap: faceTex, emissive: '#ffffff', emissiveIntensity: 0.25 }),
    new MeshStandardMaterial({ color: '#e0a010', roughness: 0.5 }),
  ])
  disc.rotation.x = Math.PI / 2
  wheel.add(disc)
  const hub = new Mesh(new CylinderGeometry(0.35, 0.35, 0.5, 20), plastic('#ffffff', 0.3))
  hub.rotation.x = Math.PI / 2
  wheel.add(hub)
  fontReady.then(() => {
    face.draw()
    faceTex.needsUpdate = true
  })
  // bulbs round the rim (two alternating sets blink)
  const bulbA = neon('#fff6c8', 2.8)
  const bulbB = neon('#fff6c8', 2.8)
  const bulbGeo = new SphereGeometry(0.11, 8, 6)
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    const b = new Mesh(bulbGeo, i % 2 ? bulbA : bulbB)
    b.position.set(Math.cos(a) * 2.45, Math.sin(a) * 2.45, 0.27)
    wheel.add(b)
  }
  // pointer at the top (does not turn with the wheel)
  const pointer = new Mesh(new CylinderGeometry(0.0, 0.32, 0.7, 4), plastic('#e3242b', 0.35))
  pointer.position.set(0, 7.35, 0.5)
  pointer.rotation.z = Math.PI
  g.add(pointer)

  const r = ring('#b23cff', 2)
  r.position.set(0, 0, 3.4)
  g.add(r)
  g.add(sparkleField({ count: 22, center: { x: 0, y: 2.5, z: 0.5 }, box: { x: 2.8, y: 4, z: 0.6 }, rise: 0.3, life: 2.4, size: 0.25, color: '#ffe680', seed: 77 }))

  const toWorld = place(g, spec)
  solidBox(1.8, 0.6, 1.3, spec.x, 0.6, spec.z, spec.yaw)
  solidPole(0.6, 7.5, spec.x, spec.z)
  const title = label('Spin Wheel', 0.95, { color: '#c03cff', outline: '#22053d' })
  const sub = label('Spin for rewards', 0.6, { color: '#ffffff', outline: '#22053d' })
  const [lx, lz] = toWorld(0, 0)
  title.position.set(lx, 8.7, lz)
  sub.position.set(lx, 8.05, lz)
  const [rx, rz] = toWorld(0, 3.4)
  return { group: g, labels: [title, sub], wheel, bulbA, bulbB, zone: { id: 'spin', label: 'Spin Wheel', x: rx, z: rz, r: 2, ring: r } }
}

export function buildSouthPlaza(scene) {
  const root = new Group()
  root.name = 'southPlaza'
  const stalls = LOBBY.stalls.map(stall)
  for (const s of stalls) root.add(s.group)
  const board = eventBoard(LOBBY.eventBoard)
  root.add(board.group)
  const fuse = fuseMachine(LOBBY.fuseMachine)
  root.add(fuse.group, ...fuse.labels)
  const spin = spinWheel(LOBBY.spinWheel)
  root.add(spin.group, ...spin.labels)
  // a warm light over the stalls at night
  const night = new PointLight('#ffcf8a', 0, 30, 2)
  night.position.set(0, 7, 158)
  root.add(night)
  scene.add(root)

  const zones = [...stalls.map((s) => s.zone), fuse.zone, spin.zone]
  let spinVel = 0.25 // rad/s idle drift; jumps when the player steps into the ring
  return {
    zones,
    spin() {
      if (spinVel < 2) spinVel = 9 + Math.random() * 4
    },
    setNight(n) {
      night.intensity = n * 60
    },
    update(dt, elapsed, activeZone) {
      board.update(elapsed)
      // wheel: spins down to the idle drift
      spin.wheel.rotation.z -= spinVel * dt
      spinVel = Math.max(0.25, spinVel * Math.exp(-dt * 0.55))
      const blink = Math.floor(elapsed * 3) % 2
      spin.bulbA.visible = !!blink
      spin.bulbB.visible = !blink
      fuse.tipMat.visible = Math.sin(elapsed * 4) > 0
      // shopkeepers: little idle sway and wave
      stalls.forEach((s, i) => {
        s.keeper.rotation.y = Math.sin(elapsed * 0.7 + i) * 0.25
        s.keeper.userData.arms[1].rotation.x = -Math.max(0, Math.sin(elapsed * 1.3 + i * 2)) * 1.2
      })
      // rings: pulse, brighter when stood in
      for (const z of zones) {
        const on = z === activeZone
        const s = 1 + Math.sin(elapsed * 3 + z.x) * 0.03 + (on ? 0.08 : 0)
        z.ring.scale.set(s, 1, s)
        z.ring.userData.mat.opacity = on ? 1 : 0.75
      }
    },
  }
}
