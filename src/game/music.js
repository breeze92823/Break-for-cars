// Background music: a cheerful procedural loop, no files. Its volume follows Bloxity's
// master_volume x music_volume settings (main.js); 0 stops it.
// Four bars (C - Am - F - G) at 112 bpm: triangle bass on beats 1 and 3, a soft
// sine arpeggio in eighths, and a square-wave lead every other pass. Notes are
// scheduled ~0.3 s ahead on its own AudioContext, which starts on the first
// pointer / key press (browsers block audio before a gesture).
import { MUSIC_VOLUME } from '../config.js'

const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null
const BPM = 112
const EIGHTH = 60 / BPM / 2
const CHORDS = [
  [48, [60, 64, 67, 72]], // C
  [45, [57, 60, 64, 69]], // Am
  [41, [57, 60, 65, 69]], // F
  [43, [55, 59, 62, 67]], // G
]
// lead: 8 eighths per bar, 0 = rest
const LEAD = [
  [72, 0, 76, 0, 79, 76, 0, 74],
  [72, 0, 69, 0, 72, 0, 76, 0],
  [77, 0, 76, 0, 74, 0, 72, 69],
  [71, 0, 74, 0, 79, 0, 77, 74],
]
const freq = (m) => 440 * Math.pow(2, (m - 69) / 12)

let ctx = null
let out = null
let enabled = false
let timer = 0
let nextT = 0
let step = 0 // eighths since start

function note(m, t, dur, type, gain) {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.value = freq(m)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g)
  g.connect(out)
  o.start(t)
  o.stop(t + dur + 0.05)
}

function schedule() {
  if (!ctx || ctx.state !== 'running') return
  if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05
  while (nextT < ctx.currentTime + 0.3) {
    const bar = Math.floor(step / 8) % 4
    const e = step % 8
    const [bass, tones] = CHORDS[bar]
    if (e === 0 || e === 4) note(bass, nextT, EIGHTH * 3.5, 'triangle', 0.5)
    note(tones[[0, 1, 2, 3, 2, 1, 2, 3][e]], nextT, EIGHTH * 1.6, 'sine', 0.16)
    const lead = LEAD[bar][e]
    if (lead && Math.floor(step / 32) % 2 === 1) note(lead, nextT, EIGHTH * 1.8, 'square', 0.05)
    nextT += EIGHTH
    step++
  }
}

function start() {
  if (!enabled || !AC) return
  if (!ctx) {
    try {
      ctx = new AC()
    } catch {
      return
    }
    out = ctx.createGain()
    out.gain.value = MUSIC_VOLUME * level
    out.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  if (!timer) timer = setInterval(schedule, 100)
}

// 0..1 of the music's full level.
let level = 1
export function setMusicVolume(v) {
  level = Math.max(0, Math.min(1, v))
  if (out) out.gain.value = MUSIC_VOLUME * level
}

export function setMusic(on) {
  if (on === enabled) return
  enabled = on
  if (on) start()
  else {
    clearInterval(timer)
    timer = 0
    if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {})
  }
}

if (AC) {
  const kick = () => enabled && start()
  window.addEventListener('pointerdown', kick, { capture: true })
  window.addEventListener('keydown', kick, { capture: true })
  // a hidden tab stops the loop; it picks up again on return
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !enabled) return
    if (document.visibilityState === 'hidden') ctx.suspend().catch(() => {})
    else start()
  })
}
