// The game's Settings window (the gear button beside the calendar): green studded
// rows with an icon, a name and an On (green) / Off (red) switch: Music, Sounds and
// Trading. These are the game's own switches, separate from Bloxity's portal menu
// (which has the volume sliders): main.js multiplies the two, so Music Off silences
// the music whatever the portal's music_volume is. Trading is stored for when trade
// requests exist. Saved per device under GAME_SETTINGS.saveKey.
import { GAME_SETTINGS } from '../config.js'
import './pickshop.css'
import './windows.css'

// Loaded at import so main.js can apply them before the game exists.
export const gameSettings = { ...GAME_SETTINGS.defaults }
try {
  Object.assign(gameSettings, JSON.parse(localStorage.getItem(GAME_SETTINGS.saveKey) || '{}'))
} catch {
  // blocked storage: defaults
}
const listeners = new Set()
// fn(key, value) after a switch flips.
export function onGameSettings(fn) {
  listeners.add(fn)
}

const ICON = {
  gear: `<svg viewBox="0 0 100 100"><g stroke="#0d1f4d" stroke-width="5" stroke-linejoin="round"><path fill="#b9c8e8" d="M43 6h14l3 12 9 4 11-6 10 10-6 11 4 9 12 3v14l-12 3-4 9 6 11-10 10-11-6-9 4-3 12H43l-3-12-9-4-11 6-10-10 6-11-4-9-12-3V43l12-3 4-9-6-11 10-10 11 6 9-4z"/><circle cx="50" cy="50" r="15" fill="#3c6dff"/></g></svg>`,
  music: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#e3e8f2" stroke="#0d0f17" stroke-width="5"/><circle cx="50" cy="50" r="30" fill="none" stroke="#b9c1d2" stroke-width="3"/><circle cx="50" cy="50" r="12" fill="#9aa3b5" stroke="#0d0f17" stroke-width="4"/><circle cx="50" cy="50" r="4" fill="#0d0f17"/><path d="M24 30 Q32 20 44 18" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>`,
  sounds: `<svg viewBox="0 0 100 100"><g stroke="#0d0f17" stroke-width="5" stroke-linejoin="round"><path d="M14 38h16l22-18v60L30 62H14z" fill="#3c6dff"/><path d="M62 34 Q72 50 62 66" fill="none" stroke="#ffb21a" stroke-width="8" stroke-linecap="round"/><path d="M74 24 Q90 50 74 76" fill="none" stroke="#ffb21a" stroke-width="8" stroke-linecap="round"/></g></svg>`,
  trading: `<svg viewBox="0 0 100 100"><g stroke="#0d0f17" stroke-width="5" stroke-linejoin="round"><path d="M14 34h46V20l28 24-28 24V54H14z" fill="#ffb21a"/><path d="M86 66H40v14L12 56l28-24v14h46z" fill="#2fd84a"/></g></svg>`,
}
const ROWS = [
  { key: 'music', label: 'Music' },
  { key: 'sounds', label: 'Sounds' },
  { key: 'trading', label: 'Trading' },
]

// sfx: game/audio.js (click blips); hud for toasts. Returns { open, close, toggle }.
export function createSettings(layer, { sfx, hud }) {
  const save = () => {
    try {
      localStorage.setItem(GAME_SETTINGS.saveKey, JSON.stringify(gameSettings))
    } catch {
      // ignore
    }
  }

  const root = document.createElement('div')
  root.className = 'pick-shop settings-shop'
  root.innerHTML = `<div class="pick-win settings-win" role="dialog" aria-label="Settings">
    <div class="pick-head win-blue studs"><span class="pick-ico">${ICON.gear}</span><span class="pick-title ol">Settings</span><button class="pick-x studs" aria-label="Close"><span class="ol">X</span></button></div>
    <div class="pick-body settings-body"></div>
  </div>`
  layer.appendChild(root)
  const body = root.querySelector('.settings-body')
  const rows = ROWS.map((r) => {
    const row = document.createElement('div')
    row.className = 'set-row studs'
    row.innerHTML = `<span class="set-ico">${ICON[r.key]}</span><span class="set-name ol">${r.label}</span><button class="lego-btn studs set-btn"><span class="ol"></span></button>`
    const btn = row.querySelector('button')
    btn.addEventListener('click', () => {
      gameSettings[r.key] = !gameSettings[r.key]
      save()
      paint()
      for (const fn of listeners) fn(r.key, gameSettings[r.key])
      sfx.blip()
      if (r.key === 'trading') hud.toast(gameSettings.trading ? 'Trade requests allowed' : 'Trade requests blocked')
    })
    body.appendChild(row)
    return { key: r.key, btn, label: btn.querySelector('span') }
  })
  function paint() {
    for (const r of rows) {
      const on = !!gameSettings[r.key]
      r.btn.classList.toggle('green', on)
      r.btn.classList.toggle('red', !on)
      r.label.textContent = on ? 'On' : 'Off'
    }
  }
  paint()

  let open = false
  const show = () => {
    if (open) return
    open = true
    paint()
    root.classList.add('show')
    sfx.blip()
  }
  const hide = () => {
    if (!open) return
    open = false
    root.classList.remove('show')
    sfx.blip()
  }
  root.querySelector('.pick-x').addEventListener('click', hide)
  return { open: show, close: hide, toggle: () => (open ? hide() : show()) }
}
