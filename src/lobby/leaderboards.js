import { Group, Mesh, MeshStandardMaterial, PlaneGeometry, PointLight } from 'three'
import { LOBBY } from '../config.js'
import { boxAt, brick } from '../lego.js'
import { fontReady, solidBox } from '../propkit.js'
import { boardStyle, canvasTex, paintBoard, paintTitle } from './paint.js'
import { sparkleField } from './fx.js'

// The three global leaderboards on the north plaza (Cash, PlayTime, Total
// Income). Each is a neon-coloured studded frame: plinth, two columns with
// capitals, a lintel with a stepped crown, the board inset between the columns,
// a big outlined title floating above, sparkles rising off the plinth and a
// coloured light that comes up at night. Rows are placeholders until the
// backend serves real standings (setEntries repaints a board).

const PLACEHOLDER_NAMES = ['BrickBoss', 'TurboTom', 'Nitro_Nia', 'CarCrusher', 'Zoomy', 'BlockSmash', 'GearHead', 'Vroom99']

function placeholder(kind) {
  const base = kind === 'playtime' ? 9000 : 8.4e15
  return PLACEHOLDER_NAMES.map((name, i) => ({ name, value: kind === 'playtime' ? Math.round(base / (1 + i * 0.6)) : base / Math.pow(2.6, i) }))
}

function buildBoard(spec) {
  const st = boardStyle(spec.kind)
  const g = new Group()
  g.position.set(spec.x, 0.08, spec.z)
  g.rotation.y = spec.yaw
  const frame = brick(st.color, { roughness: 0.45, emissive: st.color, emissiveIntensity: 0.28 })
  const frameDark = brick(st.dark, { roughness: 0.5, emissive: st.color, emissiveIntensity: 0.12 })

  // Plinth (two steps) and columns.
  boxAt(g, frameDark, 0, 0.3, 0, 8.6, 0.6, 2.4)
  boxAt(g, frame, 0, 0.85, 0, 7.8, 0.5, 1.8)
  for (const s of [-1, 1]) {
    boxAt(g, frame, s * 3.35, 4.6, 0, 1.1, 7.0, 1.3)
    boxAt(g, frameDark, s * 3.35, 1.35, 0, 1.4, 0.5, 1.5) // base
    boxAt(g, frameDark, s * 3.35, 8.0, 0, 1.4, 0.4, 1.5) // capital
  }
  // Lintel + stepped crown with corner horns.
  boxAt(g, frame, 0, 8.6, 0, 8.4, 0.9, 1.6)
  boxAt(g, frameDark, 0, 9.25, 0, 6.4, 0.45, 1.3)
  boxAt(g, frame, 0, 9.65, 0, 3.6, 0.4, 1.1)
  for (const s of [-1, 1]) boxAt(g, frame, s * 3.9, 9.4, 0, 0.9, 0.7, 1.4)
  // back panel
  boxAt(g, frameDark, 0, 4.6, -0.45, 5.8, 7.2, 0.3)

  // The board itself.
  const board = paintBoard(spec.kind, placeholder(spec.kind))
  const tex = canvasTex(board.canvas)
  const panel = new Mesh(new PlaneGeometry(5.5, 5.5 * (board.canvas.height / board.canvas.width)), new MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.5 }))
  panel.position.set(0, 4.6, -0.28)
  panel.receiveShadow = true
  g.add(panel)

  // Title over the top.
  const title = paintTitle(st.title, 'Global Leaderboard', st.color)
  const titleTex = canvasTex(title.canvas)
  const titleMesh = new Mesh(new PlaneGeometry(9, 9 * (title.canvas.height / title.canvas.width)), new MeshStandardMaterial({ map: titleTex, transparent: true, emissive: '#ffffff', emissiveMap: titleTex, emissiveIntensity: 0.5, roughness: 0.6, depthWrite: false }))
  titleMesh.position.set(0, 11.6, 0.2)
  g.add(titleMesh)

  fontReady.then(() => {
    board.draw()
    tex.needsUpdate = true
    title.draw()
    titleTex.needsUpdate = true
  })

  g.add(sparkleField({ count: 26, center: { x: 0, y: 1.1, z: 0.9 }, box: { x: 3.8, y: 1, z: 0.5 }, rise: 0.9, life: 3.2, drift: 0.2, size: 0.28, color: st.color, seed: spec.x * 7 + 100 }))

  const light = new PointLight(st.color, 0, 16, 2)
  light.position.set(0, 4.5, 2.5)
  g.add(light)

  g.updateMatrixWorld(true)
  // One collider for the plinth, one per column.
  const c = Math.cos(spec.yaw)
  const s = Math.sin(spec.yaw)
  const at = (lx, lz) => [spec.x + lx * c + lz * s, spec.z - lx * s + lz * c]
  let [wx, wz] = at(0, 0)
  solidBox(4.3, 0.55, 1.2, wx, 0.55, wz, spec.yaw)
  for (const side of [-1, 1]) {
    ;[wx, wz] = at(side * 3.35, 0)
    solidBox(0.7, 4.8, 0.75, wx, 4.8, wz, spec.yaw)
  }
  ;[wx, wz] = at(0, -0.45)
  solidBox(3, 4, 0.2, wx, 4.6, wz, spec.yaw)

  return {
    group: g,
    light,
    setEntries(entries) {
      const next = paintBoard(spec.kind, entries)
      board.canvas.getContext('2d').drawImage(next.canvas, 0, 0)
      tex.needsUpdate = true
    },
  }
}

export function buildLeaderboards(scene) {
  const boards = LOBBY.leaderboards.map(buildBoard)
  for (const b of boards) scene.add(b.group)
  return {
    boards,
    // night: 0 (day) .. 1 (night)
    setNight(n) {
      for (const b of boards) b.light.intensity = 2 + n * 40
    },
  }
}
