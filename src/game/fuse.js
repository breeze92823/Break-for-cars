// The Fuse Machine window (opened by the Fuse Machine's ring): "Put 4 Cars to
// Fuse" with four slots (Add opens a picker of your hotbar cars, Return gives a
// car back), "Possible Fusions" with each outcome's odds, then "Fusion Time" and
// Fuse. Fusing takes the four cars, rolls the result and starts the timer; when
// it runs out the button turns into Claim and the new car goes to the hotbar.
// The machine's state has its own save (FUSE.saveKey), so it survives reloads.
import { CAR_ROSTER, FUSE, RARITY_LADDER } from '../config.js'
import { renderSideCarIcons } from '../hud/thumbnails.js'
import { makeCar, rarityColor, tierOf } from './carmake.js'
import './pickshop.css'
import './windows.css'

const REMOTE = `<svg viewBox="0 0 100 100"><g stroke="#0d0f17" stroke-width="5" stroke-linejoin="round">
  <path d="M60 10 L68 40" stroke-width="10" stroke-linecap="round"/><path d="M60 10 L68 40" stroke="#c9ced8" stroke-width="4" stroke-linecap="round"/>
  <rect x="22" y="36" width="56" height="58" rx="12" transform="rotate(-18 50 65)" fill="#e9edf5"/>
  <circle cx="46" cy="66" r="15" fill="#ff2b3a"/><circle cx="42" cy="62" r="5" fill="#ff9aa4" stroke-width="0"/></g></svg>`

const mmss = (s) => {
  s = Math.max(0, Math.ceil(s))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// Outcomes for a set of input cars: [{ rarity, odds, car: { name, look } }].
function outcomes(cars) {
  if (!cars.length) return []
  const top = RARITY_LADDER.length - 1
  const base = Math.min(top, Math.round(cars.reduce((a, c) => a + tierOf(c.rarity), 0) / cars.length))
  const seed = cars.reduce((a, c) => a + c.name.length, 0)
  const out = []
  FUSE.odds.forEach((odds, k) => {
    const tier = Math.min(top, base + k)
    const hit = out.find((o) => o.tier === tier)
    if (hit) hit.odds += odds
    else {
      const rarity = RARITY_LADDER[tier]
      const pool = CAR_ROSTER[rarity]
      out.push({ tier, rarity, odds, car: pool[(seed + k) % pool.length] })
    }
  })
  return out
}
const timeFor = (cars) => (cars.length ? FUSE.time[Math.min(FUSE.time.length - 1, Math.round(cars.reduce((a, c) => a + tierOf(c.rarity), 0) / cars.length))] : 0)

// inv: { cars(), take(i) -> car, give(car) -> bool, room() }, hud, sfx, onClaim(car)
export function createFuse(layer, { inv, hud, sfx, onClaim }) {
  // --- state + save ---
  const st = { slots: Array(FUSE.slots).fill(null), endAt: 0, result: null, time: 0 }
  try {
    const d = JSON.parse(localStorage.getItem(FUSE.saveKey) || 'null')
    if (d) {
      st.slots = Array.from({ length: FUSE.slots }, (_, i) => d.slots?.[i] ?? null)
      st.endAt = d.endAt || 0
      st.result = d.result ?? null
      st.time = d.time || 0
    }
  } catch {
    // blocked storage: the machine just starts empty
  }
  const save = () => {
    try {
      localStorage.setItem(FUSE.saveKey, JSON.stringify(st))
    } catch {
      // ignore
    }
  }
  const filled = () => st.slots.filter(Boolean)
  const fusing = () => !!st.result

  // --- DOM ---
  const root = document.createElement('div')
  root.className = 'pick-shop fuse-shop'
  root.innerHTML = `<div class="pick-win fuse-win" role="dialog" aria-label="Fuse Machine">
    <div class="pick-head win-blue studs"><span class="pick-ico">${REMOTE}</span><span class="pick-title ol">Fuse Machine</span><button class="pick-x studs" aria-label="Close"><span class="ol">X</span></button></div>
    <div class="pick-body fuse-body">
      <div class="fuse-main">
        <div class="win-sub ol">Put ${FUSE.slots} Cars to Fuse</div>
        <div class="fuse-slots"></div>
        <div class="win-sub ol">Possible Fusions</div>
        <div class="fuse-out"></div>
      </div>
      <div class="fuse-pick" hidden>
        <div class="win-sub ol">Choose a Car</div>
        <div class="fuse-pick-list"></div>
        <button class="lego-btn red studs fuse-back"><span class="ol">Back</span></button>
      </div>
    </div>
    <div class="fuse-foot"><div class="fuse-time ol">Fusion Time: 00:00</div><button class="lego-btn green studs fuse-go"><span class="ol">Fuse</span></button></div>
  </div>`
  layer.appendChild(root)
  const $ = (s) => root.querySelector(s)
  const slotRow = $('.fuse-slots')
  const outRow = $('.fuse-out')
  const main = $('.fuse-main')
  const picker = $('.fuse-pick')
  const pickList = $('.fuse-pick-list')
  const timeEl = $('.fuse-time')
  const goBtn = $('.fuse-go')
  const goLabel = goBtn.querySelector('span')
  const icons = {}
  const iconOf = (look) => {
    if (!icons[look]) Object.assign(icons, renderSideCarIcons([look]))
    return icons[look]
  }
  const carTile = (name, look, lines) =>
    `<div class="fuse-name ol">${name}</div><img alt="" src="${iconOf(look)}">${lines.map(([t, c, cls = '']) => `<div class="fuse-line ol ${cls}" style="color:${c}">${t}</div>`).join('')}`

  const slotEls = st.slots.map((_, i) => {
    const wrap = document.createElement('div')
    wrap.className = 'fuse-slot-wrap'
    wrap.innerHTML = `<div class="fuse-slot"></div><button class="lego-btn green studs fuse-sbtn"><span class="ol">Add</span></button>`
    slotRow.appendChild(wrap)
    const btn = wrap.querySelector('button')
    btn.addEventListener('click', () => (st.slots[i] ? giveBack(i) : openPicker(i)))
    return { box: wrap.querySelector('.fuse-slot'), btn, label: btn.querySelector('span') }
  })

  function render() {
    const busy = fusing()
    st.slots.forEach((car, i) => {
      const el = slotEls[i]
      el.box.classList.toggle('empty', !car)
      el.box.innerHTML = car ? carTile(car.name, car.look, [['Normal', '#ffffff', 'small'], [car.rarity, rarityColor(car.rarity)]]) : '<span class="ol">Empty</span>'
      el.btn.hidden = busy
      el.btn.classList.toggle('red', !!car)
      el.btn.classList.toggle('green', !car)
      el.label.textContent = car ? 'Return' : 'Add'
    })
    const list = busy ? st.result.outcomes : outcomes(filled())
    outRow.innerHTML = list
      .map((o) => `<div class="fuse-res">${carTile(o.car.name, o.car.look, [[`${o.odds}%`, '#ffffff', 'odds'], ['Normal', '#ffffff', 'small'], [o.rarity, rarityColor(o.rarity)]])}</div>`)
      .join('')
    tick()
  }

  function tick() {
    if (fusing()) {
      const left = (st.endAt - Date.now()) / 1000
      timeEl.textContent = `Fusion Time: ${mmss(left)}`
      const done = left <= 0
      goLabel.textContent = done ? 'Claim!' : 'Fusing...'
      goBtn.classList.toggle('waiting', !done)
      goBtn.classList.toggle('claim', done)
    } else {
      timeEl.textContent = `Fusion Time: ${mmss(timeFor(filled()))}`
      goLabel.textContent = 'Fuse'
      goBtn.classList.remove('waiting', 'claim')
      goBtn.classList.toggle('waiting', filled().length < FUSE.slots)
    }
  }

  // --- picker: hotbar cars ---
  let pickFor = -1
  function openPicker(i) {
    if (fusing()) return
    const cars = inv.cars()
    if (!cars.length) {
      sfx.error()
      return hud.toast('No cars in your hotbar: press E on a parked car to take it')
    }
    pickFor = i
    pickList.replaceChildren(
      ...cars.map((c, k) => {
        const b = document.createElement('button')
        b.className = 'fuse-res fuse-choice'
        b.innerHTML = carTile(c.name, c.look, [[`Lvl ${c.level}`, '#ffffff', 'small'], [c.rarity, rarityColor(c.rarity)]])
        b.addEventListener('click', () => addCar(k))
        return b
      }),
    )
    main.hidden = true
    picker.hidden = false
    sfx.blip()
  }
  function closePicker() {
    pickFor = -1
    main.hidden = false
    picker.hidden = true
  }
  function addCar(k) {
    if (pickFor < 0 || st.slots[pickFor]) return closePicker()
    const car = inv.take(k)
    if (!car) return closePicker()
    st.slots[pickFor] = car
    sfx.place()
    closePicker()
    save()
    render()
  }
  function giveBack(i) {
    if (fusing() || !st.slots[i]) return
    if (inv.room() <= 0) {
      sfx.error()
      return hud.toast('Your hotbar is full! Place or sell a car first')
    }
    inv.give(st.slots[i])
    st.slots[i] = null
    sfx.pickup()
    save()
    render()
  }

  function fuse() {
    if (fusing()) return claim()
    const cars = filled()
    if (cars.length < FUSE.slots) {
      sfx.error()
      return hud.toast(`Put ${FUSE.slots} cars in to fuse`)
    }
    const list = outcomes(cars)
    let r = Math.random() * 100
    const won = list.find((o) => (r -= o.odds) < 0) ?? list[list.length - 1]
    st.result = { outcomes: list, car: makeCar({ rarity: won.rarity, name: won.car.name, look: won.car.look, bonus: FUSE.bonus }) }
    st.time = timeFor(cars)
    st.endAt = Date.now() + st.time * 1000
    notified = false
    sfx.upgrade()
    hud.toast(`Fusing! Come back in ${mmss(st.time)}`)
    save()
    render()
  }
  function claim() {
    if (Date.now() < st.endAt) {
      sfx.error()
      return hud.toast(`Still fusing: ${mmss((st.endAt - Date.now()) / 1000)} left`)
    }
    if (inv.room() <= 0) {
      sfx.error()
      return hud.toast('Your hotbar is full! Place or sell a car first')
    }
    const car = st.result.car
    inv.give(car)
    st.slots.fill(null)
    st.result = null
    st.endAt = 0
    save()
    render()
    onClaim?.(car)
  }

  // --- open / close + a timer that also tells you when a fusion finishes ---
  let open = false
  let notified = Date.now() >= st.endAt
  setInterval(() => {
    if (open) tick()
    if (fusing() && !notified && Date.now() >= st.endAt) {
      notified = true
      hud.toast('Fusion complete! Claim your car at the Fuse Machine', 3600)
    }
  }, 250)

  function show() {
    if (open) return
    open = true
    closePicker()
    render()
    root.classList.add('show')
  }
  function hide() {
    if (!open) return
    open = false
    root.classList.remove('show')
    sfx.close()
  }
  $('.pick-x').addEventListener('click', hide)
  $('.fuse-back').addEventListener('click', closePicker)
  goBtn.addEventListener('click', fuse)
  pickList.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true })

  return {
    open: show,
    close: hide,
    get isOpen() {
      return open
    },
    // cars waiting in the machine (for the 3D "n/4" label)
    get count() {
      return filled().length
    },
  }
}
