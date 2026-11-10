// The other players' garages, read-only: for each plot owned by someone else in the room, what stands
// in each bay (a block with its health, or the car that came out of it with its name, rarity, level
// and $/s), the bays they bought, their conveyor's look and luck, and their name and income on the
// billboard, all from the snapshot their game relays (game.js baseSnapshot -> net.js -> backend
// presence.ts applyBase -> roster `base`). Nothing here can be clicked, bought or collected. Plots
// nobody holds stand as free garages; the local player's own plot is left to game.js.
import { BoxGeometry, CanvasTexture, Group, Mesh, Sprite, SpriteMaterial, SRGBColorSpace } from 'three'
import { BLOCK_THEMES, CONVEYOR_SKINS, CONVEYOR_UPGRADE, GAME, MUTATIONS, RARITY_COLORS, RARITY_LADDER } from './config.js'
import { mySessionId, roster } from './net.js'
import { brick } from './lego.js'
import { fontReady } from './propkit.js'
import { buildCar } from './lobby/cars.js'
import { paintStack, short } from './lobby/paint.js'
import { sparkleField } from './lobby/fx.js'
import { makeCanvas, paintHpLabel } from './game/paint.js'

const MUT = Object.fromEntries(MUTATIONS.filter((m) => m.mult > 1).map((m) => [m.id, m]))
const incomeOf = (car) => car.b * Math.pow(GAME.upgrade.incomeGrowth, car.lv - 1)
const rate = (v) => (v < 100 && v % 1 ? v.toFixed(1) : short(v))
const tierOf = (rarity) => Math.max(0, RARITY_LADDER.indexOf(rarity))
const skinFor = (level) => CONVEYOR_SKINS.reduce((best, sk, i) => (level >= sk.minLevel ? i : best), 0)
const blockGeo = new BoxGeometry(GAME.placedSize, GAME.placedSize, GAME.placedSize)
const padSpec = CONVEYOR_UPGRADE.pad

function spriteOf(canvas, height) {
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  const sprite = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }))
  sprite.userData.fit = () => sprite.scale.set((height * canvas.width) / canvas.height, height, 1)
  sprite.userData.fit()
  sprite.renderOrder = 5
  return sprite
}
function dropSprite(s) {
  s.material.map?.dispose()
  s.material.dispose()
}

const carLines = (c) => [
  { size: 60, parts: [{ text: c.n, fill: '#ffffff' }] },
  ...(MUT[c.v] ? [{ size: 52, parts: [{ text: `${c.v} x${MUT[c.v].mult}`, fill: c.v === 'Rainbow' ? ['#ff3b4e', '#ffd21a', '#2dd84a', '#2f9bff', '#b23cff'] : MUT[c.v].color }] }] : []),
  { size: 50, parts: [{ text: c.r, fill: RARITY_COLORS[c.r] ?? '#fff' }] },
  { size: 48, parts: [{ text: `Level ${c.lv}`, fill: '#4aa8ff' }] },
  { size: 54, parts: [{ text: `$${rate(incomeOf(c))}/s`, fill: '#7dff3a' }] },
]

// One plot's read-only garage view.
function createView(base, bursts) {
  const g = base.group
  const bayBase = base.bays.map((b) => base.garageToBase(b.cx, b.top, b.cz))
  const carYaw = (i) => (base.bays[i].side < 0 ? 0 : Math.PI) // nose toward the aisle
  const bays = base.bays.map(() => null) // { key, kind, holder, label, ... }
  let unlocked = new Set()
  let lvl = -1

  // The magenta "More Luck" pad by the exit tunnel, with the owner's conveyor luck.
  const luck = new Group()
  const pad = new Mesh(new BoxGeometry(padSpec.size, 0.14, padSpec.size), brick('#e81ee0', { roughness: 0.4, emissive: '#ff2be0', emissiveIntensity: 0.5 }))
  pad.position.set(padSpec.x, 0.2, padSpec.z)
  luck.add(pad)
  const luckLines = []
  const luckStack = paintStack(luckLines, { width: 640 })
  const luckLabel = spriteOf(luckStack.canvas, 1.9)
  luckLabel.position.set(padSpec.x, 2.6, padSpec.z)
  luck.add(luckLabel)
  luck.visible = false
  g.add(luck)
  function paintLuck() {
    const l = CONVEYOR_UPGRADE.levels[Math.min(lvl, CONVEYOR_UPGRADE.levels.length - 1)]?.luck ?? 1
    luckLines.length = 0
    luckLines.push({ size: 50, parts: [{ text: 'Conveyor Luck', fill: '#ff6af0' }] }, { size: 56, parts: [{ text: `x${+l.toFixed(2)}`, fill: '#ffffff' }] })
    luckStack.draw()
    luckLabel.material.map.needsUpdate = true
    luckLabel.userData.fit()
  }

  function clearBay(i) {
    const v = bays[i]
    if (!v) return
    g.remove(v.holder)
    if (v.label) {
      g.remove(v.label)
      dropSprite(v.label)
    }
    bays[i] = null
  }

  function buildBlock(i, s) {
    const t = BLOCK_THEMES[s.t]
    if (!t) return null
    const holder = new Group()
    holder.position.copy(bayBase[i])
    const cube = new Mesh(blockGeo, base.blockMaterial(s.t, MUT[s.v] ? s.v : undefined))
    cube.castShadow = true
    cube.position.y = GAME.placedSize / 2
    holder.add(cube)
    const hpCanvas = makeCanvas(512, 220)
    paintHpLabel(hpCanvas, t, s.hp, s.max)
    const hp = spriteOf(hpCanvas, 1.55)
    hp.position.y = GAME.placedSize + 1.25
    holder.add(hp)
    if (tierOf(t.rarity) >= 1) holder.add(sparkleField({ count: 10, center: { x: 0, y: 0, z: 0 }, box: { x: 2.4, y: 2.6, z: 2.4 }, rise: 0.6, life: 1.8, size: 0.22, color: t.glow, seed: 70 + i }))
    g.add(holder)
    fontReady.then(() => bays[i]?.holder === holder && repaintHp(i))
    return { kind: 'b', holder, cube, hp, hpCanvas, theme: s.t, hpNow: s.hp, max: s.max, punch: 0, pop: 0 }
  }
  function repaintHp(i) {
    const v = bays[i]
    paintHpLabel(v.hpCanvas, BLOCK_THEMES[v.theme], v.hpNow, v.max)
    v.hp.material.map.needsUpdate = true
  }

  function buildCarView(i, s, reveal) {
    const holder = new Group()
    holder.position.copy(bayBase[i])
    holder.rotation.y = carYaw(i)
    const spin = new Group()
    holder.add(spin)
    let car
    try {
      car = buildCar(s.l)
    } catch {
      return null // a look this client does not know
    }
    car.scale.setScalar(GAME.carScale)
    spin.add(car)
    const tier = tierOf(s.r)
    if (tier >= 2) holder.add(sparkleField({ count: 8 + tier * 3, center: { x: 0, y: 0, z: 0 }, box: { x: 6.5, y: 2.4, z: 3.2 }, rise: 0.5, life: 2.2, size: 0.2, color: RARITY_COLORS[s.r], seed: 300 + i }))
    g.add(holder)
    const stack = paintStack(carLines(s), { width: 640 })
    const label = spriteOf(stack.canvas, 2.4)
    label.position.copy(bayBase[i])
    label.position.y += 4.6
    g.add(label)
    fontReady.then(() => {
      if (bays[i]?.label !== label) return
      stack.draw()
      label.material.map.needsUpdate = true
      label.userData.fit()
    })
    if (reveal) spin.scale.setScalar(0.01)
    return { kind: 'c', holder, spin, label, pop: reveal ? 0 : 1 }
  }

  function applyBay(i, s) {
    const key = s ? JSON.stringify(s) : ''
    const v = bays[i]
    if (v?.key === key) return
    // Same block, less health: a hit landed (punch + chips), no rebuild.
    if (v?.kind === 'b' && s?.k === 'b' && s.t === v.theme && s.max === v.max) {
      if (s.hp < v.hpNow) {
        v.punch = 1
        const w = g.localToWorld(bayBase[i].clone())
        bursts?.emit(w.x, w.y + GAME.placedSize * 0.6, w.z, BLOCK_THEMES[s.t].glow, 8, 4)
      }
      v.hpNow = s.hp
      v.key = key
      repaintHp(i)
      return
    }
    const wasBlock = v?.kind === 'b'
    clearBay(i)
    if (!s) return
    const next = s.k === 'b' ? buildBlock(i, s) : buildCarView(i, s, wasBlock)
    if (!next) return
    next.key = key
    bays[i] = next
    if (wasBlock && s.k === 'c' && bursts) {
      // the block broke into this car
      const w = g.localToWorld(bayBase[i].clone())
      const color = RARITY_COLORS[s.r] ?? '#ffffff'
      bursts.emit(w.x, w.y + 1.4, w.z, color, 30, 7)
      bursts.emit(w.x, w.y + 2.0, w.z, '#ffffff', 16, 8)
    }
  }

  return {
    // snapshot: the parsed roster `base` (or null for a free garage).
    apply(snap) {
      const next = new Set(snap?.unl ?? [])
      for (const i of unlocked) if (!next.has(i)) base.lockBay(i)
      for (const i of next) if (!unlocked.has(i)) base.unlockBay(i, lvl >= 0) // sparks only when bought while watched
      unlocked = next
      const level = snap ? snap.lvl ?? 0 : 0
      if (level !== lvl) {
        const animate = lvl >= 0 && !!snap
        lvl = level
        base.setLuck(CONVEYOR_UPGRADE.levels[Math.min(level, CONVEYOR_UPGRADE.levels.length - 1)]?.luck ?? 1)
        base.setConveyorSkin(skinFor(level), animate)
        paintLuck()
      }
      luck.visible = !!snap
      base.setIncome(snap ? Math.round((snap.inc ?? 0) * 100) / 100 : 0)
      for (let i = 0; i < bays.length; i++) applyBay(i, snap?.bays?.[i] ?? null)
    },
    update(dt) {
      for (const v of bays) {
        if (!v) continue
        if (v.kind === 'b' && v.punch > 0) {
          v.punch = Math.max(0, v.punch - dt * 7)
          v.cube.scale.set(1 + v.punch * 0.1, 1 - v.punch * 0.12, 1 + v.punch * 0.1)
        } else if (v.kind === 'c' && v.pop < 1) {
          v.pop = Math.min(1, v.pop + dt / GAME.reveal)
          const k = v.pop
          v.spin.scale.setScalar(Math.max(0.01, 1 + 2.9 * Math.pow(k - 1, 3) + 1.9 * Math.pow(k - 1, 2)))
          v.spin.rotation.y = (1 - (1 - (1 - k) * (1 - k))) * Math.PI * 4
        }
      }
    },
    // Back to a bare free garage (it became the local player's, or nobody's).
    reset() {
      for (let i = 0; i < bays.length; i++) clearBay(i)
      for (const i of unlocked) base.lockBay(i)
      unlocked = new Set()
      lvl = -1
      luck.visible = false
      base.setLuck(1)
      base.setConveyorSkin(0, false)
      base.setIncome(0)
    },
  }
}

// bases: lobby.bases (one per plot).
export function createRemoteBases({ bases, bursts }) {
  const views = bases.map((b) => createView(b, bursts))
  const shown = bases.map(() => null) // per plot: 'mine' | 'free' | `${sessionId}|${base json}`
  const parsed = new Map() // base json -> snapshot

  function snapshotOf(json) {
    if (!json) return null
    let s = parsed.get(json)
    if (s === undefined) {
      try {
        s = JSON.parse(json)
      } catch {
        s = null
      }
      if (parsed.size > 64) parsed.clear()
      parsed.set(json, s)
    }
    return s
  }

  return {
    // myPlot: the local player's plot (-1 offline: then the home garage is the game's and the rest are free).
    update(dt, myPlot, homePlot) {
      const owners = bases.map(() => null)
      const mine = mySessionId()
      roster()?.forEach?.((p, id) => {
        if (id !== mine && p.plot >= 0 && p.plot < owners.length) owners[p.plot] = { id, p }
      })
      const own = myPlot >= 0 ? myPlot : homePlot
      for (let i = 0; i < bases.length; i++) {
        const v = views[i]
        if (i === own) {
          if (shown[i] !== 'mine') {
            if (shown[i] !== null) v.reset()
            shown[i] = 'mine'
          }
          continue
        }
        const o = owners[i]
        const key = o ? `${o.id}|${o.p.base}|${o.p.username}` : 'free'
        if (key !== shown[i]) {
          if (shown[i] === 'mine') v.reset()
          shown[i] = key
          bases[i].setOwner(o ? o.p.username || 'Player' : null)
          v.apply(o ? snapshotOf(o.p.base) : null)
        }
        v.update(dt)
      }
    },
  }
}
