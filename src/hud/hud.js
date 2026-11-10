import './hud.css'
import { BLOCK_THEMES, FEATURED_BLOCKS, HUD_DEMO } from '../config.js'
import * as bloxity from '../bloxity.js'
import { onKey } from '../input.js'
import { fontReady } from '../propkit.js'
import { short } from '../lobby/paint.js'
import { renderIcons } from './thumbnails.js'

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

export function createHud({ onShop, onPlot, onSpin }) {
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
  const daily = el('button', 'round-btn', SVG.calendar)
  daily.setAttribute('aria-label', 'Daily rewards')
  topRight.append(daily)

  // --- Left column ---
  const left = el('div', 'hud-left')
  const shop = el('button', 'tile shop studs', `${SVG.shop}<span class="name ol">Shop</span><span class="badge alert ol-thin">!</span>`)
  const index = el('button', 'tile index studs', `${SVG.index}<span class="name ol">Index</span>`)
  const collect = el('button', 'tile collect studs', `${SVG.magnet}<span class="name ol">Collect All</span>`)
  const free = el('button', 'free-btn', `<span class="rays"></span><img alt=""><span class="name ol">FREE!</span>`)
  const autoSwing = el('button', 'wide-btn studs', `${SVG.pickaxe}${outlined('Auto Swing')}`)
  left.append(shop, index, collect, free, autoSwing)
  autoSwing.addEventListener('click', () => {
    const on = autoSwing.classList.toggle('on')
    toast(on ? 'Auto Swing on' : 'Auto Swing off')
  })
  for (const [b, name] of [[shop, 'Shop'], [index, 'Index'], [collect, 'Collect All'], [free, 'Free car'], [daily, 'Daily rewards']]) b.addEventListener('click', () => toast(`${name}: coming soon`))

  // --- Right column: offers ---
  const right = el('div', 'hud-right')
  const priceTag = (n) => `<span class="price ol-thin">${SVG.coin}${n}</span>`
  const starter = el('button', 'offer', `<span class="rays"></span><img alt="">${priceTag(HUD_DEMO.offers.starterPack)}<span class="name ol">STARTER PACK</span>`)
  const pickaxe = el('button', 'offer', `<span class="rays"></span><img alt="">${priceTag(HUD_DEMO.offers.opPickaxe)}<span class="name ol"><span class="op">OP</span> <span class="grad-purple">PICKAXE!</span></span>`)
  const featured = el('button', 'offer', `<span class="rays"></span><img alt="">${priceTag(FEATURED_BLOCKS[0].price)}<span class="name ol">${BLOCK_THEMES[FEATURED_BLOCKS[0].theme].name}</span>`)
  const packs = el('button', 'offer', `<span class="rays"></span><img alt=""><span class="new-tag ol-thin">NEW!</span><span class="name ol"><span class="op" style="color:#ff2be0">OP</span> <span class="grad-blue">Packs</span></span>`)
  right.append(starter, pickaxe, featured, packs)
  for (const [b, name] of [[starter, 'Starter Pack'], [pickaxe, 'OP Pickaxe'], [featured, 'Block offer'], [packs, 'OP Packs']]) b.addEventListener('click', () => toast(`${name}: coming soon`))

  // --- Money ---
  const money = el('div', 'hud-money ol')

  // --- Hotbar ---
  const hotbar = el('div', 'hud-hotbar')
  const slots = []
  const addSlot = (n, cost, tag) => {
    const s = el('button', 'slot', `<span class="num ol-thin">${n}</span><img alt="">${cost ? `<span class="cost ol-thin">${cost}</span>` : ''}${tag ? `<span class="tag ol-thin">${tag}</span>` : ''}`)
    s.addEventListener('click', () => select(n - 1))
    hotbar.append(s)
    slots.push(s)
  }
  addSlot(1, '', '')
  HUD_DEMO.hotbar.forEach((h, i) => addSlot(i + 2, '$' + short(h.price), h.tag))
  let selected = 0
  function select(i) {
    if (i < 0 || i >= slots.length) return
    slots[selected].classList.remove('sel')
    selected = i
    slots[selected].classList.add('sel')
  }
  select(0)
  for (let i = 0; i < slots.length; i++) onKey(`Digit${i + 1}`, () => select(i))

  // --- Toast ---
  const toastEl = el('div', 'hud-toast ol-thin')
  let toastTimer = 0
  function toast(msg, ms = 1800) {
    toastEl.textContent = msg
    toastEl.classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms)
  }

  root.append(top, topRight, left, right, money, hotbar, toastEl)
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
    const carKeys = [...new Set([...HUD_DEMO.hotbar.map((h) => h.car), HUD_DEMO.freeCar])]
    const icons = renderIcons(carKeys, FEATURED_BLOCKS.map((f) => f.theme))
    slots[0].querySelector('img').src = icons.hammer
    HUD_DEMO.hotbar.forEach((h, i) => (slots[i + 1].querySelector('img').src = icons[`car:${h.car}`]))
    free.querySelector('img').src = icons[`car:${HUD_DEMO.freeCar}`]
    starter.querySelector('img').src = icons.starter
    pickaxe.querySelector('img').src = icons.pickaxe
    packs.querySelector('img').src = icons.packs
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
  let shown = 0
  let target = HUD_DEMO.money
  const paintMoney = () => (money.textContent = '$' + short(shown))
  paintMoney()

  return {
    toast,
    setMoney(v) {
      target = v
    },
    update(dt) {
      if (shown === target) return
      shown += (target - shown) * Math.min(1, dt * 4)
      if (Math.abs(target - shown) < Math.max(1, target * 1e-4)) shown = target
      paintMoney()
    },
  }
}
