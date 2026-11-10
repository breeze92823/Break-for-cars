import './hud.css'
import { BLOCK_THEMES, FEATURED_BLOCKS, HUD_DEMO } from '../config.js'
import * as bloxity from '../bloxity.js'
import { onKey } from '../input.js'
import { fontReady } from '../propkit.js'
import { short } from '../lobby/paint.js'
import { renderCarIcons, renderIcons } from './thumbnails.js'

// The lobby HUD, laid out like the reference: To Shop / To Plot and the spin
// wheel along the top, the Shop / Index / Collect All / FREE! / Auto Swing
// column on the left, the offer tiles on the right, money bottom-left and the
// tool + car hotbar bottom-centre (keys 1-7 or tap). Icons for cars, the hammer
// and the offers are rendered from the game's own 3D models (thumbnails.js).
// Values are HUD_DEMO placeholders until the economy exists.

const SVG = {
  shop: `<svg viewBox="0 0 100 100"><g stroke="#3a0710" stroke-width="5" stroke-linejoin="round">
    <polygon points="50,30 88,46 50,62 12,46" fill="#7a0d1c"/>
    <polygon points="12,46 50,62 50,94 12,78" fill="#ff3348"/>
    <polygon points="88,46 50,62 50,94 88,78" fill="#c8172c"/>
    <polygon points="12,46 26,18 62,32 50,62" fill="#ff6878"/>
    <polygon points="88,46 94,20 60,10 50,30" fill="#ff8a96"/></g></svg>`,
  index: `<svg viewBox="0 0 100 100"><g stroke="#0c1f4d" stroke-width="5" stroke-linejoin="round">
    <polygon points="12,44 54,24 90,42 48,64" fill="#55b0ff"/>
    <polygon points="12,44 48,64 48,86 12,66" fill="#eef3fb"/>
    <polygon points="48,64 90,42 90,64 48,86" fill="#1f5fd0"/>
    <polygon points="26,44 54,31 76,42 48,55" fill="#8fd0ff" stroke-width="0"/></g></svg>`,
  magnet: `<svg viewBox="0 0 100 100"><g stroke-linecap="butt" fill="none">
    <path d="M27 18 V54 a23 23 0 0 0 46 0 V18" stroke="#3a0710" stroke-width="28"/>
    <path d="M27 18 V54 a23 23 0 0 0 46 0 V18" stroke="#ff2b3a" stroke-width="18"/>
    <path d="M22 30 V54" stroke="#ff8a96" stroke-width="5"/></g>
    <g stroke="#3a0710" stroke-width="4"><rect x="15" y="8" width="24" height="16" rx="2" fill="#e8eef8"/><rect x="61" y="8" width="24" height="16" rx="2" fill="#e8eef8"/></g></svg>`,
  pickaxe: `<svg viewBox="0 0 100 100"><g stroke="#0d0f17" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
    <path d="M32 90 L62 40" stroke="#0d0f17" stroke-width="16"/><path d="M32 90 L62 40" stroke="#b5642e" stroke-width="9"/>
    <path d="M14 34 Q50 4 88 30 L80 38 Q52 20 22 42 Z" fill="#28c8ff"/>
    <path d="M28 26 Q50 12 74 24" fill="none" stroke="#bff2ff" stroke-width="4"/></g></svg>`,
  gear: `<svg viewBox="0 0 100 100"><path fill="#e6ecf8" d="M43 6h14l3 12 9 4 11-6 10 10-6 11 4 9 12 3v14l-12 3-4 9 6 11-10 10-11-6-9 4-3 12H43l-3-12-9-4-11 6-10-10 6-11-4-9-12-3V43l12-3 4-9-6-11 10-10 11 6 9-4z"/><circle cx="50" cy="50" r="15" fill="#2a3150"/></svg>`,
  calendar: `<svg viewBox="0 0 100 100"><rect x="12" y="18" width="76" height="70" rx="12" fill="#fff"/><rect x="12" y="18" width="76" height="22" rx="10" fill="#ff3b5c"/><rect x="28" y="8" width="8" height="18" rx="4" fill="#ddd"/><rect x="64" y="8" width="8" height="18" rx="4" fill="#ddd"/><text x="50" y="78" text-anchor="middle" font-size="36" font-family="Fredoka, sans-serif" font-weight="700" fill="#222">31</text></svg>`,
  coin: `<svg viewBox="0 0 100 100"><polygon points="50,4 90,27 90,73 50,96 10,73 10,27" fill="#0d0f17"/><polygon points="50,14 82,32 82,68 50,86 18,68 18,32" fill="#3ddc4a"/><polygon points="50,32 66,41 66,59 50,68 34,59 34,41" fill="#0d0f17"/><polygon points="50,40 59,45 59,55 50,60 41,55 41,45" fill="#7dff6a"/></svg>`,
}

function el(tag, cls, html) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html != null) e.innerHTML = html
  return e
}
const outlined = (text, cls = 'ol') => `<span class="${cls}">${text}</span>`

export function createHud({ onShop, onPlot, onSpin, onCollectAll, onAutoSwing, onSlot, onDaily, onIndex, money: startMoney = 0 }) {
  const root = el('div', 'hud')

  // --- Top row ---
  const top = el('div', 'hud-top')
  const toShop = el('button', 'lego-btn green studs', `<span class="ol">To Shop</span>`)
  const toPlot = el('button', 'lego-btn blue studs', `<span class="ol">To Plot</span>`)
  const spin = el('button', 'spin-btn', `<span class="strap"></span><span class="disc"></span><span class="badge ol-thin">${HUD_DEMO.spins}</span>`)
  spin.setAttribute('aria-label', 'Spin wheel')
  top.append(toShop, toPlot, spin)
  toShop.addEventListener('click', () => onShop?.())
  toPlot.addEventListener('click', () => onPlot?.())
  spin.addEventListener('click', () => {
    spin.classList.add('whirl')
    setTimeout(() => spin.classList.remove('whirl'), 900)
    onSpin?.()
  })

  const topRight = el('div', 'hud-topright')
  const daily = el('button', 'round-btn', `${SVG.calendar}<span class="badge alert ol-thin" hidden>!</span>`)
  daily.setAttribute('aria-label', 'Daily rewards')
  // No settings / pause button: Bloxity's own menu has them (platform UI rules).
  topRight.append(daily)
  daily.addEventListener('click', () => onDaily?.())

  // --- Left column ---
  const left = el('div', 'hud-left')
  const index = el('button', 'tile index studs', `${SVG.index}<span class="name ol">Index</span>`)
  const free = el('button', 'free-btn', `<span class="rays"></span><img alt=""><span class="name ol">FREE!</span>`)
  const autoSwing = el('button', 'wide-btn studs', `${SVG.pickaxe}${outlined('Auto Swing')}`)
  left.append(index, free, autoSwing)
  autoSwing.addEventListener('click', () => {
    const on = autoSwing.classList.toggle('on')
    toast(on ? 'Auto Swing on' : 'Auto Swing off')
    onAutoSwing?.(on)
  })
  index.addEventListener('click', () => (onIndex ? onIndex() : toast('Index: coming soon')))
  for (const [b, name] of [[free, 'Free car']]) b.addEventListener('click', () => toast(`${name}: coming soon`))

  // --- Right column: offers ---
  const right = el('div', 'hud-right')
  const priceTag = (n) => `<span class="price ol-thin">${SVG.coin}${n}</span>`
  const featured = el('button', 'offer', `<span class="rays"></span><img alt="">${priceTag(FEATURED_BLOCKS[0].price)}<span class="name ol">${BLOCK_THEMES[FEATURED_BLOCKS[0].theme].name}</span>`)
  right.append(featured)
  for (const [b, name] of [[featured, 'Block offer']]) b.addEventListener('click', () => toast(`${name}: coming soon`))

  // --- Money ---
  const money = el('div', 'hud-money ol')

  // --- Hotbar: the tool, then the cars taken off their bays, then the block being
  // carried (only while carrying). Keys 1-9 pick by position; onSlot gets
  // { kind: 'hammer' | 'car' | 'block', index }.
  const hotbar = el('div', 'hud-hotbar')
  const makeSlot = (entry) => {
    const s = el('button', 'slot', `<span class="num ol-thin"></span><img alt=""><span class="cost ol-thin"></span><span class="tag ol-thin"></span>`)
    s._entry = entry
    s.addEventListener('click', () => onSlot?.(s._entry))
    return s
  }
  const slots = [makeSlot({ kind: 'hammer' })] // slots[0] = the tool slot
  const carrySlot = makeSlot({ kind: 'block' })
  carrySlot.classList.add('carry')
  carrySlot.hidden = true
  const carSlots = []
  const carIcons = {}
  let order = [slots[0]]
  hotbar.append(slots[0])
  for (let i = 1; i <= 9; i++) onKey(`Digit${i}`, () => order[i - 1] && onSlot?.(order[i - 1]._entry))
  // bar: { equipped, carrying, held, cars: [{ look, name, level, income, color }] }
  function paintHotbar(bar) {
    const cars = bar.cars ?? []
    while (carSlots.length < cars.length) {
      const s = makeSlot(null)
      s.classList.add('car')
      carSlots.push(s)
    }
    const missing = [...new Set(cars.map((c) => c.look))].filter((k) => !carIcons[k])
    if (missing.length) Object.assign(carIcons, renderCarIcons(missing))
    order = [slots[0]]
    carSlots.forEach((s, i) => {
      const c = cars[i]
      if (!c) return
      s._entry = { kind: 'car', index: i }
      const img = s.querySelector('img')
      if (img.dataset.look !== c.look) {
        img.src = carIcons[c.look]
        img.dataset.look = c.look
      }
      s.querySelector('.cost').textContent = c.income
      s.querySelector('.tag').textContent = `Lvl ${c.level}`
      s.style.setProperty('--rarity', c.color)
      s.title = c.name
      s.classList.toggle('sel', i === bar.held)
      order.push(s)
    })
    carrySlot.hidden = !bar.carrying
    if (bar.carrying) order.push(carrySlot)
    order.forEach((s, i) => (s.querySelector('.num').textContent = String(i + 1)))
    hotbar.replaceChildren(...order)
    slots[0].classList.toggle('sel', !!bar.equipped && !bar.carrying && !(bar.held >= 0))
    carrySlot.classList.toggle('sel', !!bar.carrying)
  }
  let icons = null
  let toolIcon = null // the equipped pickaxe's icon (game.js), else the hammer
  let carryTheme = null
  function paintCarry() {
    if (!carryTheme) return
    const t = BLOCK_THEMES[carryTheme]
    carrySlot.querySelector('.tag').textContent = `[x1] ${t.name}`
    const img = carrySlot.querySelector('img')
    if (icons) img.src = icons[`block:${carryTheme}`]
  }

  // --- Toast ---
  const toastEl = el('div', 'hud-toast ol-thin')
  let toastTimer = 0
  function toast(msg, ms = 1800) {
    toastEl.textContent = msg
    toastEl.classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms)
  }

  // --- Announcement banner (a Secret block spawned, events) ---
  const banner = el('div', 'hud-banner', '<span class="ol"></span>')
  let bannerTimer = 0
  function announce(msg, ms = 3200) {
    banner.firstChild.textContent = msg
    banner.classList.remove('show')
    void banner.offsetWidth
    banner.classList.add('show')
    clearTimeout(bannerTimer)
    bannerTimer = setTimeout(() => banner.classList.remove('show'), ms)
  }

  root.append(top, topRight, left, right, money, hotbar, toastEl, banner)
  document.body.appendChild(root)

  // Keep clear of Bloxity's toolbar + chat: the left column starts under them; the
  // top row stays centred unless that would overlap them, then it slides right of
  // them, and only drops below them when there is no room beside.
  let reserved = []
  function layoutTop() {
    const w = window.innerWidth
    const rowW = top.offsetWidth
    const rowH = top.offsetHeight
    const baseTop = parseFloat(getComputedStyle(top).getPropertyValue('--base-top')) || 0
    let x = (w - rowW) / 2
    let y = 0
    const hits = (ax, ay) => reserved.some((a) => ax < a.left + a.width && ax + rowW > a.left && ay < a.top + a.height && ay + rowH + baseTop > a.top)
    if (hits(x, y)) {
      const right = Math.max(...reserved.filter((a) => a.top < rowH + baseTop + 20).map((a) => a.left + a.width)) + 10
      if (right + rowW <= w - 10 && !hits(right, y)) x = right
      else y = Math.max(...reserved.filter((a) => a.left < x + rowW && a.left + a.width > x).map((a) => a.top + a.height)) + 8 - baseTop
    }
    top.style.left = `${Math.round(x)}px`
    top.style.marginTop = `${Math.max(0, Math.round(y))}px`
  }
  bloxity.onReservedAreas((areas) => {
    reserved = areas.map((a) => ({ left: a.left ?? 0, top: a.top ?? 0, width: a.width ?? 0, height: a.height ?? 0 }))
    let leftBottom = 0
    for (const a of reserved) if (a.left < 320) leftBottom = Math.max(leftBottom, a.top + a.height)
    root.style.setProperty('--reserved-left', `${leftBottom}px`)
    requestAnimationFrame(layoutTop)
  })
  window.addEventListener('resize', () => requestAnimationFrame(layoutTop))
  fontReady.then(() => requestAnimationFrame(layoutTop))

  // Icons from the 3D models, once the font is in (block faces carry a "?").
  fontReady.then(() => {
    icons = renderIcons([HUD_DEMO.freeCar], Object.keys(BLOCK_THEMES))
    slots[0].querySelector('img').src = toolIcon ?? icons.hammer
    paintCarry()
    free.querySelector('img').src = icons[`car:${HUD_DEMO.freeCar}`]
    // The featured block offer cycles through the block themes.
    let f = 0
    const showFeatured = () => {
      const spec = FEATURED_BLOCKS[f]
      featured.querySelector('img').src = icons[`block:${spec.theme}`]
      featured.querySelector('.price').innerHTML = `${SVG.coin}${spec.price}`
      featured.querySelector('.name').textContent = BLOCK_THEMES[spec.theme].name
      featured.classList.remove('swap')
      void featured.offsetWidth
      featured.classList.add('swap')
    }
    showFeatured()
    setInterval(() => {
      f = (f + 1) % FEATURED_BLOCKS.length
      showFeatured()
    }, 6000)
  })

  // Money counts toward its target.
  let shown = startMoney
  let target = startMoney
  const paintMoney = () => (money.textContent = '$' + short(Math.floor(shown)))
  paintMoney()

  return {
    toast,
    announce,
    setMoney(v, instant = false) {
      target = v
      if (instant) {
        shown = v
        paintMoney()
        return
      }
      money.classList.remove('bump')
      void money.offsetWidth
      money.classList.add('bump')
    },
    // "!" on the calendar while a daily reward is waiting.
    // Spins waiting on the wheel button's badge (game/spin.js).
    setSpins(n) {
      const b = spin.querySelector('.badge')
      b.textContent = n
      b.hidden = n <= 0
    },
    setDailyReady(on) {
      daily.querySelector('.badge').hidden = !on
    },
    // Hotbar slot 1 icon (the equipped pickaxe), a data URL.
    setToolIcon(url) {
      if (!url) return
      toolIcon = url
      slots[0].querySelector('img').src = url
    },
    // equipped: tool in hand; carrying: block theme key or null; cars: hotbar cars; held: the one in hand (-1 none).
    setHotbar(bar) {
      carryTheme = bar.carrying
      paintHotbar(bar)
      paintCarry()
    },
    update(dt) {
      if (shown === target) return
      shown += (target - shown) * Math.min(1, dt * 4)
      if (Math.abs(target - shown) < Math.max(1, target * 1e-4)) shown = target
      paintMoney()
    },
  }
}
