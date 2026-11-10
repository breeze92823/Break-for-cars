// The core loop on the player's base:
//   1. Walk up to the conveyor, hold E on a block: if you can afford it, it is
//      bought and lands in your hands (hotbar slot 2).
//   2. Carry it into the garage, stand by a free bay, press E: it is placed.
//   3. With the hammer out (slot 1), click / tap (or hold, or Auto Swing) to
//      hit it; its health bar drains, at 0 it shatters and a car grows out of
//      it, rarer blocks giving richer cars (with a small "lucky" chance of one
//      rarity up).
//   4. The car earns $/s into its bay's green pad; step on the pad (or Collect
//      All) to bank it. Click the yellow sign to level the car up; hold E on
//      the car to sell it and free the bay.
// Everything is saved to localStorage; pads keep earning (capped) while away.
// The game plays on one of the island's six garages; moveTo() carries it to another (the server
// hands one out per player, main.js). baseSnapshot() / loadout() are what the other players see
// (net.js relays them; remoteBases.js / remotePlayers.js draw them read-only).
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Raycaster,
  RingGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from 'three'
import { BASE, BLOCK_THEMES, CAR_ROSTER, CONVEYOR_SKINS, CONVEYOR_UPGRADE, GAME, GARAGE_SKINS, LOBBY, MUTATIONS, PICKAXES, RARITY_COLORS, RARITY_INCOME, RARITY_LADDER, SKINS_PAD, TUTORIAL } from '../config.js'
import { brick } from '../lego.js'
import { buildCar } from '../lobby/cars.js'
import { paintStack, short } from '../lobby/paint.js'
import { sparkleField } from '../lobby/fx.js'
import { fontReady } from '../propkit.js'
import { player } from '../player.js'
import * as sfx from './audio.js'
import { createPrompt } from './prompt.js'
import { createPickShop } from './pickshop.js'
import { createSellShop } from './sellshop.js'
import { createFuse } from './fuse.js'
import { createDaily } from './daily.js'
import { createFreeCar } from './freecar.js'
import { createEvents } from './events.js'
import { createIndex } from './carindex.js'
import { createSpin } from './spin.js'
import { createTrade } from './trade.js'
import { createSettings } from './settings.js'
import { createBaseSkins } from './baseskins.js'
import { createTutorial, TUTORIAL_DONE } from './tutorial.js'
import { buildPickaxe, disposePickaxe } from './pickaxe-model.js'
import { renderPickaxeIcons } from '../hud/thumbnails.js'
import { makeCanvas, paintHpLabel, paintPadMoney, paintUpgradeSign } from './paint.js'
import './game.css'

const TAU = Math.PI * 2
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t)
const easeOut = (t) => 1 - (1 - t) * (1 - t)
const easeIn = (t) => t * t
const easeOutBack = (t) => {
  const c = 1.9
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
}
const easeOutBounce = (t) => {
  if (t < 1 / 2.75) return 7.5625 * t * t
  if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75
  if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375
  return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375
}
const PICK_BY_ID = Object.fromEntries(PICKAXES.map((p) => [p.id, p]))
const tierOf = (rarity) => Math.max(0, RARITY_LADDER.indexOf(rarity))
const themeOfRarity = (rarity) => Object.keys(BLOCK_THEMES).find((k) => BLOCK_THEMES[k].rarity === rarity)
// Event variants (config MUTATIONS) by id; Normal has no entry on a record (variant undefined).
const MUT = Object.fromEntries(MUTATIONS.filter((m) => m.mult > 1).map((m) => [m.id, m]))
const withVariant = (v) => (MUT[v] ? { variant: v } : {})

// Economy formulas. A car's own $/s (hotbar, trades) and what it earns parked in the garage:
// times the equipped garage skin's multiplier (GARAGE_SKINS mult, set by the game).
const rawIncome = (car) => car.base * Math.pow(GAME.upgrade.incomeGrowth, car.level - 1)
let garageMult = 1
const incomeOf = (car) => rawIncome(car) * garageMult
const SKIN_BY_ID = Object.fromEntries(GARAGE_SKINS.map((s) => [s.id, s]))
const upgradeCost = (car) => Math.round(car.base * GAME.upgrade.costFactor * Math.pow(GAME.upgrade.costGrowth, car.level - 1))
// $/s with a decimal while it is small (2.7 reads better than 3).
const rate = (v) => (v < 100 && v % 1 ? v.toFixed(1) : short(v))
const sellValue = (car) => Math.round((BLOCK_THEMES[car.theme].price + car.spent) * GAME.sellBack)

function spriteOf(canvas, height) {
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  const sprite = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }))
  sprite.userData.fit = () => sprite.scale.set((height * canvas.width) / canvas.height, height, 1)
  sprite.userData.fit()
  sprite.renderOrder = 5
  return sprite
}

// onSwing(): a swing started (relayed so the others see it).
// rewardedAd: { available(), watch() } for the Spin Wheel's "Watch Ad" button (spin.js).
// onTutorialStep(step): the new-player tutorial moved on (net.js saves it for the account).
export function createGame({ scene, camera, canvas, base, bursts, hud, playerGroup, playerFx, getAvatar, getAnimator, lobby, onSwing, rewardedAd, nearbyPlayer, onTutorialStep, claimFreeCar }) {
  let g = base.group
  g.updateMatrixWorld(true)
  base.setLit(true)
  const bays = base.bays
  const layer = document.createElement('div')
  layer.className = 'hud game-ui'
  document.body.appendChild(layer)
  const prompt = createPrompt(layer, camera)

  // --- State + save ---------------------------------------------------------------------------
  const carIndex = createIndex(layer, { sfx })
  const state = { carryVariant: null, money: GAME.startMoney, carrying: null, equipped: true, autoSwing: false, conveyorLevel: 0, cars: [], held: -1, pickaxe: PICKAXES[0].id, floors: 0, skin: GARAGE_SKINS[0].id }
  const boughtSkins = new Set() // garage skins bought with money (an Index unlock needs no record)
  const ownedPicks = new Set([PICKAXES[0].id]) // the first (free) pickaxe is always owned
  const pick = () => PICK_BY_ID[state.pickaxe] ?? PICKAXES[0]
  const slots = bays.map(() => null) // per bay: null | block record | car record
  const unlocked = new Set() // bought bays among BASE.lockedSlots
  // A bay can be used once its floor is bought (and, for a locked one, the bay itself).
  const isOpen = (i) => bays[i].level <= state.floors && (!bays[i].locked || unlocked.has(i))
  const views = bays.map(() => null)

  let escrowed = () => [] // cars held aside by an open trade (trade.js): saved with the hotbar so a reload loses none
  function save() {
    try {
      const data = {
        v: 1,
        t: Date.now(),
        money: state.money,
        carrying: state.carrying,
        carryVariant: state.carryVariant,
        conveyorLevel: state.conveyorLevel,
        unlocked: [...unlocked],
        floors: state.floors,
        skin: state.skin,
        skins: [...boughtSkins],
        pickaxe: state.pickaxe,
        pickaxes: [...ownedPicks],
        cars: [...state.cars, ...escrowed()],
        bays: slots.map((s) => (s ? { ...s } : null)),
      }
      localStorage.setItem(GAME.saveKey, JSON.stringify(data))
    } catch {
      // Storage can be blocked (private mode, sandboxed frame); the game still plays.
    }
  }
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(GAME.saveKey) || 'null')
      if (!data || data.v !== 1) return 0
      state.money = Number.isFinite(data.money) ? data.money : GAME.startMoney
      state.carrying = BLOCK_THEMES[data.carrying] ? data.carrying : null
      state.carryVariant = state.carrying && MUT[data.carryVariant] ? data.carryVariant : null
      state.conveyorLevel = Math.max(0, Math.min(CONVEYOR_UPGRADE.levels.length - 1, data.conveyorLevel | 0))
      for (const i of data.unlocked || []) if (bays[i]?.locked) unlocked.add(i)
      state.floors = Math.max(0, Math.min(BASE.floors.length, data.floors | 0))
      for (const id of data.skins || []) if (SKIN_BY_ID[id]) boughtSkins.add(id)
      if (SKIN_BY_ID[data.skin]) state.skin = data.skin
      garageMult = SKIN_BY_ID[state.skin].mult // before the away earnings below
      state.cars = (data.cars || [])
        .filter((c) => c && BLOCK_THEMES[c.theme] && c.look)
        .slice(0, GAME.inventory)
        .map((c) => ({ theme: c.theme, rarity: c.rarity, name: c.name, look: c.look, base: c.base, level: c.level || 1, spent: c.spent || 0, ...withVariant(c.variant) }))
      for (const id of data.pickaxes || []) if (PICK_BY_ID[id]) ownedPicks.add(id)
      if (ownedPicks.has(data.pickaxe)) state.pickaxe = data.pickaxe
      let away = 0
      const secs = Math.min(GAME.offlineCap, Math.max(0, (Date.now() - (data.t || Date.now())) / 1000))
      ;(data.bays || []).forEach((s, i) => {
        if (!s || i >= slots.length || !BLOCK_THEMES[s.theme]) return
        if (s.kind === 'block') slots[i] = { kind: 'block', theme: s.theme, hp: s.hp, max: BLOCK_THEMES[s.theme].hp, ...withVariant(s.variant) }
        else if (s.kind === 'car') {
          const car = { kind: 'car', theme: s.theme, rarity: s.rarity, name: s.name, look: s.look, base: s.base, level: s.level || 1, stored: s.stored || 0, away: s.away || 0, spent: s.spent || 0, ...withVariant(s.variant) }
          const earned = incomeOf(car) * secs
          car.away += earned // away money waits on the pad: only walking onto it banks it
          away += earned
          slots[i] = car
        }
      })
      return away
    } catch {
      return 0
    }
  }

  // --- Coordinates --------------------------------------------------------------------------------
  const v1 = new Vector3()
  const v2 = new Vector3()
  const local = new Vector3()
  // Bay positions in the base group's frame and in the world.
  const bayBase = bays.map((b) => base.garageToBase(b.cx, b.top, b.cz))
  let bayWorld = bayBase.map((p) => g.localToWorld(p.clone()))
  const padBase = bays.map((b) => base.garageToBase(b.pad.x, b.pad.top, b.pad.z))
  let padWorld = padBase.map((p) => g.localToWorld(p.clone()))
  const carYaw = (i) => (bays[i].side < 0 ? 0 : Math.PI) // nose toward the aisle
  // Distance (garage units) from a local point to a bay's rectangle.
  const rectDist = (b, p) => Math.hypot(Math.max(b.x0 - p.x, 0, p.x - b.x1), Math.max(b.z0 - p.z, 0, p.z - b.z1))

  // --- Feedback: floating texts, reveal card, money ----------------------------------------------------
  const floats = []
  function floatText(text, world, color = '#7dff3a', big = false) {
    const el = document.createElement('div')
    el.className = `float-text ol${big ? ' big' : ''}`
    el.textContent = text
    el.style.color = color
    layer.appendChild(el)
    floats.push({ el, at: world.clone(), t: 0 })
  }
  const revealCard = document.createElement('div')
  revealCard.className = 'reveal-card'
  layer.appendChild(revealCard)
  let revealTimer = 0
  function showReveal(car, lucky) {
    const col = RARITY_COLORS[car.rarity] ?? '#fff'
    revealCard.innerHTML = `${lucky ? '<div class="lucky ol">LUCKY!</div>' : ''}<div class="title ol">NEW CAR!</div><div class="name ol">${car.name}</div>${MUT[car.variant] ? `<div class="rarity ol" style="color:${MUT[car.variant].color}">${car.variant} x${MUT[car.variant].mult}</div>` : ''}<div class="rarity ol" style="color:${col}">${car.rarity}</div><div class="income ol">$${rate(incomeOf(car))}/s</div>`
    revealCard.style.setProperty('--glow', col)
    revealCard.classList.remove('show')
    void revealCard.offsetWidth
    revealCard.classList.add('show')
    clearTimeout(revealTimer)
    revealTimer = setTimeout(() => revealCard.classList.remove('show'), 2600)
  }
  function setMoney(v) {
    state.money = v
    hud.setMoney(v)
  }
  function fail(msg) {
    sfx.error()
    hud.toast(msg)
  }
  function refreshIncome() {
    let total = 0
    for (const s of slots) if (s?.kind === 'car') total += incomeOf(s)
    base.setIncome(Math.round(total * 100) / 100)
  }

  // --- Effects: debris, beams, rings, shake ----------------------------------------------------------
  const debrisGeo = new BoxGeometry(1, 1, 1)
  const debris = []
  function spawnDebris(theme, at, n, size, power, floorY = at.y) {
    const mat = base.blockMaterial(theme)
    for (let i = 0; i < n; i++) {
      const m = new Mesh(debrisGeo, mat)
      const s = size * (0.55 + Math.random() * 0.7)
      m.scale.setScalar(s)
      m.position.set(at.x + (Math.random() - 0.5) * 1.6, at.y + Math.random() * 1.6, at.z + (Math.random() - 0.5) * 1.6)
      m.castShadow = true
      g.add(m)
      const a = Math.random() * TAU
      const sp = power * (0.4 + Math.random() * 0.8)
      debris.push({ m, s, floor: floorY - 0.05 + s / 2, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: power * (0.6 + Math.random() * 0.9), rx: (Math.random() - 0.5) * 14, rz: (Math.random() - 0.5) * 14, t: 0, life: 1.3 + Math.random() * 0.6 })
    }
  }
  const ringGeo = new RingGeometry(0.7, 1, 48)
  const beamGeo = new CylinderGeometry(1.1, 1.7, 16, 24, 1, true)
  const fxs = []
  function spawnReveal(at, color, tier) {
    const ringMat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })
    const ring = new Mesh(ringGeo, ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.set(at.x, at.y + 0.08, at.z)
    g.add(ring)
    fxs.push({ obj: ring, mat: ringMat, t: 0, life: 0.8, kind: 'ring', grow: 7 + tier })
    const beamMat = new MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })
    const beam = new Mesh(beamGeo, beamMat)
    beam.position.set(at.x, at.y + 8, at.z)
    g.add(beam)
    fxs.push({ obj: beam, mat: beamMat, t: 0, life: 1.4 + tier * 0.15, kind: 'beam' })
  }
  let shake = 0
  const shakeOff = new Vector3()

  // --- Views: placed block, car -------------------------------------------------------------------------
  const blockGeo = new BoxGeometry(GAME.placedSize, GAME.placedSize, GAME.placedSize)
  function buildBlockView(i, drop) {
    const s = slots[i]
    const t = BLOCK_THEMES[s.theme]
    const holder = new Group()
    holder.position.copy(bayBase[i])
    const cube = new Mesh(blockGeo, base.blockMaterial(s.theme, s.variant))
    cube.castShadow = true
    cube.position.y = GAME.placedSize / 2
    holder.add(cube)
    const hpCanvas = makeCanvas(512, 220)
    paintHpLabel(hpCanvas, t, s.hp, s.max)
    const label = spriteOf(hpCanvas, 1.55)
    label.position.y = GAME.placedSize + 1.25
    holder.add(label)
    if (tierOf(t.rarity) >= 1) holder.add(sparkleField({ count: 14, center: { x: 0, y: 0, z: 0 }, box: { x: 2.4, y: 2.6, z: 2.4 }, rise: 0.6, life: 1.8, size: 0.22, color: t.glow, seed: 70 + i }))
    g.add(holder)
    fontReady.then(() => {
      if (views[i]?.holder !== holder) return
      paintHpLabel(hpCanvas, t, slots[i].hp, slots[i].max)
      label.material.map.needsUpdate = true
    })
    views[i] = { kind: 'block', holder, cube, label, hpCanvas, punch: 0, drop: drop ? 0 : 1, landed: !drop, shakeT: 0 }
  }
  function repaintHp(i) {
    const s = slots[i]
    const view = views[i]
    paintHpLabel(view.hpCanvas, BLOCK_THEMES[s.theme], s.hp, s.max)
    view.label.material.map.needsUpdate = true
  }

  const signGeo = new PlaneGeometry(1.9, 0.95)
  const signBackGeo = new BoxGeometry(2.0, 1.05, 0.1)
  const signBackMat = new MeshStandardMaterial({ color: '#1c2030', roughness: 0.6 })
  const postGeo = new BoxGeometry(0.14, 0.7, 0.14)
  const padGeo = new PlaneGeometry(2.0, 4.0)
  const signMeshes = []
  function carLabelLines(car) {
    return [
      { size: 60, parts: [{ text: car.name, fill: '#ffffff' }] },
      ...(MUT[car.variant] ? [{ size: 52, parts: [{ text: `${car.variant} x${MUT[car.variant].mult}`, fill: car.variant === 'Rainbow' ? ['#ff3b4e', '#ffd21a', '#2dd84a', '#2f9bff', '#b23cff'] : MUT[car.variant].color }] }] : []),
      { size: 50, parts: [{ text: car.rarity, fill: RARITY_COLORS[car.rarity] ?? '#fff' }] },
      { size: 48, parts: [{ text: `Level ${car.level}`, fill: '#4aa8ff' }] },
      { size: 54, parts: [{ text: `$${rate(incomeOf(car))}/s`, fill: '#7dff3a' }] },
    ]
  }
  function buildCarView(i, revealing) {
    const s = slots[i]
    const holder = new Group()
    holder.position.copy(bayBase[i])
    holder.rotation.y = carYaw(i)
    const spin = new Group()
    holder.add(spin)
    const car = buildCar(s.look)
    car.scale.setScalar(GAME.carScale)
    spin.add(car)
    const tier = tierOf(s.rarity)
    if (tier >= 2) holder.add(sparkleField({ count: 10 + tier * 4, center: { x: 0, y: 0, z: 0 }, box: { x: 6.5, y: 2.4, z: 3.2 }, rise: 0.5, life: 2.2, size: 0.2, color: RARITY_COLORS[s.rarity], seed: 300 + i }))
    g.add(holder)

    // label over the car
    const lines = carLabelLines(s)
    const stack = paintStack(lines, { width: 640 })
    const label = spriteOf(stack.canvas, 2.4)
    label.position.copy(bayBase[i]).add(v1.set(0, 4.6, 0))
    g.add(label)
    fontReady.then(() => {
      stack.draw()
      label.material.map.needsUpdate = true
      label.userData.fit()
    })

    // upgrade sign by the aisle end of the bay, facing the aisle, leaning back
    const b = bays[i]
    const signHolder = new Group()
    signHolder.position.copy(base.garageToBase(b.side * 4.3, b.top, b.cz))
    signHolder.rotation.y = b.side < 0 ? Math.PI / 2 : -Math.PI / 2
    const post = new Mesh(postGeo, signBackMat)
    post.position.y = 0.35
    signHolder.add(post)
    const tilt = new Group()
    tilt.position.y = 0.75
    tilt.rotation.x = -0.65
    signHolder.add(tilt)
    const back = new Mesh(signBackGeo, signBackMat)
    back.position.z = -0.06
    back.castShadow = true
    tilt.add(back)
    const signCanvas = makeCanvas(512, 256)
    const signTex = new CanvasTexture(signCanvas)
    signTex.colorSpace = SRGBColorSpace
    const sign = new Mesh(signGeo, new MeshBasicMaterial({ map: signTex, transparent: true }))
    sign.userData.bay = i
    tilt.add(sign)
    signMeshes.push(sign)
    g.add(signHolder)

    // money on the pad
    const padCanvas = makeCanvas(128, 256)
    const padTex = new CanvasTexture(padCanvas)
    padTex.colorSpace = SRGBColorSpace
    const padText = new Mesh(padGeo, new MeshBasicMaterial({ map: padTex, transparent: true, depthWrite: false }))
    padText.rotation.x = -Math.PI / 2
    padText.rotation.z = b.side < 0 ? 0 : Math.PI
    padText.position.copy(padBase[i]).add(v1.set(0, 0.03, 0))
    padText.renderOrder = 4
    g.add(padText)

    const view = { kind: 'car', holder, spin, car, label, stack, lines, signHolder, sign, signCanvas, signTex, padText, padCanvas, padTex, t: revealing ? 0 : 1, pop: 0, padShown: null, signKey: null, onPad: false, padClock: 0 }
    views[i] = view
    repaintSign(i, true)
    repaintPad(i, true)
    if (revealing) {
      spin.scale.setScalar(0.01)
      label.visible = false
    }
  }
  function repaintSign(i, force) {
    const s = slots[i]
    const view = views[i]
    const maxed = s.level >= GAME.upgrade.maxLevel
    const cost = upgradeCost(s)
    const key = `${s.level}|${state.money >= cost}`
    if (!force && key === view.signKey) return
    view.signKey = key
    paintUpgradeSign(view.signCanvas, cost, s.level, maxed, state.money >= cost)
    view.signTex.needsUpdate = true
  }
  function repaintPad(i, force) {
    const s = slots[i]
    const view = views[i]
    const shown = s.stored + (s.away || 0)
    const text = short(Math.floor(shown))
    if (!force && text === view.padShown) return
    view.padShown = text
    paintPadMoney(view.padCanvas, shown)
    view.padTex.needsUpdate = true
  }
  function repaintCarLabel(i) {
    const view = views[i]
    view.lines.splice(0, view.lines.length, ...carLabelLines(slots[i]))
    view.stack.draw()
    view.label.material.map.needsUpdate = true
    view.label.userData.fit()
  }
  function disposeView(i) {
    const view = views[i]
    if (!view) return
    const drop = (o) => {
      if (!o) return
      g.remove(o)
      o.traverse((m) => {
        if (m.isSprite) m.material.map?.dispose()
      })
    }
    drop(view.holder)
    if (view.kind === 'car') {
      drop(view.label)
      drop(view.signHolder)
      g.remove(view.padText)
      view.signTex.dispose()
      view.padTex.dispose()
      view.sign.material.dispose()
      view.padText.material.dispose()
      signMeshes.splice(signMeshes.indexOf(view.sign), 1)
    }
    views[i] = null
  }

  // --- Carrying + hammer ---------------------------------------------------------------------------------
  const carryMesh = new Mesh(new BoxGeometry(1.05, 1.05, 1.05), base.blockMaterial('gold'))
  carryMesh.castShadow = true
  carryMesh.position.set(0, 1.2, 0.85)
  carryMesh.visible = false
  playerGroup.add(carryMesh)
  let carryPop = 0
  // A small model of the car in hand while one is picked from the hotbar.
  const heldHolder = new Group()
  heldHolder.position.set(0, 1.15, 0.9)
  playerGroup.add(heldHolder)
  let heldLook = null
  const busy = () => !!state.carrying || state.held >= 0 // hands full
  function syncHotbar() {
    hud.setHotbar({
      equipped: state.equipped,
      carrying: state.carrying,
      held: state.held,
      cars: state.cars.map((c) => ({ look: c.look, name: c.name, level: c.level, income: `$${rate(rawIncome(c))}/s`, color: RARITY_COLORS[c.rarity] ?? '#fff' })),
    })
  }
  function showCarry() {
    carryMesh.visible = !!state.carrying
    if (state.carrying) {
      carryMesh.material = base.blockMaterial(state.carrying, state.carryVariant)
      carryPop = 0
    }
    const look = state.held >= 0 ? state.cars[state.held]?.look : null
    if (look !== heldLook) {
      heldHolder.clear()
      heldLook = look
      if (look) {
        const m = buildCar(look)
        m.scale.setScalar(0.34)
        m.rotation.y = -Math.PI / 2 // nose (+X) forward (+Z)
        m.position.y = -0.2
        heldHolder.add(m)
        carryPop = 0
      }
    }
    syncHotbar()
  }

  const tool = playerFx.tool
  const toolRest = { pos: tool.position.clone(), rot: tool.rotation.clone(), parent: tool.parent }
  // The tool group's contents are the equipped pickaxe's model (playerfx.js starts it as a hammer).
  function dressTool() {
    for (const c of [...tool.children]) {
      tool.remove(c)
      disposePickaxe(c)
    }
    tool.add(buildPickaxe(pick().look))
  }
  const hand = new Group() // pivot at the right shoulder; rotation.x = -(arm pitch)
  playerGroup.add(hand)
  hand.position.set(-0.56, 1.32, 0.02)
  let inHand = false
  function placeTool(want) {
    if (want === inHand) return
    inHand = want
    if (want) {
      hand.add(tool)
      tool.position.set(0, -0.66, 0.55)
      tool.rotation.set(Math.PI / 2, 0, 0)
      tool.scale.setScalar(1.25)
    } else {
      toolRest.parent.add(tool)
      tool.position.copy(toolRest.pos)
      tool.rotation.copy(toolRest.rot)
      tool.scale.setScalar(1)
    }
  }

  // Swing: windup over the head, strike forward (impact), recover.
  const HOLD_ANGLE = 0.4
  let swingT = -1
  let impactDone = true
  let swingTarget = -1
  let faceTo = null
  function armAngle() {
    if (swingT < 0) return HOLD_ANGLE
    const S = GAME.swing
    const up = S.impact * 0.5
    if (swingT < up) return HOLD_ANGLE + (2.7 - HOLD_ANGLE) * easeOut(swingT / up)
    if (swingT < S.impact) return 2.7 + (1.25 - 2.7) * easeIn((swingT - up) / (S.impact - up))
    return 1.25 + (HOLD_ANGLE - 1.25) * easeOut(clamp01((swingT - S.impact) / (S.duration - S.impact)))
  }
  const overlay = (pose) => {
    if (busy()) {
      pose.set('ArmL1', -1.35, 0, 0.18)
      pose.set('ArmR1', -1.35, 0, -0.18)
      pose.set('ArmL2', 0)
      pose.set('ArmR2', 0)
    } else if (inHand) {
      pose.set('ArmR1', -armAngle(), 0, -0.08)
      pose.set('ArmR2', 0)
    }
  }

  function nearestBlockInReach() {
    let best = -1
    let bestD = GAME.hitReach
    for (let i = 0; i < slots.length; i++) {
      if (slots[i]?.kind !== 'block' || !views[i]?.landed) continue
      if (Math.abs(bayWorld[i].y - player.position.y) > 4) continue // a block on another floor
      const d = Math.hypot(bayWorld[i].x - player.position.x, bayWorld[i].z - player.position.z) - GAME.placedSize / 2
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return best
  }

  function swing() {
    if (state.carrying) return fail('Place your block on a free bay first')
    if (state.held >= 0) {
      state.held = -1 // the hammer comes out; the car goes back to the hotbar
      showCarry()
    }
    if (!state.equipped) equip(true)
    if (swingT >= 0) return
    swingT = 0
    impactDone = false
    swingTarget = nearestBlockInReach()
    faceTo = swingTarget >= 0 ? bayWorld[swingTarget] : null
    sfx.swing()
    onSwing?.()
  }

  function equip(on) {
    state.equipped = on
    syncHotbar()
  }
  // A hotbar pick: { kind: 'hammer' | 'car' | 'block', index }.
  function pickSlot(entry) {
    if (!entry) return
    if (entry.kind === 'hammer') {
      if (state.carrying) return
      if (state.held >= 0) {
        state.held = -1
        state.equipped = true
      } else state.equipped = !state.equipped
      sfx.equip(state.equipped)
      showCarry()
    } else if (entry.kind === 'car') {
      if (state.carrying) return fail('Place your block on a free bay first')
      state.held = state.held === entry.index ? -1 : entry.index
      if (state.held >= 0) sfx.pickup()
      showCarry()
    }
  }

  // --- Actions ----------------------------------------------------------------------------------------
  const freeBay = () => slots.findIndex((s, i) => s === null && isOpen(i))

  // Buy a locked bay (the "[Upgrade] 10th Slot" plate).
  function buySlot(i) {
    const lock = bays[i].locked
    if (!lock || isOpen(i)) return
    if (state.money < lock.price) return fail(`Not enough money: need $${short(lock.price - state.money)} more`)
    setMoney(state.money - lock.price)
    unlocked.add(i)
    base.unlockBay(i, true)
    sfx.buy()
    setTimeout(sfx.upgrade, 120)
    floatText(`-$${short(lock.price)}`, v1.copy(bayWorld[i]).add(v2.set(0, 2.4, 0)), '#ff6a4a')
    hud.toast(`${lock.label} unlocked!`)
    shake = Math.max(shake, 0.1)
    save()
  }

  // Buy the next floor (its "[Upgrade] 2nd Floor" plate, where its staircase will stand).
  function buyFloor(n) {
    const plate = base.floorPlates[n - 1]
    if (!plate || n !== state.floors + 1) return
    if (state.money < plate.price) return fail(`Not enough money: need $${short(plate.price - state.money)} more`)
    setMoney(state.money - plate.price)
    state.floors = n
    base.setFloors(n, true)
    sfx.buy()
    setTimeout(sfx.upgrade, 120)
    sfx.reveal(3)
    const at = g.localToWorld(base.garageToBase(plate.cx, plate.top, plate.cz, v1))
    floatText(`-$${short(plate.price)}`, at.add(v2.set(0, 2.4, 0)), '#ff6a4a', true)
    hud.announce(`${plate.label} built! 10 more bays upstairs`)
    shake = Math.max(shake, 0.35)
    save()
  }

  // --- Garage skins: owned once bought or once enough of the Index is found ---------------------------
  const skinOwned = (id) => SKIN_BY_ID[id] && (boughtSkins.has(id) || carIndex.percent() >= SKIN_BY_ID[id].index)
  function equipSkin(id, quiet) {
    if (!skinOwned(id) || state.skin === id) return
    state.skin = id
    garageMult = SKIN_BY_ID[id].mult
    base.setSkin(id, !quiet)
    for (let i = 0; i < slots.length; i++) if (slots[i]?.kind === 'car' && views[i]) repaintCarLabel(i)
    refreshIncome()
    if (!quiet) {
      sfx.upgrade()
      hud.toast(`${SKIN_BY_ID[id].name} equipped! Cars in your garage earn x${SKIN_BY_ID[id].mult}`)
      shake = Math.max(shake, 0.2)
    }
    save()
  }
  function buySkin(id) {
    const sk = SKIN_BY_ID[id]
    if (!sk || skinOwned(id)) return
    if (state.money < sk.price) return fail(`Not enough money: need $${short(sk.price - state.money)} more`)
    setMoney(state.money - sk.price)
    boughtSkins.add(id)
    sfx.buy()
    equipSkin(id, false)
  }

  function buy(b) {
    if (state.carrying || !base.onBelt(b)) return
    const t = BLOCK_THEMES[b.key]
    if (freeBay() < 0) return fail('Your garage is full! Press E on a car to remove it to your hotbar')
    if (state.money < t.price) return fail(`Not enough money: need $${short(t.price - state.money)} more`)
    const at = base.blockWorld(b, v1).clone()
    setMoney(state.money - t.price)
    base.takeBlock(b)
    state.carrying = b.key
    state.carryVariant = b.variant ?? null // event mutation (game/events.js)
    state.held = -1
    showCarry()
    sfx.buy()
    setTimeout(sfx.pickup, 110)
    floatText(`-$${short(t.price)}`, at.add(v2.set(0, 1.2, 0)), '#ff6a4a')
    save()
  }

  function place(i) {
    if (slots[i] || !isOpen(i)) return
    if (!state.carrying && state.held >= 0) return placeCar(i)
    if (!state.carrying) return
    const theme = state.carrying
    slots[i] = { kind: 'block', theme, hp: BLOCK_THEMES[theme].hp, max: BLOCK_THEMES[theme].hp, ...(state.carryVariant ? { variant: state.carryVariant } : {}) }
    state.carrying = null
    state.carryVariant = null
    buildBlockView(i, true)
    showCarry()
    sfx.pickup()
    save()
  }

  function damage(i) {
    const s = slots[i]
    const view = views[i]
    if (s?.kind !== 'block' || !view) return
    const t = BLOCK_THEMES[s.theme]
    const before = s.hp / s.max
    const dmg = pick().damage
    s.hp = Math.max(0, s.hp - dmg)
    const after = s.hp / s.max
    sfx.hit(1 - after)
    if (Math.floor(before * 3) !== Math.floor(after * 3) && after > 0) sfx.crack()
    view.punch = 1
    const c = v1.copy(bayWorld[i]).add(v2.set(0, GAME.placedSize * 0.6, 0))
    bursts.emit(c.x, c.y, c.z, t.glow, 10, 4)
    spawnDebris(s.theme, local.copy(bayBase[i]).add(v2.set(0, GAME.placedSize * 0.55, 0)), 2, 0.28, 4, bayBase[i].y)
    floatText(`-${short(dmg)}`, c.add(v2.set((Math.random() - 0.5) * 1.6, 0.2, 0)), '#ffffff')
    shake = Math.max(shake, 0.06)
    if (s.hp <= 0) breakBlock(i)
    else repaintHp(i)
  }

  function rollCar(theme) {
    let tier = tierOf(BLOCK_THEMES[theme].rarity)
    let lucky = false
    if (tier < RARITY_LADDER.length - 1 && Math.random() < GAME.luckyChance) {
      tier++
      lucky = true
    }
    const rarity = RARITY_LADDER[tier]
    const pool = CAR_ROSTER[rarity]
    const pick = pool[Math.floor(Math.random() * pool.length)]
    const [lo, hi] = GAME.incomeSpread
    const baseIncome = Math.max(1, Math.round(RARITY_INCOME[rarity] * (lo + Math.random() * (hi - lo)) * 10) / 10)
    return { car: { kind: 'car', theme: themeOfRarity(rarity) ?? theme, rarity, name: pick.name, look: pick.look, base: baseIncome, level: 1, stored: 0, spent: 0 }, lucky }
  }

  function breakBlock(i) {
    const s = slots[i]
    const t = BLOCK_THEMES[s.theme]
    disposeView(i)
    const { car, lucky } = rollCar(s.theme)
    car.theme = s.theme // sell value follows the block that was paid for
    if (MUT[s.variant]) {
      car.variant = s.variant // event block: the car earns the variant's multiplier
      car.base = Math.round(car.base * MUT[s.variant].mult * 10) / 10
    }
    carIndex.discover(car)
    slots[i] = car
    const tier = tierOf(car.rarity)
    const color = RARITY_COLORS[car.rarity] ?? t.glow
    const at = bayBase[i]
    spawnDebris(s.theme, at, 22, 0.55, 7)
    const w = bayWorld[i]
    bursts.emit(w.x, w.y + 1.4, w.z, t.glow, 40, 8)
    bursts.emit(w.x, w.y + 1.0, w.z, color, 30, 6)
    bursts.emit(w.x, w.y + 2.0, w.z, '#ffffff', 20, 9)
    spawnReveal(at, color, tier)
    buildCarView(i, true)
    sfx.smash(tier)
    sfx.reveal(tier)
    shake = 0.35 + tier * 0.06
    showReveal(car, lucky)
    if (tier >= 3 || car.variant) hud.announce(`${car.variant ? `${car.variant} ` : ''}${car.name} (${car.rarity}) unlocked!`)
    refreshIncome()
    save()
  }

  function collect(i, quiet) {
    const s = slots[i]
    if (s?.kind !== 'car' || s.stored + (s.away || 0) < 1) return
    const amount = Math.floor(s.stored + (s.away || 0))
    s.stored = 0
    s.away = 0
    setMoney(state.money + amount)
    repaintPad(i, true)
    const p = padWorld[i]
    bursts.emit(p.x, p.y + 0.4, p.z, '#7dff3a', quiet ? 6 : 18, 4)
    floatText(`+$${short(amount)}`, v1.copy(p).add(v2.set(0, 1.8, 0)), '#7dff3a', !quiet)
    sfx.collect(quiet ? 2 : Math.min(6, 2 + Math.floor(Math.log10(amount + 1))))
  }

  // Collect All only banks money earned while playing; away money must be collected at each bay's pad.
  function collectAll() {
    let total = 0
    for (const s of slots) if (s?.kind === 'car') total += Math.floor(s.stored)
    if (total < 1) return fail('Nothing to collect yet')
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]
      if (s?.kind !== 'car') continue
      s.stored -= Math.floor(s.stored)
      repaintPad(i, true)
      const p = padWorld[i]
      bursts.emit(p.x, p.y + 0.4, p.z, '#7dff3a', 10, 4)
    }
    setMoney(state.money + total)
    floatText(`+$${short(total)}`, v1.copy(player.position).add(v2.set(0, 2.6, 0)), '#7dff3a', true)
    sfx.collect(6)
    save()
  }

  function upgrade(i) {
    const s = slots[i]
    if (s?.kind !== 'car') return
    if (s.level >= GAME.upgrade.maxLevel) return fail('This car is at max level')
    const cost = upgradeCost(s)
    if (state.money < cost) return fail(`Need $${short(cost - state.money)} more to upgrade`)
    setMoney(state.money - cost)
    s.spent += cost
    s.level++
    repaintCarLabel(i)
    repaintSign(i, true)
    views[i].pop = 1
    const w = bayWorld[i]
    bursts.emit(w.x, w.y + 1.5, w.z, '#ffe14a', 26, 5)
    floatText(`Level ${s.level}!`, v1.copy(w).add(v2.set(0, 3.2, 0)), '#ffe14a', true)
    sfx.upgrade()
    refreshIncome()
    save()
  }

  // E on a parked car: bank its pad, take it off the bay into the hotbar.
  function removeCar(i) {
    const s = slots[i]
    if (s?.kind !== 'car') return
    if (state.carrying) return fail('Place your block on a free bay first')
    if (state.cars.length >= GAME.inventory) return fail('Your hotbar is full! Place a car or sell one at the Sell stall')
    if (s.stored + (s.away || 0) >= 1) collect(i, true)
    disposeView(i)
    slots[i] = null
    state.cars.push({ theme: s.theme, rarity: s.rarity, name: s.name, look: s.look, base: s.base, level: s.level, spent: s.spent, ...withVariant(s.variant) })
    const w = bayWorld[i]
    bursts.emit(w.x, w.y + 1.2, w.z, RARITY_COLORS[s.rarity] ?? '#ffffff', 30, 6)
    floatText(`${s.name} added to hotbar`, v1.copy(w).add(v2.set(0, 2.6, 0)), '#ffffff', true)
    sfx.pickup()
    showCarry()
    refreshIncome()
    save()
  }

  // E at a free bay with a car in hand: park it back (same level), earning from 0.
  function placeCar(i) {
    const car = state.cars[state.held]
    if (!car || slots[i] || !isOpen(i)) return
    state.cars.splice(state.held, 1)
    state.held = -1
    slots[i] = { kind: 'car', ...car, stored: 0 }
    buildCarView(i, false)
    views[i].pop = 1
    const w = bayWorld[i]
    bursts.emit(w.x, w.y + 0.6, w.z, '#ffffff', 24, 5)
    bursts.emit(w.x, w.y + 1.2, w.z, RARITY_COLORS[car.rarity] ?? '#ffffff', 18, 4)
    sfx.place()
    shake = Math.max(shake, 0.12)
    showCarry()
    refreshIncome()
    save()
  }

  // The car in hand, sold at the Sell stall.
  function sellHeld() {
    sellCarAt(state.held)
  }
  // Sells hotbar car i (the Sell Cars window, or the car in hand).
  function sellCarAt(i) {
    const car = state.cars[i]
    if (!car) return
    const value = sellValue(car)
    state.cars.splice(i, 1)
    if (state.held === i) state.held = -1
    else if (state.held > i) state.held--
    setMoney(state.money + value)
    const p = v1.copy(player.position).add(v2.set(0, 1.5, 0))
    bursts.emit(p.x, p.y, p.z, '#7dff3a', 30, 6)
    floatText(`+$${short(value)}`, p.add(v2.set(0, 1.2, 0)), '#7dff3a', true)
    sfx.sell()
    hud.toast(`Sold ${car.name} for $${short(value)}`)
    showCarry()
    save()
  }

  // --- Conveyor "More Luck" upgrade: magenta pad + label, confirm dialog ------------------------------------
  const CU = CONVEYOR_UPGRADE
  const padSpec = CU.pad
  const luckPadMat = brick('#e81ee0', { roughness: 0.4, emissive: '#ff2be0', emissiveIntensity: 0.5 })
  const luckPad = new Mesh(new BoxGeometry(padSpec.size, 0.14, padSpec.size), luckPadMat)
  luckPad.position.set(padSpec.x, 0.2, padSpec.z)
  luckPad.receiveShadow = true
  g.add(luckPad)
  let luckPadWorld = g.localToWorld(luckPad.position.clone())
  const luckLines = []
  const luckStack = paintStack(luckLines, { width: 640 })
  const luckLabel = spriteOf(luckStack.canvas, 2.6)
  luckLabel.position.set(padSpec.x, 3.2, padSpec.z)
  g.add(luckLabel)
  const luckSparkle = sparkleField({ count: 14, center: { x: padSpec.x, y: 0.2, z: padSpec.z }, box: { x: padSpec.size, y: 1.6, z: padSpec.size }, rise: 0.7, life: 1.8, size: 0.18, color: '#ff6af0', seed: 77 })
  g.add(luckSparkle)
  // The highest conveyor skin unlocked at a level.
  const skinFor = (level) => CONVEYOR_SKINS.reduce((best, sk, i) => (level >= sk.minLevel ? i : best), 0)
  const luckMaxed = () => state.conveyorLevel >= CU.levels.length - 1
  const nextLuck = () => CU.levels[state.conveyorLevel + 1]
  const luckX = (l) => `x${+l.toFixed(2)}`
  function paintLuckLabel() {
    const cur = CU.levels[state.conveyorLevel]
    luckLines.length = 0
    luckLines.push({ size: 48, parts: [{ text: '[UPGRADE]', fill: '#ffe14a' }] }, { size: 50, parts: [{ text: 'More Luck', fill: '#5dff4a' }] })
    if (luckMaxed()) {
      luckLines.push({ size: 48, parts: [{ text: `Conveyor Luck ${luckX(cur.luck)}`, fill: '#ff6af0' }] }, { size: 54, parts: [{ text: 'MAXED', fill: '#ffffff' }] })
    } else {
      const n = nextLuck()
      luckLines.push(
        { size: 46, parts: [{ text: `Upgrade Conveyor (Lvl ${state.conveyorLevel + 1})`, fill: '#ff6af0' }] },
        { size: 44, parts: [{ text: `Luck ${luckX(cur.luck)} > ${luckX(n.luck)}`, fill: '#4aa8ff' }] },
        { size: 56, parts: [{ text: `$${short(n.cost)}`, fill: state.money >= n.cost ? '#7dff3a' : '#ff5a4a' }] },
      )
    }
    luckStack.draw()
    luckLabel.material.map.needsUpdate = true
    luckLabel.userData.fit()
  }
  fontReady.then(paintLuckLabel)
  let luckLabelKey = ''

  const modal = document.createElement('div')
  modal.className = 'confirm'
  modal.innerHTML = `<div class="confirm-card"><div class="confirm-head studs"><span class="ol head">Upgrade</span></div><div class="confirm-body"><div class="q ol">Are you sure you want to purchase this for</div><div class="cprice ol"></div><div class="what ol"></div><div class="confirm-btns"><button class="lego-btn red studs no"><span class="ol">No</span></button><button class="lego-btn green studs yes"><span class="ol">Yes</span></button></div></div></div>`
  layer.appendChild(modal)
  let modalOpen = false
  let confirmYes = null
  function openConfirm({ head, question, price, what, onYes }) {
    modal.querySelector('.head').textContent = head
    modal.querySelector('.q').textContent = question
    modal.querySelector('.cprice').textContent = price
    modal.querySelector('.what').textContent = what
    confirmYes = onYes
    modal.classList.add('show')
    modalOpen = true
    sfx.blip()
  }
  function openLuckModal() {
    if (luckMaxed()) return fail('Conveyor luck is maxed!')
    const n = nextLuck()
    openConfirm({ head: 'Upgrade', question: 'Are you sure you want to purchase this for', price: `$${short(n.cost)}`, what: `Conveyor Luck ${luckX(CU.levels[state.conveyorLevel].luck)} > ${luckX(n.luck)}`, onYes: buyLuck })
  }
  function openSellModal() {
    const car = state.cars[state.held]
    if (!car) return
    openConfirm({ head: 'Sell', question: 'Are you sure you want to sell this car for', price: `$${short(sellValue(car))}`, what: `${car.name} (${car.rarity}, Lvl ${car.level})`, onYes: () => (closeModal(), sellHeld()) })
  }
  function closeModal() {
    modal.classList.remove('show')
    modalOpen = false
  }
  function buyLuck() {
    closeModal()
    if (luckMaxed()) return
    const n = nextLuck()
    if (state.money < n.cost) return fail(`Not enough money: need $${short(n.cost - state.money)} more`)
    setMoney(state.money - n.cost)
    const skinBefore = skinFor(state.conveyorLevel)
    state.conveyorLevel++
    base.setLuck(n.luck)
    const skinNow = skinFor(state.conveyorLevel)
    if (skinNow !== skinBefore) {
      base.setConveyorSkin(skinNow, true)
      hud.announce(`Conveyor evolved: ${CONVEYOR_SKINS[skinNow].name}!`)
      sfx.reveal(3)
      shake = Math.max(shake, 0.3)
    }
    paintLuckLabel()
    bursts.emit(luckPadWorld.x, luckPadWorld.y + 0.5, luckPadWorld.z, '#ff6af0', 36, 6)
    floatText(`Luck ${luckX(n.luck)}!`, v1.copy(luckPadWorld).add(v2.set(0, 2, 0)), '#ff6af0', true)
    sfx.upgrade()
    hud.toast(`Conveyor upgraded! Rare blocks spawn more often (Luck ${luckX(n.luck)})`)
    save()
  }
  modal.querySelector('.no').addEventListener('click', closeModal)
  modal.querySelector('.yes').addEventListener('click', () => confirmYes?.())
  modal.addEventListener('pointerdown', (e) => e.target === modal && closeModal())
  window.addEventListener('keydown', (e) => {
    if (!modalOpen) return
    if (e.code === 'Enter') confirmYes?.()
    else if (e.code === 'Backspace' || e.code === 'KeyN') closeModal()
  })
  let onLuckPad = false

  // --- "Bases" pad: stepping on it opens the Base Skins window ------------------------------------------
  const skinPadMat = brick('#ff9a1a', { roughness: 0.4, emissive: '#ff7a00', emissiveIntensity: 0.45 })
  const skinPad = new Mesh(new BoxGeometry(SKINS_PAD.size, 0.14, SKINS_PAD.size), skinPadMat)
  skinPad.position.set(SKINS_PAD.x, 0.2, SKINS_PAD.z)
  skinPad.receiveShadow = true
  g.add(skinPad)
  let skinPadWorld = g.localToWorld(skinPad.position.clone())
  const skinStack = paintStack(
    [
      { size: 56, parts: [{ text: 'Bases', fill: '#ffb21a' }] },
      { size: 46, parts: [{ text: 'Unlock base skins!', fill: '#ffffff' }] },
    ],
    { width: 640 },
  )
  const skinLabel = spriteOf(skinStack.canvas, 1.9)
  skinLabel.position.set(SKINS_PAD.x, 2.8, SKINS_PAD.z)
  g.add(skinLabel)
  fontReady.then(() => {
    skinStack.draw()
    skinLabel.material.map.needsUpdate = true
    skinLabel.userData.fit()
  })
  const skinSparkle = sparkleField({ count: 14, center: { x: SKINS_PAD.x, y: 0.2, z: SKINS_PAD.z }, box: { x: SKINS_PAD.size, y: 1.6, z: SKINS_PAD.size }, rise: 0.7, life: 1.8, size: 0.18, color: '#ffb21a', seed: 78 })
  g.add(skinSparkle)
  let onSkinPad = false

  // --- Pickaxes Shop: buy with money, equip any owned one ----------------------------------------------
  let pickIcons = null
  function equipPickaxe(id, quiet) {
    if (!ownedPicks.has(id)) return
    state.pickaxe = id
    dressTool()
    if (pickIcons) hud.setToolIcon(pickIcons[id])
    if (!quiet) {
      sfx.pickup()
      hud.toast(`Equipped ${pick().name} (${short(pick().damage)} damage)`)
      bursts.emit(player.position.x, player.position.y + 1.6, player.position.z, '#7fe6ff', 18, 4)
    }
    save()
  }
  function buyPickaxe(id) {
    const p = PICK_BY_ID[id]
    if (!p || ownedPicks.has(id)) return
    if (state.money < p.price) return fail(`Not enough money: need $${short(p.price - state.money)} more`)
    setMoney(state.money - p.price)
    ownedPicks.add(id)
    sfx.buy()
    setTimeout(sfx.upgrade, 120)
    floatText(`-$${short(p.price)}`, v1.copy(player.position).add(v2.set(0, 2.6, 0)), '#ff6a4a', true)
    equipPickaxe(id, true)
    hud.toast(`Bought ${p.name}! ${short(p.damage)} damage per hit`)
    tutorialProgress()
    bursts.emit(player.position.x, player.position.y + 1.6, player.position.z, '#ffe14a', 30, 6)
  }
  const sellShop = createSellShop(layer, {
    cars: () => state.cars.map((c) => ({ name: c.name, rarity: c.rarity, look: c.look, value: sellValue(c) })),
    onSell: sellCarAt,
    onClose: () => sfx.close(),
  })

  // --- Hotbar access for the Fuse Machine and Daily Rewards (game/fuse.js, daily.js) -------------------
  const inv = {
    cars: () => state.cars,
    room: () => GAME.inventory - state.cars.length,
    take(i) {
      const car = state.cars[i]
      if (!car) return null
      state.cars.splice(i, 1)
      if (state.held === i) state.held = -1
      else if (state.held > i) state.held--
      showCarry()
      save()
      return car
    },
    sellValue: sellValue,
    give(car, force = false) {
      if (!force && state.cars.length >= GAME.inventory) return false
      state.cars.push({ theme: car.theme, rarity: car.rarity, name: car.name, look: car.look, base: car.base, level: car.level || 1, spent: car.spent || 0, ...withVariant(car.variant) })
      carIndex.discover(car)
      showCarry()
      save()
      return true
    },
    addMoney(n) {
      setMoney(state.money + n)
      floatText(`+$${short(n)}`, v1.copy(player.position).add(v2.set(0, 2.6, 0)), '#7dff3a', true)
      save()
    },
  }
  const cheer = (color) => {
    const p = player.position
    bursts.emit(p.x, p.y + 1.6, p.z, color, 36, 7)
    shake = Math.max(shake, 0.15)
  }
  const fuseMachine = createFuse(layer, {
    inv,
    hud,
    sfx,
    onClaim: (car) => {
      cheer(RARITY_COLORS[car.rarity] ?? '#ffffff')
      sfx.reveal(tierOf(car.rarity))
      showReveal({ ...car, level: 1 }, false)
    },
  })
  const daily = createDaily(layer, { inv, hud, sfx, onReady: (on) => hud.setDailyReady?.(on), onClaim: () => cheer('#ffe14a') })
  // The HUD's FREE! car after FREE_CAR.minutes of play (a signed-in player's checked by the server).
  const freeCar = createFreeCar(layer, {
    inv,
    hud,
    sfx,
    claimRemote: () => claimFreeCar?.() ?? Promise.resolve(null),
    onState: (s) => hud.setFreeCar?.(s),
    onClaim: (car) => {
      cheer(RARITY_COLORS[car.rarity] ?? '#ffffff')
      sfx.reveal(tierOf(car.rarity))
      showReveal(car, false)
    },
  })
  // One window at a time: opening one closes the rest (pickShop is added below).
  const settings = createSettings(layer, { sfx, hud })
  const windows = [sellShop, fuseMachine, daily, freeCar, carIndex, settings]
  const events = createEvents(layer, { lobby, base, hud, sfx })
  const spinWheel = createSpin(layer, {
    inv,
    hud,
    sfx,
    income: () => slots.reduce((a, s) => a + (s?.kind === 'car' ? incomeOf(s) : 0), 0),
    // A reward block lands in your hands (like one bought off the belt).
    giveBlock(theme) {
      if (state.carrying || state.held >= 0) {
        inv.addMoney(BLOCK_THEMES[theme].price)
        return false
      }
      state.carrying = theme
      state.carryVariant = null
      showCarry()
      save()
      return true
    },
    onWin: () => cheer('#ffe14a'),
    rewardedAd,
  })
  windows.push(spinWheel)
  const solo = (w) => windows.forEach((o) => o !== w && o.close())
  const pickShop = createPickShop(layer, {
    isOwned: (id) => ownedPicks.has(id),
    equipped: () => state.pickaxe,
    onBuy: buyPickaxe,
    onEquip: (id) => equipPickaxe(id, false),
    onClose: () => sfx.close(),
  })
  windows.push(pickShop)
  const baseSkins = createBaseSkins(layer, {
    isOwned: skinOwned,
    equipped: () => state.skin,
    indexPct: () => carIndex.percent(),
    onBuy: buySkin,
    onEquip: (id) => equipSkin(id, false),
    onLocked: (sk) => fail(`Get ${Math.round(sk.index * 100)}% of the Index to unlock ${sk.name}, or buy it for $${short(sk.price)}`),
    onClose: () => sfx.close(),
  })
  windows.push(baseSkins)
  const trade = createTrade(layer, {
    inv,
    hud,
    sfx,
    income: rawIncome,
    beforeOpen: () => solo(trade),
    onDone: () => cheer('#7dff3a'),
  })
  escrowed = trade.escrowed
  windows.push(trade)
  // The Trade prompt over the nearest other player (E / tap).
  const tradeTarget = { id: '', action: 'Trade', object: '', color: '#7dff3a', hold: 0, anchor: new Vector3(), sid: '', onDone: () => trade.request(tradeTarget.sid) }
  function tradePrompt() {
    if (!trade.idle || !nearbyPlayer) return null
    const n = nearbyPlayer()
    if (!n) return null
    tradeTarget.id = `trade:${n.id}`
    tradeTarget.sid = n.id
    tradeTarget.object = n.name
    tradeTarget.anchor.set(n.x, n.y + 3.1, n.z)
    return tradeTarget
  }
  fontReady.then(() => {
    pickIcons = renderPickaxeIcons(PICKAXES)
    pickShop.setIcons(pickIcons)
    hud.setToolIcon(pickIcons[state.pickaxe])
  })

  // --- Pointer: click / tap = upgrade sign under the pointer, else a swing ----------------------------------
  const raycaster = new Raycaster()
  const ndc = new Vector2()
  function act(x, y) {
    if (document.pointerLockElement) {
      // Cursor is captured: aim from the screen centre
      x = window.innerWidth / 2
      y = window.innerHeight / 2
    }
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
    const hit = raycaster.intersectObjects(signMeshes, false)[0]
    if (hit) return upgrade(hit.object.userData.bay)
    swing()
  }
  let mouseHeld = false
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    mouseHeld = true
    act(e.clientX, e.clientY)
  })
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse' && e.button === 0) mouseHeld = false
  })
  window.addEventListener('blur', () => (mouseHeld = false))
  const taps = new Map()
  const isFinger = (e) => e.pointerType === 'touch' || e.pointerType === 'pen'
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (!isFinger(e)) return
      if (e.target !== canvas && !e.target.closest?.('.touch-right')) return
      taps.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() })
    },
    { capture: true },
  )
  window.addEventListener(
    'pointerup',
    (e) => {
      const tp = taps.get(e.pointerId)
      if (!tp) return
      taps.delete(e.pointerId)
      if (Math.hypot(e.clientX - tp.x, e.clientY - tp.y) < 14 && performance.now() - tp.t < 350) act(e.clientX, e.clientY)
    },
    { capture: true },
  )
  window.addEventListener('pointercancel', (e) => taps.delete(e.pointerId), { capture: true })

  // --- Prompt targets (objects reused every frame) ---------------------------------------------------------
  const buyTargetsOf = (bs) => bs.blocks.map((b, k) => ({ id: `buy${k}`, action: '', object: '', color: '', hold: GAME.buyHold, anchor: new Vector3(), onDone: () => buy(b) }))
  let buyTargets = buyTargetsOf(base)
  const placeTargets = bays.map((_, i) => ({ id: `place${i}`, action: 'Place', object: '', hold: 0, anchor: bayWorld[i].clone().add(new Vector3(0, 1.6, 0)), onDone: () => place(i) }))
  const slotTargets = bays.map((b, i) => (b.locked ? { id: `slot${i}`, action: `Buy  $${short(b.locked.price)}`, object: b.locked.label, color: '#3ff0ff', hold: GAME.buyHold, anchor: bayWorld[i].clone().add(new Vector3(0, 1.4, 0)), onDone: () => buySlot(i) } : null))
  const floorTarget = { id: 'floor', n: 0, action: '', object: '', color: '#3ff0ff', hold: GAME.buyHold, anchor: new Vector3(), onDone: () => buyFloor(floorTarget.n) }
  const removeTargets = bays.map((_, i) => ({ id: `remove${i}`, action: 'Remove', object: '', hold: GAME.removeHold, anchor: bayWorld[i].clone().add(new Vector3(0, 2.2, 0)), onDone: () => removeCar(i) }))

  function pickPrompt(pl) {
    if (!busy()) {
      let best = null
      let bestD = GAME.buyReach
      base.blocks.forEach((b, k) => {
        if (!base.onBelt(b)) return
        const p = base.blockWorld(b, v1)
        const d = Math.hypot(p.x - player.position.x, p.z - player.position.z)
        if (d >= bestD) return
        bestD = d
        const t = BLOCK_THEMES[b.key]
        const tg = buyTargets[k]
        tg.id = `buy${k}:${b.key}:${b.variant ?? ''}`
        tg.action = `Buy  $${short(t.price)}`
        tg.object = b.variant ? `${b.variant} ${t.name}` : t.name
        tg.color = RARITY_COLORS[t.rarity]
        tg.anchor.copy(p).add(v2.set(0, 1.0, 0))
        best = tg
      })
      if (best) return best
    }
    // Only the bays (and the floor plate) on the floor the player stands on.
    const sameFloor = (i) => Math.abs(pl.y - bays[i].top) < 2.5
    if (!bays.some((_, i) => sameFloor(i))) return null
    const fp = base.floorPlates[state.floors]
    if (fp && Math.abs(pl.y - fp.top) < 2.5 && rectDist(fp, pl) < 0.6) {
      floorTarget.id = `floor${fp.n}`
      floorTarget.n = fp.n
      floorTarget.action = `Buy  $${short(fp.price)}`
      floorTarget.object = fp.label
      g.localToWorld(base.garageToBase(fp.cx, fp.top, fp.cz, floorTarget.anchor)).add(v2.set(0, 1.4, 0))
      return floorTarget
    }
    for (let i = 0; i < bays.length; i++) if (bays[i].locked && !isOpen(i) && sameFloor(i) && rectDist(bays[i], pl) < 0.9) return slotTargets[i]
    if (busy()) {
      const heldCar = state.held >= 0 ? state.cars[state.held] : null
      let best = null
      let bestD = GAME.placeReach
      for (let i = 0; i < bays.length; i++) {
        if (slots[i] || !isOpen(i) || !sameFloor(i)) continue
        const d = rectDist(bays[i], pl)
        if (d < bestD) {
          bestD = d
          best = placeTargets[i]
          best.id = `place${i}:${heldCar ? 'car' : 'block'}`
          best.object = heldCar ? heldCar.name : BLOCK_THEMES[state.carrying].name
          best.color = RARITY_COLORS[heldCar ? heldCar.rarity : BLOCK_THEMES[state.carrying].rarity]
        }
      }
      return best
    }
    let best = null
    let bestD = GAME.removeReach
    for (let i = 0; i < bays.length; i++) {
      const s = slots[i]
      if (s?.kind !== 'car' || views[i].t < 1 || !sameFloor(i)) continue
      const d = rectDist(bays[i], pl)
      if (d >= bestD) continue
      bestD = d
      best = removeTargets[i]
      best.object = s.name
      best.color = RARITY_COLORS[s.rarity]
    }
    return best
  }

  // --- New-player tutorial (game/tutorial.js) ----------------------------------------------------------------
  // A save from before the tutorial existed (a game save but no tutorial record) counts as finished.
  let hadSave = false
  try {
    hadSave = localStorage.getItem(GAME.saveKey) !== null
  } catch {
    // ignore
  }
  const tutorial = createTutorial({ layer, scene, sfx, onStep: (n) => onTutorialStep?.(n) })
  if (tutorial.fresh && hadSave) tutorial.advance(TUTORIAL_DONE, { quiet: true })
  const goalPick = PICK_BY_ID[TUTORIAL.pickaxe] ?? PICKAXES[1]

  // Moves the tutorial on from what the player has done (bought a block, placed it, got a car, saved
  // up, bought a pickaxe), whichever way they did it (the belt, the Spin Wheel, a trade, ...).
  function tutorialProgress() {
    const now = tutorial.step
    if (now >= TUTORIAL_DONE) return
    if (ownedPicks.size > 1) return void tutorial.advance(TUTORIAL_DONE)
    let want = now
    if (state.carrying) want = Math.max(want, 1)
    let car = state.cars.length > 0
    for (const sl of slots) {
      if (sl?.kind === 'block') want = Math.max(want, 2)
      else if (sl?.kind === 'car') car = true
    }
    if (car) want = Math.max(want, 3)
    if (want >= 3 && state.money >= goalPick.price) want = 4
    if (want <= now) return
    if (want === 4) tutorial.flash(TUTORIAL.afford.replace('{name}', goalPick.name))
    tutorial.advance(want)
  }

  // The arrows' route to the next thing to do: world points from the player's feet (reused objects).
  const B = BASE.building
  const F = B.floor
  const route = Array.from({ length: 14 }, () => new Vector3())
  const path = []
  let routeN = 0
  const shopZone = lobby?.zones?.find((z) => z.id === 'pickaxes')
  const at = (v) => route[routeN++].copy(v)
  const atBase = (x, y, z) => g.localToWorld(route[routeN++].set(x, y, z)) // base-group metres
  const atGarage = (x, y, z) => g.localToWorld(base.garageToBase(x, y, z, route[routeN++])) // garage design units
  // Drops the leading points (from index `from`) the player has already passed: the route resumes
  // at the end of the segment nearest to them.
  function trimRoute(from) {
    const p = player.position
    let best = Math.hypot(p.x - route[from].x, p.z - route[from].z)
    let skip = 0
    for (let j = from; j < routeN - 1; j++) {
      const a = route[j]
      const b = route[j + 1]
      const dx = b.x - a.x
      const dz = b.z - a.z
      const t = clamp01(((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1))
      const d = Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t))
      if (d < best) {
        best = d
        skip = j + 1 - from
      }
    }
    if (!skip) return
    for (let j = from; j + skip < routeN; j++) route[j].copy(route[j + skip])
    routeN -= skip
  }
  // Into the garage through its open front, up the aisle, to (x, z) (garage design units).
  function intoGarage(pl, inside, x, z) {
    if (!inside) {
      const atDoor = pl.z > B.maxZ && pl.z < B.maxZ + 4 && Math.abs(pl.x) < B.maxX - 2
      if (!atDoor) atGarage(0, 0.1, B.maxZ + 2.5)
      atGarage(0, F + 0.2, B.maxZ - 1.5)
    }
    if (!inside || Math.abs(pl.z - z) > 2.2) atGarage(0, F + 0.2, z)
    atGarage(x, F + 0.2, z)
  }
  function outOfGarage(inside) {
    if (!inside) return
    atGarage(0, F + 0.2, B.maxZ - 1.5)
    atGarage(0, 0.1, B.maxZ + 2.5)
  }
  // Fills `route` and returns how close (m) the player may get before the arrows go, or -1 for none.
  function tutorialRoute(pl) {
    routeN = 0
    at(player.position)
    const inside = pl.x > B.minX && pl.x < B.maxX && pl.z > B.minZ && pl.z < B.maxZ + 0.3 && pl.y < B.height
    const step = tutorial.step
    if (step === 0) {
      // the nearest belt block the player can pay for; the arrows end on the apron in front of it
      let best = null
      let bestD = Infinity
      for (const b of base.blocks) {
        if (!base.onBelt(b) || BLOCK_THEMES[b.key].price > state.money) continue
        const d = base.blockWorld(b, v1).distanceToSquared(player.position)
        if (d < bestD) {
          bestD = d
          best = b
        }
      }
      if (!best) return -1
      outOfGarage(inside)
      const Cv = BASE.conveyor
      const lx = Math.max(Cv.from + 1, Math.min(Cv.to - 1, best.holder.position.x))
      atBase(lx, 0.2, Cv.z - Cv.belt / 2 - Cv.wall - 1.6)
      return 2.4
    }
    if (step === 1 || step === 2) {
      // a free bay (the one nearest the player) / the bay with the placed block
      let bay = -1
      let bestD = Infinity
      for (let i = 0; i < bays.length; i++) {
        if (bays[i].level !== 0) continue
        const ok = step === 1 ? !slots[i] && isOpen(i) : slots[i]?.kind === 'block'
        if (!ok) continue
        const d = Math.hypot(bays[i].cx - pl.x, bays[i].cz - pl.z)
        if (d < bestD) {
          bestD = d
          bay = i
        }
      }
      if (bay < 0) return -1
      intoGarage(pl, inside, bays[bay].cx, bays[bay].cz)
      return 3.2
    }
    if (step === 3) {
      // the green pad of the car with the most money waiting
      let bay = -1
      let most = -1
      for (let i = 0; i < bays.length; i++) {
        const sl = slots[i]
        if (bays[i].level !== 0 || sl?.kind !== 'car') continue
        const m = sl.stored + (sl.away || 0)
        if (m > most) {
          most = m
          bay = i
        }
      }
      if (bay < 0) return -1
      intoGarage(pl, inside, bays[bay].pad.x, bays[bay].pad.z)
      return 1.6
    }
    if (step === 4 && shopZone) {
      // out of the garage, round the end of the conveyor nearer the plaza (between the limited car and
      // the tunnel box), down the road to the stall
      outOfGarage(inside)
      const from = routeN
      const sideOf = (s) => g.localToWorld(v2.set(s * 37, 0.1, 28)).distanceToSquared(v1.set(shopZone.x, 0, shopZone.z))
      const s = sideOf(1) < sideOf(-1) ? 1 : -1
      atBase(s * 25, 0.1, 28)
      atBase(s * 37, 0.1, 28)
      const out = atBase(s * 37, 0.1, 46)
      const lane = Math.sign(out.x || 1) * 2.6
      at(v2.set(lane, 0.1, out.z))
      at(v2.set(lane, 0.1, LOBBY.road.south - 4))
      at(v2.set(shopZone.x, 0.1, shopZone.z))
      if (!inside) trimRoute(from)
      return 2.2
    }
    return -1
  }
  function tutorialUpdate(dt, pl) {
    tutorialProgress()
    let show = null
    if (tutorial.step < TUTORIAL_DONE) {
      const hide = tutorialRoute(pl)
      const end = route[routeN - 1]
      if (hide >= 0 && routeN > 1 && Math.hypot(end.x - player.position.x, end.z - player.position.z) > hide) {
        path.length = 0
        for (let i = 0; i < routeN; i++) path.push(route[i])
        show = path
      }
    }
    const step = Math.min(tutorial.step, TUTORIAL.steps.length - 1)
    const text = TUTORIAL.steps[step].replace('{money}', short(Math.floor(state.money))).replace('{goal}', short(goalPick.price))
    tutorial.update(dt, text, show)
  }

  // --- Boot from the save ------------------------------------------------------------------------------------
  const away = load()
  // Index: everything owned counts as discovered (covers saves from before the Index).
  for (const c of [...state.cars, ...slots.filter((s) => s?.kind === 'car')]) carIndex.discover(c)
  for (const i of unlocked) base.unlockBay(i, false)
  base.setFloors(state.floors, false)
  base.setSkin(state.skin, false)
  dressTool()
  for (let i = 0; i < slots.length; i++) {
    if (slots[i]?.kind === 'block') buildBlockView(i, false)
    else if (slots[i]?.kind === 'car') buildCarView(i, false)
  }
  hud.setMoney(state.money, true)
  base.setLuck(CU.levels[state.conveyorLevel].luck)
  base.setConveyorSkin(skinFor(state.conveyorLevel), false)
  showCarry()
  refreshIncome()
  if (away >= 1) setTimeout(() => hud.toast(`Welcome back! Your cars earned $${short(away)} while you were away. Walk onto each car's green pad to collect it`, 3600), 1200)
  else if (!slots.some(Boolean) && tutorial.done) setTimeout(() => hud.toast('Buy a block from the conveyor (hold E), carry it to a bay in your garage!', 4200), 1500)
  let saveClock = 0
  window.addEventListener('beforeunload', save)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && save())

  let slowClock = 0
  const tmpQ = new Vector3()

  // --- Moving to another garage (the server assigned this player a different plot) -----------------
  // The garages are identical in their own frame, so everything the game drew moves across with its
  // local transform; world positions are re-read, and the old garage goes back to a free one.
  function moveTo(next) {
    if (!next || next === base) return
    const prev = base
    for (const i of unlocked) prev.lockBay(i)
    prev.setFloors(0)
    prev.setSkin(GARAGE_SKINS[0].id)
    prev.setLuck(1)
    prev.setConveyorSkin(0, false)
    prev.setIncome(0)
    prev.setLit(false)
    prev.setOwner(null)
    base = next
    g = next.group
    g.updateMatrixWorld(true)
    for (const v of views) if (v) for (const o of [v.holder, v.label, v.signHolder, v.padText]) if (o) g.add(o)
    for (const d of debris) g.add(d.m)
    for (const f of fxs) g.add(f.obj)
    g.add(luckPad, luckLabel, luckSparkle, skinPad, skinLabel, skinSparkle)
    g.updateMatrixWorld(true)
    skinPadWorld = g.localToWorld(skinPad.position.clone())
    bayWorld = bayBase.map((p) => g.localToWorld(p.clone()))
    padWorld = padBase.map((p) => g.localToWorld(p.clone()))
    luckPadWorld = g.localToWorld(luckPad.position.clone())
    placeTargets.forEach((t, i) => t.anchor.copy(bayWorld[i]).add(v2.set(0, 1.6, 0)))
    slotTargets.forEach((t, i) => t?.anchor.copy(bayWorld[i]).add(v2.set(0, 1.4, 0)))
    removeTargets.forEach((t, i) => t.anchor.copy(bayWorld[i]).add(v2.set(0, 2.2, 0)))
    buyTargets = buyTargetsOf(base)
    if (faceTo) faceTo = null
    for (const i of unlocked) base.unlockBay(i, false)
    base.setFloors(state.floors, false)
    base.setSkin(state.skin, false)
    base.setLuck(CU.levels[state.conveyorLevel].luck)
    base.setConveyorSkin(skinFor(state.conveyorLevel), false)
    base.setLit(true)
    events.moveTo(base)
    refreshIncome()
  }

  // What the other players draw of this garage (net.js -> backend presence.ts applyBase).
  function baseSnapshot() {
    let inc = 0
    for (const s of slots) if (s?.kind === 'car') inc += incomeOf(s)
    const v = (s) => (MUT[s.variant] ? { v: s.variant } : {})
    return {
      lvl: state.conveyorLevel,
      unl: [...unlocked],
      fl: state.floors,
      sk: state.skin,
      inc: Math.round(inc * 100) / 100,
      bays: slots.map((s) => {
        if (!s) return null
        if (s.kind === 'block') return { k: 'b', t: s.theme, hp: Math.ceil(s.hp), max: s.max, ...v(s) }
        return { k: 'c', t: s.theme, r: s.rarity, n: s.name, l: s.look, lv: s.level, b: s.base, ...v(s) }
      }),
    }
  }

  return {
    get base() {
      return base
    },
    moveTo,
    baseSnapshot,
    // The new-player tutorial's step (0-4, 5 = done; net.js reports it and syncs it with the server).
    get tutorialStep() {
      return tutorial.step
    },
    syncTutorial: (step) => tutorial.sync(step),
    // Hands full or mid-swing (an emote stops for it).
    get busy() {
      return busy() || swingT >= 0
    },
    // What is in this player's hands (net.js `loadout`).
    loadout() {
      const held = state.held >= 0 ? state.cars[state.held]?.look : null
      return { tool: state.pickaxe, toolOut: state.equipped && !busy(), carry: state.carrying || '', carryVariant: state.carryVariant || '', held: held || '' }
    },
    // Garage income $/s (net.js reports it to Bloxity's boards).
    get income() {
      return slots.reduce((a, s) => a + (s?.kind === 'car' ? incomeOf(s) : 0), 0)
    },
    // Is one of the game's windows (shops, Index, Daily, Fuse, Spin, a confirm) open? (screen ads)
    panelOpen: () => modalOpen || !!layer.querySelector('.pick-shop.show'),
    // A rewarded ad the server checked: free spins (spin.js).
    addSpins: (n) => spinWheel.addSpins?.(n),
    collectAll,
    setAutoSwing(on) {
      state.autoSwing = on
    },
    slot: pickSlot,
    // Lobby ring entered / left (main.js): the Sell stall sells the car in hand.
    onZone(zone) {
      if (zone?.id === 'sell') {
        // The Sell stall opens "Sell Cars" with every hotbar car.
        if (state.cars.length) {
          solo(sellShop)
          sellShop.open()
          sfx.blip()
        } else setTimeout(() => hud.toast('No cars to sell: press E on a parked car to put it in your hotbar'), 50)
      } else {
        sellShop.close()
        if (zone?.id === 'spin') {
          solo(spinWheel)
          spinWheel.open()
        }
        if (zone?.id === 'fuse') {
          solo(fuseMachine)
          fuseMachine.open()
        }
        else fuseMachine.close()
        if (!zone && modalOpen && confirmYes !== buyLuck) closeModal()
      }
    },
    swing,
    // HUD calendar / gear buttons.
    toggleDaily: () => (solo(daily), daily.toggle()),
    toggleFreeCar: () => (solo(freeCar), freeCar.toggle()),
    // The free car's play time: what this browser counted (net.js freeCarSync) / the server's answer.
    freeCarSnapshot: () => freeCar.snapshot(),
    syncFreeCar: (msg) => freeCar.sync(msg),
    toggleSettings: () => (solo(settings), settings.toggle()),
    toggleIndex: () => (solo(carIndex), carIndex.toggle()),
    toggleSpin: () => (solo(spinWheel), spinWheel.toggle()),
    events, // dev: __game.game.events.start('Golden')
    // Stepping into / out of the Pickaxes Shop stall's ring.
    setPickShopZone(inside) {
      if (inside) {
        solo(pickShop)
        pickShop.open()
        sfx.blip()
      } else pickShop.close()
    },
    get money() {
      return state.money
    },
    // dev: cheat money
    addMoney(n) {
      setMoney(state.money + n)
    },
    // dev: leave the block on bay i one hit from breaking (tests the reveal / car flow)
    devCrack(i) {
      if (slots[i]?.kind === 'block') slots[i].hp = 1
    },
    // Shakes the camera after camera.update ran.
    applyShake(cam, dt) {
      if (shake <= 0.002) return
      shakeOff.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake)
      cam.position.add(shakeOff)
      shake *= Math.exp(-dt * 9)
    },

    update(dt, elapsed) {
      const pl = base.worldToGarage(player.position, local).clone()
      events.update(dt)

      // Hammer in hand (slot 1 equipped, hands free), arms posed via the animator overlay.
      placeTool(state.equipped && !busy())
      const animator = getAnimator()
      if (animator) animator.overlay = overlay
      const avatar = getAvatar()
      const shoulder = avatar?.nodes?.ArmR1
      if (shoulder) {
        shoulder.getWorldPosition(tmpQ)
        playerGroup.worldToLocal(tmpQ)
        hand.position.lerp(tmpQ, 0.5)
      }
      hand.rotation.x = -armAngle()

      // Carried block bob + pop-in.
      if (heldLook) {
        carryPop = Math.min(1, carryPop + dt * 4)
        heldHolder.scale.setScalar(easeOutBack(carryPop))
        heldHolder.position.y = 1.15 + Math.sin(elapsed * 6) * 0.03
      }
      if (carryMesh.visible) {
        carryPop = Math.min(1, carryPop + dt * 4)
        carryMesh.scale.setScalar(easeOutBack(carryPop))
        carryMesh.position.y = 1.2 + Math.sin(elapsed * 6) * 0.03
        carryMesh.rotation.y = Math.sin(elapsed * 1.5) * 0.08
      }

      // Swing timeline.
      if (faceTo) {
        const want = Math.atan2(faceTo.x - player.position.x, faceTo.z - player.position.z)
        const diff = Math.atan2(Math.sin(want - player.facing), Math.cos(want - player.facing))
        player.facing += diff * Math.min(1, dt * 18)
      }
      if (swingT >= 0) {
        swingT += dt
        if (!impactDone && swingT >= GAME.swing.impact) {
          impactDone = true
          const target = nearestBlockInReach()
          if (target >= 0) damage(target)
        }
        if (swingT >= GAME.swing.duration) {
          swingT = -1
          faceTo = null
        }
      }
      if (swingT < 0 && inHand && (mouseHeld || state.autoSwing) && nearestBlockInReach() >= 0) swing()

      // Conveyor luck pad: stepping on asks to buy the next level (once per visit).
      const lp = player.position
      const onPad = Math.abs(lp.x - luckPadWorld.x) < padSpec.size / 2 + 0.2 && Math.abs(lp.z - luckPadWorld.z) < padSpec.size / 2 + 0.2 && lp.y < luckPadWorld.y + 1.5
      if (onPad && !onLuckPad) openLuckModal()
      else if (!onPad && onLuckPad && modalOpen) closeModal()
      onLuckPad = onPad
      luckPadMat.emissiveIntensity = 0.4 + Math.sin(elapsed * 3) * 0.2
      const lk = `${state.conveyorLevel}|${luckMaxed() || state.money >= nextLuck().cost}`
      if (lk !== luckLabelKey) {
        luckLabelKey = lk
        paintLuckLabel()
      }

      // Bases pad: stepping on opens Base Skins, stepping off closes it.
      const onSP = Math.abs(lp.x - skinPadWorld.x) < SKINS_PAD.size / 2 + 0.2 && Math.abs(lp.z - skinPadWorld.z) < SKINS_PAD.size / 2 + 0.2 && lp.y < skinPadWorld.y + 1.5
      if (onSP && !onSkinPad) {
        solo(baseSkins)
        baseSkins.open()
        sfx.blip()
      } else if (!onSP && onSkinPad) baseSkins.close()
      onSkinPad = onSP
      skinPadMat.emissiveIntensity = 0.35 + Math.sin(elapsed * 3 + 1) * 0.15

      tutorialUpdate(dt, pl)

      // Prompt.
      prompt.set(pickPrompt(pl) ?? tradePrompt())
      prompt.update(dt)

      // Placed blocks (drop-in, hit punch) and cars (reveal, upgrade pop).
      for (let i = 0; i < slots.length; i++) {
        const view = views[i]
        if (!view) continue
        if (view.kind === 'block') {
          if (view.drop < 1) {
            view.drop = Math.min(1, view.drop + dt / 0.45)
            view.cube.position.y = GAME.placedSize / 2 + (1 - easeOutBounce(view.drop)) * 3
            if (view.drop >= 1 && !view.landed) {
              view.landed = true
              sfx.place()
              const w = bayWorld[i]
              bursts.emit(w.x, w.y + 0.2, w.z, '#ffffff', 16, 3)
              shake = Math.max(shake, 0.12)
            }
          }
          view.punch = Math.max(0, view.punch - dt * 7)
          const p = view.punch
          view.cube.scale.set(1 + p * 0.1, 1 - p * 0.12, 1 + p * 0.1)
          view.cube.rotation.y = Math.sin(elapsed * 40) * p * 0.06
          view.cube.position.x = Math.sin(elapsed * 55) * p * 0.08
        } else {
          if (view.t < 1) {
            view.t = Math.min(1, view.t + dt / GAME.reveal)
            const k = view.t
            view.spin.scale.setScalar(Math.max(0.01, easeOutBack(k)))
            view.spin.rotation.y = (1 - easeOut(k)) * TAU * 2
            view.spin.position.y = Math.sin(Math.PI * k) * 1.8
            if (view.t >= 1) view.label.visible = true
          }
          if (view.pop > 0) {
            view.pop = Math.max(0, view.pop - dt * 3)
            view.spin.scale.setScalar(1 + Math.sin(view.pop * Math.PI) * 0.12)
          }
        }
      }

      // Income into pads; stepping on a pad banks it.
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i]
        if (s?.kind !== 'car') continue
        s.stored += incomeOf(s) * dt
        const view = views[i]
        const pad = bays[i].pad
        const on = Math.abs(pl.x - pad.x) < pad.hx + 0.3 && Math.abs(pl.z - pad.z) < pad.hz + 0.3 && pl.y < pad.top + 1.5 && pl.y > pad.top - 1
        if (on && !view.onPad) {
          collect(i, false)
          view.padClock = 0
          save()
        } else if (on) {
          view.padClock += dt
          if (view.padClock > 1) {
            view.padClock = 0
            collect(i, true)
          }
        }
        view.onPad = on
      }

      slowClock += dt
      if (slowClock > 0.25) {
        slowClock = 0
        for (let i = 0; i < slots.length; i++) {
          if (slots[i]?.kind !== 'car') continue
          repaintPad(i)
          repaintSign(i)
        }
      }

      // Debris and reveal effects.
      for (let k = debris.length - 1; k >= 0; k--) {
        const d = debris[k]
        d.t += dt
        d.vy -= 22 * dt
        d.m.position.x += d.vx * dt
        d.m.position.y += d.vy * dt
        d.m.position.z += d.vz * dt
        if (d.m.position.y < d.floor) {
          d.m.position.y = d.floor
          d.vy = Math.abs(d.vy) * 0.35
          d.vx *= 0.6
          d.vz *= 0.6
          d.rx *= 0.5
          d.rz *= 0.5
        }
        d.m.rotation.x += d.rx * dt
        d.m.rotation.z += d.rz * dt
        const fade = clamp01((d.life - d.t) / 0.4)
        d.m.scale.setScalar(d.s * fade)
        if (d.t >= d.life) {
          g.remove(d.m)
          debris.splice(k, 1)
        }
      }
      for (let k = fxs.length - 1; k >= 0; k--) {
        const f = fxs[k]
        f.t += dt
        const k01 = clamp01(f.t / f.life)
        if (f.kind === 'ring') {
          const s = 1 + easeOut(k01) * f.grow
          f.obj.scale.set(s, s, 1)
          f.mat.opacity = 0.9 * (1 - k01)
        } else {
          f.mat.opacity = 0.55 * Math.sin(Math.PI * Math.min(1, k01 * 1.4)) * (1 - k01 * 0.5)
          f.obj.rotation.y += dt * 2
          f.obj.scale.set(1 + k01 * 0.4, 1, 1 + k01 * 0.4)
        }
        if (f.t >= f.life) {
          g.remove(f.obj)
          f.mat.dispose()
          fxs.splice(k, 1)
        }
      }

      // Floating texts.
      for (let k = floats.length - 1; k >= 0; k--) {
        const f = floats[k]
        f.t += dt
        v1.copy(f.at).add(v2.set(0, f.t * 1.6, 0)).project(camera)
        const x = (v1.x * 0.5 + 0.5) * window.innerWidth
        const y = (-v1.y * 0.5 + 0.5) * window.innerHeight
        f.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${(0.7 + easeOutBack(clamp01(f.t * 5)) * 0.3).toFixed(3)})`
        f.el.style.opacity = String(v1.z > 1 ? 0 : clamp01((1.2 - f.t) / 0.4))
        if (f.t > 1.2) {
          f.el.remove()
          floats.splice(k, 1)
        }
      }

      saveClock += dt
      if (saveClock > GAME.autosave) {
        saveClock = 0
        save()
      }
    },
  }
}
