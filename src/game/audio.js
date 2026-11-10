// Procedural sound effects (Web Audio, no files): every sound is a few short
// oscillator / filtered-noise voices with exponential envelopes, through one
// compressor so stacked hits never clip. The context starts on the first
// pointer or key press (browsers block audio before a gesture); calls made
// before that are silent no-ops.
import { GAME } from '../config.js'

const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null
let ctx = null
let out = null
let noiseBuf = null
let muted = false

function init() {
  if (ctx || !AC) return ctx
  try {
    ctx = new AC()
  } catch {
    return null
  }
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -16
  comp.knee.value = 8
  comp.ratio.value = 4
  out = ctx.createGain()
  out.gain.value = GAME.volume * volume
  out.connect(comp)
  comp.connect(ctx.destination)
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return ctx
}

export function unlock() {
  if (!init()) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
}
if (AC) {
  window.addEventListener('pointerdown', unlock, { capture: true })
  window.addEventListener('keydown', unlock, { capture: true })
}

// Master volume 0..1 (Bloxity's master_volume setting; 0 during an ad break).
let volume = 1
export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v))
  muted = volume === 0
  if (out) out.gain.value = GAME.volume * volume
}

const ready = () => !muted && init() && ctx.state === 'running'
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12)
const rnd = (a, b) => a + Math.random() * (b - a)

function envelope(t0, dur, gain, attack) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  return g
}

// One oscillator voice; `to` glides the pitch over the note.
function tone(freq, dur, { type = 'sine', gain = 0.3, at = 0, to = null, attack = 0.005 } = {}) {
  const t0 = ctx.currentTime + at
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur)
  const g = envelope(t0, dur, gain, attack)
  o.connect(g)
  g.connect(out)
  o.start(t0)
  o.stop(t0 + dur + 0.03)
}

// Filtered white noise; `to` sweeps the filter.
function noise(dur, { gain = 0.3, at = 0, type = 'bandpass', freq = 1000, to = null, q = 1, attack = 0.003 } = {}) {
  const t0 = ctx.currentTime + at
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.setValueAtTime(freq, t0)
  if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur)
  f.Q.value = q
  const g = envelope(t0, dur, gain, attack)
  src.connect(f)
  f.connect(g)
  g.connect(out)
  src.start(t0, Math.random() * 0.5)
  src.stop(t0 + dur + 0.03)
}

const glints = (n, at, spread = 0.05, gain = 0.045) => {
  for (let i = 0; i < n; i++) tone(rnd(2200, 5200), 0.09, { gain, at: at + i * spread + rnd(0, 0.02) })
}

// Bought a block: a bright two-note register "ka-ching".
export function buy() {
  if (!ready()) return
  tone(1318, 0.08, { type: 'square', gain: 0.06 })
  tone(1318, 0.08, { type: 'triangle', gain: 0.16 })
  tone(1760, 0.34, { type: 'square', gain: 0.05, at: 0.075 })
  tone(1760, 0.34, { type: 'triangle', gain: 0.14, at: 0.075 })
  noise(0.3, { type: 'highpass', freq: 6000, gain: 0.05, at: 0.07 })
  glints(3, 0.12)
}

// Picked up (block lands in the hands).
export function pickup() {
  if (!ready()) return
  tone(330, 0.16, { type: 'triangle', gain: 0.2, to: 700 })
  noise(0.15, { freq: 600, to: 2600, q: 1.5, gain: 0.08 })
}

// Block set down on a bay: a solid thud with a click.
export function place() {
  if (!ready()) return
  tone(150, 0.24, { gain: 0.6, to: 50 })
  noise(0.16, { type: 'lowpass', freq: 520, gain: 0.35 })
  tone(880, 0.05, { type: 'triangle', gain: 0.08, at: 0.02 })
}

// Hammer cutting the air.
export function swing() {
  if (!ready()) return
  noise(0.17, { freq: 450, to: 2100, q: 1.3, gain: 0.16, attack: 0.06 })
}

// Hammer lands on the block. `damage` 0..1 (how broken it is) raises the pitch.
export function hit(damage) {
  if (!ready()) return
  const base = (190 + damage * 170) * rnd(0.95, 1.06)
  tone(base, 0.13, { type: 'triangle', gain: 0.45, to: base * 0.5 })
  tone(base * 2.02, 0.06, { type: 'square', gain: 0.05 })
  noise(0.08, { freq: 900 + damage * 1500, q: 2.4, gain: 0.5 })
  noise(0.03, { type: 'highpass', freq: 4000, gain: 0.12 })
}

// A third of the block's health gone: crunchy crack.
export function crack() {
  if (!ready()) return
  noise(0.1, { type: 'highpass', freq: 2500, gain: 0.25 })
  noise(0.14, { freq: 700, q: 4, gain: 0.3, at: 0.02 })
  for (let i = 0; i < 3; i++) noise(0.025, { freq: rnd(1500, 4000), q: 6, gain: 0.25, at: 0.03 + i * 0.03 })
}

// The block bursts. tier 0 (Common) .. 5 (Secret) makes it bigger.
export function smash(tier = 0) {
  if (!ready()) return
  noise(0.6 + tier * 0.05, { type: 'lowpass', freq: 4200, to: 140, gain: 0.75 })
  tone(115, 0.5, { gain: 0.6, to: 34 })
  noise(0.16, { type: 'highpass', freq: 3000, gain: 0.25 })
  for (let i = 0; i < 6; i++) noise(0.035, { freq: rnd(900, 3800), q: 5, gain: 0.3, at: 0.02 + i * 0.035 })
}

// The car appears: a rising arpeggio, a held chord and sparkles; rarer = longer.
export function reveal(tier = 0) {
  if (!ready()) return
  const steps = [0, 4, 7, 12, 16, 19, 24].slice(0, 4 + Math.min(tier, 3))
  const root = 72 + (tier >= 4 ? 2 : 0)
  const at0 = 0.12
  steps.forEach((s, i) => {
    tone(midi(root + s), 0.18, { type: 'triangle', gain: 0.17, at: at0 + i * 0.075 })
    tone(midi(root + s + 12), 0.12, { gain: 0.05, at: at0 + i * 0.075 })
  })
  const chordAt = at0 + steps.length * 0.075
  const top = tier >= 3 ? 12 : 0
  for (const s of [0, 4, 7, 12]) {
    tone(midi(root + s + top), 0.8 + tier * 0.1, { type: 'triangle', gain: 0.09, at: chordAt, attack: 0.02 })
    tone(midi(root + s + top + 12), 0.6, { gain: 0.035, at: chordAt, attack: 0.02 })
  }
  glints(6 + tier * 2, chordAt, 0.045)
  if (tier >= 3) tone(midi(root - 12), 1.1, { type: 'sawtooth', gain: 0.03, at: chordAt, attack: 0.05 })
}

// Money collected from a pad; n (1..6) coins.
export function collect(n = 3) {
  if (!ready()) return
  const notes = [0, 2, 4, 7, 9, 12]
  const k = Math.max(2, Math.min(6, n))
  for (let i = 0; i < k; i++) {
    tone(midi(84 + notes[i]), 0.13, { type: 'triangle', gain: 0.15, at: i * 0.05 })
    tone(midi(96 + notes[i]), 0.08, { gain: 0.04, at: i * 0.05 })
  }
  noise(0.25, { type: 'highpass', freq: 6500, gain: 0.05, at: 0.03 })
}

// Car levelled up.
export function upgrade() {
  if (!ready()) return
  tone(392, 0.24, { type: 'sawtooth', gain: 0.05, to: 1175 })
  tone(392, 0.24, { type: 'triangle', gain: 0.12, to: 1175 })
  for (const f of [784, 988, 1175, 1568]) tone(f, 0.5, { type: 'triangle', gain: 0.08, at: 0.22, attack: 0.01 })
  glints(5, 0.25)
}

// Car sold off its bay.
export function sell() {
  if (!ready()) return
  noise(0.3, { freq: 2400, to: 500, q: 1.2, gain: 0.12 })
  for (let i = 0; i < 4; i++) tone(midi(91 - i * 3), 0.1, { type: 'triangle', gain: 0.13, at: 0.05 + i * 0.05 })
}

// Can't do that (not enough money, garage full).
export function error() {
  if (!ready()) return
  tone(170, 0.1, { type: 'square', gain: 0.07 })
  tone(125, 0.15, { type: 'square', gain: 0.07, at: 0.11 })
}

// Soft blip when an interaction prompt appears.
export function blip() {
  if (!ready()) return
  tone(1046, 0.05, { type: 'triangle', gain: 0.05 })
}
