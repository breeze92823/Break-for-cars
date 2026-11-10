// The Daily Rewards window (the calendar button): Days 1-6 as blue tiles in a
// 3x2 grid and Day 7, the OP car, as a tall purple tile. Claimed days show a big
// green check, today's reward glows with "Claim!", later days say "Can't claim!".
// Under the grid: "Next Reward in: 21h 59m 40s". One claim per DAILY.cooldownHours;
// a gap over DAILY.graceHours restarts the streak at Day 1. Own save (DAILY.saveKey).
import { DAILY } from '../config.js'
import { short } from '../lobby/paint.js'
import { renderSideCarIcons } from '../hud/thumbnails.js'
import { incomeLabel, makeCar, rarityColor } from './carmake.js'
import './pickshop.css'
import './windows.css'

const H = 3600 * 1000
const CALENDAR = `<svg viewBox="0 0 100 100"><rect x="10" y="18" width="80" height="72" rx="12" fill="#fff" stroke="#0d0f17" stroke-width="5"/><rect x="10" y="18" width="80" height="24" rx="10" fill="#ff3b5c" stroke="#0d0f17" stroke-width="5"/><rect x="27" y="7" width="9" height="20" rx="4" fill="#dde3ee" stroke="#0d0f17" stroke-width="4"/><rect x="64" y="7" width="9" height="20" rx="4" fill="#dde3ee" stroke="#0d0f17" stroke-width="4"/><text x="50" y="80" text-anchor="middle" font-size="36" font-family="Fredoka, sans-serif" font-weight="700" fill="#1b1c22">31</text></svg>`
const CASH = `<svg viewBox="0 0 100 70"><g stroke="#0d3a0a" stroke-width="4" stroke-linejoin="round"><polygon points="6,40 52,20 94,36 48,58" fill="#7dff6a"/><polygon points="6,40 48,58 48,68 6,50" fill="#2fb52a"/><polygon points="48,58 94,36 94,46 48,68" fill="#1f8a1c"/><polygon points="12,28 56,8 92,22 46,44" fill="#9dff8a"/><ellipse cx="52" cy="26" rx="11" ry="6" fill="#2fb52a" stroke-width="3"/></g></svg>`
const CHECK = `<svg class="dr-check" viewBox="0 0 100 100"><path d="M10 52 L38 80 L92 22" fill="none" stroke="#0d3a0a" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 52 L38 80 L92 22" fill="none" stroke="#45e83a" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/></svg>`

const fmt = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m ${String(s % 60).padStart(2, '0')}s`
}

// inv: { give(car) -> bool, room(), addMoney(n) }, hud, sfx, onReady(bool), onClaim(text)
export function createDaily(layer, { inv, hud, sfx, onReady, onClaim }) {
  const st = { day: 0, last: 0 }
  try {
    const d = JSON.parse(localStorage.getItem(DAILY.saveKey) || 'null')
    if (d) {
      st.day = Math.max(0, Math.min(DAILY.rewards.length - 1, d.day | 0))
      st.last = d.last || 0
    }
  } catch {
    // blocked storage: a fresh streak
  }
  const save = () => {
    try {
      localStorage.setItem(DAILY.saveKey, JSON.stringify(st))
    } catch {
      // ignore
    }
  }
  function checkStreak() {
    if (st.last && Date.now() - st.last > DAILY.graceHours * H) {
      st.day = 0
      st.last = 0
      save()
    }
  }
  const nextAt = () => (st.last ? st.last + DAILY.cooldownHours * H : 0)
  const ready = () => Date.now() >= nextAt()

  // Reward cars: built once (Day 7's income label needs its record).
  const cars = DAILY.rewards.map((r) => (r.kind === 'car' ? makeCar({ rarity: r.rarity, name: r.name, look: r.look, bonus: r.bonus ?? 1 }) : null))

  const root = document.createElement('div')
  root.className = 'pick-shop daily-shop'
  root.innerHTML = `<div class="pick-win daily-win" role="dialog" aria-label="Daily Rewards">
    <div class="pick-head win-blue studs"><span class="pick-ico">${CALENDAR}</span><span class="pick-title ol">Daily Rewards</span><button class="pick-x studs" aria-label="Close"><span class="ol">X</span></button></div>
    <div class="pick-body daily-body"><div class="daily-grid"></div><div class="daily-next ol"></div></div>
  </div>`
  layer.appendChild(root)
  const grid = root.querySelector('.daily-grid')
  const nextEl = root.querySelector('.daily-next')
  let icons = null

  const tiles = DAILY.rewards.map((r, i) => {
    const t = document.createElement('button')
    const big = i === DAILY.rewards.length - 1
    t.className = `daily-tile studs${big ? ' big' : ''}`
    t.addEventListener('click', () => claim(i))
    grid.appendChild(t)
    return { r, t, big, car: cars[i] }
  })

  function paint() {
    if (!icons) icons = renderSideCarIcons([...new Set(cars.filter(Boolean).map((c) => c.look))])
    const can = ready()
    for (const [i, { r, t, big, car }] of tiles.entries()) {
      const state = i < st.day ? 'claimed' : i === st.day && can ? 'ready' : 'locked'
      t.dataset.state = state
      const kind = r.kind === 'cash' ? '<div class="dr-kind ol" style="color:#ffe14a">CASH</div>' : `<div class="dr-kind ol" style="color:${rarityColor(r.rarity)}">${r.rarity}</div>`
      const pic = r.kind === 'cash' ? `<div class="dr-pic">${CASH}</div>` : `<img class="dr-pic" alt="" src="${icons[car.look]}">`
      const foot = r.kind === 'cash' ? `+$${short(r.amount)}` : car.name
      const flag = state === 'ready' ? '<div class="dr-flag ok ol">Claim!</div>' : state === 'locked' ? '<div class="dr-flag ol">Can\'t claim!</div>' : ''
      t.innerHTML = big
        ? `<div class="dr-day ol">Day ${i + 1}</div><div class="dr-op ol">OP CAR!</div>${kind}${pic}${flag}<div class="dr-income ol">${incomeLabel(car)}</div><div class="dr-foot ol">${foot}</div>${state === 'claimed' ? CHECK : ''}`
        : `<div class="dr-day ol">Day ${i + 1}</div>${kind}${pic}${flag}<div class="dr-foot ol">${foot}</div>${state === 'claimed' ? CHECK : ''}`
    }
    tickNext()
  }
  function tickNext() {
    nextEl.textContent = ready() ? 'Your reward is ready! Tap it to claim' : `Next Reward in: ${fmt(nextAt() - Date.now())}`
  }

  function claim(i) {
    checkStreak()
    if (i !== st.day || !ready()) {
      sfx.error()
      return hud.toast(i < st.day ? 'Already claimed!' : ready() ? `Claim Day ${st.day + 1} first` : `Come back in ${fmt(nextAt() - Date.now())}`)
    }
    const r = DAILY.rewards[i]
    let text
    if (r.kind === 'cash') {
      inv.addMoney(r.amount)
      text = `+$${short(r.amount)}`
    } else {
      if (inv.room() <= 0) {
        sfx.error()
        return hud.toast('Your hotbar is full! Place or sell a car first')
      }
      inv.give({ ...cars[i] })
      text = `${cars[i].name} (${r.rarity}) added to your hotbar!`
    }
    st.day = (i + 1) % DAILY.rewards.length
    st.last = Date.now()
    save()
    sfx.buy()
    setTimeout(sfx.upgrade, 140)
    hud.toast(`Day ${i + 1} reward: ${text}`, 3000)
    onClaim?.(text)
    // after Day 7 the loop restarts: show the finished week until the window is reopened
    if (st.day === 0) for (const { t } of tiles) t.dataset.state = 'claimed'
    else paint()
    if (st.day === 0) tickNext()
    report()
  }

  let lastReady = null
  function report() {
    const r = ready()
    if (r !== lastReady) {
      lastReady = r
      onReady?.(r)
    }
  }

  let open = false
  setInterval(() => {
    if (open) tickNext()
    if (open && ready() && tiles[st.day].t.dataset.state !== 'ready') paint()
    report()
  }, 1000)
  checkStreak()
  report()

  function show() {
    if (open) return
    open = true
    checkStreak()
    paint()
    root.classList.add('show')
    sfx.blip()
  }
  function hide() {
    if (!open) return
    open = false
    root.classList.remove('show')
    sfx.blip()
  }
  root.querySelector('.pick-x').addEventListener('click', hide)
  return {
    open: show,
    close: hide,
    toggle: () => (open ? hide() : show()),
    get isOpen() {
      return open
    },
  }
}
