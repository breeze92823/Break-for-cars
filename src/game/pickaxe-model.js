import { Group } from 'three'
import { boxAt, plastic } from '../lego.js'
import { neon } from '../propkit.js'

// A blocky pickaxe built from a PICKAXES entry's `look` (config.js). Same frame
// as the old hammer so it drops into the hand pivot unchanged: the handle runs
// along +Y (grip at the bottom), the head crosses it along X at y ~0.75, +Z is
// the face the player sees.
export function buildPickaxe(look) {
  const g = new Group()
  const handle = plastic(look.handle, 0.5)
  const head = plastic(look.head, 0.35)
  const tip = plastic(look.tip, 0.3)
  const dark = plastic('#1b1c22', 0.6)
  const top = 0.78

  boxAt(g, handle, 0, 0, 0, 0.17, 1.5, 0.17)
  boxAt(g, dark, 0, -0.6, 0, 0.2, 0.28, 0.2) // grip wrap
  boxAt(g, handle, 0, -0.78, 0, 0.22, 0.08, 0.22) // pommel

  if (look.style === 'hammer') {
    boxAt(g, head, 0, top, 0, 0.82, 0.48, 0.48)
    boxAt(g, tip, -0.45, top, 0, 0.1, 0.54, 0.54)
    boxAt(g, tip, 0.45, top, 0, 0.1, 0.54, 0.54)
    boxAt(g, head, 0, top + 0.3, 0, 0.24, 0.14, 0.24)
  } else {
    // Curved pick: short box segments drooping toward two points.
    const span = look.span ?? 1
    const n = 5
    for (let i = -n; i <= n; i++) {
      const k = Math.abs(i) / n
      const seg = boxAt(g, look.stripes ? (i % 2 ? tip : head) : k > 0.7 ? tip : head, i * 0.115 * span, top - k * k * 0.28, 0, 0.15 * span, 0.32 - k * 0.14, 0.26 - k * 0.1)
      seg.rotation.z = -i * 0.09
    }
    boxAt(g, handle, 0, top, 0, 0.26, 0.38, 0.3) // socket
  }

  if (look.glow) {
    const core = neon(look.glow, 2.6)
    boxAt(g, core, 0, top, 0.14, 0.12, 0.12, 0.02, { shadow: false })
    boxAt(g, core, 0, top, -0.14, 0.12, 0.12, 0.02, { shadow: false })
  }
  if (look.crown) {
    const gold = plastic('#ffcf1f', 0.3)
    boxAt(g, gold, 0, top + 0.2, 0, 0.36, 0.1, 0.2)
    for (const x of [-0.14, 0, 0.14]) boxAt(g, gold, x, top + 0.3, 0, 0.07, x ? 0.12 : 0.16, 0.07)
    boxAt(g, neon(look.glow ?? '#2af0ff', 2.2), 0, top + 0.2, 0.11, 0.08, 0.06, 0.02, { shadow: false })
  }
  return g
}

// Frees the geometry of a model built above (materials are shared caches).
export function disposePickaxe(g) {
  g.traverse((m) => m.isMesh && m.geometry.dispose())
}
