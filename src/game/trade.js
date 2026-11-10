// Player-to-player trading. Walk up to another player and press E (tap on touch) to ask; if they
// accept, both get the Trade window: "Your Offer" (3 x 3 slots, the green + opens "Select to add" with
// your hotbar cars; tap an offered car to take it back) next to the other player's offer, then
// Accept / Decline. Any change to either offer clears both accepts and re-locks Accept for a few
// seconds, so nobody can swap the offer at the last moment. Both accepted = the cars change hands.
//
// The server (backend trades.ts) brokers requests and relays offers; the cars live here. A car you
// offer leaves your hotbar at once and is held aside (`escrowed()`, also written to the save) until
// the trade completes or ends, so it can never be placed, sold or offered twice.
import { MUTATIONS, PICKAXE_RARITIES } from '../config.js'
import { short } from '../lobby/paint.js'
import { renderSideCarIcons } from '../hud/thumbnails.js'
import { setTradeHandler, tradeAccept, tradeCancel, tradeOffer, tradeReply, tradeRequest } from '../net.js'
import './pickshop.css'
import './windows.css'
import './trade.css'

const SLOTS = 9 // matches the backend's TRADE_SLOTS
const LOCK_S = 4 // Accept stays locked this long after either offer changes
const MUT = Object.fromEntries(MUTATIONS.map((m) => [m.id, m]))

// title-bar icon: the two green / orange trade arrows
const ARROWS = `<svg viewBox="0 0 100 100"><g stroke="#0d0f17" stroke-width="5" stroke-linejoin="round">
  <path d="M14 36 L58 14 L58 26 L88 26 L88 46 L58 46 L58 58 Z" fill="#ffa21a"/>
  <path d="M86 64 L42 86 L42 74 L12 74 L12 54 L42 54 L42 42 Z" fill="#3ae860"/></g></svg>`

const rate = (v) => (v < 100 && v % 1 ? v.toFixed(1) : short(v))

// inv: { cars(), take(i) -> car, give(car, force) -> bool, room(), addMoney(n), sellValue(car) }
// opts: { inv, hud, sfx, income(car) -> $/s, beforeOpen(), onDone() }
export function createTrade(layer, { inv, hud, sfx, income, beforeOpen, onDone }) {
  const root = document.createElement('div')
  root.className = 'pick-shop trade-shop'
  root.innerHTML = `<div class="pick-win trade-win" role="dialog" aria-label="Trade">
    <div class="pick-head win-blue studs"><span class="pick-ico">${ARROWS}</span><span class="pick-title ol">Trade</span></div>
    <div class="pick-body trade-body">
      <div class="trade-cols">
        <div class="trade-col"><div class="trade-who ol">Your Offer</div><div class="trade-grid mine"></div></div>
        <span class="trade-mid">${ARROWS}</span>
        <div class="trade-col"><div class="trade-who ol theirs-name"></div><div class="trade-grid theirs"></div></div>
      </div>
      <div class="trade-btns">
        <button class="lego-btn green studs trade-accept"><span class="ol">Accept</span></button>
        <button class="lego-btn red studs trade-decline"><span class="ol">Decline</span></button>
      </div>
    </div>
    <div class="trade-pick" hidden>
      <div class="pick-head win-blue studs"><span class="pick-title ol">Select to add</span><button class="pick-x studs" aria-label="Close"><span class="ol">X</span></button></div>
      <div class="pick-body trade-pick-body"><div class="trade-pick-list"></div></div>
    </div>
  </div>`
  layer.appendChild(root)
  const $ = (s) => root.querySelector(s)
  const mineGrid = $('.trade-grid.mine')
  const theirsGrid = $('.trade-grid.theirs')
  const theirsName = $('.theirs-name')
  const acceptBtn = $('.trade-accept')
  const acceptLabel = acceptBtn.querySelector('span')
  const picker = $('.trade-pick')
  const pickList = $('.trade-pick-list')

  // The request / invite card at the top of the screen.
  const invite = document.createElement('div')
  invite.className = 'trade-invite'
  invite.innerHTML = `<div class="trade-invite-text ol"></div><div class="trade-invite-btns">
    <button class="lego-btn green studs trade-yes"><span class="ol">Accept</span></button>
    <button class="lego-btn red studs trade-no"><span class="ol">Decline</span></button></div>`
  layer.appendChild(invite)

  const icons = {}
  const iconOf = (look) => {
    if (!(look in icons)) {
      try {
        Object.assign(icons, renderSideCarIcons([look]))
      } catch {
        icons[look] = ''
      }
    }
    return icons[look] ?? ''
  }

  // --- State -----------------------------------------------------------------------------------
  let open = false
  let outgoing = false // a request of ours waits for an answer
  let incoming = null // { from, name } the request shown on the invite card
  let partnerName = ''
  let offer = [] // our cars, held aside (taken off the hotbar)
  let theirs = []
  let meAccepted = false
  let themAccepted = false
  let lastKey = ''
  let lockUntil = 0
  let timer = 0

  const lockLeft = () => Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000))

  function cardHtml(car) {
    const r = PICKAXE_RARITIES[car.rarity] ?? PICKAXE_RARITIES.Common
    const v = MUT[car.variant] ?? MUT.Normal
    return { r, html: `<div class="tc-inc ol">$${rate(income(car))}/s</div><img alt="" src="${iconOf(car.look)}"><div class="tc-lvl ol">Lvl ${car.level}</div><div class="tc-var ol" style="color:${v.color}">${car.variant ?? 'Normal'}</div><div class="tc-rar ol" style="color:${r.text}">${car.rarity}</div>` }
  }
  function fillCard(el, car) {
    const { r, html } = cardHtml(car)
    el.classList.add('has')
    el.style.setProperty('--card', r.card)
    el.style.setProperty('--edge', r.edge)
    el.innerHTML = html
  }

  function render() {
    // Mine: cars, then the green + on the first free slot (while there is room on the hotbar side).
    mineGrid.replaceChildren(
      ...Array.from({ length: SLOTS }, (_, i) => {
        const el = document.createElement('button')
        el.className = 'trade-slot'
        if (offer[i]) {
          fillCard(el, offer[i])
          el.addEventListener('click', () => removeCar(i))
        } else if (i === offer.length) {
          el.classList.add('add')
          el.innerHTML = '<span class="ol">+</span>'
          el.setAttribute('aria-label', 'Add a car')
          el.addEventListener('click', openPicker)
        } else el.disabled = true
        return el
      }),
    )
    theirsGrid.replaceChildren(
      ...Array.from({ length: SLOTS }, (_, i) => {
        const el = document.createElement('div')
        el.className = 'trade-slot'
        if (theirs[i]) fillCard(el, theirs[i])
        return el
      }),
    )
    theirsName.textContent = partnerName
    theirsName.classList.toggle('ready', themAccepted)
    tick()
  }

  function tick() {
    const left = lockLeft()
    const locked = left > 0
    acceptBtn.classList.toggle('waiting', locked || meAccepted)
    acceptLabel.textContent = meAccepted ? 'Accepted' : locked ? `Accept (${left})` : 'Accept'
  }

  // --- Picker: hotbar cars -----------------------------------------------------------------------
  function refreshPicker() {
    const cars = inv.cars()
    if (!cars.length || offer.length >= SLOTS) return closePicker()
    pickList.replaceChildren(
      ...cars.map((car, k) => {
        const b = document.createElement('button')
        b.className = 'trade-slot has pickable'
        fillCard(b, car)
        b.addEventListener('click', () => addCar(k))
        return b
      }),
    )
  }
  function openPicker() {
    if (!inv.cars().length) {
      sfx.error()
      return hud.toast('No cars in your hotbar: press E on a parked car to take it')
    }
    picker.hidden = false
    refreshPicker()
    sfx.blip()
  }
  function closePicker() {
    picker.hidden = true
  }
  $('.trade-pick .pick-x').addEventListener('click', () => (sfx.close(), closePicker()))
  pickList.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true })

  // --- Offer ---------------------------------------------------------------------------------------
  function sendOffer() {
    meAccepted = false
    tradeOffer(offer)
    render()
  }
  function addCar(k) {
    if (offer.length >= SLOTS) return
    const car = inv.take(k)
    if (!car) return
    offer.push(car)
    sfx.blip()
    sendOffer()
    refreshPicker()
  }
  function removeCar(i) {
    const [car] = offer.splice(i, 1)
    if (!car) return
    inv.give(car, true)
    sfx.blip()
    sendOffer()
    if (!picker.hidden) refreshPicker()
  }
  // Cars held aside go back to the hotbar (trade ended without a swap).
  function returnAll() {
    for (const car of offer) inv.give(car, true)
    offer = []
  }

  // --- Window -------------------------------------------------------------------------------------
  function openWindow(name) {
    beforeOpen?.()
    partnerName = name
    offer = []
    theirs = []
    meAccepted = themAccepted = false
    lastKey = ''
    lockUntil = 0
    closePicker()
    open = true
    root.classList.add('show')
    render()
    clearInterval(timer)
    timer = setInterval(tick, 250)
    sfx.blip()
  }
  function closeWindow() {
    open = false
    clearInterval(timer)
    closePicker()
    root.classList.remove('show')
  }
  // Closing the window any other way than Accept / Decline (another window opens, ...) = Decline.
  function decline() {
    if (!open) return
    tradeCancel()
    returnAll()
    closeWindow()
    sfx.close()
  }
  $('.trade-decline').addEventListener('click', decline)
  acceptBtn.addEventListener('click', () => {
    if (!open || lockLeft() > 0) return
    if (!meAccepted) {
      if (!offer.length && !theirs.length) return hud.toast('Add a car to trade first')
      if (inv.room() < theirs.length) {
        sfx.error()
        return hud.toast('Your hotbar is full! Make room for the cars you receive')
      }
    }
    meAccepted = !meAccepted
    tradeAccept(meAccepted)
    sfx.blip()
    tick()
  })

  // --- Invite card ---------------------------------------------------------------------------------
  function showInvite(msg) {
    incoming = msg
    invite.querySelector('.trade-invite-text').textContent = `${msg.name} wants to trade`
    invite.classList.add('show')
    sfx.blip()
  }
  function hideInvite() {
    incoming = null
    invite.classList.remove('show')
  }
  invite.querySelector('.trade-yes').addEventListener('click', () => incoming && (tradeReply(incoming.from, true), hideInvite()))
  invite.querySelector('.trade-no').addEventListener('click', () => incoming && (tradeReply(incoming.from, false), hideInvite()))

  // --- Server events -------------------------------------------------------------------------------
  const DECLINED = {
    declined: (n) => `${n} declined your trade`,
    timeout: (n) => `${n} did not answer your trade request`,
    busy: (n) => `${n} is busy right now`,
    far: (n) => `${n} is too far away`,
    cancelled: (n) => `${n} cancelled the trade request`,
    left: (n) => `${n} left`,
  }
  const handlers = {
    tradeSent: (m) => {
      outgoing = true
      hud.toast(`Trade request sent to ${m.name}`)
    },
    tradeDeclined: (m) => {
      outgoing = false
      hud.toast((DECLINED[m.reason] ?? DECLINED.declined)(m.name))
    },
    tradeInvite: (m) => (open || incoming ? tradeReply(m.from, false) : showInvite(m)),
    tradeInviteEnd: () => hideInvite(),
    tradeStart: (m) => {
      outgoing = false
      hideInvite()
      openWindow(m.name)
    },
    tradeState: (m) => {
      if (!open) return
      theirs = Array.isArray(m.theirs) ? m.theirs : []
      meAccepted = !!m.meAccepted
      themAccepted = !!m.themAccepted
      const key = JSON.stringify([m.mine, m.theirs])
      if (key !== lastKey) {
        if (lastKey) lockUntil = Date.now() + LOCK_S * 1000
        lastKey = key
      }
      render()
    },
    tradeDone: (m) => {
      if (!open) return
      let paid = 0
      for (const car of Array.isArray(m.received) ? m.received : []) if (!inv.give(car)) (paid += inv.sellValue(car)), inv.addMoney(inv.sellValue(car))
      offer = [] // handed over
      closeWindow()
      sfx.buy()
      hud.toast(paid ? `Trade complete! Your hotbar was full: sold the rest for $${short(paid)}` : 'Trade complete!')
      onDone?.()
    },
    tradeEnd: (m) => {
      outgoing = false
      hideInvite()
      if (!open) return
      returnAll()
      closeWindow()
      hud.toast(m.reason === 'offline' ? 'Trade cancelled: connection lost' : `${m.name || 'The other player'} ${m.reason === 'left' ? 'left' : 'cancelled the trade'}`)
    },
  }
  setTradeHandler((type, msg) => {
    try {
      handlers[type]?.(msg ?? {})
    } catch (err) {
      console.warn('[trade]', type, err)
    }
  })

  return {
    // E on another player (game.js prompt).
    request(sid, name) {
      if (open || outgoing || incoming) return
      tradeRequest(sid)
      void name
    },
    // May the Trade prompt be offered right now?
    get idle() {
      return !open && !outgoing && !incoming
    },
    // Cars held aside during a trade (the game's save writes them back with the hotbar).
    escrowed: () => offer,
    get isOpen() {
      return open
    },
    open: () => {},
    close: decline,
    refresh: () => open && !picker.hidden && refreshPicker(),
  }
}
