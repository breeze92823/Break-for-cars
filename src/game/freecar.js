// The FREE! car (the HUD button under the Index): play FREE_CAR.minutes and claim one car, once.
// The button counts down on itself and lights up when the car is ready; the window shows the car,
// a progress bar and a Claim button.
// Play time: a guest's is counted here (only while the tab is visible, saved under FREE_CAR.saveKey);
// a signed-in player's is counted by the game server (backend freeCar.ts) while connected: it sends
// `freeCar` { tracked, played, claimed, need } once joined (net.js `onFreeCar`) and checks the claim
// (`claimFreeCar`), so the car goes once per account, on any device.
import { FREE_CAR } from '../config.js'
import { renderSideCarIcons } from '../hud/thumbnails.js'
import { incomeLabel, makeCar, rarityColor } from './carmake.js'
import './pickshop.css'
import './windows.css'

const GIFT = `<svg viewBox="0 0 100 100"><g stroke="#0d0f17" stroke-width="5" stroke-linejoin="round"><rect x="12" y="40" width="76" height="50" rx="6" fill="#49e43a"/><rect x="6" y="26" width="88" height="20" rx="5" fill="#7dff6a"/><rect x="42" y="26" width="16" height="64" fill="#ffe14a"/><path d="M50 26 C34 4 14 14 26 26 Z M50 26 C66 4 86 14 74 26 Z" fill="#ffe14a"/></g></svg>`

export const clock = (s) => {
  s = Math.max(0, Math.ceil(s))
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0')
  return `${h ? `${h}:` : ''}${mm}:${String(s % 60).padStart(2, '0')}`
}

// inv: { give(car, force), room() }, hud, sfx, claimRemote() -> Promise<{ ok, reason? } | null>,
// onState({ left, ready, claimed }) (the HUD button), onClaim(car)
export function createFreeCar(layer, { inv, hud, sfx, claimRemote, onState, onClaim }) {
  const local = { played: 0, claimed: false }
  try {
    const d = JSON.parse(localStorage.getItem(FREE_CAR.saveKey) || 'null')
    if (d) {
      local.played = Math.max(0, Number(d.played) || 0)
      local.claimed = d.claimed === true
    }
  } catch {
    // blocked storage: counts from 0 this session
  }
  const save = () => {
    try {
      localStorage.setItem(FREE_CAR.saveKey, JSON.stringify({ played: Math.floor(local.played), claimed: local.claimed }))
    } catch {
      // ignore
    }
  }
  // The server's count for a signed-in player (null = a guest / offline: the local count rules).
  let server = null // { played, at (Date.now() it arrived), claimed, need }
  const need = () => server?.need ?? FREE_CAR.minutes * 60
  const played = () => (server ? server.played + (Date.now() - server.at) / 1000 : local.played)
  const claimed = () => (server ? server.claimed : local.claimed)
  const left = () => Math.max(0, need() - played())
  const ready = () => !claimed() && left() <= 0

  const car = makeCar(FREE_CAR.car)

  const root = document.createElement('div')
  root.className = 'pick-shop free-shop'
  root.innerHTML = `<div class="pick-win free-win" role="dialog" aria-label="Free Car">
    <div class="pick-head win-green studs"><span class="pick-ico">${GIFT}</span><span class="pick-title ol">Free Car!</span><button class="pick-x studs" aria-label="Close"><span class="ol">X</span></button></div>
    <div class="pick-body free-body">
      <div class="free-card studs">
        <div class="fc-kind ol" style="color:${rarityColor(car.rarity)}">${car.rarity}</div>
        <img class="fc-pic" alt="">
        <div class="fc-name ol">${car.name}</div>
        <div class="fc-income ol">${incomeLabel(car)}</div>
      </div>
      <div class="free-side">
        <div class="free-sub ol">Play for ${FREE_CAR.minutes} minutes to get this car for FREE!</div>
        <div class="free-bar"><div class="free-fill"></div><span class="free-time ol-thin"></span></div>
        <button class="lego-btn green studs free-go"><span class="ol">Claim!</span></button>
      </div>
    </div>
  </div>`
  layer.appendChild(root)
  const pic = root.querySelector('.fc-pic')
  const fill = root.querySelector('.free-fill')
  const timeEl = root.querySelector('.free-time')
  const go = root.querySelector('.free-go')
  const goText = go.querySelector('span')

  let open = false
  let busy = false
  function paint() {
    const p = Math.min(1, played() / need())
    fill.style.width = `${(p * 100).toFixed(1)}%`
    if (claimed()) {
      timeEl.textContent = 'Claimed!'
      goText.textContent = 'Claimed'
    } else {
      timeEl.textContent = ready() ? 'Ready!' : `${clock(played())} / ${clock(need())}`
      goText.textContent = busy ? '...' : ready() ? 'Claim!' : clock(left())
    }
    go.classList.toggle('waiting', !ready() || busy)
    go.classList.toggle('claim', ready() && !busy)
  }

  let last = ''
  function report() {
    const s = { left: Math.ceil(left()), ready: ready(), claimed: claimed() }
    const k = JSON.stringify(s)
    if (k === last) return
    last = k
    onState?.(s)
  }

  // The local clock: a visible tab counts (whether or not the server counts too, so a later guest /
  // offline session carries on from here).
  let sinceSave = 0
  setInterval(() => {
    if (!document.hidden && !local.claimed && local.played < need()) {
      local.played = Math.min(need(), local.played + 1)
      if (++sinceSave >= 10) {
        sinceSave = 0
        save()
      }
    }
    report()
    if (open) paint()
  }, 1000)
  window.addEventListener('pagehide', save)

  function give() {
    if (!inv.give({ ...car }, true)) return
    local.claimed = true
    if (server) server.claimed = true
    save()
    sfx.buy()
    setTimeout(sfx.upgrade, 140)
    hud.toast(`${car.name} (${car.rarity}) added to your hotbar!`, 3000)
    onClaim?.({ ...car })
    report()
    paint()
    setTimeout(hide, 900)
  }

  async function claim() {
    if (busy) return
    if (claimed()) {
      sfx.error()
      return hud.toast('You already claimed your free car!')
    }
    if (!ready()) {
      sfx.error()
      return hud.toast(`Keep playing! Your free car is ready in ${clock(left())}`)
    }
    if (inv.room() <= 0) {
      sfx.error()
      return hud.toast('Your hotbar is full! Place or sell a car first')
    }
    if (!server) return give()
    busy = true
    paint()
    const r = await claimRemote()
    busy = false
    if (r?.ok) return give()
    sfx.error()
    if (r?.reason === 'claimed') {
      server.claimed = local.claimed = true
      save()
      hud.toast('You already claimed your free car!')
    } else if (r?.reason === 'early') {
      if (Number.isFinite(r.played)) Object.assign(server, { played: r.played, at: Date.now() })
      hud.toast(`Keep playing! Your free car is ready in ${clock(left())}`)
    } else if (r?.reason === 'guest') {
      server = null
      return claim()
    } else hud.toast('Could not reach the server. Try again in a moment')
    report()
    paint()
  }
  go.addEventListener('click', claim)

  function show() {
    if (open) return
    open = true
    if (!pic.src) pic.src = renderSideCarIcons([car.look])[car.look]
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
  report()

  return {
    open: show,
    close: hide,
    toggle: () => (open ? hide() : show()),
    get isOpen() {
      return open
    },
    // What this browser has, for the server's `freeCarSync` (it seeds a new account).
    snapshot: () => ({ played: Math.floor(local.played), claimed: local.claimed }),
    // The server's `freeCar` message; { tracked: false } (a guest, or disconnected) = count locally.
    sync(msg) {
      if (!msg?.tracked || !Number.isFinite(msg.played)) server = null
      else {
        server = { played: msg.played, at: Date.now(), claimed: msg.claimed === true, need: Number.isFinite(msg.need) && msg.need > 0 ? msg.need : FREE_CAR.minutes * 60 }
        // This browser keeps what the account has reached, for a later offline / guest session.
        local.played = Math.max(local.played, Math.min(server.need, server.played))
        if (server.claimed) local.claimed = true
        save()
      }
      report()
      if (open) paint()
    },
  }
}
