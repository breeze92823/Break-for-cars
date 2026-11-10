// The Spin Wheel window: a big six-wedge wheel (SPIN_WHEEL.rewards, clockwise
// from the top) with each reward's picture, label and odds, a pointer at the
// top, an X, and one green "Spin (Nx)" button with "Free Spin in: mm:ss" over
// it. One free spin every SPIN_WHEEL.freeEvery s; spins stack and are saved
// (SPIN_WHEEL.saveKey). The wheel eases to the rolled wedge, then pays out.
// While Bloxity has a rewarded ad to show, a "Watch Ad" button gives NET.adRewardSpins more
// spins once the ad is watched and the game server has checked its token (rewardedAd).
import { NET, SPIN_WHEEL } from '../config.js'
import { short } from '../lobby/paint.js'
import { renderBlockIcons, renderSideCarIcons } from '../hud/thumbnails.js'
import { incomeLabel, makeCar } from './carmake.js'
import './windows.css'

const NS = 'http://www.w3.org/2000/svg'
const R = 200 // wheel radius in SVG units
const CASH = (big) => `<g stroke="#0d3a0a" stroke-width="5" stroke-linejoin="round" transform="scale(${big ? 1.15 : 0.95})">
  <polygon points="-44,6 0,-14 44,2 0,24" fill="#7dff6a"/><polygon points="-44,6 0,24 0,34 -44,16" fill="#2fb52a"/><polygon points="0,24 44,2 44,12 0,34" fill="#1f8a1c"/>
  <polygon points="-38,-8 4,-28 40,-12 -2,8" fill="#9dff8a"/><ellipse cx="2" cy="-10" rx="11" ry="6" fill="#2fb52a" stroke-width="3"/></g>`
const MINI_WHEEL = `<g stroke="#0d0f17" stroke-width="4"><circle r="34" fill="#ff3b4e"/><path d="M0 0 L0 -34 A34 34 0 0 1 29 -17 Z" fill="#ffd21a"/><path d="M0 0 L29 -17 A34 34 0 0 1 29 17 Z" fill="#2dd84a"/><path d="M0 0 L29 17 A34 34 0 0 1 0 34 Z" fill="#2f9bff"/><path d="M0 0 L0 34 A34 34 0 0 1 -29 17 Z" fill="#b23cff"/><circle r="8" fill="#fff"/></g>`

const mmss = (s) => {
  s = Math.max(0, Math.ceil(s))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// inv: { give(car), room(), addMoney(n) }, income() -> $/s, giveBlock(theme) -> bool, hud, sfx
// rewardedAd: { available() -> bool, watch() -> Promise<bool> (true = watched and verified) }
export function createSpin(layer, { inv, income, giveBlock, hud, sfx, onWin, rewardedAd }) {
  const W = SPIN_WHEEL
  const st = { spins: W.startSpins, nextAt: Date.now() + W.freeEvery * 1000 }
  try {
    const d = JSON.parse(localStorage.getItem(W.saveKey) || 'null')
    if (d) {
      st.spins = Math.max(0, d.spins | 0)
      st.nextAt = d.nextAt || st.nextAt
    }
  } catch {
    // defaults
  }
  const save = () => {
    try {
      localStorage.setItem(W.saveKey, JSON.stringify(st))
    } catch {
      // ignore
    }
  }
  // free spins that came due while away
  function accrue() {
    const now = Date.now()
    if (now < st.nextAt) return
    const n = 1 + Math.floor((now - st.nextAt) / (W.freeEvery * 1000))
    st.spins += n
    st.nextAt += n * W.freeEvery * 1000
    save()
  }

  const cars = W.rewards.map((r) => (r.kind === 'car' ? makeCar({ rarity: r.rarity, name: r.name, look: r.look, bonus: r.bonus ?? 1 }) : null))
  const cashOf = (r) => Math.max(r.min, Math.round((income() * r.incomeSecs) / 1000) * 1000)

  const root = document.createElement('div')
  root.className = 'pick-shop spin-shop'
  root.innerHTML = `<div class="spin-win" role="dialog" aria-label="Spin Wheel">
    <button class="pick-x studs spin-x" aria-label="Close"><span class="ol">X</span></button>
    <div class="spin-stage"><svg class="spin-svg" viewBox="-220 -232 440 452"><g class="spin-wheel"></g>
      <g class="spin-pointer"><path d="M-30 -226 L30 -226 L0 -178 Z" fill="#e9f6ff" stroke="#0d3a6a" stroke-width="6" stroke-linejoin="round"/></g></svg></div>
    <div class="spin-foot"><div class="spin-free ol"></div><button class="lego-btn green studs spin-go"><span class="ol">Spin</span></button><button class="lego-btn studs spin-ad" hidden><span class="ol">Watch Ad: +${NET.adRewardSpins} Spin</span></button></div>
  </div>`
  layer.appendChild(root)
  const wheel = root.querySelector('.spin-wheel')
  const freeEl = root.querySelector('.spin-free')
  const goBtn = root.querySelector('.spin-go')
  const goLabel = goBtn.querySelector('span')
  const adBtn = root.querySelector('.spin-ad')
  let watching = false

  const n = W.rewards.length
  const step = 360 / n
  const total = W.rewards.reduce((a, r) => a + r.weight, 0)
  let built = false
  const labelOf = (r, i) => (r.kind === 'cash' ? `$${short(cashOf(r))}` : r.kind === 'block' ? 'Hacker Block' : r.kind === 'spins' ? `${r.amount} Spins` : cars[i].name)
  const subOf = (r, i) => (r.kind === 'car' ? incomeLabel(cars[i]) : '')
  const labelEls = []

  function build() {
    built = true
    const carIcons = renderSideCarIcons([...new Set(cars.filter(Boolean).map((c) => c.look))])
    const blockIcons = renderBlockIcons(W.rewards.filter((r) => r.kind === 'block').map((r) => r.theme))
    const rim = document.createElementNS(NS, 'circle')
    rim.setAttribute('r', R + 10)
    rim.setAttribute('fill', '#ffffff')
    rim.setAttribute('stroke', '#0d0f17')
    rim.setAttribute('stroke-width', 6)
    wheel.appendChild(rim)
    W.rewards.forEach((r, i) => {
      const a0 = ((i * step - 90) * Math.PI) / 180
      const a1 = (((i + 1) * step - 90) * Math.PI) / 180
      const path = document.createElementNS(NS, 'path')
      path.setAttribute('d', `M0 0 L${R * Math.cos(a0)} ${R * Math.sin(a0)} A${R} ${R} 0 0 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`)
      path.setAttribute('fill', r.color)
      path.setAttribute('stroke', '#0d0f17')
      path.setAttribute('stroke-width', 3)
      wheel.appendChild(path)
      const g = document.createElementNS(NS, 'g')
      g.setAttribute('transform', `rotate(${i * step + step / 2})`)
      let pic = ''
      if (r.kind === 'cash') pic = `<g transform="translate(0 -112)">${CASH(r.incomeSecs > 300)}</g>`
      else if (r.kind === 'spins') pic = `<g transform="translate(0 -112)">${MINI_WHEEL}</g>`
      else {
        const src = r.kind === 'car' ? carIcons[r.look] : blockIcons[r.theme]
        pic = `<image href="${src}" x="-52" y="-160" width="104" height="104" transform="rotate(-90 0 -108)"/>`
      }
      g.innerHTML = `<text class="spin-pct" y="-48">${r.weight}%</text>${pic}<text class="spin-lbl" y="-170"></text><text class="spin-sub" y="-150"></text>`
      wheel.appendChild(g)
      labelEls.push({ r, i, lbl: g.querySelector('.spin-lbl'), sub: g.querySelector('.spin-sub') })
    })
    const hub = document.createElementNS(NS, 'circle')
    hub.setAttribute('r', 16)
    hub.setAttribute('fill', '#ffffff')
    hub.setAttribute('stroke', '#0d0f17')
    hub.setAttribute('stroke-width', 5)
    wheel.appendChild(hub)
  }
  function paintLabels() {
    for (const e of labelEls) {
      e.lbl.textContent = labelOf(e.r, e.i)
      e.sub.textContent = subOf(e.r, e.i)
    }
  }

  let angle = 0
  let spinning = false
  function paintFoot() {
    accrue()
    goLabel.textContent = st.spins > 0 ? `Spin (${st.spins}x)` : 'Spin'
    goBtn.classList.toggle('waiting', st.spins <= 0 || spinning)
    freeEl.textContent = `Free Spin in: ${mmss((st.nextAt - Date.now()) / 1000)}`
    hud.setSpins?.(st.spins)
    adBtn.hidden = !rewardedAd?.available()
    adBtn.classList.toggle('waiting', watching)
  }
  function addSpins(k) {
    st.spins += k
    save()
    paintFoot()
  }
  async function watchAd() {
    if (watching || !rewardedAd) return
    watching = true
    paintFoot()
    const ok = await rewardedAd.watch()
    watching = false
    if (ok) {
      addSpins(NET.adRewardSpins)
      sfx.buy()
      hud.toast(`+${NET.adRewardSpins} spin! Thanks for watching`)
    } else hud.toast('No ad reward this time: try again later')
    paintFoot()
  }

  function spin() {
    if (spinning) return
    accrue()
    if (st.spins <= 0) {
      sfx.error()
      return hud.toast(`No spins left: next free spin in ${mmss((st.nextAt - Date.now()) / 1000)}`)
    }
    st.spins--
    save()
    let roll = Math.random() * total
    const i = Math.max(0, W.rewards.findIndex((r) => (roll -= r.weight) < 0))
    const r = W.rewards[i]
    // rewards are fixed at the spin (cash by the income now)
    const amount = r.kind === 'cash' ? cashOf(r) : 0
    const center = i * step + step / 2
    const jitter = (Math.random() - 0.5) * step * 0.6
    const target = angle - (angle % 360) + 360 * 6 + (360 - center) + jitter
    angle = target
    spinning = true
    paintFoot()
    wheel.style.transition = `transform ${W.spinTime}s cubic-bezier(0.12, 0.8, 0.18, 1)`
    wheel.style.transform = `rotate(${angle}deg)`
    sfx.click()
    // Ratchet clicks that slow down with the wheel (its ease-out is close to 1 - (1 - t)^3.5).
    const TICKS = 36
    for (let k = 1; k < TICKS; k++) {
      const t = 1 - Math.pow(1 - k / TICKS, 1 / 3.5)
      setTimeout(sfx.tick, t * W.spinTime * 1000)
    }
    setTimeout(() => {
      spinning = false
      payout(r, i, amount)
      paintFoot()
    }, W.spinTime * 1000 + 150)
  }
  function payout(r, i, amount) {
    let text
    if (r.kind === 'cash') {
      inv.addMoney(amount)
      text = `$${short(amount)}`
    } else if (r.kind === 'spins') {
      st.spins += r.amount
      save()
      text = `${r.amount} more spins`
    } else if (r.kind === 'block') {
      text = giveBlock(r.theme) ? 'a Hacker Block! Carry it to a free bay' : 'a Hacker Block (hands full: paid as cash)'
    } else {
      if (inv.room() > 0) {
        inv.give({ ...cars[i] })
        text = `${cars[i].name} (${r.rarity})!`
      } else {
        const cash = cars[i].base * 600
        inv.addMoney(cash)
        text = `${cars[i].name}, hotbar full: paid $${short(cash)}`
      }
    }
    sfx.buy()
    setTimeout(sfx.upgrade, 140)
    hud.toast(`You won ${text}`, 3200)
    onWin?.(r)
  }

  let open = false
  setInterval(() => {
    if (open) paintFoot()
    else {
      accrue()
      hud.setSpins?.(st.spins)
    }
  }, 500)

  function show() {
    if (open) return
    open = true
    if (!built) build()
    paintLabels()
    paintFoot()
    root.classList.add('show')
    sfx.blip()
  }
  function hide() {
    if (!open) return
    open = false
    root.classList.remove('show')
  }
  root.querySelector('.spin-x').addEventListener('click', hide)
  goBtn.addEventListener('click', spin)
  adBtn.addEventListener('click', watchAd)
  accrue()
  hud.setSpins?.(st.spins)

  return {
    open: show,
    close: hide,
    toggle: () => (open ? hide() : show()),
    addSpins,
  }
}
