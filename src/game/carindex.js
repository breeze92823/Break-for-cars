// The Index window (HUD Index tile): every car in CAR_ROSTER, once per variant
// (MUTATIONS: Normal, Golden, Radioactive, ...). Variant tabs on the left, a
// 3-column scrolling grid of cards on the right: name, picture (a black
// silhouette until you have owned that car in that variant), variant and rarity.
// The header shows how many of the open tab's cars you have found. Discoveries
// are saved under INDEX.saveKey.
import { CAR_ROSTER, INDEX, MUTATIONS, RARITY_LADDER } from '../config.js'
import { renderSideCarIcons } from '../hud/thumbnails.js'
import { rarityColor } from './carmake.js'
import './pickshop.css'
import './windows.css'

const BOOK = `<svg viewBox="0 0 100 100"><g stroke="#0c1f4d" stroke-width="5" stroke-linejoin="round">
  <polygon points="12,44 54,24 90,42 48,64" fill="#55b0ff"/><polygon points="12,44 48,64 48,86 12,66" fill="#eef3fb"/>
  <polygon points="48,64 90,42 90,64 48,86" fill="#1f5fd0"/><polygon points="26,44 54,31 76,42 48,55" fill="#8fd0ff" stroke-width="0"/>
  <path d="M40 70 L40 92 L46 86 L52 92 L52 74" fill="#ff3b4e" stroke-width="4"/></g></svg>`

const ROSTER = RARITY_LADDER.flatMap((rarity) => (CAR_ROSTER[rarity] ?? []).map((c) => ({ ...c, rarity })))
const keyOf = (name, variant) => `${name}|${variant || 'Normal'}`

export function createIndex(layer, { sfx }) {
  const found = new Set()
  try {
    for (const k of JSON.parse(localStorage.getItem(INDEX.saveKey) || '[]')) found.add(k)
  } catch {
    // nothing found yet
  }
  const save = () => {
    try {
      localStorage.setItem(INDEX.saveKey, JSON.stringify([...found]))
    } catch {
      // ignore
    }
  }

  const root = document.createElement('div')
  root.className = 'pick-shop index-shop'
  root.innerHTML = `<div class="pick-win index-win" role="dialog" aria-label="Index">
    <div class="pick-head win-blue studs"><span class="pick-ico">${BOOK}</span><span class="pick-title ol">Index</span><span class="index-count ol"></span><button class="pick-x studs" aria-label="Close"><span class="ol">X</span></button></div>
    <div class="pick-body index-body"><div class="index-tabs"></div><div class="index-grid"></div></div>
  </div>`
  layer.appendChild(root)
  const tabsEl = root.querySelector('.index-tabs')
  const grid = root.querySelector('.index-grid')
  const countEl = root.querySelector('.index-count')
  let tab = MUTATIONS[0]
  let icons = null

  const tabs = MUTATIONS.map((m) => {
    const b = document.createElement('button')
    b.className = 'index-tab studs'
    b.style.setProperty('--tab', m.tab)
    b.innerHTML = `<span class="ol">${m.id}</span>`
    b.addEventListener('click', () => {
      tab = m
      sfx.blip()
      paint()
      grid.scrollTop = 0
    })
    tabsEl.appendChild(b)
    return { m, b }
  })

  function paint() {
    if (!icons) icons = renderSideCarIcons([...new Set(ROSTER.map((c) => c.look))])
    for (const t of tabs) t.b.classList.toggle('sel', t.m === tab)
    const vColor = tab.id === 'Normal' ? '#ffffff' : tab.color
    let n = 0
    grid.replaceChildren(
      ...ROSTER.map((c) => {
        const have = found.has(keyOf(c.name, tab.id))
        if (have) n++
        const card = document.createElement('div')
        card.className = `index-card${have ? '' : ' unknown'}`
        card.style.setProperty('--ray', tab.id === 'Normal' ? 'rgba(255,255,255,0.12)' : `color-mix(in srgb, ${tab.color} 45%, transparent)`)
        // short words never split ("Rolls-Royce" stays whole; "Mercedes-Maybach" may break at
        // its hyphen); long names get a smaller font
        const name = c.name.split(' ').map((w) => (w.length <= 11 ? `<span class="nw">${w}</span>` : w)).join(' ')
        card.innerHTML = `<div class="fuse-name ol${c.name.length > 12 ? ' long' : ''}">${name}</div><img alt="" src="${icons[c.look]}"><div class="fuse-line ol" style="color:${vColor}">${tab.id}</div><div class="fuse-line ol" style="color:${rarityColor(c.rarity)}">${c.rarity}</div>`
        return card
      }),
    )
    countEl.textContent = `${n}/${ROSTER.length}`
  }

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
    sfx.close()
  }
  root.querySelector('.pick-x').addEventListener('click', hide)
  grid.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true })

  return {
    open: show,
    close: hide,
    toggle: () => (open ? hide() : show()),
    // How much of the Index is found, 0..1: distinct cars owned in any variant (unlocks garage skins).
    percent() {
      const names = new Set([...found].map((k) => k.split('|')[0]))
      return ROSTER.filter((c) => names.has(c.name)).length / ROSTER.length
    },
    // A car the player now owns (record with name + optional variant).
    discover(car) {
      if (!car?.name) return
      const k = keyOf(car.name, car.variant)
      if (found.has(k)) return
      found.add(k)
      save()
      if (open) paint()
    },
  }
}
