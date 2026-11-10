// Procedural sound effects (Web Audio, no files). Every sound is built from a
// few "natural" voices: soft mallets (wood / marimba), knocks (plastic lego),
// coins (inharmonic metal partials), brown-noise thuds and rustles, filtered
// air whooshes. No square or saw waves; everything goes through a gentle
// low-pass so nothing is shrill, a small room reverb so hits sit in the world
// instead of in your ear, and a compressor so stacked hits never clip. Each
// call varies pitch and level a little so repeats never sound machine-gunned.
//
// The context starts on the first pointer or key press (browsers block audio
// before a gesture); calls made before that are silent no-ops.
//
// UI: every clickable element (buttons, touch buttons, anything with
// `cursor: pointer`) gets a hover tick (mouse only) and a press "thock" from
// one delegated listener at the bottom of this file, so new windows get sounds
// for free. An element with `data-sfx="off"` (or inside one) stays silent.
import { GAME } from '../config.js'

const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null
let ctx = null
let bus = null // voices connect here (dry)
let send = null // reverb send
let out = null // master gain
let whiteBuf = null
let brownBuf = null
let volume = 1
let muted = false
let gestureAt = -1e9

function impulse(seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

function init() {
  if (ctx || !AC) return ctx
  try {
    ctx = new AC()
  } catch {
    return null
  }
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -18
  comp.knee.value = 10
  comp.ratio.value = 3.5
  comp.attack.value = 0.004
  comp.release.value = 0.2
  out = ctx.createGain()
  out.gain.value = GAME.volume * volume
  // Gentle top-end roll-off: keeps every effect warm, never piercing.
  const soft = ctx.createBiquadFilter()
  soft.type = 'lowpass'
  soft.frequency.value = 7000
  soft.Q.value = 0.5
  bus = ctx.createGain()
  bus.connect(soft)
  soft.connect(out)
  out.connect(comp)
  comp.connect(ctx.destination)
  // Small room: a short, dark reverb tail.
  const verb = ctx.createConvolver()
  verb.buffer = impulse(0.9, 3.4)
  const verbTone = ctx.createBiquadFilter()
  verbTone.type = 'lowpass'
  verbTone.frequency.value = 3200
  send = ctx.createGain()
  send.gain.value = 0.55
  send.connect(verb)
  verb.connect(verbTone)
  verbTone.connect(soft)

  const n = ctx.sampleRate
  whiteBuf = ctx.createBuffer(1, n, n)
  brownBuf = ctx.createBuffer(1, n, n)
  const w = whiteBuf.getChannelData(0)
  const b = brownBuf.getChannelData(0)
  let last = 0
  for (let i = 0; i < n; i++) {
    w[i] = Math.random() * 2 - 1
    last = (last + 0.02 * w[i]) / 1.02
    b[i] = last * 3.5
  }
  return ctx
}

export function unlock() {
  if (!init()) return
  gestureAt = performance.now()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
}
if (AC) {
  window.addEventListener('pointerdown', unlock, { capture: true })
  window.addEventListener('keydown', unlock, { capture: true })
}

// Master volume 0..1 (Bloxity's master_volume setting; 0 during an ad break).
export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v))
  muted = volume === 0
  if (out) out.gain.value = GAME.volume * volume
}

// Running, or resuming right after the gesture that unlocked it (so the very
// first click is heard). Never queues sounds on a context that was never unlocked.
const ready = () => !muted && ctx && (ctx.state === 'running' || (ctx.state === 'suspended' && performance.now() - gestureAt < 600))
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12)
const rnd = (a, b) => a + Math.random() * (b - a)
const vary = (x, amt = 0.04) => x * (1 + rnd(-amt, amt))
const clamp01 = (x) => Math.max(0, Math.min(1, x))

// --- Voices ----------------------------------------------------------------

function envelope(t0, dur, gain, attack) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  return g
}

// Sends a voice to the dry bus, panned, with `room` of it into the reverb.
function route(node, room, pan) {
  let n = node
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner()
    p.pan.value = pan
    node.connect(p)
    n = p
  }
  n.connect(bus)
  if (room > 0) {
    const s = ctx.createGain()
    s.gain.value = room
    n.connect(s)
    s.connect(send)
  }
}

// One oscillator voice; `to` glides the pitch over the note.
function tone(freq, dur, { type = 'sine', gain = 0.3, at = 0, to = null, attack = 0.004, room = 0.1, pan = 0 } = {}) {
  const t0 = ctx.currentTime + at
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur)
  const g = envelope(t0, dur, gain, attack)
  o.connect(g)
  route(g, room, pan)
  o.start(t0)
  o.stop(t0 + dur + 0.05)
}

// Filtered noise (white = air / grit, brown = thud / rustle); `to` sweeps the filter.
function noise(dur, { gain = 0.3, at = 0, type = 'bandpass', freq = 1000, to = null, q = 1, attack = 0.003, brown = false, room = 0.1, pan = 0 } = {}) {
  const t0 = ctx.currentTime + at
  const src = ctx.createBufferSource()
  src.buffer = brown ? brownBuf : whiteBuf
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.setValueAtTime(freq, t0)
  if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur)
  f.Q.value = q
  const g = envelope(t0, dur, gain, attack)
  src.connect(f)
  f.connect(g)
  route(g, room, pan)
  src.start(t0, Math.random() * 0.8)
  src.stop(t0 + dur + 0.05)
}

// A wooden mallet note (marimba-like): round fundamental, a quickly fading 4th
// partial and a soft felt-tip transient.
function mallet(freq, { dur = 0.4, gain = 0.12, at = 0, room = 0.22, pan = 0 } = {}) {
  tone(freq, dur, { gain, at, attack: 0.003, room, pan })
  tone(freq * 3.93, dur * 0.18, { gain: gain * 0.22, at, attack: 0.002, room, pan })
  noise(0.014, { type: 'lowpass', freq: 1800, gain: gain * 0.35, at, room: 0, pan })
}

// A coin: a few inharmonic metal partials ringing out.
function coin(freq, { gain = 0.07, at = 0, room = 0.2, pan = 0 } = {}) {
  const f = vary(freq, 0.05)
  const parts = [
    [1, 1, 0.32],
    [2.32, 0.45, 0.22],
    [4.25, 0.18, 0.12],
  ]
  for (const [r, g, d] of parts) tone(f * r, d, { gain: gain * g, at, attack: 0.002, room, pan })
  noise(0.01, { freq: f * 2, q: 2, gain: gain * 0.6, at, room: 0, pan })
}

// A short knock on hard plastic / wood.
function knock(freq, { gain = 0.15, at = 0, dur = 0.06, room = 0.1, pan = 0 } = {}) {
  const f = vary(freq, 0.05)
  tone(f, dur, { type: 'triangle', gain, at, to: f * 0.8, room, pan })
  noise(dur * 0.4, { freq: f * 2.6, q: 2.5, gain: gain * 0.7, at, room: 0, pan })
}

// --- UI --------------------------------------------------------------------

let hoverAt = 0
// Pointer moves onto a button: a soft wooden tick.
export function hover() {
  if (!ready()) return
  const now = performance.now()
  if (now - hoverAt < 45) return
  hoverAt = now
  tone(vary(620, 0.05), 0.04, { gain: 0.035, room: 0.05 })
  noise(0.012, { freq: vary(1700), q: 1.3, gain: 0.025, room: 0 })
}

// A button pressed: a rounded plastic "thock" with a little weight under it.
export function click() {
  if (!ready()) return
  const f = vary(270, 0.04)
  tone(f, 0.09, { gain: 0.2, to: f * 0.66, room: 0.08 })
  tone(f * 2.05, 0.035, { type: 'triangle', gain: 0.05, room: 0 })
  noise(0.016, { freq: vary(1500), q: 1.4, gain: 0.11, room: 0 })
  noise(0.06, { type: 'lowpass', freq: 420, gain: 0.14, brown: true, room: 0.05 })
}

// A window / prompt opens, or a choice is confirmed: two rising mallet notes.
export function blip() {
  if (!ready()) return
  mallet(midi(72), { gain: 0.09, dur: 0.3 })
  mallet(midi(79), { gain: 0.08, dur: 0.4, at: 0.06 })
}

// A window closes: the same two notes falling.
export function close() {
  if (!ready()) return
  mallet(midi(79), { gain: 0.07, dur: 0.25 })
  mallet(midi(72), { gain: 0.07, dur: 0.35, at: 0.055 })
}

// Spin wheel ratchet: a dry wooden peg click.
export function tick() {
  if (!ready()) return
  knock(vary(950, 0.06), { gain: 0.09, dur: 0.03, room: 0.12 })
}

// Can't do that (not enough money, garage full): a muted low double knock.
export function error() {
  if (!ready()) return
  mallet(196, { gain: 0.13, dur: 0.16, room: 0.08 })
  mallet(156, { gain: 0.13, dur: 0.22, at: 0.11, room: 0.08 })
  noise(0.08, { type: 'lowpass', freq: 300, gain: 0.12, brown: true })
}

// --- Economy ---------------------------------------------------------------

// Bought something: a drawer slides, coins drop in, a warm chime.
export function buy() {
  if (!ready()) return
  noise(0.14, { freq: 1100, to: 520, q: 0.9, gain: 0.05, attack: 0.02 })
  coin(1180, { at: 0.05, gain: 0.08 })
  coin(1420, { at: 0.11, gain: 0.07 })
  coin(1050, { at: 0.16, gain: 0.05 })
  mallet(midi(76), { gain: 0.07, at: 0.08, dur: 0.4 })
  mallet(midi(84), { gain: 0.06, at: 0.15, dur: 0.55 })
}

// Money collected from a pad; n (1..6) coins tumbling into a pouch.
export function collect(n = 3) {
  if (!ready()) return
  const k = Math.max(2, Math.min(6, n))
  for (let i = 0; i < k; i++) coin(980 + i * 70, { at: i * 0.055 + rnd(0, 0.015), gain: 0.07, pan: rnd(-0.2, 0.2) })
  noise(0.16, { type: 'lowpass', freq: 900, gain: 0.1, brown: true, at: k * 0.055, attack: 0.02 })
  mallet(midi(79), { gain: 0.06, at: k * 0.055, dur: 0.45 })
}

// Car sold: a pour of coins and a settling chime.
export function sell() {
  if (!ready()) return
  noise(0.3, { freq: 1600, to: 600, q: 1, gain: 0.05 })
  for (let i = 0; i < 6; i++) coin(1350 - i * 55, { at: 0.03 + i * 0.045 + rnd(0, 0.02), gain: 0.06, pan: rnd(-0.25, 0.25) })
  mallet(midi(76), { gain: 0.07, at: 0.3, dur: 0.3 })
  mallet(midi(72), { gain: 0.08, at: 0.38, dur: 0.5 })
}

// Something levelled up / unlocked: a rising mallet run into a ringing chord.
export function upgrade() {
  if (!ready()) return
  noise(0.32, { freq: 400, to: 1500, q: 0.8, gain: 0.04, attack: 0.1, room: 0.2 })
  ;[60, 64, 67, 72, 76].forEach((m, i) => mallet(midi(m), { gain: 0.08, at: i * 0.055, dur: 0.3 }))
  for (const m of [72, 76, 79]) mallet(midi(m), { gain: 0.06, at: 0.3, dur: 0.8, room: 0.35 })
}

// --- Blocks, cars and the pickaxe -----------------------------------------

// Picked up (block lands in the hands, or a car comes off the hotbar).
export function pickup() {
  if (!ready()) return
  noise(0.14, { freq: 300, to: 900, q: 0.9, gain: 0.16, brown: true, attack: 0.02 })
  tone(vary(180), 0.12, { gain: 0.12, to: 320, attack: 0.01 })
  knock(600, { gain: 0.07, at: 0.03 })
}

// Block set down on a bay: a solid thud and the lego "snap" of studs locking in.
export function place() {
  if (!ready()) return
  tone(vary(140), 0.2, { gain: 0.42, to: 58, room: 0.12 })
  noise(0.14, { type: 'lowpass', freq: 520, gain: 0.3, brown: true })
  noise(0.012, { freq: vary(2100), q: 4, gain: 0.14, at: 0.018, room: 0.12 })
  noise(0.012, { freq: vary(2400), q: 4, gain: 0.1, at: 0.046, room: 0.12 })
}

// Tool in or out of the hand: a short swish and the handle settling in the palm.
export function equip(on = true) {
  if (!ready()) return
  noise(0.12, { freq: on ? 600 : 1500, to: on ? 1500 : 600, q: 1, gain: 0.06, attack: 0.03 })
  knock(on ? 420 : 340, { gain: 0.11, at: 0.06 })
  if (on) coin(900, { at: 0.07, gain: 0.025 })
}

// Pickaxe cutting the air: a soft whoosh that rises and falls.
export function swing() {
  if (!ready()) return
  const f = vary(1, 0.08)
  noise(0.2, { freq: 350 * f, to: 1300 * f, q: 1.1, gain: 0.13, attack: 0.07, room: 0.05 })
  noise(0.17, { type: 'lowpass', freq: 600, gain: 0.08, brown: true, attack: 0.06 })
}

// Pickaxe lands on the block. `damage` 0..1 (how broken it is) raises the pitch.
export function hit(damage) {
  if (!ready()) return
  const base = (170 + damage * 130) * rnd(0.95, 1.06)
  tone(base, 0.16, { type: 'triangle', gain: 0.3, to: base * 0.62, room: 0.12 })
  tone(base * 2.71, 0.07, { gain: 0.07, room: 0.1 })
  noise(0.06, { freq: 1100 + damage * 900, q: 2, gain: 0.3, room: 0.1 })
  noise(0.12, { type: 'lowpass', freq: 380, gain: 0.34, brown: true })
}

// A third of the block's health gone: a crunchy crack.
export function crack() {
  if (!ready()) return
  noise(0.09, { freq: 1400, q: 3, gain: 0.2, room: 0.15 })
  noise(0.1, { type: 'lowpass', freq: 320, gain: 0.2, brown: true })
  for (let i = 0; i < 4; i++) noise(0.02, { freq: rnd(900, 2600), q: 6, gain: 0.15, at: 0.015 + i * 0.025 + rnd(0, 0.01), room: 0.1 })
}

// The block bursts: a deep boom and a clatter of lego pieces raining down.
// tier 0 (Common) .. 5 (Secret) makes it bigger.
export function smash(tier = 0) {
  if (!ready()) return
  tone(95, 0.5, { gain: 0.5, to: 32, room: 0.2 })
  noise(0.55 + tier * 0.05, { type: 'lowpass', freq: 1800, to: 120, gain: 0.55, brown: true, room: 0.25 })
  noise(0.12, { freq: 900, q: 1, gain: 0.18 })
  const n = 10 + tier * 3
  const span = 0.5 + tier * 0.06
  for (let i = 0; i < n; i++) {
    const at = 0.03 + Math.pow(i / n, 1.4) * span + rnd(0, 0.02)
    const g = rnd(0.06, 0.15) * (1 - (i / n) * 0.6)
    const pan = rnd(-0.4, 0.4)
    noise(rnd(0.02, 0.035), { freq: rnd(1200, 3000), q: 5, gain: g, at, room: 0.25, pan })
    if (i % 3 === 0) tone(rnd(600, 1300), 0.03, { type: 'triangle', gain: g * 0.3, at, room: 0.2, pan })
  }
}

// The car appears: a mallet arpeggio into a warm held chord; rarer = longer, richer.
export function reveal(tier = 0) {
  if (!ready()) return
  const steps = [0, 4, 7, 12, 16, 19, 24].slice(0, 4 + Math.min(tier, 3))
  const root = 67 + (tier >= 4 ? 2 : 0)
  const at0 = 0.12
  steps.forEach((s, i) => mallet(midi(root + s), { gain: 0.11, at: at0 + i * 0.075, dur: 0.35, room: 0.3 }))
  const chordAt = at0 + steps.length * 0.075
  const len = 1 + tier * 0.15
  for (const s of [0, 4, 7, 12]) tone(midi(root + s), len, { gain: 0.04, at: chordAt, attack: 0.05, room: 0.45 })
  for (let i = 0; i < 3 + tier; i++) {
    mallet(midi(root + 24 + [0, 4, 7][i % 3]), { gain: 0.03, at: chordAt + 0.05 + i * 0.06, dur: 0.3, room: 0.4, pan: rnd(-0.3, 0.3) })
  }
  if (tier >= 3) tone(midi(root - 12), len + 0.2, { gain: 0.08, at: chordAt, attack: 0.08, room: 0.3 })
}

// --- Movement --------------------------------------------------------------

// One footfall. surface 'grass' | 'hard' (lego plastic, road, plaza, garage),
// intensity 0 (walk) .. 1 (sprint), side -1 / 1 pans it a touch left / right.
export function footstep(surface = 'grass', intensity = 0, side = 1) {
  if (!ready()) return
  const g = 0.55 + 0.45 * clamp01(intensity)
  const pan = side * 0.1
  if (surface === 'grass') {
    noise(vary(0.11), { type: 'lowpass', freq: vary(700, 0.1), to: 280, gain: 0.2 * g, brown: true, attack: 0.006, room: 0.04, pan })
    noise(0.07, { freq: vary(1700, 0.1), q: 0.8, gain: 0.03 * g, attack: 0.008, room: 0, pan })
    tone(vary(80), 0.06, { gain: 0.08 * g, room: 0, pan })
  } else {
    const f = vary(150, 0.06)
    tone(f, 0.05, { gain: 0.14 * g, to: f * 0.6, room: 0.06, pan })
    noise(0.03, { freq: vary(1100, 0.08), q: 1.6, gain: 0.07 * g, room: 0.05, pan })
    noise(0.06, { type: 'lowpass', freq: 500, gain: 0.12 * g, brown: true, room: 0, pan })
  }
}

// Jump: a push-off scuff and the air of the body rising.
export function jump(surface = 'grass') {
  if (!ready()) return
  noise(0.07, { type: 'lowpass', freq: surface === 'grass' ? 600 : 800, gain: 0.16, brown: true })
  noise(0.22, { freq: 300, to: 900, q: 0.9, gain: 0.06, attack: 0.05, room: 0.05 })
  tone(110, 0.08, { gain: 0.06, to: 160 })
}

// Landing; impact 0 (a hop) .. 1 (a long fall).
export function land(impact = 0, surface = 'grass') {
  if (!ready()) return
  const k = clamp01(impact)
  tone(vary(115) - k * 30, 0.16 + 0.16 * k, { gain: 0.22 + 0.32 * k, to: 40, room: 0.08 + 0.1 * k })
  noise(0.15 + 0.1 * k, { type: 'lowpass', freq: 320 + k * 600, to: 140, gain: 0.22 + 0.3 * k, brown: true, room: 0.08 })
  if (surface === 'grass') noise(0.12, { freq: 1500, q: 0.7, gain: 0.04 + 0.04 * k, attack: 0.01, room: 0 })
  else knock(260, { gain: 0.08 + 0.08 * k, dur: 0.05 })
}

// Back home (R, fell off the island, Reset Character): a soft airy swoop and a bright pop.
export function respawn() {
  if (!ready()) return
  noise(0.45, { freq: 1600, to: 400, q: 1, gain: 0.06, attack: 0.12, room: 0.35 })
  noise(0.1, { type: 'lowpass', freq: 350, gain: 0.14, brown: true, at: 0.3 })
  mallet(midi(79), { gain: 0.07, at: 0.3, dur: 0.3, room: 0.3 })
  mallet(midi(84), { gain: 0.06, at: 0.36, dur: 0.45, room: 0.3 })
}

// --- UI hookup: hover + press on everything clickable ----------------------

const CLICKABLE = 'button, a[href], [role="button"], input, select, summary, label, .touch-btn'
function clickable(t) {
  if (!(t instanceof Element) || t.closest('[data-sfx="off"]')) return null
  const el = t.closest(CLICKABLE)
  if (el) {
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return null
    if (el.classList.contains('touch-btn')) return el
    // Buttons styled `cursor: default` are inert (equipped, locked, the other player's slot).
    return getComputedStyle(el).cursor === 'pointer' ? el : null
  }
  // Anything else styled as clickable: climb to the outermost pointer element so its children share it.
  let e = t
  if (getComputedStyle(e).cursor !== 'pointer') return null
  while (e.parentElement && e.parentElement !== document.body && getComputedStyle(e.parentElement).cursor === 'pointer') e = e.parentElement
  return e
}

if (typeof document !== 'undefined') {
  let hovered = null
  document.addEventListener(
    'pointerover',
    (e) => {
      if (e.pointerType !== 'mouse') return
      const el = clickable(e.target)
      if (el && el !== hovered) hover()
      hovered = el
    },
    { capture: true, passive: true },
  )
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button > 0) return
      if (clickable(e.target)) click()
    },
    { capture: true, passive: true },
  )
}
