import { ACESFilmicToneMapping, Clock, Group, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three'
import { CAMERA, graphicsPreset, RENDER } from './config.js'
import * as bloxity from './bloxity.js'
import { install as installInput, onKey } from './input.js'
import { installTouch } from './touch.js'
import { createPlayerBody, interpolate as interpolatePlayer, player, resetPlayer, respawn } from './player.js'
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

// Boot order: Bloxity SDK -> renderer -> Rapier (async wasm) -> ground + sky + lighting,
// player body -> avatar (async, swaps in when ready) -> loop. The SDK is optional at every step.
let lighting = null
let renderer = null
let postfx = null

// Settings come from the portal's settings menu (or their defaults offline).
function applySetting(key, value) {
  if (key === 'camera_sensitivity') setCameraSensitivity(value)
  else if (key === 'fullscreen') bloxity.requestFullscreen(value)
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
bloxity.init()

// --- Renderer ---------------------------------------------------------------
const preset = graphicsPreset(bloxity.settings.graphics_quality)
renderer = new WebGLRenderer({ antialias: preset.antialias, powerPreference: 'high-performance' })
renderer.outputColorSpace = SRGBColorSpace
renderer.toneMapping = ACESFilmicToneMapping
renderer.toneMappingExposure = RENDER.exposure
renderer.shadowMap.enabled = preset.shadows
renderer.shadowMap.type = PCFSoftShadowMap
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

// --- HUD ----------------------------------------------------------------------------
function goTo(spot) {
  resetPlayer({ x: spot.x, y: 0.4, z: spot.z }, spot.facing)
  syncYawToPlayer()
}
const spinSpot = (() => {
  const w = LOBBY.spinWheel
  return { x: w.x + Math.sin(w.yaw) * 6, z: w.z + Math.cos(w.yaw) * 6, facing: w.yaw + Math.PI }
})()
const hud = createHud({
  onShop: () => goTo(lobby.spots.shop),
  onPlot: () => goTo(lobby.spots.plot),
  onSpin: () => goTo(spinSpot),
})
const onZone = (zone) => {
  if (zone) hud.toast(zone.label)
}

// --- Modes + keys --------------------------------------------------------------
onModeChanged((mode) => {
  playerGroup.visible = mode !== 'player' // first person: you are the camera
})
onKey('KeyV', toggleMode)
onKey('KeyN', () => lighting.toggleDayNight())
onKey('KeyR', respawn)
installTouch({ mode: toggleMode, day: () => lighting.toggleDayNight(), respawn })

// --- Loop -------------------------------------------------------------------
const clock = new Clock()
let shownLoading = true
let readySince = 0

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1) // clamp huge frames (tab switch, breakpoint)
  const elapsed = clock.elapsedTime

  stepPhysics(dt) // runs the player controller + world at the fixed rate, interpolates bodies
  interpolatePlayer()

  const p = player.renderPosition
  playerGroup.position.set(p.x, p.y, p.z)
  playerGroup.rotation.y = player.facing
  animator?.update(dt, {
    grounded: player.grounded,
    speed: Math.hypot(player.velocity.x, player.velocity.z),
    verticalVelocity: player.velocity.y,
    turn: 0,
  })

  updateCamera(camera, dt)
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
})

window.addEventListener('beforeunload', bloxity.teardown)

// Dev-only console hook, e.g. __game.teleport(-24, 0, 6, Math.PI / 2)
if (import.meta.env.DEV) {
  const teleport = (x, y, z, facing = player.facing) => {
    resetPlayer({ x, y, z }, facing)
    syncYawToPlayer()
  }
  window.__game = { player, scene, renderer, camera, postfx, bodies: bodyCount, toggleMode, teleport, lobby, lighting, setView }
}
