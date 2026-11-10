import { AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'
import { boxAt, plastic } from '../lego.js'
import { neon } from '../propkit.js'
import { canvasTex, paintSwirl } from './paint.js'
import { sparkleField } from './fx.js'

// The player's equipped tool: a blocky cyan hammer slung diagonally across the
// back, wrapped in a turning blue energy swirl with a few sparkles. Parented to
// the player group, so it follows position and facing (local +Z = forward).

function hammer() {
  const g = new Group()
  const handle = plastic('#1f2c4a', 0.5)
  const head = plastic('#22c9ff', 0.35)
  const headLight = plastic('#9ff0ff', 0.3)
  const core = neon('#5ff0ff', 2.4)
  boxAt(g, handle, 0, 0, 0, 0.12, 1.25, 0.12)
  boxAt(g, plastic('#0f1626', 0.6), 0, -0.45, 0, 0.15, 0.3, 0.15) // grip
  boxAt(g, head, 0, 0.72, 0, 0.72, 0.4, 0.4)
  boxAt(g, headLight, -0.38, 0.72, 0, 0.1, 0.46, 0.46) // striking faces
  boxAt(g, headLight, 0.38, 0.72, 0, 0.1, 0.46, 0.46)
  boxAt(g, core, 0, 0.72, 0.205, 0.3, 0.14, 0.02, { shadow: false })
  boxAt(g, core, 0, 0.72, -0.205, 0.3, 0.14, 0.02, { shadow: false })
  boxAt(g, head, 0, 0.98, 0, 0.2, 0.14, 0.2) // top voxel
  return g
}

export function createPlayerFx(playerGroup) {
  const root = new Group()
  playerGroup.add(root)

  const tool = hammer()
  tool.position.set(0.05, 1.05, -0.36)
  tool.rotation.set(-0.12, 0, 0.75)
  root.add(tool)

  const swirlTex = canvasTex(paintSwirl())
  const swirls = []
  for (let i = 0; i < 2; i++) {
    const m = new Mesh(
      new PlaneGeometry(1.5 - i * 0.35, 1.5 - i * 0.35),
      new MeshBasicMaterial({ map: swirlTex, color: i ? '#7fe6ff' : '#2aa8ff', transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
    )
    m.position.set(-0.32, 1.48, -0.42 - i * 0.04)
    root.add(m)
    swirls.push(m)
  }
  root.add(sparkleField({ count: 12, center: { x: -0.3, y: 1.0, z: -0.45 }, box: { x: 0.6, y: 0.9, z: 0.3 }, rise: 0.45, life: 1.4, drift: 0.12, size: 0.11, color: '#7fe6ff', seed: 5 }))

  return {
    root,
    update(dt, elapsed) {
      swirls[0].rotation.z -= dt * 3.2
      swirls[1].rotation.z += dt * 4.5
      const p = 1 + Math.sin(elapsed * 5) * 0.06
      swirls[0].scale.set(p, p, 1)
    },
  }
}
