import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
} from 'three'
import { mulberry32, paintSparkle, paintSoftDot, toTexture } from '../textures.js'

// Particles.
//  - sparkleField: a fixed set of points whose whole life (rise, sway, twinkle,
//    fade) is computed in the vertex shader from a per-point seed and uTime, so
//    it costs nothing on the CPU. Used for block sparkles, the podium, the
//    leaderboards, the shop and the ambient pollen.
//  - createBursts: a small CPU pool for one-off pops (a block breaking).
// Point size is in metres; `fxView.value` (pixels per metre at 1 m) is kept
// up to date by main.js on resize.

export const fxView = { value: 600 }
export const fxBoost = { value: 1 } // HDR multiplier: >1 with bloom on so sparkles glow
let sparkleTex = null
let dotTex = null
const textures = () => {
  sparkleTex ??= toTexture(paintSparkle(64), { srgb: true })
  dotTex ??= toTexture(paintSoftDot(64), { srgb: true })
}

const vertex = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform float uLife;
  uniform float uRise;
  uniform float uDrift;
  uniform float uSize;
  uniform float uView;
  varying float vAlpha;
  void main() {
    float t = fract(uTime / uLife * (0.75 + aSeed.w * 0.5) + aSeed.z);
    vec3 p = position;
    p.y += t * uRise * uLife;
    p.x += sin(uTime * (0.8 + aSeed.x) + aSeed.z * 30.0) * uDrift;
    p.z += cos(uTime * (0.7 + aSeed.y) + aSeed.w * 30.0) * uDrift;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float twinkle = 0.65 + 0.35 * sin(uTime * 9.0 + aSeed.x * 40.0);
    vAlpha = sin(t * 3.14159) * twinkle;
    gl_PointSize = uSize * uView * (0.6 + aSeed.y * 0.8) / max(-mv.z, 0.1);
    gl_Position = projectionMatrix * mv;
  }`
const fragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform float uBoost;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    float a = tex.a * vAlpha * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor * tex.rgb * uBoost, a);
  }`

const fields = []

// box: spawn volume half-extents around `center` (y spans 0..box.y above center.y).
export function sparkleField({ count, center, box, rise = 0.6, life = 2.5, drift = 0.25, size = 0.35, color = '#ffffff', opacity = 1, soft = false, seed = 1 }) {
  textures()
  const rand = mulberry32(seed)
  const pos = new Float32Array(count * 3)
  const seeds = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    pos[i * 3] = center.x + (rand() * 2 - 1) * box.x
    pos[i * 3 + 1] = center.y + rand() * box.y
    pos[i * 3 + 2] = center.z + (rand() * 2 - 1) * box.z
    seeds.set([rand(), rand(), rand(), rand()], i * 4)
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setAttribute('aSeed', new BufferAttribute(seeds, 4))
  const mat = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLife: { value: life },
      uRise: { value: rise },
      uDrift: { value: drift },
      uSize: { value: size },
      uView: fxView,
      uMap: { value: soft ? dotTex : sparkleTex },
      uColor: { value: new Color(color) },
      uBoost: fxBoost,
      uOpacity: { value: opacity },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  const points = new Points(geo, mat)
  points.frustumCulled = false
  fields.push(mat)
  return points
}

export function updateFields(elapsed) {
  for (const m of fields) m.uniforms.uTime.value = elapsed
}

// --- Bursts -------------------------------------------------------------------
const burstVertex = /* glsl */ `
  attribute float aLife;
  attribute vec3 aColor;
  uniform float uSize;
  uniform float uView;
  varying float vLife;
  varying vec3 vColor;
  void main() {
    vLife = aLife;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aLife > 0.0 ? uSize * uView * (0.4 + aLife * 0.8) / max(-mv.z, 0.1) : 0.0;
    gl_Position = projectionMatrix * mv;
  }`
const burstFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uBoost;
  varying float vLife;
  varying vec3 vColor;
  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    float a = tex.a * clamp(vLife * 1.6, 0.0, 1.0);
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * tex.rgb * uBoost, a);
  }`

export function createBursts(max = 240) {
  textures()
  const pos = new Float32Array(max * 3)
  const vel = new Float32Array(max * 3)
  const life = new Float32Array(max)
  const col = new Float32Array(max * 3)
  const geo = new BufferGeometry()
  const posAttr = new BufferAttribute(pos, 3)
  const lifeAttr = new BufferAttribute(life, 1)
  const colAttr = new BufferAttribute(col, 3)
  geo.setAttribute('position', posAttr)
  geo.setAttribute('aLife', lifeAttr)
  geo.setAttribute('aColor', colAttr)
  const points = new Points(
    geo,
    new ShaderMaterial({
      uniforms: { uSize: { value: 0.45 }, uView: fxView, uMap: { value: sparkleTex }, uBoost: fxBoost },
      vertexShader: burstVertex,
      fragmentShader: burstFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  )
  points.frustumCulled = false
  let next = 0
  const tmp = new Color()
  const rand = mulberry32(99)
  return {
    points,
    emit(x, y, z, color, n = 24, speed = 5) {
      tmp.set(color)
      for (let i = 0; i < n; i++) {
        const k = next
        next = (next + 1) % max
        pos.set([x, y, z], k * 3)
        const a = rand() * Math.PI * 2
        const up = rand()
        const s = speed * (0.4 + rand() * 0.6)
        vel.set([Math.cos(a) * s * (1 - up * 0.5), 2 + up * speed, Math.sin(a) * s * (1 - up * 0.5)], k * 3)
        life[k] = 0.7 + rand() * 0.5
        col.set([tmp.r, tmp.g, tmp.b], k * 3)
      }
    },
    update(dt) {
      for (let k = 0; k < max; k++) {
        if (life[k] <= 0) continue
        life[k] -= dt
        vel[k * 3 + 1] -= 9 * dt
        pos[k * 3] += vel[k * 3] * dt
        pos[k * 3 + 1] += vel[k * 3 + 1] * dt
        pos[k * 3 + 2] += vel[k * 3 + 2] * dt
      }
      posAttr.needsUpdate = true
      lifeAttr.needsUpdate = true
      colAttr.needsUpdate = true
    },
  }
}
