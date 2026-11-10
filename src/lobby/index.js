import { Group } from 'three'
import { DETAIL, LOBBY } from '../config.js'
import { buildGround, updateBelts } from './ground.js'
import { buildNature } from './nature.js'
import { buildLeaderboards } from './leaderboards.js'
import { buildSouthPlaza } from './southplaza.js'
import { buildBase } from './base.js'
import { createBursts, sparkleField, updateFields } from './fx.js'

// The whole lobby: island + road + plazas + plots (ground.js), scenery
// (nature.js), the leaderboards (north plaza), the stalls / Fuse Machine /
// Spin Wheel / event board (south plaza), ambient pollen that follows the
// player, and a burst pool for one-off pops.

export function buildLobby(scene, preset) {
  buildGround(scene)
  buildNature(scene)
  const boards = buildLeaderboards(scene)
  const plaza = buildSouthPlaza(scene)

  const pollen = new Group()
  pollen.add(sparkleField({ count: Math.round(70 * preset.particles), center: { x: 0, y: 0.2, z: 0 }, box: { x: 26, y: 5, z: 26 }, rise: 0.12, life: 7, drift: 1.2, size: 0.1, color: '#fff6c8', opacity: 0.7, soft: true, seed: 3 }))
  scene.add(pollen)
  const bursts = createBursts()
  scene.add(bursts.points)
  // A garage on every plot: the local player's game takes one (main.js moves it when the server
  // hands out another), the others show the other players' garages or stand free.
  const bases = LOBBY.plots.map((plot, i) => {
    const b = buildBase(scene, plot, bursts)
    b.index = i
    b.setLit(false)
    return b
  })
  const base = bases[LOBBY.homePlot]
  const spots = { ...LOBBY.spots, plot: base.spot }

  let night = 0
  let activeZone = null
  let lastZone = null
  return {
    zones: plaza.zones,
    // The north plaza's boards: { kind ('cash' | 'playtime' | 'income'), setEntries([{ name, value }]) }.
    boards: boards.boards.map((b, i) => ({ kind: LOBBY.leaderboards[i].kind, setEntries: b.setEntries })),
    setEventBoard: (info) => plaza.setEventBoard(info),
    spots,
    bursts,
    base, // the home garage (LOBBY.homePlot)
    bases,
    get activeZone() {
      return activeZone
    },
    // nightTarget: 0/1 from lighting.isNight(); onZone(zone|null) fires when the player enters/leaves a ring.
    update(dt, elapsed, playerPos, nightTarget, onZone) {
      updateFields(elapsed)
      updateBelts(dt)
      bursts.update(dt)
      pollen.position.set(playerPos.x, 0, playerPos.z)
      night += (nightTarget - night) * Math.min(1, dt * 1.5)
      boards.setNight(night)
      plaza.setNight(night)
      for (const b of bases) {
        // far garages drop to the cheap version (with a margin so they do not flicker at the edge)
        const d = Math.hypot(playerPos.x - b.spot.x, playerPos.z - b.spot.z)
        b.setDetail(b.detail ? d < DETAIL.baseNear + DETAIL.baseHysteresis : d < DETAIL.baseNear - DETAIL.baseHysteresis)
        b.setNight(night)
        b.update(dt, elapsed)
      }
      activeZone = null
      for (const z of plaza.zones) if (Math.hypot(playerPos.x - z.x, playerPos.z - z.z) < z.r && playerPos.y < 2) activeZone = z
      if (activeZone !== lastZone) {
        if (activeZone?.id === 'spin') plaza.spin()
        if (activeZone) bursts.emit(activeZone.x, 0.6, activeZone.z, '#ffffff', 18, 3)
        onZone?.(activeZone)
        lastZone = activeZone
      }
      plaza.update(dt, elapsed, activeZone)
    },
  }
}
