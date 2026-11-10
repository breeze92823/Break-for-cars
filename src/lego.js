import { BoxGeometry, Color, Mesh, MeshPhysicalMaterial, MeshStandardMaterial } from 'three'
import { LOBBY } from './config.js'

// Lego look. Every upward-facing surface of a "brick" material gets round studs,
// drawn in the fragment shader from the WORLD position (not UVs), so a stud is
// the same size on a 300 m island, a 2 m tree canopy or a rock, and boxes of any
// size line up on one grid. The stud wall tilts the normal (real lighting and
// shadow side), a soft ring darkens the base (contact shadow), and the studs fade
// out with distance before they can alias.

const studVertexHead = /* glsl */ `
varying vec3 vStudP;
varying vec3 vStudN;`
const studVertexBody = /* glsl */ `
{
  vec4 sp = vec4(transformed, 1.0);
  vec3 sn = objectNormal;
  #ifdef USE_INSTANCING
    sp = instanceMatrix * sp;
    sn = mat3(instanceMatrix) * sn;
  #endif
  vStudP = (modelMatrix * sp).xyz;
  vStudN = normalize(mat3(modelMatrix) * sn);
}`
const studFragmentHead = /* glsl */ `
varying vec3 vStudP;
varying vec3 vStudN;
uniform float uStudPitch;
uniform float uStudRadius;
uniform float uStudStrength;`
// Runs after color_fragment: sets up the stud variables and shades the colour.
const studColor = /* glsl */ `
float studTop = smoothstep(0.55, 0.9, vStudN.y);
vec2 studG = vStudP.xz / uStudPitch + 0.5;
vec2 studC = fract(studG) - 0.5;
float studD = length(studC);
float studFw = max(fwidth(studG.x), fwidth(studG.y));
float studFade = studTop * (1.0 - smoothstep(0.1, 0.32, studFw)) * uStudStrength;
float studAa = studFw * 1.1 + 0.012;
float studIn = 1.0 - smoothstep(uStudRadius - studAa, uStudRadius + studAa, studD);
float studWall = smoothstep(uStudRadius - 0.07 - studAa, uStudRadius - 0.01, studD) * (1.0 - smoothstep(uStudRadius - 0.01, uStudRadius + 0.03 + studAa, studD));
float studAo = (1.0 - smoothstep(uStudRadius, uStudRadius + 0.17, studD)) * (1.0 - studIn);
// light catches the top of the stud a little; the plate around it sits in its shadow
diffuseColor.rgb *= 1.0 + studFade * (studIn * 0.07 - studAo * 0.22);
// side faces of a brick: a faint darkening toward the bottom of each plate row
float studSide = (1.0 - studTop) * (1.0 - smoothstep(0.08, 0.3, studFw));
diffuseColor.rgb *= 1.0 - studSide * 0.06 * smoothstep(0.6, 1.0, fract(vStudP.y / (uStudPitch * 0.66)));`
const studNormal = /* glsl */ `
{
  vec3 studOut = vec3(studC.x, 0.0, studC.y) / max(studD, 1e-3);
  normal = normalize(normal + (viewMatrix * vec4(studOut * studWall * 1.9 * studFade, 0.0)).xyz);
}`

// Patches a MeshStandard/Physical material in place to draw studs on its tops.
export function studify(material, { pitch = LOBBY.stud.pitch, radius = LOBBY.stud.radius, strength = 1 } = {}) {
  material.userData.stud = { pitch, radius, strength }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uStudPitch = { value: pitch }
    shader.uniforms.uStudRadius = { value: radius }
    shader.uniforms.uStudStrength = { value: strength }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${studVertexHead}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${studVertexBody}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${studFragmentHead}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${studColor}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${studNormal}`)
  }
  material.customProgramCacheKey = () => 'stud'
  return material
}

// A plastic brick material with studs on top.
const brickCache = new Map()
export function brick(color, { roughness = 0.55, strength = 1, emissive = null, emissiveIntensity = 0 } = {}) {
  const key = `${color}|${roughness}|${strength}|${emissive}|${emissiveIntensity}`
  let m = brickCache.get(key)
  if (!m) {
    m = studify(new MeshStandardMaterial({ color, roughness, metalness: 0, ...(emissive ? { emissive: new Color(emissive), emissiveIntensity } : {}) }), { strength })
    brickCache.set(key, m)
  }
  return m
}

// Smooth plastic (no studs): car parts, signs, trims.
const plasticCache = new Map()
export function plastic(color, roughness = 0.45) {
  const key = `${color}|${roughness}`
  let m = plasticCache.get(key)
  if (!m) plasticCache.set(key, (m = new MeshStandardMaterial({ color, roughness, metalness: 0 })))
  return m
}

// Glossy car paint.
export function paint(color, { metalness = 0.35, roughness = 0.32 } = {}) {
  return new MeshPhysicalMaterial({ color, metalness, roughness, clearcoat: 1, clearcoatRoughness: 0.06 })
}

// One shared unit cube; boxes are scaled instances of it (bake merges them anyway).
export const UNIT_BOX = new BoxGeometry(1, 1, 1)

// Adds a box spanning [x0,x1] x [y0,y1] x [z0,z1] to parent.
export function boxSpan(parent, mat, x0, y0, z0, x1, y1, z1, { shadow = true } = {}) {
  return boxAt(parent, mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), { shadow })
}

// Adds a box of size (w, h, d) centred at (x, y, z), optional yaw.
export function boxAt(parent, mat, x, y, z, w, h, d, { yaw = 0, shadow = true } = {}) {
  const mesh = new Mesh(new BoxGeometry(w, h, d), mat)
  mesh.position.set(x, y, z)
  mesh.rotation.y = yaw
  mesh.castShadow = shadow
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}
