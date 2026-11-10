// The "Sell Cars" window (opened by the Sell stall's ring): a green studded
// title bar with an X, and a scrolling list of the cars in the hotbar, highest
// value first, one rarity-coloured card each: car picture, name, rarity, the
// money it sells for and a Sell button. Shares its look with the Buy Pickaxes
// window (pickshop.css); card colours come from PICKAXE_RARITIES.
import { PICKAXE_RARITIES } from '../config.js'
import { short } from '../lobby/paint.js'
import { renderSideCarIcons } from '../hud/thumbnails.js'
import './pickshop.css'

// title-bar icon: a green cash stack
const CASH = `<svg viewBox="0 0 100 100"><g stroke="#0d3a0a" stroke-width="5" stroke-linejoin="round">
  <polygon points="8,52 56,30 92,46 44,70" fill="#7dff6a"/>
  <polygon points="8,52 44,70 44,86 8,68" fill="#2fb52a"/>
  <polygon points="44,70 92,46 92,62 44,86" fill="#1f8a1c"/>
  <polygon points="12,40 58,18 90,32 46,56" fill="#9dff8a"/>
  <ellipse cx="51" cy="37" rx="10" ry="6" fill="#2fb52a" stroke-width="3"/></g></svg>`

// opts: { cars() -> [{ name, rarity, look, value }], onSell(index), onClose() }
export function createSellShop(layer, opts) {
  const root = document.createElement('div')
  root.className = 'pick-shop sell-shop'
  root.innerHTML = `<div class="pick-win" role="dialog" aria-label="Sell Cars">
    <div class="pick-head sell-head studs"><span class="pick-ico">${CASH}</span><span class="pick-title ol">Sell Cars</span><button class="pick-x studs" aria-label="Close"><span class="ol">X</span></button></div>
    <div class="pick-body"><div class="pick-list"></div></div>
  </div>`
  layer.appendChild(root)
  const list = root.querySelector('.pick-list')
  const icons = {}

  function refresh() {
    const cars = opts.cars().map((c, index) => ({ ...c, index }))
    if (!cars.length) return hide()
    const need = [...new Set(cars.map((c) => c.look))].filter((k) => !icons[k])
    if (need.length) Object.assign(icons, renderSideCarIcons(need))
    cars.sort((a, b) => b.value - a.value)
    list.replaceChildren(
      ...cars.map((c) => {
        const r = PICKAXE_RARITIES[c.rarity] ?? PICKAXE_RARITIES.Common
        const card = document.createElement('div')
        card.className = 'pick-card sell-card studs'
        card.style.setProperty('--card', r.card)
        card.style.setProperty('--edge', r.edge)
        card.style.setProperty('--rtext', r.text)
        card.innerHTML = `<img class="sell-car" alt="" src="${icons[c.look]}">
          <div class="pick-info"><div class="pick-name ol"></div><div class="pick-rarity ol">${c.rarity}</div></div>
          <div class="sell-value ol">$${short(c.value)}</div>
          <button class="lego-btn green studs pick-btn sell-btn"><span class="ol">Sell</span></button>`
        card.querySelector('.pick-name').textContent = c.name
        card.querySelector('.sell-btn').addEventListener('click', () => {
          opts.onSell(c.index)
          refresh()
        })
        return card
      }),
    )
  }

  let open = false
  function show() {
    if (open) return
    open = true
    list.scrollTop = 0
    refresh()
    if (open) root.classList.add('show')
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
    refresh: () => open && refresh(),
    get isOpen() {
      return open
    },
  }
}
