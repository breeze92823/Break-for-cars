// Every tunable constant lives here; the rest of src/ holds no theme values.

// --- Identity -------------------------------------------------------------
export const GAME_SLUG = 'bowling-roll' // slug registered on bloxity.io
export const GAME_TITLE = 'Bowling Roll'

// Forces the Bloxity SDK and avatar CDN to be treated as unavailable (see .env.example).
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'

// --- World (metres: +X east, +Z south, +Y up) -------------------------------
export const GROUND_Y = 0
// The ground (world.js): one convex slab of land in a sea. The shoreline sweeps from
// the front edge (-Z) back toward +Z on both wings.
export const BEACH = {
  front: -46, // z of the shoreline at the front edge
  back: 90, // z of the back edge
  halfWidth: 75, // x extent of the wings
  wingZ: 24, // z of the shoreline at the far left/right ends
  gateEdge: 21.5, // half-width of the straight shoreline at the front edge
  depth: 4, // slab thickness above the sea floor
  tile: 18, // m per sand texture tile
  fenceHeight: 3, // invisible wall around the sand so nobody walks into the sea
}
export const WATER = { level: -1.4, size: 1400, color: '#14a6f0', shallow: '#6fe6ff' }
export const SPAWN = { x: 0, y: 0.4, z: 40 }

// --- Lobby (lobby/*.js): the lego island ---------------------------------------
// One flat island of studded grass. A two-lane road runs north-south between two
// plazas: the north plaza holds the three global leaderboards, the south plaza
// the market stalls (Robux Shop, Pickaxes Shop, Sell), the Fuse Machine, the
// Spin Wheel and the "Next Event" billboard. Six player plots flank the road,
// three on each side; until bases are built they are empty grey studded slabs
// in a brown border.
export const LOBBY = {
  stud: { pitch: 0.5, radius: 0.3 }, // m between studs; stud radius as a fraction of the pitch
  island: { minX: -128, maxX: 128, minZ: -196, maxZ: 204, depth: 7, fenceHeight: 4 },
  colors: {
    grass: '#2fc41c',
    grassSide: '#279b19',
    road: '#3a4050',
    roadArrow: '#20242e',
    curb: '#a7b3dc',
    plot: '#8590bd',
    plotBorder: '#a35a3a',
    trunk: '#8f5833',
    trunkDark: '#71431f',
    leaves: '#35c21f',
    leavesLight: '#4fd82c',
    rock: '#9eadd6',
    rockDark: '#7f8cb6',
    wood: '#c07a45',
    woodDark: '#9a5a2f',
  },
  road: { halfWidth: 5.2, curb: 1.4, south: 132, north: -132, top: 0.08, curbTop: 0.32 },
  northPlaza: { minX: -34, maxX: 34, minZ: -164, maxZ: -132 },
  southPlaza: { minX: -42, maxX: 42, minZ: 132, maxZ: 172 },
  // Plots: width across (x) and depth along the road (z), and the brown border.
  plotW: 50,
  plotD: 60,
  plotBorder: 2.6,
  plots: [
    { x: -46, z: -74 },
    { x: -46, z: 0 },
    { x: -46, z: 74 },
    { x: 46, z: -74 },
    { x: 46, z: 0 },
    { x: 46, z: 74 },
  ],
  leaderboards: [
    { x: -17, z: -156, yaw: 0.18, kind: 'cash' },
    { x: 0, z: -159, yaw: 0, kind: 'playtime' },
    { x: 17, z: -156, yaw: -0.18, kind: 'income' },
  ],
  // South plaza props (seen from the road: Fuse Machine east, Spin Wheel west).
  stalls: [
    { x: 11, z: 162, kind: 'robux', label: 'Robux Shop', awning: '#ffd21a', ring: '#ffe14a', npc: 'suit' },
    { x: 0, z: 163, kind: 'pickaxes', label: 'Pickaxes Shop', awning: '#f0202a', ring: '#ff3344', npc: 'miner' },
    { x: -11, z: 162, kind: 'sell', label: 'Sell', awning: '#22d52a', ring: '#33ff55', npc: 'chef' },
  ],
  eventBoard: { x: 0, z: 178, yaw: Math.PI, every: 600 }, // countdown repeats every `every` s
  fuseMachine: { x: 25, z: 156, yaw: -Math.PI / 2 - 0.25, needs: 4 },
  spinWheel: { x: -25, z: 155, yaw: Math.PI / 2 + 0.3 },
  // Teleport targets for the HUD buttons ({x, z, facing}); facing PI = north, 0 = south.
  spots: {
    shop: { x: 0, z: 146, facing: 0 },
    plot: { x: -16, z: 0, facing: -Math.PI / 2 }, // edge of the first plot until plots are assigned
  },
  trees: 44,
  pines: 18,
  rocks: 22,
  bushes: 30,
  seed: 1907,
}

// Block themes: the conveyor's mystery blocks and the HUD's featured block offer.
export const BLOCK_THEMES = {
  gold: { name: 'Lucky Block', base: '#ffcf1f', edge: '#e08a00', mark: '#ffffff', ink: '#c25e00', glow: '#ffd84a' },
  cyan: { name: 'Ice Block', base: '#3fe3ff', edge: '#0a8fd8', mark: '#ffffff', ink: '#075a9e', glow: '#6ff2ff' },
  hacker: { name: 'Hacker Block', base: '#0d1a10', edge: '#21ff4a', mark: '#21ff4a', ink: '#003b0c', glow: '#3dff5e', grid: true },
  divine: { name: 'Divine Block', base: '#ffe27a', edge: '#ffffff', mark: '#ffffff', ink: '#d88a00', glow: '#fff1a8' },
  galaxy: { name: 'Galaxy Block', base: '#6a1fd8', edge: '#d65cff', mark: '#ffffff', ink: '#2a0870', glow: '#c27bff', stars: true },
}
// The HUD's featured block cycles through these, with their price.
export const FEATURED_BLOCKS = [
  { theme: 'hacker', price: 29 },
  { theme: 'divine', price: 4 },
  { theme: 'galaxy', price: 14 },
]

// Car looks used by the shop, the podium, the hotbar and the parked car.
// style: 'super' (wedge), 'hyper' (low, big wing), 'sport' (GT coupe), 'coupe' (hybrid)
export const CARS = {
  yellowSuper: { body: '#ffcc0f', accent: '#1b1b1f', style: 'super', rim: '#2a2a2e' },
  whiteHyper: { body: '#f4f6fb', accent: '#1d2330', style: 'hyper', rim: '#c9ced8' },
  goldenCoupe: { body: '#6f7480', accent: '#1d2028', style: 'sport', rim: '#d8b04a', tag: 'Golden' },
  silverSport: { body: '#b9bfcc', accent: '#252a33', style: 'sport', rim: '#e3e6ec' },
  redSport: { body: '#e8141b', accent: '#1b1b1f', style: 'super', rim: '#25262b' },
  blueCoupe: { body: '#8d99b4', accent: '#1b2533', style: 'coupe', rim: '#2c3442', trim: '#3f8cff' },
  orangeHyper: { body: '#ff4a12', accent: '#141418', style: 'hyper', rim: '#1f1f24' },
  greenSuper: { body: '#7ee81c', accent: '#16181c', style: 'super', rim: '#25262b' },
  bolido: { body: '#11151d', accent: '#0a0d12', style: 'hyper', rim: '#151a22', neon: '#18e8ff' },
}
// Placeholder HUD state until the economy exists (matches the reference layout).
export const HUD_DEMO = {
  money: 517.15e9,
  spins: 1,
  hotbar: [
    { car: 'yellowSuper', price: 3.94e6 },
    { car: 'whiteHyper', price: 26e6 },
    { car: 'goldenCoupe', price: 16, tag: 'Golden' },
    { car: 'silverSport', price: 2.67e6 },
    { car: 'redSport', price: 800 },
    { car: 'blueCoupe', price: 48.1e3 },
  ],
  freeCar: 'blueCoupe',
  offers: { starterPack: 19, opPickaxe: 159 },
}
export const SPAWN_FACING = Math.PI // yaw the character faces on spawn (PI = toward -Z)

// --- Player modes (modes.js) -------------------------------------------------
// 'character' = third-person chase cam with the avatar on screen.
// 'player' = first-person, the camera is the player's eyes and the avatar is hidden.
export const MODES = ['character', 'player']
export const START_MODE = 'character'

// --- Physics (physics.js, player.js) ------------------------------------------
export const PHYSICS = {
  gravity: -22, // m/s^2 for dynamic bodies and the player
  fixedStep: 1 / 60, // s per physics tick; rendering interpolates between ticks
  maxSubSteps: 5, // a long frame never runs more ticks than this
  walkSpeed: 8, // m/s
  sprintSpeed: 14, // m/s with Shift held
  accel: 70, // m/s^2 toward the target velocity on the ground
  airAccel: 22, // m/s^2 steering while airborne
  decel: 60, // m/s^2 when no key is held
  turnSpeed: 12, // rad/s the body turns toward its heading
  jumpSpeed: 8.5, // m/s
  coyoteTime: 0.1, // s after leaving a ledge a jump still counts
  jumpBuffer: 0.12, // s a jump pressed before landing is remembered
  stepHeight: 0.45, // m autostep
  maxSlope: 50, // degrees the player can walk up
  snapToGround: 0.4, // m the controller stays glued to downward steps and slopes
  pushMass: 80, // kg the character weighs when shoving crates
  killY: -6, // sank this far: respawn
}
export const PLAYER_DIMS = { radius: 0.75, height: 1.8 } // capsule the character controller moves

// --- Look ------------------------------------------------------------------
export const RENDER = { exposure: 1.0 }
export const FOG = { near: 320, far: 1100 }
// The two lighting moods lighting.js blends between (key N toggles).
export const TIME_OF_DAY = {
  transition: 2.5, // s to blend day <-> night
  day: {
    zenith: '#1576f0',
    horizon: '#a9e2ff',
    sunColor: '#fff4de',
    // Sun + hemi + env together keep the pale sand (#eed39c) near its own tan;
    // much more and ACES washes it (and the props) out to grey-white.
    sunIntensity: 2.4,
    sunElevation: 55, // degrees above the horizon
    sunAzimuth: 35, // degrees, 0 = from +Z
    hemiSky: '#e4f2ff',
    hemiGround: '#8fc46e',
    hemiIntensity: 0.8,
    envIntensity: 0.45,
    lampIntensity: 0,
    stars: 0,
    exposure: 0.95,
  },
  night: {
    zenith: '#050b22',
    horizon: '#24345e',
    sunColor: '#9fb4ff', // the moon
    sunIntensity: 0.55,
    sunElevation: 38,
    sunAzimuth: -60,
    hemiSky: '#3a4c80',
    hemiGround: '#1a1a22',
    hemiIntensity: 0.35,
    envIntensity: 0.25,
    lampIntensity: 30,
    stars: 1,
    exposure: 1.15,
  },
}
export const LIGHT = {
  shadowRange: 40, // half-width of the sun's shadow box around the player
  lampColor: '#ffb35c',
  lampDistance: 22,
}

// Default (fallback) character look, used only when player.glb cannot load.
export const CHARACTER_COLORS = { skin: '#f2c79a', suit: '#2f6fd0', hair: '#4a2f1c' }

export const MATERIAL_PBR = {
  PLAYER: { roughness: 0.7, metalness: 0 },
  GROUND: { roughness: 0.95, metalness: 0 },
}

// --- Graphics presets, picked by the Bloxity graphics_quality setting ----------
export const GRAPHICS_PRESETS = {
  Low: { shadows: false, shadowMap: 512, antialias: false, dpr: 1, bloom: false, particles: 0.35 },
  Medium: { shadows: true, shadowMap: 1024, antialias: false, dpr: 1.25, bloom: false, particles: 0.6 },
  High: { shadows: true, shadowMap: 2048, antialias: true, dpr: 2, bloom: true, particles: 1 },
  Ultra: { shadows: true, shadowMap: 4096, antialias: true, dpr: 2, bloom: true, particles: 1 },
}

// Bloom (postfx.js): only HDR-bright pixels (above threshold, linear, before
// tone mapping) glow: neon rails, waterfall, VIP gate, particles. Sunlit sand
// stays under the threshold.
export const BLOOM = { strength: 0.6, radius: 0.35, threshold: 2.0 }
// Neon materials (propkit.js): k = HDR colour multiplier with bloom on; with
// bloom off they are capped at plainMax so they stay coloured, not white.
export const NEON = { k: 3.5, plainMax: 1.2 }

// Phones and tablets default to a lighter preset when the portal sends no value,
// and any preset is capped there (a phone at DPR 3 renders 9x the pixels; bloom
// is a full-screen multi-pass blur, so it stays off on phones).
export const COARSE_POINTER = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
export const DEFAULT_GRAPHICS = COARSE_POINTER ? 'Medium' : 'High'
export const MOBILE_GRAPHICS_CAP = { dpr: 1.5, shadowMap: 1024, particles: 0.6 }

// The preset to render with on this device.
export function graphicsPreset(name) {
  const p = GRAPHICS_PRESETS[name] ?? GRAPHICS_PRESETS[DEFAULT_GRAPHICS]
  if (!COARSE_POINTER) return p
  const cap = MOBILE_GRAPHICS_CAP
  return { ...p, dpr: Math.min(p.dpr, cap.dpr), shadowMap: Math.min(p.shadowMap, cap.shadowMap), bloom: false, particles: Math.min(p.particles, cap.particles) }
}

// --- Touch controls (touch.js) --------------------------------------------------
export const TOUCH = {
  deadZone: 0.12, // fraction of the joystick radius that does nothing
  lookScale: 1.5, // touch drag pixels -> look, relative to a mouse pixel
  pinchPixelsPerNotch: 30, // finger spread change that equals one wheel notch
}

// --- Camera (camera.js) -------------------------------------------------------
export const CAMERA = {
  fov: 70,
  near: 0.1,
  far: 1200,
  startPitch: 0.14, // radians above the horizon (low chase cam)
  minPitch: -0.35,
  maxPitch: 1.25,
  firstPersonPitch: 1.45, // |pitch| limit looking up/down in player mode
  eyeHeight: 0.92, // eye height as a fraction of player height (player mode)
  distance: 12.4, // resting boom length, m
  minDistance: 2.5, // wheel in past this enters player mode
  maxDistance: 26,
  followLerp: 14, // 1/s: the one smoothing stage, on the point the camera follows
  targetHeight: 1.2, // look-at point as a fraction of player height
  lookSensitivity: 0.0026, // rad per pixel of mouse movement
  zoomStep: 0.9, // m per wheel notch
  zoomEase: 12, // 1/s the zoom glides to its target
  speedFov: 6, // degrees the FOV widens at sprint speed
  speedEase: 3, // 1/s the speed framing eases in and out
  clearEase: 6, // 1/s the boom eases back out once a wall stops blocking it
}

// --- Bloxity (bloxity.js, avatar/) -------------------------------------------------
// SDK setting keys this game listens for; registering a listener makes the control
// appear in the portal's settings menu.
export const SETTINGS = {
  graphics_quality: { def: DEFAULT_GRAPHICS, type: 'enum', values: ['Low', 'Medium', 'High', 'Ultra'] },
  camera_sensitivity: { def: '1', type: 'number', min: 0.1, max: 5 },
  show_fps: { def: 'false', type: 'bool' },
  fullscreen: { def: 'false', type: 'bool' },
}

// The base rig, measured from player.glb: origin at the feet, 6.4 units tall at bind pose.
export const RIG_HEIGHT = 6.4
// Bind-pose values of the rig nodes the SDK proportions drive.
export const RIG = { armOffsetX: 2, legOffsetX: 0.6, neckOffsetY: 0.6 }
// getProportions() ranges, straight from the SDK spec; clamped before they reach the scene graph.
export const PROPORTIONS = {
  height: { def: 1, min: 0.5, max: 1.6 },
  shoulderWidth: { def: 1, min: 0.5, max: 1.5 },
  armLength: { def: 1, min: 0.05, max: 3 },
  legOffsetX: { def: 1, min: -0.7, max: 5 },
  torsoScaleX: { def: 1, min: 0.3, max: 2 },
  neckHeight: { def: 1, min: 0.94, max: 1.2 },
  headScale: { def: 1, min: 0.3, max: 2.6 },
}

// Procedural animation (avatar/animator.js), ported from Clean Leaves for Loot.
// Rotations are radians in CHARACTER space: +X swings a limb backward, +Y yaws, +Z rolls.
const deg = (d) => (d * Math.PI) / 180
export const ANIM = {
  airborneDelay: 0.07, // s off the ground before the air pose (ignores a step down a ledge)
  // Walk -> run is one cycle at two depths; phase advances with distance travelled.
  locomotion: {
    minFrequency: 0.7,
    maxFrequency: 3.6,
    strideDistance: 3.8, // m per cycle
    idleSpeed: 0.6,
    walkSpeed: 2.5,
    runSpeed: 8,
    sprintSpeed: 13,
    hipSwing: { walk: deg(22), run: deg(42), sprint: deg(56) },
    kneeBend: { walk: deg(30), run: deg(58), sprint: deg(72) },
    armSwing: { walk: deg(18), run: deg(36), sprint: deg(52) },
    elbowBend: { walk: deg(14), run: deg(44), sprint: deg(70) },
    torsoTwist: { walk: deg(4), run: deg(7), sprint: deg(9) },
    torsoLean: { walk: deg(3), run: deg(10), sprint: deg(18) },
    headCounterTwist: { walk: deg(2), run: deg(4), sprint: deg(5) },
    torsoRoll: { walk: deg(2), run: deg(3), sprint: deg(3) },
    bob: { walk: 0.03, run: 0.07, sprint: 0.09 }, // m, on the avatar root
    bankAngle: deg(9),
    bankRate: 8,
  },
  idle: {
    breathFrequency: 0.35,
    breathAmount: deg(1.8),
    breathBob: 0.007,
    basePose: {
      ArmL1: { x: deg(-4), z: deg(8) },
      ArmL2: { x: deg(12) },
      ArmR1: { x: deg(-4), z: deg(-8) },
      ArmR2: { x: deg(12) },
      LegL1: { x: deg(-4) },
      LegR1: { x: deg(4) },
    },
  },
  airborne: {
    rise: {
      LegL1: { x: deg(-38) }, LegR1: { x: deg(8) }, LegL2: { x: deg(62) }, LegR2: { x: deg(40) },
      ArmL1: { x: deg(-40), z: deg(34) }, ArmR1: { x: deg(-30), z: deg(-34) },
      ArmL2: { x: deg(30) }, ArmR2: { x: deg(30) }, Spine1: { x: deg(6) },
    },
    fall: {
      LegL1: { x: deg(-14) }, LegR1: { x: deg(10) }, LegL2: { x: deg(22) }, LegR2: { x: deg(18) },
      ArmL1: { x: deg(-70), z: deg(40) }, ArmR1: { x: deg(-60), z: deg(-40) },
      ArmL2: { x: deg(20) }, ArmR2: { x: deg(20) }, Spine1: { x: deg(-4) },
    },
    velocityReference: 8, // m/s vertical speed that reads as fully rising / falling
  },
  landing: {
    duration: 0.16,
    pose: {
      LegL1: { x: deg(-34) }, LegR1: { x: deg(-34) }, LegL2: { x: deg(58) }, LegR2: { x: deg(58) },
      ArmL1: { x: deg(-18), z: deg(20) }, ArmR1: { x: deg(-18), z: deg(-20) }, Spine1: { x: deg(14) },
    },
    bobY: -0.2,
  },
  transitions: { toLocomotion: 0.14, toAirborne: 0.12, toLanding: 0.06 }, // s to blend a pose change
}

export const FONT_FAMILY = 'Fredoka'

export function clamp(n, min, max) {
  return n < min ? min : n > max ? max : n
}

// Coerce one raw SDK string against its SETTINGS entry.
export function coerceSetting(key, raw) {
  const spec = SETTINGS[key]
  if (!spec) return raw
  const value = raw === '' || raw == null ? spec.def : raw
  if (spec.type === 'bool') return value === 'true' || value === true
  if (spec.type === 'enum') return spec.values.includes(value) ? value : spec.def
  const n = Number(value)
  return clamp(Number.isFinite(n) ? n : Number(spec.def), spec.min, spec.max)
}
