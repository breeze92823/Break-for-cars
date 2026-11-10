// The "Base Skins" window (opened by stepping on the "Bases" pad by the garage, game.js): a blue
// studded title bar with an X and a scrolling list of cards, one per garage skin (config
// GARAGE_SKINS): a little garage drawn in the skin's colours, its name, how much of the Index
// unlocks it ("Get 30% of the Index to Unlock! (12%)"), its income multiplier, and its buttons:
// the money price + "Locked" until it is owned, then "Equip" / "Equipped". Skins are bought with
// in-game money only.
import { GARAGE_SKINS } from '../config.js'
import { short } from '../lobby/paint.js'
import './pickshop.css'
import './windows.css'
import './baseskins.css'

const HOUSE = `<svg viewBox="0 0 100 100"><g stroke="#0c1f4d" stroke-width="5" stroke-linejoin="round">
  <polygon points="10,46 50,20 90,46 50,72" fill="#55b0ff"/><polygon points="10,46 50,72 50,92 10,66" fill="#eef3fb"/>
  <polygon points="50,72 90,46 90,66 50,92" fill="#1f5fd0"/><polygon points="26,46 50,31 74,46 50,61" fill="#8fd0ff" stroke-width="0"/></g></svg>`
const CASH = `<svg viewBox="0 0 100 100"><g stroke="#0d2a08" stroke-width="5" stroke-linejoin="round">
  <polygon points="8,58 54,36 92,52 46,76" fill="#2f9a1c"/><polygon points="8,58 46,76 46,88 8,70" fill="#1d6a10"/><polygon points="46,76 92,52 92,64 46,88" fill="#155a0a"/>
  <polygon points="8,46 54,24 92,40 46,64" fill="#5dd83a"/><ellipse cx="50" cy="44" rx="12" ry="6" fill="#ffe14a" stroke-width="4"/></g></svg>`

let gradId = 0
// A little glass garage in a skin's colours (the card icon).
function garageIcon(sk) {
  const c = sk.colors
  const id = `skg${gradId++}`
  const frame = sk.rainbow ? `url(#${id})` : c.frame
  const defs = sk.rainbow
    ? `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff3b4e"/><stop offset="0.25" stop-color="#ffd21a"/><stop offset="0.5" stop-color="#43e83a"/><stop offset="0.75" stop-color="#2fc8ff"/><stop offset="1" stop-color="#b23cff"/></linearGradient></defs>`
    : ''
  return `<svg viewBox="0 0 100 100">${defs}<g stroke-linejoin="round">
    <polygon points="12,34 52,22 90,32 50,44" fill="${c.slab}" stroke="#0d0f17" stroke-width="3"/>
    <polygon points="12,34 50,44 50,86 12,76" fill="${c.glass}" fill-opacity="0.75" stroke="${frame}" stroke-width="4"/>
    <polygon points="50,44 90,32 90,74 50,86" fill="${c.glass}" fill-opacity="0.5" stroke="${frame}" stroke-width="4"/>
    <path d="M25 37.5 V79.5 M37.5 40.8 V82.8 M12 55 L50 65 M63 40 V82 M76.5 36 V78 M50 65 L90 53" stroke="${frame}" stroke-width="3" fill="none"/>
    <polygon points="12,76 50,86 90,74 90,79 50,92 12,81" fill="${c.slab}" stroke="#0d0f17" stroke-width="2.5"/></g></svg>`
}

// opts: { isOwned(id), equipped(), indexPct() (0..1), onBuy(id), onEquip(id), onLocked(skin), onClose() }
export function createBaseSkins(layer, opts) {
  const root = document.createElement('div')
  root.className = 'pick-shop skins-shop'
  root.innerHTML = `<div class="pick-win" role="dialog" aria-label="Base Skins">
    <div class="pick-head win-blue studs"><span class="pick-ico">${HOUSE}</span><span class="pick-title ol">Base Skins</span><button class="pick-x studs" aria-label="Close"><span class="ol">X</span></button></div>
    <div class="pick-body"><div class="pick-list"></div></div>
  </div>`
  layer.appendChild(root)
  const list = root.querySelector('.pick-list')

  const cards = GARAGE_SKINS.map((sk) => {
    const card = document.createElement('div')
    card.className = 'pick-card skin-card studs'
    card.style.setProperty('--card', sk.card)
    card.style.setProperty('--edge', '#0d0f17')
    card.innerHTML = `<div class="pick-icon skin-icon studs">${garageIcon(sk)}</div>
      <div class="pick-info"><div class="pick-name ol">${sk.name}</div><div class="skin-req ol"></div><div class="pick-dmg skin-mult">${CASH}<span class="ol">${sk.mult}x</span></div></div>
      <div class="skin-btns"><button class="lego-btn purple studs skin-buy"><span class="ol"></span></button><button class="lego-btn studs skin-state"><span class="ol"></span></button></div>`
    const buy = card.querySelector('.skin-buy')
    const stateBtn = card.querySelector('.skin-state')
    buy.addEventListener('click', () => {
      opts.onBuy(sk.id)
      refresh()
    })
    stateBtn.addEventListener('click', () => {
      if (!opts.isOwned(sk.id)) opts.onLocked(sk)
      else if (opts.equipped() !== sk.id) opts.onEquip(sk.id)
      refresh()
    })
    list.appendChild(card)
    return { sk, card, buy, buyLabel: buy.querySelector('span'), stateBtn, stateLabel: stateBtn.querySelector('span'), req: card.querySelector('.skin-req') }
  })

  function refresh() {
    const eq = opts.equipped()
    const pct = Math.floor(opts.indexPct() * 100)
    for (const c of cards) {
      const owned = opts.isOwned(c.sk.id)
      const state = !owned ? 'locked' : eq === c.sk.id ? 'equipped' : 'equip'
      c.req.textContent = c.sk.index > 0 ? `Get ${Math.round(c.sk.index * 100)}% of the Index to Unlock! (${pct}%)` : 'Your starter garage'
      c.buy.hidden = owned
      c.buyLabel.textContent = `$${short(c.sk.price)}`
      c.stateBtn.dataset.state = state
      c.stateBtn.classList.toggle('red', state === 'locked')
      c.stateBtn.classList.toggle('green', state === 'equip')
      c.stateLabel.textContent = state === 'locked' ? 'Locked' : state === 'equip' ? 'Equip' : 'Equipped'
    }
  }

  let open = false
  function show() {
    if (open) return
    open = true
    refresh()
    root.classList.add('show')
  }
  function hide() {
    if (!open) return
    open = false
    root.classList.remove('show')
    opts.onClose?.()
  }
  root.querySelector('.pick-x').addEventListener('click', hide)
  list.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true })

  return {
    open: show,
    close: hide,
    refresh,
    get isOpen() {
      return open
    },
  }
}
