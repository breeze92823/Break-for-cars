import { CanvasTexture, Group, Mesh, MeshStandardMaterial, PlaneGeometry, RepeatWrapping } from 'three'
import { LOBBY, WATER } from '../config.js'
import { RAPIER, addFixed } from '../physics.js'
import { boxSpan, brick } from '../lego.js'

// The island: one studded grass slab, the two-lane road with its curbs, the
// curbed plazas at both ends of the road and the six empty player plots. Colliders are
// boxes (the grass slab, raised curbs and plot borders) plus an invisible
// fence on the island edge.

const C = LOBBY.colors

// Chevron lane marks: dark arrows on a transparent strip, one per lane.
function paintChevrons() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const g = c.getContext('2d')
  g.clearRect(0, 0, 128, 128)
  g.strokeStyle = '#ffffff'
  g.lineWidth = 15
  g.lineJoin = 'miter'
  g.lineCap = 'butt'
  g.beginPath() // arrow pointing up (toward -v = north once laid on the road)
  g.moveTo(22, 92)
  g.lineTo(64, 44)
  g.lineTo(106, 92)
  g.stroke()
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.anisotropy = 8
  return t
}

function solid(x0, y0, z0, x1, y1, z1, friction = 0.9) {
  addFixed(RAPIER.ColliderDesc.cuboid((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2), { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 }, null, { friction })
}

export function buildGround(scene) {
  const root = new Group()
  root.name = 'ground'
  const I = LOBBY.island
  const R = LOBBY.road

  // --- Grass slab ---------------------------------------------------------------
  const grassTop = brick(C.grass, { roughness: 0.62 })
  const grassSide = new MeshStandardMaterial({ color: C.grassSide, roughness: 0.8 })
  boxSpan(root, [grassSide, grassSide, grassTop, grassSide, grassSide, grassSide], I.minX, -1.3, I.minZ, I.maxX, 0, I.maxZ, { shadow: false })
  // Brown brick layers under the grass, a touch inset.
  const soil = brick('#8a5636', { roughness: 0.85 })
  boxSpan(root, soil, I.minX + 0.3, -I.depth, I.minZ + 0.3, I.maxX - 0.3, -1.3, I.maxZ - 0.3, { shadow: false })

  // Shallow water hugging the island.
  const band = new Mesh(
    new PlaneGeometry(I.maxX - I.minX + 40, I.maxZ - I.minZ + 40),
    new MeshStandardMaterial({ color: WATER.shallow, roughness: 0.25, transparent: true, opacity: 0.5, depthWrite: false }),
  )
  band.rotation.x = -Math.PI / 2
  band.position.set((I.minX + I.maxX) / 2, WATER.level + 0.05, (I.minZ + I.maxZ) / 2)
  band.renderOrder = 1
  root.add(band)

  solid(I.minX, -I.depth, I.minZ, I.maxX, 0, I.maxZ)
  // Invisible fence round the edge.
  const f = I.fenceHeight
  solid(I.minX - 1, 0, I.minZ, I.minX, f, I.maxZ)
  solid(I.maxX, 0, I.minZ, I.maxX + 1, f, I.maxZ)
  solid(I.minX, 0, I.minZ - 1, I.maxX, f, I.minZ)
  solid(I.minX, 0, I.maxZ, I.maxX, f, I.maxZ + 1)

  // --- Road ---------------------------------------------------------------------
  const road = brick(C.road, { roughness: 0.75, strength: 0.85 })
  const curb = brick(C.curb, { roughness: 0.6 })
  const hw = R.halfWidth
  const cw = R.curb
  boxSpan(root, road, -hw, -0.2, R.north, hw, R.top, R.south, { shadow: false })
  boxSpan(root, curb, -hw - cw, -0.2, R.north, -hw, R.curbTop, R.south)
  boxSpan(root, curb, hw, -0.2, R.north, hw + cw, R.curbTop, R.south)
  solid(-hw, 0, R.north, hw, R.top, R.south)
  solid(-hw - cw, 0, R.north, -hw, R.curbTop, R.south)
  solid(hw, 0, R.north, hw + cw, R.curbTop, R.south)

  // Lane chevrons: west lane points south, east lane points north (like the reference).
  const chevTex = paintChevrons()
  const laneLen = R.south - R.north
  const laneW = hw - 0.55
  const arrowEvery = 4.2 // m between chevrons
  for (const side of [-1, 1]) {
    const tex = chevTex.clone()
    tex.needsUpdate = true
    tex.repeat.set(1, laneLen / arrowEvery)
    const mat = new MeshStandardMaterial({ color: C.roadArrow, alphaMap: tex, transparent: true, opacity: 0.62, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
    const plane = new Mesh(new PlaneGeometry(laneW, laneLen), mat)
    plane.rotation.x = -Math.PI / 2
    if (side < 0) plane.rotation.z = Math.PI // flip: arrows point south on the west lane
    plane.position.set(side * (hw / 2 + 0.05), R.top + 0.012, (R.north + R.south) / 2)
    plane.receiveShadow = true
    plane.renderOrder = 2
    root.add(plane)
  }
  // Centre divider: a thin lighter line of tiles.
  boxSpan(root, brick('#2c3140', { roughness: 0.8 }), -0.18, R.top - 0.02, R.north, 0.18, R.top + 0.025, R.south, { shadow: false })

  // --- Plazas: T junctions at both ends of the road, curbed, open where the road meets them ---
  const plaza = (Q, roadEdge) => {
    boxSpan(root, road, Q.minX, -0.2, Q.minZ, Q.maxX, R.top, Q.maxZ, { shadow: false })
    solid(Q.minX, 0, Q.minZ, Q.maxX, R.top, Q.maxZ)
    const farZ0 = roadEdge === 'south' ? Q.minZ - cw : Q.maxZ // far side (away from the road)
    const nearZ0 = roadEdge === 'south' ? Q.maxZ : Q.minZ - cw // the side the road comes in
    const pieces = [
      [Q.minX - cw, farZ0, Q.maxX + cw, farZ0 + cw],
      [Q.minX - cw, Q.minZ - cw, Q.minX, Q.maxZ + cw],
      [Q.maxX, Q.minZ - cw, Q.maxX + cw, Q.maxZ + cw],
      [Q.minX, nearZ0, -hw - cw, nearZ0 + cw],
      [hw + cw, nearZ0, Q.maxX, nearZ0 + cw],
    ]
    for (const [x0, z0, x1, z1] of pieces) {
      boxSpan(root, curb, x0, -0.2, z0, x1, R.curbTop, z1)
      solid(x0, 0, z0, x1, R.curbTop, z1)
    }
  }
  plaza(LOBBY.northPlaza, 'south')
  plaza(LOBBY.southPlaza, 'north')

  // --- Player plots: empty grey slabs in a brown border ------------------------------
  const plotMat = brick(C.plot, { roughness: 0.7 })
  const borderMat = brick(C.plotBorder, { roughness: 0.75 })
  const sx = LOBBY.plotW / 2
  const sz = LOBBY.plotD / 2
  const b = LOBBY.plotBorder
  for (const p of LOBBY.plots) {
    boxSpan(root, plotMat, p.x - sx, -0.2, p.z - sz, p.x + sx, 0.1, p.z + sz, { shadow: false })
    // border: four strips, slightly raised
    boxSpan(root, borderMat, p.x - sx - b, -0.2, p.z - sz - b, p.x + sx + b, 0.24, p.z - sz, { shadow: false })
    boxSpan(root, borderMat, p.x - sx - b, -0.2, p.z + sz, p.x + sx + b, 0.24, p.z + sz + b, { shadow: false })
    boxSpan(root, borderMat, p.x - sx - b, -0.2, p.z - sz, p.x - sx, 0.24, p.z + sz, { shadow: false })
    boxSpan(root, borderMat, p.x + sx, -0.2, p.z - sz, p.x + sx + b, 0.24, p.z + sz, { shadow: false })
    solid(p.x - sx - b, 0, p.z - sz - b, p.x + sx + b, 0.1, p.z + sz + b)
  }

  scene.add(root)
  return root
}
