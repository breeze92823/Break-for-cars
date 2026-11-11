import { ACESFilmicToneMapping, Clock, Group, PCFShadowMap, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three'
import { CAMERA, COARSE_POINTER, graphicsPreset, RENDER } from './config.js'
import * as bloxity from './bloxity.js'
import { install as installInput, isLocked, onKey } from './input.js'
import { installTouch } from './touch.js'
import { installWakeLock } from './wakelock.js'
import { createPlayerBody, interpolate as interpolatePlayer, player, resetPlayer, respawn, setHome } from './player.js'
import { setCameraSensitivity, setView, syncYawToPlayer, update as updateCamera } from './camera.js'
import { onModeChanged, toggleMode } from './modes.js'
import { bodyCount, initPhysics, stepPhysics } from './physics.js'
import { createLighting } from './lighting.js'
import { createWorld } from './world.js'
import { buildLobby } from './lobby/index.js'
import { createPlayerFx } from './lobby/playerfx.js'
import { fxBoost, fxView } from './lobby/fx.js'
import { createHud } from './hud/hud.js'
import { LOBBY } from './config.js'
import { createPostFx } from './postfx.js'
import { setNeonBloom } from './propkit.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { createGame } from './game/game.js'
import * as sfx from './game/audio.js'
import { updateMoveSounds } from './game/movesfx.js'
import { setMusic, setMusicVolume } from './game/music.js'
import { gameSettings, onGameSettings } from './game/settings.js'
import { playEmote } from './avatar/emotes.js'
import { createBubble } from './bubble.js'
import { claimFreeCar, hasServer, initNet, myPlot, net, sendEmote, sendNewsSeen, sendSwing, sendTutorial, verifyAdReward } from './net.js'
import { createRemotePlayers } from './remotePlayers.js'
import { createRemoteBases } from './remoteBases.js'
import { LEADERBOARDS, NET } from './config.js'

// Boot order: Bloxity SDK -> renderer -> Rapier (async wasm) -> ground + sky + lighting,
// player body -> avatar (async, swaps in when ready) -> loop. The SDK is optional at every step.
let lighting = null
let renderer = null
let postfx = null

// Settings come from the portal's settings menu (or their defaults offline). The game draws no
// settings or pause menu of its own (Bloxity platform UI rules).
const fpsEl = Object.assign(document.createElement('div'), { className: 'fps-counter' })
fpsEl.style.cssText = 'position:fixed;right:calc(env(safe-area-inset-right) + 8px);bottom:calc(env(safe-area-inset-bottom) + 4px);z-index:30;font:600 12px Fredoka,sans-serif;color:#fff;text-shadow:0 1px 2px #000;pointer-events:none;display:none'
document.body.appendChild(fpsEl)
let adBreak = false // an ad is playing over the game: paused and silent
const volumes = { master: 0.8, music: 0.8 }
// Bloxity's sliders x the game's own Settings switches (game/settings.js: Music / Sounds).
function applyVolumes() {
  sfx.setVolume(adBreak || !gameSettings.sounds ? 0 : volumes.master)
  const music = adBreak || !gameSettings.music ? 0 : volumes.master * volumes.music
  setMusicVolume(music)
  setMusic(music > 0)
}
function applySetting(key, value) {
  if (key === 'camera_sensitivity') setCameraSensitivity(value)
  else if (key === 'master_volume') (volumes.master = value / 100), applyVolumes()
  else if (key === 'music_volume') (volumes.music = value / 100), applyVolumes()
  else if (key === 'show_fps') fpsEl.style.display = value ? 'block' : 'none'
  else if (key === 'graphics_quality' && renderer) {
    const next = graphicsPreset(value)
    renderer.shadowMap.enabled = next.shadows
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, next.dpr))
    lighting?.setShadows(next)
    postfx?.configure(next)
    setNeonBloom(next.bloom)
    fxBoost.value = next.bloom ? 2.6 : 1.2
    postfx?.setSize(window.innerWidth, window.innerHeight)
    resize()
  }
}
bloxity.onSetting(applySetting)
onGameSettings(applyVolumes)
bloxity.init()
// Ad breaks (Bloxity starts them, even unasked): pause the game and mute it until the break ends.
bloxity.onAdBreak((on) => {
  adBreak = on
  applyVolumes()
})
// The portal took the mouse (its menu opened over the game): let go of ours too.
bloxity.onPointerLock((locked) => {
  if (!locked && isLocked()) document.exitPointerLock?.()
})

// --- Renderer ---------------------------------------------------------------
const preset = graphicsPreset(bloxity.settings.graphics_quality)
renderer = new WebGLRenderer({ antialias: preset.antialias, powerPreference: 'high-performance' })
renderer.outputColorSpace = SRGBColorSpace
renderer.toneMapping = ACESFilmicToneMapping
renderer.toneMappingExposure = RENDER.exposure
renderer.shadowMap.enabled = preset.shadows
renderer.shadowMap.type = COARSE_POINTER ? PCFShadowMap : PCFSoftShadowMap // soft filtering costs a lot on phones
renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.dpr))
document.body.appendChild(renderer.domElement)
installInput(() => bloxity.showMenu(), renderer.domElement) // Esc opens the portal menu

const scene = new Scene()
const camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far)
postfx = createPostFx(renderer, scene, camera)
postfx.configure(preset)

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight)
  postfx.setSize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  // particle sizes are in metres: pixels per metre at 1 m from the camera
  fxView.value = (renderer.getPixelRatio() * window.innerHeight) / 2 / Math.tan((camera.fov * Math.PI) / 360)
}
window.addEventListener('resize', resize)
resize()

for (const key of Object.keys(bloxity.settings)) applySetting(key, bloxity.settings[key])

// --- Physics + ground + sky --------------------------------------------------
bloxity.loadingStep('Starting physics')
await initPhysics()

lighting = createLighting(scene, renderer, preset)
const world = createWorld(scene) // the sea and clouds
bloxity.loadingStep('Building the island')
const lobby = buildLobby(scene, preset)
createPlayerBody()
syncYawToPlayer()

// --- Player avatar ----------------------------------------------------------
// The Bloxity base rig (player.glb; procedural fallback if it fails), dressed
// with the signed-in player's equipped cosmetics and body proportions. It
// rebuilds on customizer edits and sign-in/out.
const playerGroup = new Group()
scene.add(playerGroup)
const playerFx = createPlayerFx(playerGroup)
let avatar = null
let animator = null
let generation = 0
let avatarReady = false

function setAvatar(next) {
  if (avatar) playerGroup.remove(avatar)
  disposeAnimator(animator)
  avatar = next
  playerGroup.add(avatar)
  animator = makeAnimator(avatar)
}

setAvatar(buildDefaultCharacter()) // visible immediately; replaced once the rig loads

async function loadAvatar() {
  // The SDK fires twice per change (optimistic + confirmed); only the newest load may land.
  const mine = ++generation
  try {
    const group = await loadBaseCharacter()
    if (mine !== generation) return
    const equipped = bloxity.authState.user ? bloxity.getEquippedAvatar() : null
    await attachEquippedAccessories(group, equipped, { skinTextureUrl: bloxity.getSkinTextureUrl() })
    if (mine !== generation) return
    applyProportions(group, bloxity.authState.user ? bloxity.getProportions() : null)
    setAvatar(group)
  } finally {
    if (mine === generation) avatarReady = true
  }
}

let signedIn = null
bloxity.subscribeAuth((s) => {
  const now = !!s.user
  if (now !== signedIn) {
    signedIn = now
    loadAvatar() // also runs once at start to swap in the real rig
  }
})
bloxity.onAvatarChanged(loadAvatar)
bloxity.onProportionsChanged(() => applyProportions(avatar, bloxity.getProportions()))
bloxity.onRespawnRequest(respawn)

// Bloxity emotes: played on our character and relayed so the others play it too.
bloxity.onEmote((id) => {
  playEmote(() => animator, id)
  sendEmote(id)
})
// Chat bubbles over heads: ours, or the other player whose verified Bloxity id sent it.
const myBubble = createBubble(playerGroup, 3.15)
let remotePlayers = null
bloxity.onChat((m) => {
  if (m.isLocalPlayer) myBubble.say(m.text, m.seconds)
  else remotePlayers?.say(m.userId, m.text, m.seconds)
})

// --- HUD ----------------------------------------------------------------------------
function goTo(spot) {
  resetPlayer({ x: spot.x, y: 0.4, z: spot.z }, spot.facing)
  syncYawToPlayer()
}
const spinSpot = (() => {
  const w = LOBBY.spinWheel
  return { x: w.x + Math.sin(w.yaw) * 6, z: w.z + Math.cos(w.yaw) * 6, facing: w.yaw + Math.PI }
})()
let game = null
const hud = createHud({
  onShop: () => goTo(lobby.spots.shop),
  onPlot: () => goTo(game ? game.base.spot : lobby.spots.plot),
  onSpin: () => (game ? game.toggleSpin() : goTo(spinSpot)),
  onCollectAll: () => game?.collectAll(),
  onAutoSwing: (on) => game?.setAutoSwing(on),
  onSlot: (i) => game?.slot(i),
  onDaily: () => game?.toggleDaily(),
  onSettings: () => game?.toggleSettings(),
  onIndex: () => game?.toggleIndex(),
  onFreeCar: () => game?.toggleFreeCar(),
})
for (const b of lobby.bases) b.onAnnounce((msg) => b === game?.base && hud.announce(msg))

// --- Game rules: buy blocks, place, break, cars earn (game/game.js) -----------------
{
  game = createGame({
    scene,
    camera,
    canvas: renderer.domElement,
    base: lobby.base,
    bursts: lobby.bursts,
    hud,
    playerGroup,
    playerFx,
    getAvatar: () => avatar,
    getAnimator: () => animator,
    lobby, // the event system drives the "Next Event" board
    onSwing: sendSwing,
    onTutorialStep: sendTutorial, // saved for the account (backend tutorial.ts)
    claimFreeCar: () => (net.connected ? claimFreeCar() : Promise.resolve(null)), // checked by the server (backend freeCar.ts)
    onNewsSeen: sendNewsSeen, // saved for the account (backend news.ts)
    nearbyPlayer: () => remotePlayers?.nearest(player.position, 4.5),
    rewardedAd: {
      available: () => net.connected && bloxity.canShowRewarded(),
      // A rewarded ad pays out only once the game server has checked its token with Bloxity.
      async watch() {
        const r = await bloxity.showRewarded('free-spin')
        return r.status === 'completed' && !!r.rewardToken && (await verifyAdReward(r.rewardToken))
      },
    },
  })
}
// The billboard over our garage shows our name.
bloxity.subscribeAuth(() => game.base.setOwner(bloxity.displayName() === 'Offline' ? 'Player' : bloxity.displayName()))

// --- Multiplayer: six garages, one per player (net.js; backend ../Break-for-cars-backend) -------
remotePlayers = createRemotePlayers(scene, { blockMaterial: (t, v) => lobby.base.blockMaterial(t, v) })
const remoteBases = createRemoteBases({ bases: lobby.bases, bursts: lobby.bursts })
let playTime = 0 // s this session; reported in minutes
initNet({
  pose: () => ({ x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.facing, speed: Math.hypot(player.velocity.x, player.velocity.z) }),
  loadout: () => game.loadout(),
  base: () => game.baseSnapshot(),
  stats: () => ({ cash: Math.floor(game.money), income: Math.floor(game.income), playtime: Math.floor(playTime / 60) }),
  plot: () => game.base.index,
  tutorial: () => game.tutorialStep,
  onTutorial: (step) => game.syncTutorial(step),
  freeCar: () => game.freeCarSnapshot(),
  onFreeCar: (msg) => game.syncFreeCar(msg),
  news: () => game.newsSeen,
  onNews: (msg) => game.syncNews(msg),
})
// The "New Update!" window waits for the server's word on a signed-in account (it may have seen it on
// another device); with no server, or no answer in time, this browser's own record decides.
setTimeout(() => game.decideNews(), hasServer() ? 8000 : 2500)
// The server hands out the garages: move the game (and us, when we were home) to ours.
function followPlot(plot) {
  const next = lobby.bases[plot]
  if (!next || next === game.base) return
  const prev = game.base
  const home = Math.hypot(player.position.x - prev.spot.x, player.position.z - prev.spot.z) < 70
  game.moveTo(next)
  // moveTo cleared the garage we left; if someone else holds it, draw theirs again from scratch.
  remoteBases.forget(prev.index)
  next.setOwner(bloxity.displayName() === 'Offline' ? 'Player' : bloxity.displayName())
  setHome(next.spot.x, next.spot.z, next.spot.facing)
  if (home) goTo(next.spot)
  hud.toast('This is your garage!')
}
setHome(game.base.spot.x, game.base.spot.z, game.base.spot.facing)

// The north plaza's boards show Bloxity's standings (Cash, PlayTime, Total Income).
const plazaBoards = { cash: 'cash', playtime: 'playtime', income: 'income' }
async function refreshBoards() {
  for (const b of lobby.boards ?? []) {
    const id = plazaBoards[b.kind]
    if (!id || !LEADERBOARDS.some((l) => l.id === id)) continue
    const rows = await bloxity.topScores(id)
    if (rows?.length) b.setEntries(rows)
  }
}
refreshBoards()
setInterval(refreshBoards, NET.leaderboardEvery * 1000)
// Fires when the player steps into a plaza ring (or out: zone = null).
const onZone = (zone) => {
  game?.setPickShopZone(zone?.id === 'pickaxes') // the Pickaxes Shop stall opens "Buy Pickaxes"
  if (zone && !['pickaxes', 'sell', 'fuse', 'spin'].includes(zone.id)) hud.toast(zone.label) // those open their own windows
  game?.onZone(zone) // the Sell stall sells the car in hand
}

// --- Modes + keys --------------------------------------------------------------
onModeChanged((mode) => {
  playerGroup.visible = mode !== 'player' // first person: you are the camera
})
onKey('KeyV', () => (sfx.click(), toggleMode()))
onKey('KeyN', () => (sfx.click(), lighting.toggleDayNight()))
onKey('KeyR', respawn)
// Escape opens Bloxity's own menu (input.js); P is Bloxity's pause key on CrazyGames: never bound here.
installWakeLock()
installTouch({ mode: toggleMode, day: () => lighting.toggleDayNight(), respawn, hit: () => game?.swing() })

// --- Loop -------------------------------------------------------------------
const clock = new Clock()
const fps = { frames: 0, t: 0 }
let shownLoading = true
let readySince = 0

// stepDt: dev tests step the loop by hand with a fixed dt (a hidden tab gets no rAF).
function frame(stepDt) {
  const real = Math.min(clock.getDelta(), 0.1) // clamp huge frames (tab switch, breakpoint)
  // An ad break pauses the world (the frame still draws under Bloxity's ad).
  const dt = adBreak ? 0 : typeof stepDt === 'number' ? stepDt : real
  const elapsed = clock.elapsedTime
  if (!adBreak && !document.hidden) playTime += real
  fps.frames++
  if ((fps.t += real) >= 0.5) {
    if (fpsEl.style.display !== 'none') fpsEl.textContent = `${Math.round(fps.frames / fps.t)} FPS`
    fps.frames = fps.t = 0
  }
  if (dt === 0) {
    postfx.render()
    return
  }

  stepPhysics(dt) // runs the player controller + world at the fixed rate, interpolates bodies
  interpolatePlayer()
  updateMoveSounds(dt) // footsteps, jump, landing, respawn

  const p = player.renderPosition
  playerGroup.position.set(p.x, p.y, p.z)
  playerGroup.rotation.y = player.facing
  animator?.update(dt, {
    grounded: player.grounded,
    speed: Math.hypot(player.velocity.x, player.velocity.z),
    verticalVelocity: player.velocity.y,
    turn: 0,
    busy: game?.busy,
  })

  // The garage the server gave us (the others' garages are drawn first, so ours is clear when we move in).
  const plot = myPlot()
  remoteBases.update(dt, plot, game.base.index)
  if (plot >= 0) followPlot(plot)
  remotePlayers.update(dt, elapsed, player.position)
  myBubble.update(dt)
  // Ad banners around the game's windows while one is open; the gameplay screen otherwise.
  if (!shownLoading) bloxity.showScreen(game.panelOpen() ? 'panel' : 'gameplay')

  game?.update(dt, elapsed)
  updateCamera(camera, dt)
  game?.applyShake(camera, dt)
  world.update(dt, elapsed)
  lobby.update(dt, elapsed, player.position, lighting.isNight() ? 1 : 0, onZone)
  hud.update(dt)
  playerFx.update(dt, elapsed)
  lighting.update(dt, playerGroup.position)
  postfx.render()

  // Loading ends once the scene has drawn and the avatar has had its chance (max ~5 s).
  if (shownLoading) {
    readySince += dt
    if (avatarReady || readySince > 5) {
      shownLoading = false
      bloxity.notifyFirstFrame()
    }
  }
}
renderer.setAnimationLoop(() => frame())

window.addEventListener('beforeunload', bloxity.teardown)

// Dev-only console hook, e.g. __game.teleport(-24, 0, 6, Math.PI / 2)
if (import.meta.env.DEV) {
  const teleport = (x, y, z, facing = player.facing) => {
    resetPlayer({ x, y, z }, facing)
    syncYawToPlayer()
  }
  window.__game = { player, scene, renderer, camera, postfx, bodies: bodyCount, toggleMode, teleport, lobby, lighting, setView, game, frame, hud, net, remotePlayers, followPlot, playerGroup, animator: () => animator }
}
