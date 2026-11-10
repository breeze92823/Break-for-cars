import { Group, Matrix4, Mesh } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// --- Baking: one mesh per material ------------------------------------------------
// Props are built from many small meshes (a palm is ~20); merging the ones
// that share a look keeps a set piece to a handful of draw calls (mobile).
const matKey = (m) => [m.type, m.color?.getHexString(), m.emissive?.getHexString(), m.vertexColors, m.side, m.flatShading, m.transparent, m.opacity, m.blending, m.map?.uuid, m.roughness, m.metalness, m.userData.k].join('|')
const rel = new Matrix4()
export function bake(root, castShadow = false) {
  const list = []
  root.traverse((o) => o.isMesh && list.push(o))
  return bakeMeshes(list, root, castShadow)
}

// The same for a picked list of meshes anywhere under `root`; the result is in root's frame.
export function bakeMeshes(list, root, castShadow = false) {
  root.updateMatrixWorld(true)
  const inv = root.matrixWorld.clone().invert()
  const groups = new Map() // key -> { mat, geos }
  const out = new Group()
  for (const o of list) {
    rel.multiplyMatrices(inv, o.matrixWorld)
    if (Array.isArray(o.material)) {
      out.add(new Mesh(o.geometry.clone().applyMatrix4(rel), o.material)) // multi-material: kept as is
      continue
    }
    // keyed by the material object too: two materials that look alike may be recoloured apart later
    const key = `${matKey(o.material)}|${o.material.uuid}|${o.renderOrder}`
    let e = groups.get(key)
    if (!e) groups.set(key, (e = { mat: o.material, geos: [], order: o.renderOrder }))
    e.geos.push((o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(rel))
  }
  for (const { mat, geos, order } of groups.values()) {
    const names = Object.keys(geos[0].attributes).filter((n) => geos.every((g) => g.attributes[n]))
    for (const g of geos) {
      for (const n of Object.keys(g.attributes)) if (!names.includes(n)) g.deleteAttribute(n)
      g.morphAttributes = {}
      g.clearGroups()
    }
    const merged = mergeGeometries(geos)
    for (const g of geos) g.dispose()
    if (!merged) continue
    const mesh = new Mesh(merged, mat)
    mesh.renderOrder = order
    out.add(mesh)
  }
  out.traverse((o) => {
    if (o.isMesh) o.castShadow = castShadow
  })
  return out
}
