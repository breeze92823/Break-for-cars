// The "Buy Pickaxes" window (opened by the Pickaxes Shop stall's ring): a red
// studded title bar with an X, and a scrolling list of rarity-coloured cards,
// one per pickaxe (config PICKAXES): icon well, name, rarity, damage per hit,
// and one button: the money price, "Equip" once owned, "Equipped" when in hand.
// Pickaxes are bought with in-game money only.
import { PICKAXE_RARITIES, PICKAXES } from '../config.js'
import { short } from '../lobby/paint.js'
import './pickshop.css'

const SVG = {
  // title-bar pickaxe: gold head, brown handle
  pick: `<svg viewBox="0 0 100 100"><g stroke="#3a1a08" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
    <path d="M50 30 L50 94" stroke="#3a1a08" stroke-width="17"/><path d="M50 30 L50 94" stroke="#a8582a" stroke-width="9"/>
    <path d="M6 44 Q50 2 94 44 L84 50 Q50 22 16 50 Z" fill="#ffb21a"/>
    <path d="M20 34 Q50 12 80 34" fill="none" stroke="#ffe27a" stroke-width="4"/></g></svg>`,
  // damage: a blue crystal sword with an orange hilt
  dmg: `<svg viewBox="0 0 100 100"><g stroke="#0d0f17" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
    <polygon points="40,50 78,12 92,8 88,22 50,60" fill="#3d9bff"/>
    <polygon points="47,51 80,18 85,15 51,55" fill="#c4e6ff" stroke-width="0"/>
    <polygon points="28,46 54,72 47,79 21,53" fill="#ff9a1a"/>
    <path d="M34 66 L14 86" stroke="#0d0f17" stroke-width="16"/><path d="M34 66 L14 86" stroke="#ff9a1a" stroke-width="8"/></g></svg>`,
}

// opts: { isOwned(id), equipped(), onBuy(id), onEquip(id), onClose() }
export function createPickShop(layer, opts) {
  const root = document.createElement('div')
  root.className = 'pick-shop'
  root.innerHTML = `<div class="pick-win" role="dialog" aria-label="Buy Pickaxes">
    <div class="pick-head studs"><span class="pick-ico">${SVG.pick}</span><span class="pick-title ol">Buy Pickaxes</span><button class="pick-x studs" aria-label="Close"><span class="ol">X</span></button></div>
    <div class="pick-body"><div class="pick-list"></div></div>
  </div>`
  layer.appendChild(root)
  const list = root.querySelector('.pick-list')

  const cards = PICKAXES.map((p) => {
    const r = PICKAXE_RARITIES[p.rarity] ?? PICKAXE_RARITIES.Common
    const card = document.createElement('div')
    card.className = 'pick-card studs'
    card.style.setProperty('--card', r.card)
    card.style.setProperty('--icon', r.icon)
    card.style.setProperty('--edge', r.edge)
    card.style.setProperty('--rtext', r.text)
    card.innerHTML = `<div class="pick-icon studs"><img alt=""></div>
      <div class="pick-info"><div class="pick-name ol">${p.name}</div><div class="pick-rarity ol">${p.rarity}</div><div class="pick-dmg">${SVG.dmg}<span class="ol">${short(p.damage)}</span></div></div>
      <button class="lego-btn green studs pick-btn"><span class="ol"></span></button>`
    const btn = card.querySelector('.pick-btn')
    btn.addEventListener('click', () => {
      if (!opts.isOwned(p.id)) opts.onBuy(p.id)
      else if (opts.equipped() !== p.id) opts.onEquip(p.id)
      refresh()
    })
    list.appendChild(card)
    return { p, card, btn, label: btn.querySelector('span'), img: card.querySelector('img') }
  })

  function refresh() {
    const eq = opts.equipped()
    for (const c of cards) {
      const owned = opts.isOwned(c.p.id)
      const state = !owned ? 'buy' : eq === c.p.id ? 'equipped' : 'equip'
      c.btn.dataset.state = state
      c.label.textContent = state === 'buy' ? `$${short(c.p.price)}` : state === 'equip' ? 'Equip' : 'Equipped'
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
  // The list scrolls with a wheel / drag even though the HUD blocks touch gestures.
  list.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true })

  return {
    open: show,
    close: hide,
    refresh,
    get isOpen() {
      return open
    },
    setIcons(icons) {
      for (const c of cards) if (icons[c.p.id]) c.img.src = icons[c.p.id]
    },
  }
}
