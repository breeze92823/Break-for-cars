// Timed events. The "Next Event in" board (south plaza) counts down EVENTS.every
// seconds; then a random variant from MUTATIONS (by weight: Golden most often,
// Rainbow rarely) runs for EVENTS.duration seconds. During it, each block that
// comes out of the conveyor tunnel is that variant with EVENTS.chance, and the
// car inside earns the variant's multiplier. The board shows "<Variant> Event!"
// with the time left, a pill under the top HUD row does too, and a banner
// announces the start. The clock runs while the game is open (not saved).
import { EVENTS, MUTATIONS } from '../config.js'
import './windows.css'

const fmt = (s) => {
  s = Math.max(0, Math.ceil(s))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// lobby: setEventBoard; base: setVariantRoller; hud: announce/toast; sfx
export function createEvents(layer, { lobby, base, hud, sfx }) {
  const pool = MUTATIONS.filter((m) => m.weight)
  const total = pool.reduce((a, m) => a + m.weight, 0)
  let next = EVENTS.every
  let active = null
  let left = 0

  const pill = document.createElement('div')
  pill.className = 'event-pill ol'
  layer.appendChild(pill)

  const roller = () => (active && Math.random() < EVENTS.chance ? active.id : null)
  base.setVariantRoller(roller)

  function start(id) {
    let m = MUTATIONS.find((x) => x.id === id && x.weight)
    if (!m) {
      let r = Math.random() * total
      m = pool.find((x) => (r -= x.weight) < 0) ?? pool[0]
    }
    active = m
    left = EVENTS.duration
    hud.announce(`${m.id} Event! ${m.id} blocks earn x${m.mult}!`, 4200)
    sfx.upgrade()
    pill.style.setProperty('--ev', m.color)
    pill.classList.add('show')
  }
  function end() {
    hud.toast(`The ${active.id} Event has ended`)
    active = null
    next = EVENTS.every
    pill.classList.remove('show')
  }

  let shown = ''
  return {
    get active() {
      return active
    },
    // The player's game moved to another garage: its conveyor rolls the event variants now.
    moveTo(next) {
      base.setVariantRoller(null)
      base = next
      base.setVariantRoller(roller)
    },
    // dev / testing: start an event now (variant id, or random)
    start,
    update(dt) {
      if (active) {
        left -= dt
        if (left <= 0) end()
      } else {
        next -= dt
        if (next <= 0) start()
      }
      lobby?.setEventBoard(active ? { title: `${active.id} Event!`, color: active.color, left } : { title: 'Next Event in', color: '#ffffff', left: next })
      const text = active ? `${active.id} Event  ${fmt(left)}` : ''
      if (text !== shown) {
        shown = text
        pill.textContent = text
      }
    },
  }
}
