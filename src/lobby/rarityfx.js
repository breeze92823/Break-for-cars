import { AdditiveBlending, Color, CylinderGeometry, DoubleSide, Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three'
import { RARITY_COLORS, RARITY_LADDER } from '../config.js'
import { fxBoost, sparkleField, trackTime } from './fx.js'

// The aura under and around a parked car, stronger the rarer it is. Everything
// animates in shaders from the shared uTime (fx.js updateFields), so a garage
// full of cars costs no CPU per frame. Built in the car holder's frame: the car
// is ~7 m long along X and ~3 m wide along Z, origin on the floor.
//
//   Common     soft ground glow
//   Uncommon   + rising sparkles
//   Epic       + a ring of sparkles circling the car
//   Legendary  + golden embers and a faint light column
//   Mythic     + fire embers, brighter column, faster orbit
//   Secret     rainbow glow and column, sparkles in four colours, two counter-rotating rings

const RX = 4.4 // aura half-length (along the car)
const RZ = 2.5 // aura half-width

const glowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`
const hsv = /* glsl */ `
  vec3 hsv2rgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
  }`

// Ground glow: a soft filled ellipse with a brighter rim, breathing; a sweep of
// light runs round the rim.
const groundFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uStrength;
  uniform float uRainbow;
  uniform float uSeed;
  uniform float uBoost;
  varying vec2 vUv;
  ${hsv}
  void main() {
    vec2 q = vUv * 2.0 - 1.0;
    float d = length(q);
    if (d > 1.0) discard;
    float ang = atan(q.y, q.x);
    float pulse = 0.78 + 0.22 * sin(uTime * 2.2 + uSeed);
    float fill = (1.0 - smoothstep(0.0, 0.95, d)) * 0.55;
    float e = (d - 0.86) / 0.06;
    float rim = exp(-e * e); // never pow() a negative base: NaN, which bloom smears over the screen
    float sweep = 0.5 + 0.5 * sin(ang * 2.0 - uTime * 2.5 + uSeed);
    float a = (fill + rim * (0.6 + 0.6 * sweep)) * pulse * uStrength;
    vec3 col = mix(uColor, hsv2rgb(vec3(fract(ang / 6.2832 + uTime * 0.12), 0.75, 1.0)), uRainbow);
    gl_FragColor = vec4(col * uBoost, a);
  }`

// Light column: an open cylinder fading upward, with slow vertical streaks
// drifting round it.
const columnFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uStrength;
  uniform float uRainbow;
  uniform float uBoost;
  varying vec2 vUv;
  ${hsv}
  void main() {
    float fade = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.8);
    float streak = 0.55 + 0.45 * sin(vUv.x * 6.2832 * 7.0 + uTime * 1.6) * sin(vUv.x * 6.2832 * 3.0 - uTime * 0.9);
    float rise = 0.75 + 0.25 * sin(vUv.y * 14.0 - uTime * 4.0);
    // brightest just above the floor, thin where it crosses in front of the car body
    float a = fade * streak * rise * uStrength * (0.55 + 0.45 * smoothstep(0.0, 0.08, vUv.y));
    vec3 col = mix(uColor, hsv2rgb(vec3(fract(vUv.x + vUv.y * 0.3 - uTime * 0.15), 0.7, 1.0)), uRainbow);
    gl_FragColor = vec4(col * uBoost, a);
  }`

function shaderMat(fragmentShader, color, strength, rainbow, seed) {
  return trackTime(
    new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color(color) },
        uTime: { value: 0 },
        uStrength: { value: strength },
        uRainbow: { value: rainbow ? 1 : 0 },
        uSeed: { value: seed },
        uBoost: fxBoost,
      },
      vertexShader: glowVertex,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    }),
  )
}

// Per tier: ground strength, rising sparkles, orbit sparkles, embers, column strength.
const TIERS = [
  { ground: 0.28, sparkles: 0, orbit: 0, embers: 0, column: 0 },
  { ground: 0.42, sparkles: 12, orbit: 0, embers: 0, column: 0 },
  { ground: 0.6, sparkles: 16, orbit: 16, embers: 0, column: 0 },
  { ground: 0.75, sparkles: 20, orbit: 22, embers: 18, column: 0.14 },
  { ground: 0.9, sparkles: 22, orbit: 28, embers: 30, column: 0.2 },
  { ground: 1.0, sparkles: 10, orbit: 24, embers: 26, column: 0.24 },
]
const EMBER = { Legendary: '#ffd36a', Mythic: '#ff6a1a', Secret: '#ff9ae8' }
const SECRET_SPARKS = ['#ff6ad5', '#18e8ff', '#ffd21a', '#b23cff']

export function rarityAura(rarity, seed = 1) {
  const tier = Math.max(0, RARITY_LADDER.indexOf(rarity))
  const T = TIERS[tier]
  const color = RARITY_COLORS[rarity] ?? '#ffffff'
  const secret = rarity === 'Secret'
  const g = new Group()
  g.name = `aura:${rarity}`
  const fx = (o) => {
    o.userData.fx = true
    g.add(o)
    return o
  }

  // ground glow
  const ground = fx(new Mesh(new PlaneGeometry(RX * 2, RZ * 2), shaderMat(groundFragment, color, T.ground, secret, seed)))
  ground.rotation.x = -Math.PI / 2
  ground.position.y = 0.04
  ground.renderOrder = 3

  // rising sparkles over the car
  const box = { x: RX * 0.85, y: 2.6, z: RZ * 0.85 }
  if (T.sparkles) {
    const colors = secret ? SECRET_SPARKS : [color]
    colors.forEach((c, k) => fx(sparkleField({ count: T.sparkles, center: { x: 0, y: 0.2, z: 0 }, box, rise: 0.55, life: 2.4, size: 0.24, color: c, seed: seed * 7 + k })))
  }

  // sparkles circling the car at waist height (Secret: a second ring the other way)
  if (T.orbit) {
    const spin = tier >= 4 ? 0.9 : 0.6
    fx(sparkleField({ count: T.orbit, center: { x: 0, y: 0.6, z: 0 }, box: { x: 0, y: 1.2, z: 0 }, rise: 0.12, life: 3, drift: 0.05, size: 0.3, color, seed: seed * 11, orbit: [RX * 0.92, RZ * 0.92], spin }))
    if (secret) fx(sparkleField({ count: T.orbit, center: { x: 0, y: 1.6, z: 0 }, box: { x: 0, y: 1.0, z: 0 }, rise: 0.12, life: 3, drift: 0.05, size: 0.26, color: '#18e8ff', seed: seed * 13, orbit: [RX * 0.8, RZ * 0.8], spin: -1.1 }))
  }

  // embers: soft glowing motes drifting up fast, like heat off the car
  if (T.embers) {
    fx(sparkleField({ count: T.embers, center: { x: 0, y: 0.1, z: 0 }, box: { x: RX * 0.7, y: 0.6, z: RZ * 0.7 }, rise: tier >= 4 ? 1.6 : 1.1, life: 2.6, drift: 0.35, size: tier >= 4 ? 0.34 : 0.26, color: EMBER[rarity] ?? color, soft: true, seed: seed * 17 }))
  }

  // light column rising round the car
  if (T.column) {
    const h = 5.5
    const col = fx(new Mesh(new CylinderGeometry(1, 1, h, 40, 1, true), shaderMat(columnFragment, color, T.column, secret, seed)))
    col.scale.set(RX * 0.95, 1, RZ * 0.95)
    col.position.y = h / 2 + 0.02
    col.renderOrder = 3
  }
  return g
}
