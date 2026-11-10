import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three'
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CARS } from '../config.js'
import { neon } from '../propkit.js'
import { paint } from '../lego.js'
import { paintSoftDot, toTexture } from '../textures.js'

// Procedural cars, built as smooth lofted surfaces instead of flat profiles.
//
// The body is a loft: ~100 cross-sections along the length, each a rounded
// section (flat floor, rounded sill, side, a superellipse shoulder rising to
// the centreline) whose height follows a per-style top profile and whose width
// follows a rounded plan outline. Over each wheel the section's shoulder bulges
// up into a fender and everything outboard of the wheel-well wall is pushed up
// to the arch, which cuts real wheel arches. The cabin is a second loft sitting
// on the body (windscreen, roof, fastback / engine cover) in body colour, and
// the glass, lights, vents, intakes, panel gaps and neon are thin patches laid
// on those surfaces (same parametrisation, pushed out along the normal), so
// every detail follows the curves. Wheels are lathed tyres with spoked rims,
// brake discs and calipers. Everything is merged into one geometry per
// material role and cached per style, so a car is ~12 draw calls whatever its
// detail. Length runs along +X (nose at +X), origin on the ground under the
// centre of the car.

const L = 4.6 // body length
const W = 2.0 // body width
const AXLE_F = 1.42 // x of the front axle
const AXLE_R = -1.42 // x of the rear axle
const WHEEL_R = 0.37
const ARCH_R = 0.445
const TYRE_W = 0.34

// Per style:
//  top     centreline top height [x, y] from the nose tip to the tail tip
//  pF/pR   plan-view roundness of the nose / tail (higher = blunter)
//  front   nose width relative to the widest point
//  sf      shoulder height as a fraction of floor -> top
//  nu      shoulder superellipse exponent (lower = rounder)
//  haunch  extra fender bulge over the rear wheels (mid-engine hips)
//  gh      cabin: xa windscreen base, xb roof front, xc roof rear, xd rear base,
//          roof height, base width (of the body width), top tumblehome,
//          rear = 'glass' fastback window | 'louvre' slatted engine cover
//  wing    'low' | 'big' | 'lip' | 'duck'
const STYLES = {
  super: {
    top: [[2.3, 0.42], [2.14, 0.58], [1.75, 0.69], [1.1, 0.78], [0.6, 0.83], [-0.4, 0.88], [-1.5, 0.92], [-2.05, 0.9], [-2.3, 0.8]],
    headLamp: [0.5, 0.08, 0.5, 0.66],
    pF: 5, pR: 5.5, front: 0.84, sf: 0.5, nu: 3.2, haunch: 0.07,
    gh: { xa: 0.72, xb: -0.12, xc: -0.82, xd: -2.08, roof: 1.2, w: 0.8, tumble: 0.3, rear: 'louvre', split: null, door: -0.42 },
    wing: 'low', intakes: true, scoop: false, exhaust: 'center', head: 'slit', tail: 'y', gills: false, hoodVents: true,
  },
  hyper: {
    top: [[2.3, 0.38], [2.14, 0.53], [1.6, 0.65], [1.0, 0.73], [0.5, 0.78], [-0.5, 0.85], [-1.6, 0.88], [-2.1, 0.88], [-2.3, 0.8]],
    headLamp: [0.42, 0.08, 0.5, 0.68],
    pF: 4.5, pR: 6, front: 0.8, sf: 0.48, nu: 2.9, haunch: 0.09,
    gh: { xa: 0.95, xb: 0.15, xc: -0.6, xd: -1.75, roof: 1.13, w: 0.74, tumble: 0.34, rear: 'glass', split: null, door: -0.3 },
    wing: 'big', intakes: true, scoop: true, exhaust: 'twin', head: 'pod', tail: 'bar', gills: false, hoodVents: true,
  },
  sport: {
    top: [[2.32, 0.5], [2.15, 0.66], [1.7, 0.78], [0.9, 0.87], [0.3, 0.9], [-0.8, 0.93], [-1.8, 0.95], [-2.15, 0.91], [-2.32, 0.8]],
    headLamp: [0.55, 0.06, 0.48, 0.64],
    pF: 4.5, pR: 4.5, front: 0.88, sf: 0.52, nu: 3.3, haunch: 0.02,
    gh: { xa: 0.32, xb: -0.45, xc: -1.12, xd: -2.05, roof: 1.3, w: 0.8, tumble: 0.28, rear: 'glass', split: -0.95 },
    wing: 'lip', intakes: false, scoop: false, exhaust: 'quad', head: 'slit', tail: 'round', gills: true, hoodVents: true,
  },
  coupe: {
    top: [[2.32, 0.5], [2.15, 0.64], [1.7, 0.76], [1.0, 0.85], [0.45, 0.89], [-0.6, 0.92], [-1.7, 0.91], [-2.12, 0.87], [-2.32, 0.76]],
    headLamp: [0.45, 0.06, 0.48, 0.7],
    pF: 3.8, pR: 4, front: 0.86, sf: 0.52, nu: 2.9, haunch: 0.05,
    gh: { xa: 0.5, xb: -0.25, xc: -0.9, xd: -2.2, roof: 1.27, w: 0.8, tumble: 0.3, rear: 'glass', split: -0.8 },
    wing: 'duck', intakes: false, scoop: false, exhaust: 'twin', head: 'round', tail: 'bar', gills: true, hoodVents: false,
  },
}

// --- small maths ---------------------------------------------------------------------------------
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t)
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
// Cubic Hermite through [x, y] points (x descending), finite-difference tangents.
function curve(pts) {
  const n = pts.length
  const tan = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(n - 1, i + 1)]
    return (b[1] - a[1]) / (b[0] - a[0])
  })
  return (x) => {
    if (x >= pts[0][0]) return pts[0][1]
    if (x <= pts[n - 1][0]) return pts[n - 1][1]
    let i = 0
    while (x < pts[i + 1][0]) i++
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    const h = x1 - x0
    const t = (x - x0) / h
    const t2 = t * t
    const t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * tan[i] + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * tan[i + 1]
  }
}

// --- the body surface ----------------------------------------------------------------------------
// bodyPoint(x, v) -> [x, y, z] on the right side (z >= 0). v runs around the
// half section: 0 floor centre, 0.18 sill corner, 0.3 side, 0.42 shoulder,
// 1 top centre.
const V_CORNER = 0.18
const V_SIDE = 0.3
const V_SHOULDER = 0.42
const TH_P = 0.62 // shoulder angle where the fender bulge peaks

function makeBody(st) {
  const top = curve(st.top)
  const tipF = st.top[0][0]
  const tipR = st.top[st.top.length - 1][0]
  const xc = (tipF + tipR) / 2
  const hl = (tipF - tipR) / 2
  const wMax = W / 2
  const half = (x) => {
    const u = (x - xc) / hl
    const p = u > 0 ? st.pF : st.pR
    const a = Math.min(1, Math.abs(u))
    const plan = (1 - a ** p) ** (1 / p)
    const taper = 1 - (1 - st.front) * smooth(-0.2, 1, u)
    const flare = 0.035 * Math.exp(-(((x - AXLE_R) / 0.6) ** 2)) + 0.02 * Math.exp(-(((x - AXLE_F) / 0.6) ** 2))
    return Math.max(0.004, wMax * plan * taper + flare * plan)
  }
  const bottom = (x) => 0.21 + 0.07 * smooth(1.85, tipF, x) + 0.11 * smooth(-1.75, tipR, x)
  const shoulder = (x) => {
    const yB = bottom(x)
    return yB + st.sf * (top(x) - yB)
  }
  const wheelZ = { f: half(AXLE_F) - TYRE_W / 2 - 0.02, r: half(AXLE_R) - TYRE_W / 2 - 0.02 }
  // wheel-arch ceiling at x (or -Infinity outside the arches), and the inner well wall
  const arch = (x) => {
    for (const [ax, k] of [[AXLE_F, 'f'], [AXLE_R, 'r']]) {
      const dx = x - ax
      if (Math.abs(dx) < ARCH_R) return { y: WHEEL_R + Math.sqrt(ARCH_R * ARCH_R - dx * dx), zin: wheelZ[k] - TYRE_W / 2 - 0.05 }
    }
    return null
  }
  // fender bulge amplitude: enough to clear the arch (an ellipse wider than the
  // arch so the fender flows), plus the style's rear haunch
  const upper = (x, th, fend) => {
    const w = half(x)
    const ys = shoulder(x)
    const yT = top(x)
    const s = Math.sin(th)
    const c = Math.cos(th)
    const e = 2 / st.nu
    const bump = Math.exp(-(((th - TH_P) / 0.36) ** 2))
    return [w * (1 - st.gh.tumble * 0.28 * s) * Math.abs(c) ** e, ys + (yT - ys) * Math.abs(s) ** e + bump * fend]
  }
  const fender = (x) => {
    let need = 0
    for (const ax of [AXLE_F, AXLE_R]) {
      const dx = x - ax
      const span = ARCH_R + 0.2
      if (Math.abs(dx) < span) {
        const env = WHEEL_R + (ARCH_R + 0.06) * Math.sqrt(1 - (dx / span) ** 2)
        need = Math.max(need, env - upper(x, TH_P, 0)[1])
      }
    }
    const hip = st.haunch * Math.exp(-(((x - AXLE_R - 0.15) / 0.75) ** 2))
    return Math.max(need, hip, 0)
  }
  const fendCache = new Map()
  const fend = (x) => {
    let f = fendCache.get(x)
    if (f === undefined) fendCache.set(x, (f = fender(x)))
    return f
  }
  const point = (x, v) => {
    const w = half(x)
    const yB = bottom(x)
    const ys = shoulder(x)
    const rb = Math.min(0.13, (ys - yB) * 0.6, w * 0.5)
    let y, z
    if (v <= V_CORNER) {
      z = (v / V_CORNER) * (w - rb)
      y = yB
    } else if (v <= V_SIDE) {
      const a = -Math.PI / 2 + ((v - V_CORNER) / (V_SIDE - V_CORNER)) * (Math.PI / 2)
      z = w - rb + rb * Math.cos(a) - 0.03
      y = yB + rb + rb * Math.sin(a)
      z += 0.03 * ((v - V_CORNER) / (V_SIDE - V_CORNER))
    } else if (v <= V_SHOULDER) {
      const t = (v - V_SIDE) / (V_SHOULDER - V_SIDE)
      z = w
      y = yB + rb + (ys - yB - rb) * t
    } else {
      const th = ((v - V_SHOULDER) / (1 - V_SHOULDER)) * (Math.PI / 2)
      ;[z, y] = upper(x, th, fend(x))
    }
    const a = arch(x)
    if (a && z > a.zin && y < a.y) y = a.y
    return [x, y, z]
  }
  // ring for the loft: the floor gets explicit samples either side of the
  // wheel-well wall so the well is a clean vertical cut
  const ring = (x) => {
    const w = half(x)
    const yB = bottom(x)
    const ys = shoulder(x)
    const rb = Math.min(0.13, (ys - yB) * 0.6, w * 0.5)
    const zmax = w - rb
    const pts = []
    const zin = Math.min(wheelZ.f, wheelZ.r) - TYRE_W / 2 - 0.05
    const floorZ = [0, 0.3, zin - 0.004, zin + 0.004, zin + 0.12].map((z, k) => Math.max(0, Math.min(z, zmax - (4 - k) * 0.01)))
    for (const z of floorZ) pts.push(point(x, (Math.min(z, zmax) / Math.max(zmax, 1e-6)) * V_CORNER))
    for (let i = 0; i <= 4; i++) pts.push(point(x, V_CORNER + (i / 4) * (V_SIDE - V_CORNER) + (i === 0 ? 1e-4 : 0)))
    for (let i = 1; i <= 3; i++) pts.push(point(x, V_SIDE + (i / 3) * (V_SHOULDER - V_SIDE)))
    for (let i = 1; i <= 13; i++) pts.push(point(x, V_SHOULDER + (i / 13) * (1 - V_SHOULDER)))
    return pts
  }
  // inverse of the plan outline near a tip: x where half(x) = f * wMax
  const xAtWidth = (f, end) => {
    let a = end > 0 ? xc : tipR
    let b = end > 0 ? tipF : xc
    for (let i = 0; i < 40; i++) {
      const m = (a + b) / 2
      const wide = half(m) > f * wMax
      if (end > 0) wide ? (a = m) : (b = m)
      else wide ? (b = m) : (a = m)
    }
    return (a + b) / 2
  }
  // body top height at (x, z) along the shoulder (for seating the cabin)
  const topAt = (x, z) => {
    let lo = 0
    let hi = Math.PI / 2
    for (let i = 0; i < 24; i++) {
      const m = (lo + hi) / 2
      const p = point(x, V_SHOULDER + (m / (Math.PI / 2)) * (1 - V_SHOULDER))
      if (p[2] > z) lo = m
      else hi = m
    }
    return point(x, V_SHOULDER + (lo / (Math.PI / 2)) * (1 - V_SHOULDER))[1]
  }
  return { top, half, bottom, shoulder, point, ring, arch, wheelZ, tipF, tipR, xAtWidth, topAt }
}

// --- the cabin surface ---------------------------------------------------------------------------
// cabinPoint(x, v): v 0 = where it meets the body side, 1 = roof centre;
// v < 0 dips into the body.
function makeCabin(st, B) {
  const g = st.gh
  const yA = B.top(g.xa)
  const yD = B.top(g.xd)
  const roofY = (x) => {
    if (x >= g.xa || x <= g.xd) return B.top(x)
    if (x >= g.xb) {
      const t = (g.xa - x) / (g.xa - g.xb)
      return yA + (g.roof - yA) * (1 - (1 - t) ** 1.8)
    }
    if (x >= g.xc) {
      const t = (g.xb - x) / (g.xb - g.xc)
      return g.roof + 0.025 * Math.sin(Math.PI * t)
    }
    const t = (g.xc - x) / (g.xc - g.xd)
    return g.roof + (yD - g.roof) * t ** 1.55
  }
  const H = (x) => Math.max(0, roofY(x) - B.top(x))
  const gw = (x) => {
    const t = (x - g.xd) / (g.xa - g.xd)
    const ends = 0.82 + 0.18 * Math.sin(Math.PI * clamp01(t)) ** 0.5
    return B.half(x) * g.w * ends
  }
  const N = 2.6
  const point = (x, v) => {
    const w = gw(x)
    if (v < 0) {
      const y = B.topAt(x, w) - 0.02 + v * 0.5
      return [x, y, w * (1 + v * 0.3)]
    }
    const th = v * (Math.PI / 2)
    const s = Math.sin(th)
    const c = Math.cos(th)
    const z = w * (1 - g.tumble * s) * Math.abs(c) ** (2 / N)
    return [x, B.topAt(x, z) - 0.015 + H(x) * Math.abs(s) ** (2 / N), z]
  }
  const ring = (x) => {
    const pts = [point(x, -0.6), point(x, -0.3)]
    pts[0][2] = 0
    for (let i = 0; i <= 12; i++) pts.push(point(x, i / 12))
    return pts
  }
  return { point, ring, H, roofY, gw }
}

// --- geometry builders -----------------------------------------------------------------------------
// Loft through right-half rings (bottom -> top), mirrored to a closed ring.
function loft(xs, ringFn, crease = Math.PI / 4) {
  const rings = xs.map((x) => {
    const r = ringFn(x)
    const left = r.slice(0, -1).reverse().map(([px, py, pz]) => [px, py, -pz])
    return r.concat(left)
  })
  const m = rings[0].length
  const pos = new Float32Array(xs.length * m * 3)
  let k = 0
  for (const r of rings) for (const p of r) (pos[k++] = p[0]), (pos[k++] = p[1]), (pos[k++] = p[2])
  const idx = []
  // xs run tail -> nose (increasing x); v runs around the ring
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < m - 1; j++) {
      const a = i * m + j
      const b = (i + 1) * m + j
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setIndex(idx)
  return toCreasedNormals(geo, crease)
}

// A patch laid on a surface: map(a, b) -> [x, v] for a, b in [0, 1]; a along
// the length (increasing x), b around the section (increasing v). Pushed out
// `off` along the surface normal; both sides unless side is given.
const _pa = new Vector3()
const _pb = new Vector3()
const _pc = new Vector3()
function patch(surf, map, { nx = 6, nv = 4, off = 0.006, sides = [1, -1] } = {}) {
  const pts = []
  const eps = 1e-3
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= nv; j++) {
      const [x, v] = map(i / nx, j / nv)
      const p = surf(x, v)
      // one-sided differences that never step past the roof / floor centreline
      const ex = x + eps < 2.6 ? eps : -eps
      const ev = v + eps <= 1 ? eps : -eps
      const px = surf(x + ex, v)
      const pv = surf(x, v + ev)
      _pa.set((px[0] - p[0]) * Math.sign(ex), (px[1] - p[1]) * Math.sign(ex), (px[2] - p[2]) * Math.sign(ex))
      _pb.set((pv[0] - p[0]) * Math.sign(ev), (pv[1] - p[1]) * Math.sign(ev), (pv[2] - p[2]) * Math.sign(ev))
      _pc.crossVectors(_pa, _pb).normalize()
      pts.push([p[0] + _pc.x * off, p[1] + _pc.y * off, p[2] + _pc.z * off])
    }
  }
  const out = []
  for (const side of sides) {
    const pos = new Float32Array(pts.length * 3)
    pts.forEach((p, n) => pos.set([p[0], p[1], p[2] * side], n * 3))
    const idx = []
    const m = nv + 1
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nv; j++) {
        const a = i * m + j
        const b = (i + 1) * m + j
        if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1)
        else idx.push(a, a + 1, b, b, a + 1, b + 1)
      }
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(pos, 3))
    geo.setIndex(idx)
    geo.computeVertexNormals()
    out.push(geo)
  }
  return out
}
const rect = (x0, x1, v0, v1) => (a, b) => [x0 + (x1 - x0) * a, v0 + (v1 - v0) * b]

// A thin horizontal blade following the body's plan outline from x0 to x1
// (splitters, sill blades), standing out `out` past the body.
function outlineBlade(B, x0, x1, out, y, thick) {
  const s = new Shape()
  const n = 16
  const xs = []
  for (let i = 0; i <= n; i++) xs.push(x0 + ((x1 - x0) * i) / n)
  s.moveTo(x0, -(B.half(x0) + out))
  for (const x of xs) s.lineTo(x, -(Math.min(B.half(Math.min(x, B.tipF - 0.005)), B.half(x0)) + out))
  for (const x of xs.reverse()) s.lineTo(x, Math.min(B.half(Math.min(x, B.tipF - 0.005)), B.half(x0)) + out)
  const geo = new ExtrudeGeometry(s, { depth: thick, bevelEnabled: false })
  geo.rotateX(Math.PI / 2)
  geo.translate(0, y + thick / 2, 0)
  return geo
}

// The parts list, sorted into material roles, then merged.
class Parts {
  constructor() {
    this.roles = new Map()
  }
  add(role, geos, matrix) {
    let list = this.roles.get(role)
    if (!list) this.roles.set(role, (list = []))
    for (const g0 of [].concat(geos)) {
      let g = g0.index ? g0.toNonIndexed() : g0
      if (g === g0) g = g0.clone()
      for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n)
      if (!g.attributes.normal) g.computeVertexNormals()
      if (matrix) g.applyMatrix4(matrix)
      list.push(g)
    }
  }
  // a primitive placed with position / rotation / scale
  put(role, geo, x, y, z, { rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
    _o.position.set(x, y, z)
    _o.rotation.set(rx, ry, rz)
    _o.scale.set(sx, sy, sz)
    _o.updateMatrix()
    this.add(role, geo, _o.matrix)
  }
  // the same primitive on both sides (z and -z)
  pair(role, geo, x, y, z, opts = {}) {
    this.put(role, geo, x, y, z, opts)
    this.put(role, geo, x, y, -z, { ...opts, rx: -(opts.rx ?? 0), ry: -(opts.ry ?? 0) })
  }
  merged() {
    const out = new Map()
    for (const [role, list] of this.roles) {
      const g = mergeGeometries(list)
      for (const l of list) l.dispose()
      if (g) out.set(role, g)
    }
    return out
  }
}
const _o = new Object3D()

// --- wheels ----------------------------------------------------------------------------------------
function tyreGeo() {
  const r0 = 0.255
  const R = WHEEL_R
  const hw = TYRE_W / 2
  const pts = [
    [r0, -hw + 0.01],
    [R - 0.07, -hw],
    [R - 0.025, -hw + 0.015],
    [R - 0.004, -hw + 0.05],
    [R, -hw + 0.08],
    [R, hw - 0.08],
    [R - 0.004, hw - 0.05],
    [R - 0.025, hw - 0.015],
    [R - 0.07, hw],
    [r0, hw - 0.01],
  ].map(([r, y]) => new Vector2(r, y))
  return new LatheGeometry(pts, 26).rotateX(Math.PI / 2)
}

// One wheel's parts at (x, z) on `side`; spokes is the rim pattern.
function addWheel(P, x, z, side, spokes, front) {
  const y = WHEEL_R
  const face = z + side * (TYRE_W / 2 - 0.03) // rim face plane
  P.put('tyre', geoOnce('tyre', tyreGeo), x, y, z)
  // tread grooves
  for (const t of [-0.07, 0.07]) P.put('dark', geoOnce('groove', () => new TorusGeometry(WHEEL_R + 0.001, 0.006, 3, 26)), x, y, z + t)
  // barrel + rim lip
  P.put('dark', geoOnce('barrel', () => new CylinderGeometry(0.255, 0.255, TYRE_W - 0.02, 28, 1, true).rotateX(Math.PI / 2)), x, y, z)
  P.put('rim', geoOnce('lip', () => new TorusGeometry(0.252, 0.016, 6, 32)), x, y, face)
  // dish behind the spokes
  P.put('dark', geoOnce('dish', () => new CircleGeometry(0.25, 28)), x, y, face - side * 0.085, { ry: side > 0 ? 0 : Math.PI })
  // brake disc + caliper
  P.put('disc', geoOnce('disc', () => new CylinderGeometry(0.205, 0.205, 0.025, 28).rotateX(Math.PI / 2)), x, y, face - side * 0.07)
  P.put('dark', geoOnce('discHub', () => new CylinderGeometry(0.1, 0.1, 0.03, 16).rotateX(Math.PI / 2)), x, y, face - side * 0.068)
  const ca = front ? 0.75 : 2.4
  P.put('caliper', geoOnce('caliper', () => new BoxGeometry(0.1, 0.17, 0.07)), x + Math.cos(ca) * 0.17, y + Math.sin(ca) * 0.17, face - side * 0.055, { rz: ca - Math.PI / 2 })
  // spokes, dished: they lean in toward the hub
  const twin = spokes.twin
  for (let i = 0; i < spokes.n; i++) {
    const a0 = (i / spokes.n) * Math.PI * 2
    for (const d of twin ? [-0.11, 0.11] : [0]) {
      const a = a0 + d
      const r = 0.155
      P.put('rim', geoOnce(`spoke${twin ? 't' : ''}`, () => new BoxGeometry(twin ? 0.032 : 0.05, 0.19, 0.03)), x + Math.cos(a + Math.PI / 2) * r, y + Math.sin(a + Math.PI / 2) * r, face - side * 0.025, {
        rz: a,
        rx: side * 0.22 * Math.cos(a),
        ry: -side * 0.22 * Math.sin(a),
      })
    }
  }
  // hub, centre lock and lug nuts
  P.put('rim', geoOnce('hub', () => new CylinderGeometry(0.07, 0.078, 0.05, 20).rotateX(Math.PI / 2)), x, y, face - side * 0.035)
  P.put('chrome', geoOnce('nut', () => new CylinderGeometry(0.032, 0.032, 0.03, 6).rotateX(Math.PI / 2)), x, y, face - side * 0.0)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3
    P.put('chrome', geoOnce('lug', () => new CylinderGeometry(0.011, 0.011, 0.02, 6).rotateX(Math.PI / 2)), x + Math.cos(a) * 0.05, y + Math.sin(a) * 0.05, face - side * 0.008)
  }
}

const geoCache = new Map()
function geoOnce(key, make) {
  let g = geoCache.get(key)
  if (!g) geoCache.set(key, (g = make()))
  return g
}

// --- the whole car, per style -----------------------------------------------------------------------
const SPOKES = { super: { n: 5, twin: true }, hyper: { n: 7, twin: false }, sport: { n: 5, twin: false }, coupe: { n: 10, twin: false } }

function buildParts(styleKey, { trim, neonKit }) {
  const st = STYLES[styleKey]
  const B = makeBody(st)
  const C = makeCabin(st, B)
  const g = st.gh
  const P = new Parts()
  const bp = B.point
  const cp = C.point
  const fx = B.tipF
  const rx = B.tipR

  // Body loft: stations clustered at the tips and around each arch.
  const xs = new Set()
  const n = 50
  for (let i = 0; i <= n; i++) {
    const u = -1 + (2 * i) / n
    xs.add(((fx + rx) / 2 + ((fx - rx) / 2) * (0.55 * u + 0.45 * Math.sin((Math.PI * u) / 2))).toFixed(5))
  }
  for (const ax of [AXLE_F, AXLE_R]) {
    for (let k = 0; k <= 14; k++) xs.add((ax + Math.cos((k / 14) * Math.PI) * (ARCH_R - 0.0015)).toFixed(5))
    for (const s of [-1, 1]) xs.add((ax + s * (ARCH_R + 0.0015)).toFixed(5))
  }
  const bodyXs = [...xs].map(Number).filter((x) => x >= rx && x <= fx).sort((a, b) => a - b)
  P.add('body', loft(bodyXs, B.ring))

  // Cabin loft.
  const cabXs = []
  for (let i = 0; i <= 34; i++) cabXs.push(g.xd + ((g.xa - g.xd) * i) / 34)
  P.add('body', loft(cabXs, C.ring, Math.PI / 3))

  // Wheel-well liners and the floor pan.
  for (const ax of [AXLE_F, AXLE_R]) {
    const k = ax > 0 ? 'f' : 'r'
    const zin = B.wheelZ[k] - TYRE_W / 2 - 0.045
    const liner = geoOnce('liner', () => new CircleGeometry(ARCH_R + 0.01, 24, 0, Math.PI))
    P.put('dark', liner, ax, WHEEL_R, zin)
    P.put('dark', liner, ax, WHEEL_R, -zin, { ry: Math.PI })
  }
  P.put('dark', geoOnce('floor', () => new BoxGeometry(1, 1, 1)), (fx + rx) / 2, 0.2, 0, { sx: fx - rx - 0.5, sy: 0.04, sz: W * 0.8 })

  // --- glass: windscreen, side windows, rear glass, each in a black frame ---
  const thA = 0.64 // v where the side windows end and the roof / screens begin
  const glass = (map, frameMap) => {
    P.add('trim', patch(cp, frameMap, { nx: 14, nv: 8, off: 0.004 }))
    P.add('glass', patch(cp, map, { nx: 14, nv: 8, off: 0.009 }))
  }
  // windscreen (both halves meet on the centreline)
  glass(rect(g.xb + 0.04, g.xa - 0.035, thA + 0.06, 1), rect(g.xb + 0.01, g.xa - 0.005, thA + 0.03, 1))
  // side windows: run from the screen base back to the roof rear, rising with the screen
  const sideFront = g.xa - 0.1
  const sideRear = g.split ?? g.xc + (g.rear === 'louvre' ? 0.05 : -0.08)
  const sideMap = (x0, x1, pad) => (a, b) => {
    const x = x0 + (x1 - x0) * a
    // the window's top edge follows the A-pillar: low near the screen base
    const lift = smooth(g.xa, g.xb + 0.05, x)
    return [x, 0.16 - pad * 0.5 + (0.04 + 0.4 * lift + pad - 0.16 + thA - 0.44) * b]
  }
  glass(sideMap(sideRear + 0.02, sideFront - 0.02, 0), sideMap(sideRear - 0.01, sideFront + 0.01, 0.05))
  if (g.split) {
    // rear quarter window behind a B-pillar
    const q0 = g.xc - 0.35
    const q1 = g.split - 0.08
    const qMap = (pad) => (a, b) => [q0 - pad + (q1 - q0 + pad * 2) * a, 0.2 - pad + (thA - 0.28 + pad * 2) * b * (0.55 + 0.45 * a)]
    glass(qMap(0), qMap(0.03))
  }
  if (g.rear === 'glass') {
    glass(rect(g.xd + 0.32, g.xc - 0.03, thA + 0.06, 1), rect(g.xd + 0.29, g.xc - 0.005, thA + 0.03, 1))
  } else {
    // engine-cover louvres: a dark panel with body-colour slats over it
    const x0 = g.xd + 0.18
    const x1 = g.xc - 0.04
    P.add('glass', patch(cp, rect(g.xc - 0.22, g.xc - 0.03, thA + 0.06, 1), { nx: 4, nv: 8, off: 0.009 }))
    P.add('trim', patch(cp, rect(x0, x1 - 0.2, 0.55, 1), { nx: 12, nv: 8, off: 0.004 }))
    const slats = 7
    for (let i = 0; i < slats; i++) {
      const sx = x0 + 0.04 + ((x1 - 0.24 - x0) * i) / (slats - 1)
      P.add('body', patch(cp, rect(sx - 0.025, sx + 0.025, 0.55, 1), { nx: 1, nv: 8, off: 0.022 }))
    }
  }

  // --- panel gaps, handles, side intakes ---
  const line = (map, nx = 8) => P.add('trim', patch(bp, map, { nx, nv: 1, off: 0.003 }))
  const doorF = g.xa + 0.08
  const doorR = g.door ?? g.split - 0.04
  const doorLow = 0.33
  line((a, b) => [doorF - 0.008 + 0.016 * b, doorLow + (0.98 - doorLow) * a], 10)
  line((a, b) => [doorR - 0.008 + 0.016 * b, doorLow + (0.98 - doorLow) * a], 10)
  line(rect(doorR, doorF, doorLow - 0.006, doorLow + 0.006))
  P.add('trim', patch(bp, rect(doorR + 0.12, doorR + 0.3, 0.5, 0.53), { nx: 2, nv: 1, off: 0.008 }))
  // hood shut line + bonnet front edge
  const hoodR = g.xa + 0.02
  line((a, b) => [hoodR - 0.006 + 0.012 * b, 0.6 + 0.4 * a], 6)
  if (st.intakes) {
    // big side scoop in front of the rear wheel, with a body-colour blade
    const s0 = AXLE_R + ARCH_R + 0.08
    const s1 = doorR - 0.06
    const top = (a) => 0.36 + 0.06 + 0.13 * a
    P.add('trim', patch(bp, (a, b) => [s0 + (s1 - s0) * a, 0.34 + (top(a) - 0.34) * b], { nx: 8, nv: 6, off: 0.004 }))
    P.add('accent', patch(bp, (a, b) => [s0 - 0.03 + (s1 - s0 + 0.06) * a, 0.325 + 0.03 * b], { nx: 8, nv: 1, off: 0.016 }))
    for (let i = 1; i <= 3; i++) {
      const a = i / 4
      const sx = s0 + (s1 - s0) * a
      P.add('dark', patch(bp, rect(sx - 0.012, sx + 0.012, 0.36, top(a) - 0.015), { nx: 1, nv: 4, off: 0.009 }))
    }
  }
  if (st.gills) {
    // vents behind the front wheel
    for (let i = 0; i < 3; i++) {
      const gx = AXLE_F - ARCH_R - 0.12 - i * 0.07
      P.add('trim', patch(bp, rect(gx - 0.02, gx + 0.02, 0.36, 0.56), { nx: 1, nv: 4, off: 0.005 }))
    }
  }

  // --- lights ---
  // front fascia, mapped by width fraction so features sit on the nose face
  const xw = (f) => B.xAtWidth(f, 1)
  const faceMap = (f0, f1, v0, v1) => (a, b) => [xw(f1 + (f0 - f1) * a), v0 + (v1 - v0) * b]
  // headlights on the front corners
  // lamp quad: x0..x1 back from the nose tip, v0..v1 around the section,
  // the inner edge swept back so the lamp reads as a slanted eye
  const [lx0, lx1, lv0, lv1] = st.headLamp
  const lamp = (pad, sweep = 0.12) => (a, b) => [fx - lx0 - pad + (lx0 - lx1 + pad * 2) * a - sweep * b * (1 - a), lv0 - pad + (lv1 - lv0 + pad * 2) * b]
  P.add('trim', patch(bp, lamp(0.03), { nx: 10, nv: 5, off: 0.005 }))
  P.add('lens', patch(bp, lamp(0), { nx: 10, nv: 5, off: 0.01 }))
  // DRL strip along the lamp's lower edge
  P.add('drl', patch(bp, (a, b) => lamp(0.015)(a, b * 0.12), { nx: 10, nv: 1, off: 0.013 }))
  if (st.head === 'round' || st.head === 'pod') {
    for (const f of [0.3, 0.72]) {
      P.add('drl', patch(bp, (a, b) => lamp(0)(f - 0.07 + a * 0.14, 0.3 + b * 0.45), { nx: 3, nv: 3, off: 0.014 }))
    }
  }
  P.add('trim', patch(bp, faceMap(0.05, 0.38, 0.2, 0.4), { nx: 8, nv: 4, off: 0.005 }))
  P.add('trim', patch(bp, faceMap(0.5, 0.86, 0.21, 0.38), { nx: 8, nv: 4, off: 0.005 }))
  for (let i = 0; i < 4; i++) {
    const v = 0.24 + i * 0.04
    P.add('dark', patch(bp, faceMap(0.07, 0.36, v - 0.006, v + 0.006), { nx: 6, nv: 1, off: 0.009 }))
  }
  // splitter: a thin blade following the nose outline
  P.add('accent', outlineBlade(B, AXLE_F + ARCH_R + 0.02, fx + 0.04, 0.035, 0.19, 0.035))
  if (st.hoodVents) {
    for (const s of [1, -1]) {
      const vx0 = AXLE_F - 0.22
      const vx1 = AXLE_F + 0.28
      P.add('trim', patch(bp, rect(vx0, vx1, 0.8, 0.9), { nx: 4, nv: 3, off: 0.005, sides: [s] }))
      for (let i = 1; i < 4; i++) {
        const lx = vx0 + ((vx1 - vx0) * i) / 4
        P.add('body', patch(bp, rect(lx - 0.012, lx + 0.012, 0.8, 0.9), { nx: 1, nv: 3, off: 0.011, sides: [s] }))
      }
    }
  }
  // mirrors on stalks at the door's front top corner
  const mx = g.xa - 0.16
  const mp = cp(mx, 0.04)
  const mirror = geoOnce('mirror', () => new SphereGeometry(0.08, 14, 10))
  P.pair('body', mirror, mx - 0.03, mp[1] + 0.11, mp[2] + 0.09, { sx: 1.3, sy: 0.62, sz: 0.9 })
  P.pair('trim', geoOnce('mirrorGlass', () => new CircleGeometry(0.06, 14)), mx - 0.132, mp[1] + 0.11, mp[2] + 0.095, { ry: -Math.PI / 2, sy: 0.62 })
  P.pair('trim', geoOnce('stalk', () => new BoxGeometry(0.06, 0.1, 0.025)), mx, mp[1] + 0.05, mp[2] + 0.03, { rx: -0.7 })

  // --- rear: tail lights, diffuser, exhausts, wing ---
  const rw = (f) => B.xAtWidth(f, -1)
  const tailMap = (f0, f1, v0, v1) => (a, b) => [rw(f0 + (f1 - f0) * a), v0 + (v1 - v0) * b]
  // black rear panel the lights sit in
  P.add('trim', patch(bp, tailMap(0.0, 0.97, 0.66, 0.84), { nx: 12, nv: 4, off: 0.004 }))
  if (st.tail === 'bar') {
    P.add('tail', patch(bp, tailMap(0.0, 0.95, 0.73, 0.79), { nx: 12, nv: 2, off: 0.009 }))
  } else if (st.tail === 'round') {
    for (const [f0, f1] of [[0.48, 0.66], [0.72, 0.92]]) P.add('tail', patch(bp, tailMap(f0, f1, 0.69, 0.81), { nx: 4, nv: 3, off: 0.009 }))
  } else {
    // Y-shaped: a bar and a diagonal
    P.add('tail', patch(bp, tailMap(0.45, 0.95, 0.75, 0.8), { nx: 8, nv: 2, off: 0.009 }))
    P.add('tail', patch(bp, (a, b) => [rw(0.55 + 0.35 * a), 0.68 + 0.1 * a + 0.04 * b], { nx: 8, nv: 2, off: 0.009 }))
  }
  // reverse lights + centre brake light
  P.add('drl', patch(bp, tailMap(0.32, 0.42, 0.7, 0.74), { nx: 2, nv: 1, off: 0.009 }))
  P.add('tail', patch(bp, tailMap(0, 0.2, 0.83, 0.85), { nx: 3, nv: 1, off: 0.008 }))
  // diffuser
  P.add('trim', patch(bp, tailMap(0, 0.92, 0.2, 0.33), { nx: 10, nv: 3, off: 0.004 }))
  P.put('accent', geoOnce('diffuser', () => new BoxGeometry(1, 1, 1)), rx + 0.25, 0.27, 0, { sx: 0.5, sy: 0.12, sz: W * 0.78 })
  for (let i = -3; i <= 3; i++) P.put('dark', geoOnce('fin', () => new BoxGeometry(0.42, 0.16, 0.025)), rx + 0.23, 0.28, i * 0.2, { rz: -0.25 })
  // exhausts
  const pipe = geoOnce('pipe', () => new CylinderGeometry(0.055, 0.06, 0.25, 16, 1, true).rotateZ(Math.PI / 2))
  const pipeIn = geoOnce('pipeIn', () => new CircleGeometry(0.05, 14).rotateY(-Math.PI / 2))
  const pipes = st.exhaust === 'center' ? [[0, 0.5]] : st.exhaust === 'twin' ? [[0.28, 0.36], [-0.28, 0.36]] : [[0.62, 0.32], [0.48, 0.32], [-0.48, 0.32], [-0.62, 0.32]]
  for (const [pz, py] of pipes) {
    const big = st.exhaust === 'center'
    const s = big ? 1.5 : 1
    P.put('chrome', pipe, rx + 0.08, py, pz, { sx: 1, sy: s, sz: s })
    P.put('dark', pipeIn, rx + 0.0, py, pz, { sy: s, sz: s })
    if (big) {
      P.put('chrome', pipe, rx + 0.08, py, 0.17, { sy: s, sz: s })
      P.put('dark', pipeIn, rx + 0.0, py, 0.17, { sy: s, sz: s })
      P.put('chrome', pipe, rx + 0.08, py, -0.17, { sy: s, sz: s })
      P.put('dark', pipeIn, rx + 0.0, py, -0.17, { sy: s, sz: s })
    }
  }
  // wing
  const tailTop = B.top(rx + 0.3)
  if (st.wing === 'low' || st.wing === 'big') {
    const big = st.wing === 'big'
    const wy = tailTop + (big ? 0.36 : 0.17)
    const chord = big ? 0.5 : 0.38
    const span = W * (big ? 1.0 : 0.88)
    const foil = geoOnce(`foil${big}`, () => {
      const s = new Shape()
      s.moveTo(0, 0)
      s.bezierCurveTo(chord * 0.15, 0.05, chord * 0.6, 0.055, chord, 0.012)
      s.lineTo(chord, -0.004)
      s.bezierCurveTo(chord * 0.6, 0.02, chord * 0.2, -0.02, 0, 0)
      const geo = new ExtrudeGeometry(s, { depth: span, bevelEnabled: false, curveSegments: 10 })
      geo.translate(-chord, 0, -span / 2)
      return geo
    })
    P.put('accentGloss', foil, rx + 0.42, wy, 0, { rz: -0.12, ry: Math.PI, sx: 1 })
    if (big) {
      // swan-neck pylons + end plates
      for (const zz of [0.42, -0.42]) {
        P.put('accent', geoOnce('pylon', () => new BoxGeometry(0.12, 1, 0.04)), rx + 0.42, (wy + tailTop) / 2, zz, { sy: wy - tailTop + 0.05, rz: 0.3 })
      }
      P.pair('accent', geoOnce('plate', () => new BoxGeometry(0.62, 0.24, 0.025)), rx + 0.2, wy - 0.02, span / 2 + 0.012)
    } else {
      for (const zz of [0.55, -0.55]) P.put('accent', geoOnce('post', () => new BoxGeometry(0.1, 1, 0.05)), rx + 0.3, (wy + tailTop) / 2 - 0.02, zz, { sy: wy - tailTop + 0.06 })
      P.pair('accent', geoOnce('plateS', () => new BoxGeometry(0.42, 0.13, 0.02)), rx + 0.22, wy, span / 2 + 0.01)
    }
  } else if (st.wing === 'lip') {
    P.add('accentGloss', patch(bp, (a, b) => [rx + 0.06 + 0.16 * a, 0.95 + 0.05 * b], { nx: 3, nv: 2, off: 0.03 }))
  } else if (st.wing === 'duck') {
    // ducktail: a body-colour lip raised off the deck
    P.add('body', patch(bp, (a, b) => [rx + 0.05 + 0.3 * a, 0.88 + 0.12 * b], { nx: 4, nv: 4, off: 0.045 }))
  }
  if (st.scoop) {
    // roof snorkel
    const sx = (g.xb + g.xc) / 2
    const ry = C.roofY(sx)
    P.put('body', geoOnce('scoop', () => new SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), sx - 0.15, ry - 0.02, 0, { sx: 2.2, sy: 0.42, sz: 0.7 })
    P.put('dark', geoOnce('scoopMouth', () => new CircleGeometry(0.1, 14, 0, Math.PI).rotateY(Math.PI / 2)), sx + 0.27, ry + 0.0, 0, { sz: 1.2, sy: 0.8 })
  }

  // --- options ---
  if (trim) {
    // neon pinstripe along the sills
    P.add('trimNeon', patch(bp, rect(AXLE_R + ARCH_R + 0.05, AXLE_F - ARCH_R - 0.05, V_SIDE + 0.02, V_SIDE + 0.04), { nx: 10, nv: 1, off: 0.012 }))
  }
  if (neonKit) {
    // strips along the shoulders, the hood edges, the nose and the wing
    P.add('neon', patch(bp, rect(rx + 0.25, fx - 0.25, V_SHOULDER + 0.02, V_SHOULDER + 0.045), { nx: 40, nv: 1, off: 0.014 }))
    P.add('neon', patch(bp, rect(AXLE_F - 0.45, fx - 0.2, 0.86, 0.88), { nx: 10, nv: 1, off: 0.014 }))
    P.add('neon', patch(bp, faceMap(0.05, 0.9, 0.42, 0.45), { nx: 10, nv: 1, off: 0.014 }))
    P.add('neon', patch(cp, rect(g.xd + 0.1, g.xa - 0.1, 0.0, 0.03), { nx: 30, nv: 1, off: 0.012 }))
  }

  // the wheels (rims and tyres are roles too)
  const spokes = SPOKES[styleKey]
  for (const ax of [AXLE_F, AXLE_R]) {
    const wz = ax > 0 ? B.wheelZ.f : B.wheelZ.r
    for (const side of [1, -1]) addWheel(P, ax, side * wz, side, spokes, ax > 0)
  }

  const roles = P.merged()
  const tall = Math.max(g.roof, ...st.top.map((p) => p[1])) + 0.05
  return { roles, wheels: [[AXLE_F, B.wheelZ.f], [AXLE_F, -B.wheelZ.f], [AXLE_R, B.wheelZ.r], [AXLE_R, -B.wheelZ.r]], height: tall }
}

const partsCache = new Map()
function partsFor(style, trim, neonKit) {
  const key = `${style}|${trim ? 1 : 0}|${neonKit ? 1 : 0}`
  let p = partsCache.get(key)
  if (!p) partsCache.set(key, (p = buildParts(style, { trim, neonKit })))
  return p
}

// --- materials ------------------------------------------------------------------------------------
const shared = {}
function mats() {
  if (shared.glass) return shared
  const over = { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }
  shared.glass = new MeshPhysicalMaterial({ color: '#0b1220', metalness: 0.5, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, ...over })
  shared.trim = new MeshStandardMaterial({ color: '#0c0d11', roughness: 0.45, metalness: 0.2, ...over })
  shared.dark = new MeshStandardMaterial({ color: '#141519', roughness: 0.6, metalness: 0.2, side: DoubleSide, ...over })
  shared.tyre = new MeshStandardMaterial({ color: '#1a1b1f', roughness: 0.9 })
  shared.disc = new MeshStandardMaterial({ color: '#8a8f99', roughness: 0.35, metalness: 0.9 })
  shared.chrome = new MeshStandardMaterial({ color: '#d9dde6', roughness: 0.15, metalness: 1 })
  shared.lens = new MeshPhysicalMaterial({ color: '#dfe9f5', emissive: '#bcd6ff', emissiveIntensity: 0.55, roughness: 0.05, metalness: 0.2, clearcoat: 1, ...over })
  shared.drl = new MeshStandardMaterial({ color: '#ffffff', emissive: '#eef6ff', emissiveIntensity: 2.2, roughness: 0.3, ...over })
  shared.tail = neon('#ff1630', 2.4)
  shared.tail.polygonOffset = true
  shared.tail.polygonOffsetFactor = -1
  shared.tail.polygonOffsetUnits = -3
  shared.glow = new MeshBasicMaterial({ map: toTexture(paintSoftDot(128), { srgb: true }), transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide })
  return shared
}

const SHADOW_ROLES = new Set(['body', 'tyre', 'accent', 'accentGloss', 'rim'])

// Builds one car from a CARS key or a spec object.
export function buildCar(key) {
  const spec = typeof key === 'string' ? CARS[key] : key
  const style = STYLES[spec.style] ? spec.style : 'super'
  const M = mats()
  const car = new Group()
  car.name = `car:${typeof key === 'string' ? key : style}`

  const body = paint(spec.body, spec.neon ? { metalness: 0.5, roughness: 0.25 } : undefined)
  const accent = new MeshStandardMaterial({ color: spec.accent, roughness: 0.45, metalness: 0.3, side: DoubleSide })
  const accentGloss = new MeshPhysicalMaterial({ color: spec.accent, roughness: 0.2, metalness: 0.4, clearcoat: 1, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })
  const rim = new MeshStandardMaterial({ color: spec.rim, roughness: 0.25, metalness: 0.85, side: DoubleSide })
  const caliper = new MeshStandardMaterial({ color: spec.caliper ?? '#e0261d', roughness: 0.4 })
  const byRole = { body, accent, accentGloss, rim, caliper, ...M }
  if (spec.trim) byRole.trimNeon = neon(spec.trim, 1.6)
  if (spec.neon) byRole.neon = neon(spec.neon, 3.2)

  const parts = partsFor(style, !!spec.trim, !!spec.neon)
  for (const [role, geo] of parts.roles) {
    const mat = byRole[role]
    if (!mat) continue
    const m = new Mesh(geo, mat)
    m.castShadow = SHADOW_ROLES.has(role)
    m.receiveShadow = true
    car.add(m)
  }

  // Neon kit under-glow.
  if (spec.neon) {
    const glowMat = M.glow.clone()
    glowMat.color.set(spec.neon)
    glowMat.opacity = 0.75
    const under = new Mesh(new PlaneGeometry(L * 1.25, W * 1.7), glowMat)
    under.rotation.x = -Math.PI / 2
    under.position.y = 0.04
    car.add(under)
  }

  // Wheel anchors (the wheel geometry is merged into the car).
  car.userData.wheels = parts.wheels.map(([x, z]) => {
    const o = new Object3D()
    o.position.set(x, WHEEL_R, z)
    car.add(o)
    return o
  })
  car.userData.size = { length: L, width: W, height: parts.height }
  return car
}
