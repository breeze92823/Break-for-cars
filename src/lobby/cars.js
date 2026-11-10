import {
  AdditiveBlending,
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
} from 'three'
import { CARS } from '../config.js'
import { neon } from '../propkit.js'
import { paint } from '../lego.js'
import { paintSoftDot, toTexture } from '../textures.js'

// Procedural cars. The body is a side profile (with wheel arches cut in)
// extruded across the car's width with a rounded bevel; the glasshouse is a
// second, narrower profile in tinted glass. Then wheels with spoked rims and
// brake calipers, head/tail lights, splitter, diffuser, side intakes, mirrors
// and a wing. Length runs along +X (nose at +X), origin on the ground under the
// centre of the car. Style decides the silhouette.

const L = 4.6 // body length
const W = 2.0 // body width
const AXLE = 1.45 // |x| of the axles
const WHEEL_R = 0.38
const ARCH_R = 0.47

const STYLES = {
  //       nose height, hood y, cowl x, belt y, tail y, cabin [front base x, roof front x, roof rear x, rear base x], roof y, wing
  super: { nose: 0.42, hood: 0.78, cowl: 0.62, belt: 0.88, tail: 0.74, cabin: [0.82, -0.05, -0.9, -1.88], roof: 1.2, wing: 'low' },
  hyper: { nose: 0.36, hood: 0.66, cowl: 0.78, belt: 0.82, tail: 0.78, cabin: [0.98, 0.18, -0.55, -1.62], roof: 1.12, wing: 'big' },
  sport: { nose: 0.48, hood: 0.86, cowl: 0.36, belt: 0.95, tail: 0.86, cabin: [0.5, -0.32, -1.1, -2.05], roof: 1.3, wing: 'lip' },
  coupe: { nose: 0.46, hood: 0.82, cowl: 0.5, belt: 0.92, tail: 0.84, cabin: [0.66, -0.2, -1.05, -2.0], roof: 1.27, wing: 'none' },
}

function bodyShape(st) {
  const s = new Shape()
  const y0 = 0.27
  s.moveTo(-L / 2 + 0.1, y0)
  s.lineTo(-AXLE - ARCH_R, y0)
  s.absarc(-AXLE, 0.36, ARCH_R, Math.PI, 0, true)
  s.lineTo(AXLE - ARCH_R, y0)
  s.absarc(AXLE, 0.36, ARCH_R, Math.PI, 0, true)
  s.lineTo(L / 2 - 0.12, y0)
  s.lineTo(L / 2 + 0.04, st.nose)
  s.lineTo(L / 2 - 0.08, st.nose + 0.14)
  s.lineTo(1.25, st.hood)
  s.lineTo(st.cowl, st.belt - 0.02)
  s.lineTo(-1.35, st.belt)
  s.lineTo(-L / 2 + 0.25, st.tail + 0.06)
  s.lineTo(-L / 2 - 0.02, st.tail - 0.06)
  s.lineTo(-L / 2 - 0.02, 0.42)
  s.closePath()
  return s
}

function cabinShape(st) {
  const [fx, rfx, rrx, rx] = st.cabin
  const s = new Shape()
  s.moveTo(fx, st.belt - 0.06)
  s.lineTo(rfx, st.roof)
  s.lineTo(rrx, st.roof)
  s.lineTo(rx, st.belt + 0.02)
  s.lineTo(rx, st.belt - 0.06)
  s.closePath()
  return s
}

function extrude(shape, width, bevel) {
  const geo = new ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: 10 })
  geo.translate(0, 0, -(width - bevel * 2) / 2)
  return geo
}

const geoCache = new Map()
function cachedGeo(key, make) {
  let g = geoCache.get(key)
  if (!g) geoCache.set(key, (g = make()))
  return g
}

const box = (w, h, d) => cachedGeo(`b${w}|${h}|${d}`, () => new BoxGeometry(w, h, d))
function add(parent, geo, mat, x, y, z, cast = true) {
  const m = new Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = cast
  m.receiveShadow = true
  parent.add(m)
  return m
}

const shared = {}
function mats() {
  if (shared.glass) return shared
  shared.glass = new MeshPhysicalMaterial({ color: '#0d1420', metalness: 0.6, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 })
  shared.tire = new MeshStandardMaterial({ color: '#16171b', roughness: 0.92 })
  shared.dark = new MeshStandardMaterial({ color: '#121318', roughness: 0.55, metalness: 0.2 })
  shared.head = new MeshStandardMaterial({ color: '#ffffff', emissive: '#e8f4ff', emissiveIntensity: 1.6, roughness: 0.2 })
  shared.tail = neon('#ff1630', 2.4)
  shared.caliper = new MeshStandardMaterial({ color: '#e0261d', roughness: 0.4 })
  shared.glow = new MeshBasicMaterial({ map: toTexture(paintSoftDot(128), { srgb: true }), transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide })
  return shared
}

function wheel(parent, rimMat, x, z, side) {
  const M = mats()
  const w = new Group()
  const tire = new Mesh(cachedGeo('tire', () => new CylinderGeometry(WHEEL_R, WHEEL_R, 0.32, 28).rotateX(Math.PI / 2)), M.tire)
  tire.castShadow = true
  w.add(tire)
  const rim = new Mesh(cachedGeo('rim', () => new CylinderGeometry(0.26, 0.26, 0.335, 24).rotateX(Math.PI / 2)), rimMat)
  w.add(rim)
  const hub = new Mesh(cachedGeo('hub', () => new CylinderGeometry(0.06, 0.06, 0.36, 10).rotateX(Math.PI / 2)), M.dark)
  w.add(hub)
  for (let i = 0; i < 5; i++) {
    const spoke = new Mesh(box(0.05, 0.42, 0.04), rimMat)
    spoke.position.z = side * 0.17
    spoke.rotation.z = (i / 5) * Math.PI * 2
    w.add(spoke)
  }
  const cal = new Mesh(box(0.12, 0.16, 0.06), M.caliper)
  cal.position.set(0.12, 0.12, side * 0.1)
  w.add(cal)
  w.position.set(x, WHEEL_R, z)
  parent.add(w)
  return w
}

// Builds one car from a CARS key or a spec object.
export function buildCar(key) {
  const spec = typeof key === 'string' ? CARS[key] : key
  const st = STYLES[spec.style] ?? STYLES.super
  const M = mats()
  const car = new Group()
  car.name = `car:${typeof key === 'string' ? key : spec.style}`

  const body = paint(spec.body, spec.neon ? { metalness: 0.5, roughness: 0.25 } : undefined)
  const accent = new MeshStandardMaterial({ color: spec.accent, roughness: 0.4, metalness: 0.3 })
  const rimMat = new MeshStandardMaterial({ color: spec.rim, roughness: 0.25, metalness: 0.85 })

  add(car, cachedGeo(`body:${spec.style}`, () => extrude(bodyShape(st), W, 0.14)), body, 0, 0, 0)
  const cabinW = W * 0.76
  add(car, cachedGeo(`cabin:${spec.style}`, () => extrude(cabinShape(st), cabinW, 0.08)), M.glass, 0, 0, 0)
  // roof panel in body colour over the glass
  const [, rfx, rrx] = st.cabin
  add(car, box(rfx - rrx + 0.1, 0.05, cabinW * 0.86), body, (rfx + rrx) / 2, st.roof + 0.06, 0)

  // Lower trim: splitter, side skirts, diffuser.
  add(car, box(0.5, 0.06, W * 0.92), accent, L / 2 - 0.2, 0.25, 0)
  for (const side of [-1, 1]) add(car, box(AXLE * 2 - ARCH_R * 2 - 0.1, 0.1, 0.08), accent, 0, 0.3, side * (W / 2 + 0.02))
  add(car, box(0.3, 0.18, W * 0.8), accent, -L / 2 + 0.05, 0.33, 0)
  for (let i = -2; i <= 2; i++) add(car, box(0.32, 0.12, 0.03), M.dark, -L / 2 + 0.03, 0.34, i * 0.28, false)

  // Lights.
  for (const side of [-1, 1]) {
    const head = add(car, box(0.32, 0.07, 0.42), M.head, L / 2 - 0.2, st.nose + 0.1, side * 0.62, false)
    head.rotation.z = -0.35
    add(car, box(0.05, 0.06, 0.55), M.tail, -L / 2 - 0.02, st.tail - 0.03, side * 0.55, false)
    // side intake behind the doors
    add(car, box(0.55, 0.18, 0.06), M.dark, -0.95, 0.56, side * (W / 2 + 0.005), false)
    // mirror
    add(car, box(0.16, 0.1, 0.22), body, st.cabin[0] - 0.12, st.belt + 0.08, side * (cabinW / 2 + 0.12))
  }
  add(car, box(0.05, 0.05, W * 0.55), M.tail, -L / 2 - 0.02, st.tail - 0.03, 0, false)
  // Hood vents.
  add(car, box(0.36, 0.03, 0.5), M.dark, 1.5, (st.hood + st.nose + 0.14) / 2 + 0.07, 0, false).rotation.z = -0.22

  // Wing.
  if (st.wing === 'low' || st.wing === 'big') {
    const big = st.wing === 'big'
    const wy = st.tail + (big ? 0.48 : 0.2)
    for (const side of [-1, 1]) add(car, box(0.08, wy - st.tail + 0.05, 0.06), accent, -L / 2 + 0.35, (wy + st.tail) / 2, side * 0.55)
    const wing = add(car, box(big ? 0.5 : 0.36, 0.05, W * (big ? 1.02 : 0.9)), big ? accent : body, -L / 2 + 0.3, wy, 0)
    wing.rotation.z = 0.12
    if (big) for (const side of [-1, 1]) add(car, box(0.55, 0.22, 0.04), accent, -L / 2 + 0.3, wy - 0.02, side * W * 0.51)
  } else if (st.wing === 'lip') {
    add(car, box(0.14, 0.05, W * 0.8), accent, -L / 2 + 0.12, st.tail + 0.09, 0)
  }
  // Two-tone trim line (hybrid coupe).
  if (spec.trim) {
    const trim = neon(spec.trim, 1.6)
    for (const side of [-1, 1]) add(car, box(AXLE * 2.1, 0.04, 0.02), trim, 0, 0.42, side * (W / 2 + 0.05), false)
  }

  // Neon kit (the limited Bolido): strips along the sides, hood and wing + under-glow.
  if (spec.neon) {
    const n = neon(spec.neon, 3.2)
    for (const side of [-1, 1]) {
      add(car, box(L * 0.82, 0.045, 0.03), n, 0, st.belt - 0.12, side * (W / 2 + 0.04), false)
      add(car, box(0.9, 0.04, 0.03), n, 1.6, st.nose + 0.02, side * (W / 2 - 0.02), false).rotation.y = side * 0.1
      add(car, box(0.04, 0.04, 0.6), n, L / 2 - 0.08, st.nose + 0.06, side * 0.55, false)
    }
    add(car, box(1.8, 0.03, 0.06), n, 1.15, st.hood + 0.04, 0, false).rotation.z = -0.1
    add(car, box(0.52, 0.03, W * 1.04), n, -L / 2 + 0.3, st.tail + 0.53, 0, false).rotation.z = 0.12
    const glowMat = M.glow.clone()
    glowMat.color.set(spec.neon)
    glowMat.opacity = 0.75
    const under = new Mesh(new PlaneGeometry(L * 1.25, W * 1.7), glowMat)
    under.rotation.x = -Math.PI / 2
    under.position.y = 0.04
    car.add(under)
  }

  car.userData.wheels = []
  for (const x of [AXLE, -AXLE]) for (const side of [-1, 1]) car.userData.wheels.push(wheel(car, rimMat, x, side * (W / 2 - 0.14), side))
  car.userData.size = { length: L, width: W, height: st.roof + 0.1 }
  return car
}
