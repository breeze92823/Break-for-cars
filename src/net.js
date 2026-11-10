// Colyseus link to ../Break-for-cars-backend (room "world", six players, one garage each).
// Deployed builds reach it only through the Bloxity matchmaker (Legion.SDK.net.resolveEndpoint: a new
// Client per resolve, retried with backoff, and resolved again when the room drops: that is how
// players move off a pod being replaced). A page opened with ?roomId= (Open Rooms Join, a friend's
// invite) joins that room first. In dev, VITE_SERVER_URL points at a local `npm start`.
// What is relayed through the roster (backend presence.ts) so the others draw this player and their
// garage: pose (~10/s), hands (pickaxe, block, held car), swings, emotes, the Bloxity look and the
// garage itself. The server says which garage (`plot`) this player owns; main.js moves the game there.
// The player is identified by their Bloxity game token (verified by the server), never by an id sent
// from here. Scores go to the server, which reports them to Bloxity's boards under that verified id.
// The new-player tutorial's step is the one thing the server keeps per account (backend tutorial.ts):
// asked for once joined (`tutorialSync`), answered with `tutorial` { step }, raised by `tutorial`.
// The free car's play time / claim for a signed-in player (backend freeCar.ts): `freeCarSync` once
// joined, answered with `freeCar`; `freeCarClaim` answered with `freeCarClaim`.
// Never throws and never blocks play: without a server the game runs alone on the home garage.
import { Client } from '@colyseus/sdk'
import { DEV_MODE, LOBBY, NET, SERVER_URL } from './config.js'
import {
  authState, canResolveServer, displayName, getEquippedAvatar, getPfp, getProportions, getSkinTextureUrl, getToken, launchRoomId, locateRoom,
  playerInRoom, playerJoined, resolveServerEndpoint, subscribeAuth, updateRoom,
} from './bloxity.js'

export const net = { room: null, connected: false }

// --- Identity ---------------------------------------------------------------------
function storedId(key, make) {
  try {
    let id = localStorage.getItem(key)
    if (!id) localStorage.setItem(key, (id = make()))
    return id
  } catch {
    return make()
  }
}
// VITE_DEV_MODE (no SDK): a per-browser id a LOCAL server accepts, so two tabs tell themselves apart.
const DEV_ID = DEV_MODE ? storedId('break-for-cars.dev', () => `dev-${Math.random().toString(36).slice(2, 8)}`) : ''
const shownName = () => (DEV_ID && !authState.user ? `Dev ${DEV_ID.slice(4)}` : displayName() === 'Offline' ? 'Player' : displayName())
const who = () => ({ token: getToken(), ...(DEV_ID && { devId: DEV_ID }), username: shownName(), pfp: getPfp() })

export const hasServer = () => !!(SERVER_URL || canResolveServer())

// --- Hooks into the game (main.js) ------------------------------------------------------
const hooks = {
  pose: () => null, // { x, y, z, yaw, speed }
  loadout: () => null, // { tool, toolOut, carry, carryVariant, held }
  base: () => null, // the garage snapshot (game.baseSnapshot)
  stats: () => null, // { cash, income, playtime }
  plot: () => LOBBY.homePlot, // the garage played on now (asked for again on every join)
  tutorial: () => 0, // the tutorial step reached in this browser (game.tutorialStep)
  onTutorial: () => {}, // (step) the server's step for this account (game.syncTutorial)
  freeCar: () => null, // { played, claimed } this browser counted for the free car (game.freeCarSnapshot)
  onFreeCar: () => {}, // (msg) the server's `freeCar` { tracked, played, claimed, need } (game.syncFreeCar)
}

function send(type, payload) {
  try {
    net.room?.send(type, payload)
  } catch (err) {
    console.warn('[net] send failed', type, err)
  }
}

// --- Presence -----------------------------------------------------------------------
// The Bloxity look as the server relays it: JSON { equipped, proportions, skin }, length-capped (the
// skin URL is dropped first when it does not fit). '' = the default character.
function avatarJson() {
  if (!authState.user) return ''
  const equipped = getEquippedAvatar()
  if (!equipped) return ''
  for (const skin of [getSkinTextureUrl(), null]) {
    try {
      const json = JSON.stringify({ equipped, proportions: getProportions(), skin })
      if (json.length <= NET.avatarMax) return json
    } catch {
      return ''
    }
  }
  return ''
}
const r2 = (n) => Math.round(n * 100) / 100
function poseNow() {
  const p = hooks.pose()
  return p ? { x: r2(p.x), y: r2(p.y), z: r2(p.z), yaw: r2(p.yaw), speed: r2(p.speed) } : null
}
const sent = { pose: '', loadout: '', avatar: '', base: '', who: '' }
const json = (v) => (v ? JSON.stringify(v) : '')
function sendIfChanged(key, type, value, wrap = (v) => v) {
  const j = json(value)
  if (!j || j === sent[key]) return
  sent[key] = j
  send(type, wrap(value))
}

// A pickaxe swing (the others play it) and a Bloxity emote (Bloxity only tells the player who picked it).
export const sendSwing = () => net.connected && send('swing', {})
export const sendEmote = (id) => net.connected && send('emote', { id })

// --- Tutorial (backend tutorial.ts; client game/tutorial.js) -------------------------------------------
// A new step is sent at once; one reached offline goes up with the next join's `tutorialSync`.
export const sendTutorial = (step) => net.connected && send('tutorial', { step })

// --- Free car (backend freeCar.ts; client game/freecar.js) --------------------------------------
// A signed-in player's play time is counted by the server, which also checks the one claim per account.
// Resolves { ok, reason?: 'guest' | 'early' | 'claimed', played? }, or null when the server did not answer.
let freeCarWaiting = null
export function claimFreeCar() {
  return new Promise((resolve) => {
    if (!net.connected || freeCarWaiting) return resolve(null)
    const timer = setTimeout(() => {
      freeCarWaiting = null
      resolve(null)
    }, 10000)
    freeCarWaiting = (msg) => {
      clearTimeout(timer)
      freeCarWaiting = null
      resolve(msg ?? null)
    }
    send('freeCarClaim', {})
  })
}

// --- Trades (backend trades.ts; client game/trade.js) ------------------------------------------
// The server brokers requests, offers and accepts; the game swaps the cars. Server messages reach the
// one handler game/trade.js sets: handler(type, msg) with type tradeSent | tradeDeclined | tradeInvite |
// tradeInviteEnd | tradeStart | tradeState | tradeDone | tradeEnd.
const TRADE_EVENTS = ['tradeSent', 'tradeDeclined', 'tradeInvite', 'tradeInviteEnd', 'tradeStart', 'tradeState', 'tradeDone', 'tradeEnd']
let tradeHandler = null
export const setTradeHandler = (fn) => (tradeHandler = fn)
export const emitTrade = (type, msg) => tradeHandler?.(type, msg) // dev: simulate a server message
export const tradeRequest = (to) => net.connected && send('tradeRequest', { to })
export const tradeReply = (from, accept) => net.connected && send('tradeReply', { from, accept })
export const tradeOffer = (items) => net.connected && send('tradeOffer', { items })
export const tradeAccept = (accepted) => net.connected && send('tradeAccept', { accepted })
export const tradeCancel = () => net.connected && send('tradeCancel', {})

// --- Roster -------------------------------------------------------------------------
// The players in the room (sessionId -> PlayerState), or null when not connected.
export const roster = () => (net.connected ? net.room?.state?.players ?? null : null)
export const mySessionId = () => net.room?.sessionId ?? ''
// The garage the server gave this player (-1 until it answers / offline).
export function myPlot() {
  const me = roster()?.get?.(mySessionId())
  return me && me.plot >= 0 ? me.plot : -1
}

// "X joined you" toasts for Bloxity friends: the ones already here on joining, then each newcomer.
let known = null // Set of sessionIds seen, null until the first roster after a join
function announceJoins() {
  const players = roster()
  if (!players) return
  const mine = mySessionId()
  const ids = new Set()
  players.forEach((p, id) => {
    if (id === mine) return
    ids.add(id)
    if (known?.has(id) || !p.username) return
    if (known) playerJoined(p.username)
    else playerInRoom(p.username)
  })
  if (known || ids.size || players.size) known = ids
}

// --- Rewarded ads ----------------------------------------------------------------------
// The server checks a rewarded ad's token with Bloxity: true only when it says so.
let adWaiting = null
export function verifyAdReward(rewardToken) {
  return new Promise((resolve) => {
    if (!net.connected || adWaiting) return resolve(false)
    const timer = setTimeout(() => {
      adWaiting = null
      resolve(false)
    }, 10000)
    adWaiting = (msg) => {
      clearTimeout(timer)
      adWaiting = null
      resolve(msg?.ok === true)
    }
    send('adReward', { rewardToken })
  })
}

// --- Connection -------------------------------------------------------------------
function attach(room, relay) {
  net.room = room
  net.connected = true
  known = null
  room.onMessage('adReward', (m) => adWaiting?.(m))
  room.onMessage('tutorial', (m) => Number.isFinite(m?.step) && hooks.onTutorial(m.step))
  send('tutorialSync', { step: hooks.tutorial() })
  room.onMessage('freeCar', (m) => hooks.onFreeCar(m))
  room.onMessage('freeCarClaim', (m) => freeCarWaiting?.(m))
  send('freeCarSync', hooks.freeCar() ?? {})
  for (const type of TRADE_EVENTS) room.onMessage(type, (m) => tradeHandler?.(type, m))
  room.onLeave(() => {
    if (net.room !== room) return
    net.room = null
    net.connected = false
    known = null
    tradeHandler?.('tradeEnd', { reason: 'offline' })
    freeCarWaiting?.(null)
    hooks.onFreeCar({ tracked: false }) // offline: the browser counts again
    updateRoom('')
    // An unexpected close (a pod being replaced, a network drop): resolve again and rejoin.
    setTimeout(connect, NET.retry * 1000)
  })
  // Friends' invites and the game page's Join land in this room.
  updateRoom(relay ? `${relay}~${room.roomId}` : room.roomId)
}

let launchRoom = launchRoomId()
async function joinLaunchRoom(options) {
  const id = launchRoom
  launchRoom = ''
  if (!id) return null
  try {
    if (SERVER_URL) return { room: await new Client(SERVER_URL).joinById(id.split('~').pop(), options), relay: '' }
    const at = await locateRoom(id)
    if (at) return { room: await new Client(at.endpoint).joinById(at.roomId, options), relay: at.relayRoomId }
  } catch (err) {
    console.info('[net] the invited room is gone or full; matchmaking instead', err?.message ?? err)
  }
  return null
}

async function joinAnyRoom(options) {
  if (SERVER_URL) return { room: await new Client(SERVER_URL).joinOrCreate(NET.room, options), relay: '' }
  // Each endpoint is pinned to one pod: a new Client per resolve.
  const id = authState.user && (authState.user._id || authState.user.id)
  const { endpoint, relayRoomId } = await resolveServerEndpoint(id ? String(id) : undefined)
  return { room: await new Client(endpoint).joinOrCreate(NET.room, options), relay: relayRoomId }
}

let connecting = false
let retryIn = NET.retry
async function connect() {
  if (!hasServer() || connecting || net.connected) return
  connecting = true
  try {
    const pose = poseNow()
    const loadout = hooks.loadout()
    const base = hooks.base()
    const avatar = avatarJson()
    const options = { ...who(), plot: hooks.plot(), pose, loadout, avatar, base }
    sent.pose = json(pose)
    sent.loadout = json(loadout)
    sent.base = json(base)
    sent.avatar = avatar
    sent.who = json(who())
    const { room, relay } = (await joinLaunchRoom(options)) ?? (await joinAnyRoom(options))
    retryIn = NET.retry
    attach(room, relay)
  } catch (err) {
    console.info(`[net] could not reach the server (retrying in ${retryIn}s); playing alone`, err?.message ?? err)
    setTimeout(connect, retryIn * 1000)
    retryIn = Math.min(retryIn * 2, NET.retryMax)
  } finally {
    connecting = false
  }
}

// --- Loops --------------------------------------------------------------------------
let baseAt = 0
let statsAt = 0
function tick() {
  if (!net.connected) return
  sendIfChanged('loadout', 'loadout', hooks.loadout())
  const now = performance.now()
  if (now - baseAt >= NET.baseEvery * 1000) {
    baseAt = now
    sendIfChanged('base', 'base', hooks.base())
  }
  if (now - statsAt >= NET.statsEvery * 1000) {
    statsAt = now
    const s = hooks.stats()
    if (s) send('stats', s)
  }
}

// pose(), loadout(), base(), stats(), plot(), tutorial(), onTutorial(step), freeCar(), onFreeCar(msg): see `hooks`.
export function initNet(fns = {}) {
  Object.assign(hooks, fns)
  if (!hasServer()) return console.info('[net] no server configured; playing alone')
  setInterval(() => net.connected && sendIfChanged('pose', 'pose', poseNow()), 1000 / NET.poseHz)
  setInterval(tick, 100)
  setInterval(() => {
    announceJoins()
    if (!net.connected) return
    const a = avatarJson()
    if (a !== sent.avatar) send('setAvatar', { avatar: (sent.avatar = a) })
  }, 1000)
  // Leaving the page frees the garage at once (a dropped connection instead keeps it for the server's
  // reconnect window, while the SDK reconnects to the same session); back from the page cache: rejoin.
  window.addEventListener('pagehide', () => {
    const room = net.room
    if (!room) return
    net.room = null
    net.connected = false
    try {
      room.leave(true)
    } catch {
      // Closing anyway.
    }
  })
  window.addEventListener('pageshow', (e) => e.persisted && connect())
  // Connect once auth has settled (the token says who is playing); a later sign-in / out re-identifies
  // on the same connection, so the player stays in their friends' room.
  subscribeAuth((s) => {
    if (!s.ready) return
    if (!net.connected) return void connect()
    const w = who()
    const j = json(w)
    if (j === sent.who) return
    sent.who = j
    send('identify', w)
  })
}
