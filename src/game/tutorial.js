// The new-player tutorial: what to do next in a banner under the top buttons, and a trail of white
// arrows on the ground from the player to it (TUTORIAL in config.js).
//   0 "Purchase your first lucky block!"   -> a block on the belt
//   1 "Place lucky block on the slot"      -> a free bay in the garage
//   2 "Break lucky block to get your first car!" -> the placed block
//   3 "Earn 400/1K Cash!"                  -> the car's green pad (money / the first pickaxe's price)
//   4 "Purchase your first pickaxe"        -> the Pickaxes Shop stall
//   5 done: banner and arrows gone.
// game.js decides when a step is done (advance) and where the arrows lead (a world path); this module
// draws them, keeps the step in localStorage and reports each new step (onStep -> net.js -> server).
// The step only ever goes up: whichever of this browser and the server knows more wins (sync).
import {
  ExtrudeGeometry,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  Shape,
  ShapeGeometry,
  Vector3,
} from 'three'
import { TUTORIAL } from '../config.js'
import { groundBelow } from '../physics.js'
import './tutorial.css'

export const TUTORIAL_DONE = TUTORIAL.steps.length

// A rounded triangle pointing toward -Y in the shape plane (= +Z once laid flat), centred on its
// centroid, `k` times the arrow size (the outline is the same shape, bigger).
function arrowShape(k) {
  const L = TUTORIAL.arrows.size * k
  const W = L * 0.92
  const r = L * 0.16
  const cy = L / 6 // centroid of a triangle with its tip at -L/2 and its base at +L/2
  const pts = [new Vector3(0, -L / 2 - cy, 0), new Vector3(W / 2, L / 2 - cy, 0), new Vector3(-W / 2, L / 2 - cy, 0)]
  const s = new Shape()
  // Each corner cut by r along both edges and joined with a quadratic curve through the corner.
  const cut = (a, b) => a.clone().lerp(b, r / a.distanceTo(b))
  for (let i = 0; i < 3; i++) {
    const c = pts[i]
    const a = cut(c, pts[(i + 2) % 3])
    const b = cut(c, pts[(i + 1) % 3])
    if (i === 0) s.moveTo(a.x, a.y)
    else s.lineTo(a.x, a.y)
    s.quadraticCurveTo(c.x, c.y, b.x, b.y)
  }
  s.closePath()
  return s
}

export function createTutorial({ layer, scene, sfx, onStep }) {
  const A = TUTORIAL.arrows

  // --- Step + save ------------------------------------------------------------------------------
  let step = 0
  let fresh = true // no tutorial record in this browser yet
  try {
    const raw = localStorage.getItem(TUTORIAL.saveKey)
    if (raw !== null) {
      fresh = false
      step = Math.max(0, Math.min(TUTORIAL_DONE, Number(raw) | 0))
    }
  } catch {
    // Storage blocked: the tutorial still runs, and the server may know the step.
  }
  const store = () => {
    try {
      localStorage.setItem(TUTORIAL.saveKey, String(step))
    } catch {
      // ignore
    }
  }

  // --- Banner -------------------------------------------------------------------------------------
  const banner = document.createElement('div')
  banner.className = 'tut-banner'
  banner.innerHTML = '<span class="ol tut-text"></span>'
  layer.appendChild(banner)
  const textEl = banner.firstChild
  // Right under the To Shop / To Plot row, wherever hud.js put it (it moves clear of Bloxity's
  // toolbar, and drops lower on a phone): re-measured now and then and on resize.
  let placeClock = 0
  function placeBanner() {
    placeClock = 0
    const row = document.querySelector('.hud .hud-top')?.getBoundingClientRect()
    if (!row || !row.height) return
    const gap = Math.max(8, Math.min(window.innerHeight * 0.016, 18))
    // Phone portrait: the row is a column on the right and the left tiles sit beside it,
    // so the banner goes under whichever ends lower.
    let bottom = row.bottom
    if (window.matchMedia('(max-width: 520px)').matches) {
      const tiles = document.querySelector('.hud .hud-left')?.getBoundingClientRect()
      if (tiles?.height) bottom = Math.max(bottom, tiles.bottom)
    }
    banner.style.top = `${Math.round(bottom + gap)}px`
  }
  window.addEventListener('resize', () => requestAnimationFrame(placeBanner))
  let shownText = ''
  let flash = 0 // s left on the "You can now afford ..." line
  let flashText = ''
  function paint(text, cls = '') {
    if (text === shownText && banner.dataset.kind === cls) return
    const pop = text.replace(/[\d.,]+[KMBT]?/g, '#') !== shownText.replace(/[\d.,]+[KMBT]?/g, '#') || banner.dataset.kind !== cls
    shownText = text
    banner.dataset.kind = cls
    textEl.textContent = text
    if (pop) {
      banner.classList.remove('pop')
      void banner.offsetWidth
      banner.classList.add('pop')
    }
  }

  // --- Arrows: one instanced white prism (light-blue sides) over a dark flat outline -----------------
  const bodyGeo = new ExtrudeGeometry(arrowShape(1), { depth: 0.16, bevelEnabled: false, curveSegments: 4 })
  bodyGeo.rotateX(-Math.PI / 2) // shape Y -> -Z, extrusion -> +Y: lies flat, tip toward +Z
  const outlineGeo = new ShapeGeometry(arrowShape(1.24), 4)
  outlineGeo.rotateX(-Math.PI / 2)
  const capMat = new MeshBasicMaterial({ color: A.color, fog: false })
  const sideMat = new MeshBasicMaterial({ color: A.side, fog: false })
  const outlineMat = new MeshBasicMaterial({ color: A.outline, fog: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
  const bodies = new InstancedMesh(bodyGeo, [capMat, sideMat], A.max)
  const outlines = new InstancedMesh(outlineGeo, outlineMat, A.max)
  for (const m of [bodies, outlines]) {
    m.count = 0
    m.frustumCulled = false
    m.renderOrder = 3
    scene.add(m)
  }
  const dummy = new Object3D()
  const seg = new Vector3()
  const lens = []
  let scroll = 0

  // Lays arrows along `path` (world points, the first is the player's feet), scrolling toward its end.
  function drawPath(path, dt) {
    let total = 0
    lens.length = 0
    for (let i = 1; i < path.length; i++) {
      const l = Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z)
      lens.push(l)
      total += l
    }
    const end = total - A.stopShort
    const startAt = 1.4 // the first arrow sits a little ahead of the player
    scroll = (scroll + dt * A.speed) % A.spacing
    let n = 0
    let i = 0
    let walked = 0
    for (let s = startAt + scroll; s < end && n < A.max; s += A.spacing) {
      while (i < lens.length - 1 && s > walked + lens[i]) walked += lens[i++]
      const a = path[i]
      const b = path[i + 1]
      const t = lens[i] > 0 ? (s - walked) / lens[i] : 0
      seg.set(b.x - a.x, 0, b.z - a.z)
      const x = a.x + (b.x - a.x) * t
      const z = a.z + (b.z - a.z) * t
      const refY = a.y + (b.y - a.y) * t
      const y = groundBelow(x, refY + 1.6, z, 5) ?? refY
      // Grow in near the player, shrink away at the end.
      const k = Math.min(1, (s - startAt) / 1.2 + 0.25, (end - s) / 1.4 + 0.2)
      dummy.position.set(x, y + 0.06, z)
      dummy.rotation.set(0, Math.atan2(seg.x, seg.z), 0)
      dummy.scale.setScalar(Math.max(0.05, k))
      dummy.updateMatrix()
      bodies.setMatrixAt(n, dummy.matrix)
      dummy.position.y = y + 0.035
      dummy.updateMatrix()
      outlines.setMatrixAt(n, dummy.matrix)
      n++
    }
    bodies.count = outlines.count = n
    bodies.instanceMatrix.needsUpdate = outlines.instanceMatrix.needsUpdate = true
  }
  function hideArrows() {
    bodies.count = outlines.count = 0
  }

  // --- Moving on -----------------------------------------------------------------------------------
  function set(next, { quiet = false, report = true } = {}) {
    next = Math.max(0, Math.min(TUTORIAL_DONE, next | 0))
    if (next <= step) return false
    const was = step
    step = next
    store()
    if (report) onStep?.(step)
    if (!quiet && was < TUTORIAL_DONE) {
      if (step >= TUTORIAL_DONE) sfx?.reveal?.(2)
      else sfx?.upgrade?.()
    }
    return true
  }
  if (fresh) store()

  return {
    get step() {
      return step
    },
    get done() {
      return step >= TUTORIAL_DONE
    },
    // Was there no tutorial record in this browser (a first visit, or a save from before it)?
    fresh,
    // Moves on to `next` (never back).
    advance: (next, opts) => set(next, opts),
    // The server's step for this account (sync): taken when it is further; no echo back.
    sync(remote) {
      set(remote, { quiet: true, report: false })
    },
    // The "You can now afford ..." line, shown over the step for TUTORIAL.affordFor s.
    flash(text) {
      flashText = text
      flash = TUTORIAL.affordFor
    },
    // text: the banner line for the current step; path: world points (player first) or null.
    update(dt, text, path) {
      if (flash > 0) flash -= dt
      const on = step < TUTORIAL_DONE || flash > 0
      if (on && (placeClock += dt) > 0.5) placeBanner()
      banner.classList.toggle('show', on)
      if (flash > 0) paint(flashText, 'flash')
      else if (on) paint(text)
      if (step < TUTORIAL_DONE && path && path.length > 1) drawPath(path, dt)
      else hideArrows()
    },
  }
}
