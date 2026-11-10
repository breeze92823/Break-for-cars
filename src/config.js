// Every tunable constant lives here; the rest of src/ holds no theme values.

// --- Identity -------------------------------------------------------------
export const GAME_SLUG = 'break-for-cars' // slug registered on bloxity.io
export const GAME_TITLE = 'Break for Cars'

// Forces the Bloxity SDK and avatar CDN to be treated as unavailable (see .env.example).
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'

// --- World (metres: +X east, +Z south, +Y up) -------------------------------
export const GROUND_Y = 0
export const WATER = { level: -1.4, size: 1400, color: '#14a6f0', shallow: '#6fe6ff' }
export const SPAWN = { x: -39.2, y: 0.4, z: 0 } // on the apron of the default garage (LOBBY.plots[LOBBY.homePlot])

// --- Lobby (lobby/*.js): the lego island ---------------------------------------
// One flat island of studded grass. A two-lane road runs north-south between two
// plazas: the north plaza holds the three global leaderboards, the south plaza
// the market stalls (Pickaxes Shop, Sell), the Fuse Machine, the
// Spin Wheel and the "Next Event" billboard. Six player plots flank the road,
// three on each side, each with a garage (lobby/base.js): one per player in a
// room of six (the server hands them out; offline you play on homePlot).
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
  // beltSpeed (m/s): the lanes are conveyor belts. West lane carries you south, east lane north (the chevron direction).
  road: { halfWidth: 5.2, curb: 1.4, south: 132, north: -132, top: 0.08, curbTop: 0.32, beltSpeed: 9 },
  northPlaza: { minX: -34, maxX: 34, minZ: -164, maxZ: -132 },
  southPlaza: { minX: -30, maxX: 30, minZ: 132, maxZ: 164 },
  // Plots: width across (x) and depth along the road (z), and the brown border.
  plotW: 80,
  plotD: 70,
  plotBorder: 2.6,
  homePlot: 1, // the garage played on until the server assigns one (and offline)
  plots: [
    { x: -61, z: -82 },
    { x: -61, z: 0 },
    { x: -61, z: 82 },
    { x: 61, z: -82 },
    { x: 61, z: 0 },
    { x: 61, z: 82 },
  ],
  leaderboards: [
    { x: -17, z: -156, yaw: 0.18, kind: 'cash' },
    { x: 0, z: -159, yaw: 0, kind: 'playtime' },
    { x: 17, z: -156, yaw: -0.18, kind: 'income' },
  ],
  // South plaza props (seen from the road: Fuse Machine east, Spin Wheel west).
  stalls: [
    { x: 0, z: 156, kind: 'pickaxes', label: 'Pickaxes Shop', awning: '#f0202a', ring: '#ff3344', npc: 'miner' },
    { x: -10, z: 155, kind: 'sell', label: 'Sell', awning: '#22d52a', ring: '#33ff55', npc: 'chef' },
  ],
  eventBoard: { x: 0, z: 169, yaw: Math.PI, every: 600 }, // countdown repeats every `every` s
  fuseMachine: { x: 21, z: 147, yaw: -Math.PI / 2 - 0.25, needs: 4 },
  spinWheel: { x: -21, z: 146, yaw: Math.PI / 2 + 0.3 },
  // Teleport targets for the HUD buttons ({x, z, facing}); facing PI = north, 0 = south.
  spots: {
    shop: { x: 0, z: 140, facing: 0 },
  },
  trees: 44,
  pines: 18,
  rocks: 22,
  bushes: 30,
  seed: 1907,
}

// Block themes: the conveyor's mystery blocks and the HUD's featured block offer.
// rarity/price label the block on the belt; weight = how often the conveyor spawns it.
export const BLOCK_THEMES = {
  // hp is sized against PICKAXES: with the pickaxe you can afford when a block
  // shows up it takes ~10-30 hits; with the starter Wooden Pickaxe the rare ones are a slog.
  gold: { name: 'Lucky Block', rarity: 'Common', price: 100, hp: 1500, weight: 60, base: '#ffcf1f', edge: '#e08a00', mark: '#ffffff', ink: '#c25e00', glow: '#ffd84a' },
  cyan: { name: 'Ice Block', rarity: 'Uncommon', price: 450, hp: 4000, weight: 14, base: '#3fe3ff', edge: '#0a8fd8', mark: '#ffffff', ink: '#075a9e', glow: '#6ff2ff' },
  galaxy: { name: 'Galaxy Block', rarity: 'Epic', price: 5000, hp: 15000, weight: 6, base: '#6a1fd8', edge: '#d65cff', mark: '#ffffff', ink: '#2a0870', glow: '#c27bff', stars: true },
  hacker: { name: 'Hacker Block', rarity: 'Legendary', price: 25000, hp: 50000, weight: 4, base: '#0d1a10', edge: '#21ff4a', mark: '#21ff4a', ink: '#003b0c', glow: '#3dff5e', grid: true },
  divine: { name: 'Divine Block', rarity: 'Mythic', price: 120000, hp: 200000, weight: 3, base: '#ffe27a', edge: '#ffffff', mark: '#ffffff', ink: '#d88a00', glow: '#fff1a8' },
  cosmic: { name: 'Cosmic Lucky Block', rarity: 'Secret', price: 1e6, hp: 1e6, weight: 1, base: '#ff2f8e', edge: '#2b0b5c', mark: '#ffffff', ink: '#5a0a3a', glow: '#ff6ad5', stars: true, announce: true },
}
export const RARITY_COLORS = { Common: '#c9cfdc', Uncommon: '#5dff4a', Rare: '#3c9cff', Epic: '#c43cff', Legendary: '#ffb21a', Mythic: '#ff3b4e', Secret: '#ff6ad5' }

// The player's base (lobby/base.js), in plot-local metres: +Z points at the road,
// X runs along it. A glass showroom garage at the back, a grey studded apron in
// front, a grass strip, then the block conveyor along the road-side edge with a
// tunnel box at each end, and the two limited cars parked beside the conveyor.
export const BASE = {
  // design size of the garage; it is drawn garageScale times bigger, pushed back by garageOffsetZ
  building: { minX: -12, maxX: 12, minZ: -21, maxZ: 5, height: 6.6, floor: 0.4 },
  garageScale: 2,
  garageOffsetZ: 6,
  apron: { minX: -30, maxX: 30, minZ: -39, maxZ: 28.5 },
  conveyor: { z: 33, from: -28, to: 28, belt: 2.6, wall: 0.8, wallHeight: 1.1, speed: 2.4, spacing: 7, box: { length: 4.2, width: 5.6, height: 3.3 } },
  slots: 5, // parking slots per side inside the garage
  // Bays the player has to buy before they can use them (index into the bays: left side 0-4, right side 5-9).
  lockedSlots: [{ bay: 9, label: '10th Slot', price: 4.89e6 }],
  // Extra floors stacked on the garage, bought in order. Each adds BASE.slots x 2 bays (bay
  // indices continue: floor 1 = 10-19, floor 2 = 20-29). A storey is building.height tall; the
  // roof and billboard ride on top of the highest floor bought. The next floor is bought on the
  // glowing plate where its staircase will stand (hold E).
  floors: [
    { label: '2nd Floor', price: 25e6 },
    { label: '3rd Floor', price: 1.5e9 },
  ],
  // The staircase up to each floor runs along the open front of the garage (garage design
  // units), alternating sides: to floor 1 it rises toward -X from x = -gap to -(gap + run),
  // to floor 2 toward +X, ... Lego steps over a hidden ramp collider (the player's autostep is
  // too low for a whole step). Slope = atan(building.height / run), under PHYSICS.maxSlope.
  stairs: { run: 8, gap: 1, z0: 2.65, z1: 4.85, steps: 30 },
  limitedCars: [
    { car: 'omega', name: 'Omega', bonus: 200, x: -31.5, z: 23, yaw: 0.5 },
    { car: 'bolido', name: 'Bolido', bonus: 275, x: 31.5, z: 23, yaw: -0.6 },
  ],
}

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
  omega: { body: '#ff3d0a', accent: '#0f0f12', style: 'hyper', rim: '#18181c', neon: '#ff7a2a' },
  greenSuper: { body: '#7ee81c', accent: '#16181c', style: 'super', rim: '#25262b' },
  bolido: { body: '#11151d', accent: '#0a0d12', style: 'hyper', rim: '#151a22', neon: '#18e8ff' },
}
// Placeholder HUD state for the parts that have no game rules yet (spins, offers).
export const HUD_DEMO = {
  spins: 1,
  offers: { starterPack: 19, opPickaxe: 159 },
}
// --- Game rules (game/*.js): buy a block off the belt, carry it into the garage,
// place it on a free bay, break it with the hammer, and the car inside earns money
// into that bay's collect pad until the player steps on it.
export const GAME = {
  saveKey: 'break-for-cars:save:v1',
  startMoney: 250,
  autosave: 5, // s between saves
  offlineCap: 3600, // s of income the pads keep earning while the game is closed
  buyHold: 0.45, // s E (or the prompt) is held to buy a block
  removeHold: 0.35, // s E is held on a parked car to take it off its bay into the hotbar
  removeReach: 0.6, // garage units from a car's bay for its Remove prompt
  inventory: 7, // cars the hotbar holds (slots 2-8; the carried block takes the next one)
  buyReach: 4.8, // m from the player to a belt block for its Buy prompt (the belt wall keeps you ~3 m off)
  placeReach: 1.4, // garage units from a bay's edge for its Place prompt
  hitReach: 3.4, // m from the player to a placed block's side for a swing to land
  swing: { duration: 0.34, impact: 0.19 }, // s, s into the swing the head lands (damage per hit = the equipped pickaxe's)
  luckyChance: 0.1, // a block sometimes holds a car one rarity up
  incomeSpread: [0.85, 1.3], // a car's base income = rarity income x random in this range
  upgrade: { costFactor: 12, costGrowth: 1.35, incomeGrowth: 1.22, maxLevel: 50 },
  sellBack: 0.5, // fraction of the block price + upgrade spend a sold car returns
  placedSize: 2.3, // m edge of a block standing on a bay
  carScale: 1.55,
  reveal: 1.1, // s the car takes to grow out of the broken block
  volume: 0.6,
}
// --- New-player tutorial (game/tutorial.js): a banner under the top buttons and white arrows on the
// ground leading to the next thing to do. Steps (the backend's TUTORIAL_DONE_STEP = steps.length):
// 0 buy a block off the belt, 1 place it on a bay, 2 break it, 3 earn the first pickaxe's price,
// 4 buy that pickaxe. Saved in the browser (saveKey) and, for a signed-in player, on the server, so
// it resumes on any device. A save from before the tutorial existed counts as finished.
export const TUTORIAL = {
  saveKey: 'break-for-cars:tutorial:v1',
  pickaxe: 'iron', // the pickaxe step 3 saves up for; its price is the goal
  steps: [
    'Purchase your first lucky block!',
    'Place lucky block on the slot',
    'Break lucky block to get your first car!',
    'Earn {money}/{goal} Cash!',
    'Purchase your first pickaxe',
  ],
  afford: 'You can now afford {name}!', // flashes for `affordFor` s as step 3 ends
  affordFor: 2.6,
  // Ground arrows: m apart, m long, m/s they scroll toward the target, the most drawn, how close (m)
  // to the target they stop, and how close the player may be before they hide.
  arrows: { spacing: 2.3, size: 1.25, speed: 2.2, max: 64, stopShort: 1.6, hideNear: 3.2, color: '#ffffff', side: '#9fe6ff', outline: '#1b2233' },
}

// Conveyor "More Luck" upgrade: the magenta pad beside the exit tunnel. Stepping on
// it asks to buy the next level; each level multiplies a block's spawn weight by
// luck^tier (tier 0 = Common ... 5 = Secret), so rare blocks show up more often.
// cost = price to reach that level; priced along the block prices so each level
// is a goal for the cars you own at that point.
export const CONVEYOR_UPGRADE = {
  pad: { x: 21, z: 26.4, size: 3.2 }, // base-local metres (+Z = road side, X along the belt)
  levels: [
    { luck: 1, cost: 0 },
    { luck: 1.15, cost: 750 },
    { luck: 1.3, cost: 3500 },
    { luck: 1.45, cost: 12000 },
    { luck: 1.6, cost: 40000 },
    { luck: 1.8, cost: 125000 },
    { luck: 2.0, cost: 400000 },
    { luck: 2.25, cost: 1.2e6 },
    { luck: 2.5, cost: 4e6 },
    { luck: 2.8, cost: 12e6 },
  ],
}
// The conveyor's look evolves with its upgrade level (lobby/base.js setConveyorSkin):
// the highest skin whose minLevel <= the level (0-based) is shown. Colours tint
// the walls / tunnel bodies / caps / mouth frames / belt; deco switches on that
// tier's extra props (none, lime trim, neon edges + antenna orbs, UFO saucers,
// bronze gear towers with glowing domes).
export const CONVEYOR_SKINS = [
  { name: 'Concrete', minLevel: 0, wall: '#878fb2', body: '#878fb2', cap: '#98a0c2', frame: '#525a78', belt: '#262b38', deco: null },
  { name: 'Lime Trim', minLevel: 2, wall: '#8a93b6', body: '#7f88ad', cap: '#4fd62a', frame: '#2f9f1c', belt: '#252a36', deco: 'trim' },
  { name: 'Neon Brick', minLevel: 4, wall: '#3fd61f', body: '#38c81c', cap: '#2aa515', frame: '#1b8fb0', belt: '#1f2430', deco: 'neon' },
  { name: 'Saucer Station', minLevel: 6, wall: '#3c4262', body: '#323854', cap: '#4a5274', frame: '#1c2236', belt: '#181c28', deco: 'ufo' },
  { name: 'Ancient Gearworks', minLevel: 8, wall: '#6e5c3d', body: '#625135', cap: '#7f6b46', frame: '#43361f', belt: '#221d16', deco: 'temple' },
]
// Garage skins (game/baseskins.js, lobby/base.js setSkin): the "Bases" pad on the apron opens
// the "Base Skins" window. A skin recolours the garage (frame = columns, rails and stair
// handrails; truss = mullion tint; slab = floors and roof; glass = wall tint; bay / bayTop =
// parking bays) and multiplies the income of every car parked in it (mult). Each one unlocks
// for free once `index` (0..1) of the Index's cars are found, or can be bought with money.
// rainbow: the frame and truss cycle through the hues. Other players see the equipped skin.
export const GARAGE_SKINS = [
  { id: 'classic', name: 'Classic Base', mult: 1, index: 0, price: 0, card: '#7a83a8', colors: { frame: '#525a78', truss: '#ffffff', slab: '#878fb2', glass: '#bdf1ff', bay: '#adb5d2', bayTop: '#c4cbe2' } },
  { id: 'radioactive', name: 'Radioactive Base', mult: 2, index: 0.3, price: 2.5e9, card: '#b4f01e', colors: { frame: '#3c9a12', truss: '#c8ff3a', slab: '#7cc42a', glass: '#d8ff7a', bay: '#9ad84a', bayTop: '#c2f06a' } },
  { id: 'diamond', name: 'Diamond Base', mult: 2.5, index: 0.45, price: 12e9, card: '#2fc8ff', colors: { frame: '#1678b8', truss: '#bff4ff', slab: '#5cb6e0', glass: '#9ff0ff', bay: '#8ad4f0', bayTop: '#b8ecff' } },
  { id: 'ruby', name: 'Ruby Base', mult: 3, index: 0.55, price: 50e9, card: '#ff4a5e', colors: { frame: '#a3142c', truss: '#ffb0bc', slab: '#d0485c', glass: '#ffb8c4', bay: '#e07a88', bayTop: '#f4a8b2' } },
  { id: 'golden', name: 'Golden Base', mult: 4, index: 0.65, price: 250e9, card: '#ffc81a', colors: { frame: '#b8860b', truss: '#fff0a0', slab: '#e0b43a', glass: '#ffe88a', bay: '#e8c860', bayTop: '#f6dc84' } },
  { id: 'rainbow', name: 'Rainbow Base', mult: 5, index: 0.7, price: 1e12, card: 'linear-gradient(90deg, #ff3b4e, #ffb21a, #ffe14a, #43e83a, #2fc8ff, #8b2cff, #ff3fc8)', rainbow: true, colors: { frame: '#ff3b4e', truss: '#ffffff', slab: '#9aa2c8', glass: '#e0f0ff', bay: '#c8b8f0', bayTop: '#e0d4ff' } },
]
// The "Bases" pad on the apron (base-local metres, like CONVEYOR_UPGRADE.pad).
export const SKINS_PAD = { x: -21, z: 26.4, size: 3.2 }

// Pickaxes Shop (game/pickshop.js): stepping into the Pickaxes Shop ring opens the
// "Buy Pickaxes" window. Each pickaxe is bought once with money and can be equipped
// any time after; the equipped one is the tool in your hand and sets the damage
// per hit. Prices follow the economy: each one is roughly what the cars you own
// when you reach the matching block rarity earn in a few minutes.
// look: head / tip (the pick's points) / handle colours; style 'pick' (curved
// head) or 'hammer' (block head); span = head width; glow = neon core; stripes =
// alternating head/tip segments; crown = little crown on top.
export const PICKAXES = [
  { id: 'wooden', name: 'Wooden Pickaxe', rarity: 'Common', damage: 250, price: 0, look: { head: '#8a6448', tip: '#a87e5c', handle: '#c9a07a' } },
  { id: 'iron', name: 'Iron Pickaxe', rarity: 'Common', damage: 400, price: 1000, look: { head: '#e3e8f0', tip: '#ffffff', handle: '#c9a07a' } },
  { id: 'golden', name: 'Golden Pickaxe', rarity: 'Uncommon', damage: 700, price: 8000, look: { head: '#ffe43a', tip: '#fff7a8', handle: '#c9a07a' } },
  { id: 'diamond', name: 'Diamond Pickaxe', rarity: 'Uncommon', damage: 1200, price: 25000, look: { head: '#46eeff', tip: '#c8fbff', handle: '#c9a07a' } },
  { id: 'emerald', name: 'Emerald Pickaxe', rarity: 'Rare', damage: 2000, price: 60000, look: { head: '#22e45e', tip: '#a8ffc0', handle: '#a8784f' } },
  { id: 'ruby', name: 'Ruby Pickaxe', rarity: 'Rare', damage: 3200, price: 150000, look: { head: '#ff2448', tip: '#ff9aaa', handle: '#5a3a2a' } },
  { id: 'lava', name: 'Lava Pickaxe', rarity: 'Epic', damage: 5000, price: 400000, look: { head: '#ff6a12', tip: '#ffd04a', handle: '#3a1a14', glow: '#ff5a00' } },
  { id: 'amethyst', name: 'Amethyst Pickaxe', rarity: 'Epic', damage: 8000, price: 1e6, look: { head: '#a43cff', tip: '#e6b0ff', handle: '#3a2a4a' } },
  { id: 'crystal', name: 'Crystal Pickaxe', rarity: 'Legendary', damage: 12500, price: 2.5e6, look: { head: '#cc66ff', tip: '#ffb8ff', handle: '#e48eff' } },
  { id: 'azure', name: 'Azure Pickaxe', rarity: 'Legendary', damage: 20000, price: 6e6, look: { head: '#52dcff', tip: '#d0f8ff', handle: '#2a8ad8', span: 1.25 } },
  { id: 'shadow', name: 'Shadow Pickaxe', rarity: 'Mythic', damage: 32000, price: 15e6, look: { head: '#2a2a36', tip: '#6c6c84', handle: '#1a1a20', glow: '#9a4aff' } },
  { id: 'radioactive', name: 'Radioactive Pickaxe', rarity: 'Mythic', damage: 50000, price: 40e6, look: { head: '#b4ff26', tip: '#f0ff8a', handle: '#34d026', glow: '#c8ff3a', span: 1.2 } },
  { id: 'null', name: 'Null Pickaxe', rarity: 'Cosmic', damage: 80000, price: 100e6, look: { head: '#f4f6fb', tip: '#1b1c22', handle: '#1b1c22', stripes: true, span: 1.2 } },
  { id: 'plasma', name: 'Plasma Hammer', rarity: 'Cosmic', damage: 125000, price: 250e6, look: { head: '#e03aff', tip: '#ff9aff', handle: '#b62ad0', glow: '#ff4aff', style: 'hammer' } },
  { id: 'galaxy', name: 'Galaxy Pickaxe', rarity: 'Cosmic', damage: 200000, price: 650e6, look: { head: '#9a4aff', tip: '#ff9aff', handle: '#7a3ad8', glow: '#c08aff', span: 1.2 } },
  { id: 'bloodmoon', name: 'Blood Moon Pickaxe', rarity: 'Secret', damage: 320000, price: 1.6e9, look: { head: '#c8101e', tip: '#ff4040', handle: '#4a080e', glow: '#ff2030', span: 1.3 } },
  { id: 'divine', name: 'Divine Pickaxe', rarity: 'Celestial', damage: 500000, price: 4e9, look: { head: '#fff1a0', tip: '#ffffff', handle: '#ffe14a', glow: '#fff8c0', span: 1.25 } },
  { id: 'king', name: 'King Pickaxe', rarity: 'Godly', damage: 800000, price: 12e9, look: { head: '#ffcf1f', tip: '#ff3a2a', handle: '#e8141b', glow: '#2af0ff', crown: true } },
  { id: 'demonic', name: 'Demonic Pickaxe', rarity: 'Infernal', damage: 1.3e6, price: 35e9, look: { head: '#1c0608', tip: '#ff2a12', handle: '#7a0a0a', glow: '#ff3a12', span: 1.35, stripes: true } },
]
// Shop card colours per pickaxe rarity: card = background (CSS), icon = the
// icon well, text = rarity label colour, edge = card border.
export const PICKAXE_RARITIES = {
  Common: { card: '#e7eaf1', icon: '#5b5f6b', text: '#eef0f5', edge: '#3a3d48' },
  Uncommon: { card: '#3ed42c', icon: '#1d5c16', text: '#2b9d1a', edge: '#145a0e' },
  Rare: { card: '#2f8cff', icon: '#123a7a', text: '#9fd0ff', edge: '#0d3a80' },
  Epic: { card: '#b52cf2', icon: '#4a1068', text: '#d77bff', edge: '#4a0d6a' },
  Legendary: { card: '#f2c81a', icon: '#5a4a10', text: '#ffd21a', edge: '#7a5a00' },
  Mythic: { card: '#7a2cf0', icon: '#2e0f62', text: '#c76bff', edge: '#2e0d6a' },
  Cosmic: { card: 'linear-gradient(180deg, #ff5a68 0%, #ef2a3c 45%, #ff5a68 100%)', icon: '#5a1018', text: '#ff3a4e', edge: '#7a0a16' },
  Secret: { card: '#f6f6fa', icon: '#c8102a', text: '#ffffff', edge: '#3a3d48' },
  Celestial: { card: 'linear-gradient(180deg, #ff3a1a 0%, #ff8a12 30%, #ffd21a 60%, #ff8a12 80%, #ff3a1a 100%)', icon: '#5a2a08', text: '#ff7a1a', edge: '#7a2a00' },
  Godly: { card: 'linear-gradient(180deg, #2a3cf0 0%, #6a2cf0 50%, #3a2ce0 100%)', icon: '#1a1260', text: '#b05cff', edge: '#16106a' },
  Infernal: { card: 'linear-gradient(180deg, #ff2a1a 0%, #a00a0a 55%, #ff2a1a 100%)', icon: '#2a0606', text: '#ff5a2a', edge: '#4a0404' },
}

// Fuse Machine (game/fuse.js): step into its ring, put 4 hotbar cars in, and after
// the fusion time you claim one new car. The result rarity is rolled from the
// inputs' average rarity tier: `odds` = % for that tier, one up, two up (clamped
// at Secret). The result earns `bonus` x its rarity's income. time = seconds by
// the base (average) tier, Common .. Secret.
export const FUSE = {
  slots: 4,
  odds: [61, 31, 8],
  bonus: 1.5,
  time: [60, 180, 420, 900, 1800, 2400],
  saveKey: 'break-for-cars:fuse:v1',
}
// Daily Rewards (game/daily.js, the calendar button): one claim per day, a 7-day
// streak that loops; missing a day for over `graceHours` restarts at Day 1.
// kind 'cash' gives `amount`; kind 'car' puts a car of that rarity / roster name
// in the hotbar, earning `bonus` x its rarity's income. Day 7 is the OP car.
export const DAILY = {
  saveKey: 'break-for-cars:daily:v1',
  cooldownHours: 22,
  graceHours: 48,
  rewards: [
    { kind: 'cash', amount: 10000 },
    { kind: 'car', rarity: 'Epic', name: 'Nebula', look: 'whiteHyper' },
    { kind: 'cash', amount: 75000 },
    { kind: 'car', rarity: 'Legendary', name: 'Aurum', look: 'goldenCoupe' },
    { kind: 'cash', amount: 750000 },
    { kind: 'car', rarity: 'Mythic', name: 'Inferno', look: 'omega' },
    { kind: 'car', rarity: 'Secret', name: 'Solar GT', look: 'orangeHyper', bonus: 3, op: true },
  ],
}
// The HUD's FREE! car (game/freecar.js): play `minutes` and claim it, once. A guest's play time is
// counted in this browser (saveKey, only while the tab is visible); a signed-in player's on the game
// server (backend freeCar.ts, FREE_CAR_SECONDS = minutes x 60), which also allows one claim per account.
// `car` is made like a Daily Rewards car (`bonus` x its rarity's income).
export const FREE_CAR = {
  saveKey: 'break-for-cars:freecar:v1',
  minutes: 30,
  car: { rarity: 'Legendary', name: 'Blaze', look: 'orangeHyper', bonus: 1.5 },
}
// Car variants ("mutations"). A block bought during an event can carry the event's
// variant; the car inside earns `mult` x a Normal one. Shown on the block (tint +
// label), on the car's label and in the Index. weight = how often an event picks it.
// tab = Index tab colour (CSS background).
export const MUTATIONS = [
  { id: 'Normal', mult: 1, color: '#ffffff', tab: '#e7eaf1' },
  { id: 'Golden', mult: 2, color: '#ffd21a', tab: '#ffd21a', weight: 30 },
  { id: 'Radioactive', mult: 3, color: '#b4ff26', tab: '#b4ff26', weight: 22 },
  { id: 'Diamond', mult: 4, color: '#46eeff', tab: '#2ad8ff', weight: 16 },
  { id: 'Ruby', mult: 5, color: '#ff3a4e', tab: '#ff4a5a', weight: 12 },
  { id: 'Emerald', mult: 6, color: '#2ee86a', tab: '#3ae860', weight: 9 },
  { id: 'Infernal', mult: 8, color: '#ff7a1a', tab: '#ff6a1a', weight: 7 },
  { id: 'Rainbow', mult: 10, color: '#ff6af0', tab: 'linear-gradient(90deg, #ff3b4e, #ffd21a, #2dd84a, #2f9bff, #b23cff, #ff3fc8)', weight: 4 },
]
// Events (game/events.js): the "Next Event in" board counts down `every` s, then a
// random variant (by weight) runs for `duration` s; meanwhile each new belt block
// is that variant with `chance`.
export const EVENTS = { every: 600, duration: 180, chance: 0.45 }
// The Index window (game/carindex.js): every roster car in every variant.
export const INDEX = { saveKey: 'break-for-cars:index:v1' }

// Spin Wheel window (game/spin.js: the HUD wheel button or the plaza wheel's ring).
// One free spin every `freeEvery` s (they stack). Six equal wedges clockwise from
// the top; `weight` = % chance. Cash rewards pay `incomeSecs` of your current
// garage income (at least `min`); 'block' puts that block in your hands (its price
// in cash if your hands are full); 'spins' adds spins; 'car' adds a hotbar car.
export const SPIN_WHEEL = {
  saveKey: 'break-for-cars:spin:v1',
  freeEvery: 1500,
  startSpins: 1,
  spinTime: 4.2,
  rewards: [
    { kind: 'cash', incomeSecs: 900, min: 25000, weight: 33.5, color: '#ffd21a' },
    { kind: 'block', theme: 'hacker', weight: 4, color: '#3ddc4a' },
    { kind: 'spins', amount: 2, weight: 15, color: '#a43cff' },
    { kind: 'car', rarity: 'Secret', name: 'Phantom', look: 'bolido', bonus: 2, weight: 0.5, color: '#2f9bff' },
    { kind: 'cash', incomeSecs: 240, min: 5000, weight: 45, color: '#ff9a1a' },
    { kind: 'car', rarity: 'Mythic', name: 'Inferno', look: 'omega', bonus: 1.5, weight: 2, color: '#f0202a' },
  ],
}

// Background music (game/music.js) at full volume; Bloxity's music_volume scales it.
export const MUSIC_VOLUME = 0.16
// The game's own Settings window (game/settings.js, the gear button beside the calendar):
// on/off switches saved per device. They sit on top of Bloxity's volume sliders: Music
// off = silent whatever music_volume says, Sounds off = no effects. Trading is stored
// for when trade requests exist.
export const GAME_SETTINGS = {
  saveKey: 'break-for-cars:settings:v1',
  defaults: { music: true, sounds: true, trading: true },
}

// Block rarity -> the cars that can come out of it, and their base $/s.
export const RARITY_LADDER = ['Common', 'Uncommon', 'Epic', 'Legendary', 'Mythic', 'Secret']
export const RARITY_INCOME = { Common: 3, Uncommon: 15, Epic: 120, Legendary: 600, Mythic: 3000, Secret: 20000 }
export const CAR_ROSTER = {
  Common: [{ name: 'Pebble', look: 'blueCoupe' }, { name: 'Dash', look: 'silverSport' }],
  Uncommon: [{ name: 'Hornet', look: 'yellowSuper' }, { name: 'Zephyr', look: 'redSport' }],
  Epic: [{ name: 'Glider', look: 'greenSuper' }, { name: 'Nebula', look: 'whiteHyper' }],
  Legendary: [{ name: 'Blaze', look: 'orangeHyper' }, { name: 'Aurum', look: 'goldenCoupe' }],
  Mythic: [{ name: 'Inferno', look: 'omega' }],
  Secret: [{ name: 'Phantom', look: 'bolido' }],
}

export const SPAWN_FACING = -Math.PI / 2 // yaw the character faces on spawn (PI = toward -Z; -PI/2 = west, at the garage)

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
// Fog hides the far island and sea, so nothing is drawn past it (CAMERA.far is just beyond the
// sky dome, 500 m). Phones get a shorter view.
const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
export const FOG = COARSE ? { near: 80, far: 300 } : { near: 130, far: 430 }
// Garages further than `near` m from the player drop to a cheap version (no shadows, no animation).
export const DETAIL = { baseNear: COARSE ? 95 : 130, baseHysteresis: 12 }
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
  shadowRange: COARSE ? 28 : 40, // half-width of the sun's shadow box around the player
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
export const MOBILE_GRAPHICS_CAP = { dpr: 1.25, shadowMap: 1024, particles: 0.5 }

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
  far: 560,
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
// Volumes are 0..100. (fullscreen is applied by the portal itself, enable_chat never reaches games.)
export const SETTINGS = {
  master_volume: { def: '80', type: 'number', min: 0, max: 100 },
  music_volume: { def: '80', type: 'number', min: 0, max: 100 },
  graphics_quality: { def: DEFAULT_GRAPHICS, type: 'enum', values: ['Low', 'Medium', 'High', 'Ultra'] },
  camera_sensitivity: { def: '1', type: 'number', min: 0.1, max: 5 },
  show_fps: { def: 'false', type: 'bool' },
}

// Bloxity's boards (trophy button + game page), declared on boot (bloxity.js). The game server
// reports the scores under the player's verified id (backend platformBoards.ts, same list); the
// north plaza's boards show their top rows (main.js).
export const LEADERBOARDS = [
  { id: 'cash', label: 'Most Cash', order: 'desc', mode: 'latest', format: 'compact', reset: 'none' },
  { id: 'income', label: 'Total Income /s', order: 'desc', mode: 'best', format: 'compact', reset: 'none' },
  { id: 'playtime', label: 'Play Time (min)', order: 'desc', mode: 'latest', format: 'number', reset: 'none' },
]

// Ad screens declared to Bloxity (ads.declareScreens). 'panel' = one of the game's windows is open
// (shops, Index, Daily, Fuse, Spin); 'gameplay' banners stay off unless Boxity's admins turn them on.
// The panel banners keep clear of the HUD's right column.
export const AD_SCREENS = {
  gameplay: {},
  panel: {},
}

// --- Multiplayer (net.js, remotePlayers.js, remoteBases.js; backend ../Break-for-cars-backend) ---
// Rooms of six (the backend's ROOM_MAX_CLIENTS), one garage per player. Deployed builds always reach
// the server through the Bloxity matchmaker; SERVER_URL is for a local `npm start` in dev only.
export const SERVER_URL = import.meta.env.DEV ? import.meta.env.VITE_SERVER_URL || '' : ''
export const NET = {
  room: 'world',
  maxPlayers: 6,
  poseHz: 10, // pose messages per second
  baseEvery: 0.5, // s between garage updates while it changes
  statsEvery: 15, // s between score reports (the server reports them to Bloxity's boards)
  retry: 2, // s before the first reconnect attempt, doubling...
  retryMax: 30, // ...up to this
  avatarMax: 3000, // chars of avatar JSON the server accepts (backend AVATAR_MAX_LEN)
  remoteLerp: 12, // 1/s: remote players ease toward their last relayed pose
  remoteRange: 220, // m: further remote players are hidden
  leaderboardEvery: 60, // s between refreshes of the plaza boards from Bloxity
  adRewardSpins: 1, // spins a watched rewarded ad gives (spin.js), checked by the server
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
  emoteFade: 0.2, // s a Bloxity emote takes to blend in and out
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
