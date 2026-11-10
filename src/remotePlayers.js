// The other players in the room: each is the game's character with their Bloxity look, a name tag,
// their equipped pickaxe (in hand or slung on the back, as they have it), the block they carry or the
// car they hold, their swings, Bloxity emotes and chat bubbles. Eased toward the pose the server last
// relayed (net.js sends ours; backend presence.ts). Diffed against the roster every frame, so joins
// and leaves need no events. Read-only: nothing here touches the local game.
import { BoxGeometry, Group, Mesh, Vector3 } from 'three'
import { GAME, NET, PICKAXES } from './config.js'
import { mySessionId, roster } from './net.js'
import { label } from './propkit.js'
import { createBubble } from './bubble.js'
import { buildCar } from './lobby/cars.js'
import { buildPickaxe, disposePickaxe } from './game/pickaxe-model.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { playEmote } from './avatar/emotes.js'

const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from))
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t)
const easeOut = (t) => 1 - (1 - t) * (1 - t)
const easeIn = (t) => t * t
const PICK_BY_ID = Object.fromEntries(PICKAXES.map((p) => [p.id, p]))
const TAG_STYLE = { color: '#ffffff', outline: '#1a1a24', outlineWidth: 12 }
const carryGeo = new BoxGeometry(1.05, 1.05, 1.05)
const tmp = new Vector3()

// The swing's arm angle over time, as game.js swings ours: windup over the head, strike, recover.
const HOLD_ANGLE = 0.4
function armAngle(t) {
  if (t < 0) return HOLD_ANGLE
  const S = GAME.swing
  const up = S.impact * 0.5
  if (t < up) return HOLD_ANGLE + (2.7 - HOLD_ANGLE) * easeOut(t / up)
  if (t < S.impact) return 2.7 + (1.25 - 2.7) * easeIn((t - up) / (S.impact - up))
  return 1.25 + (HOLD_ANGLE - 1.25) * easeOut(clamp01((t - S.impact) / (S.duration - S.impact)))
}

class Remote {
  constructor(parent, blockMaterial) {
    this.parent = parent
    this.blockMaterial = blockMaterial
    this.group = new Group()
    parent.add(this.group)
    this.avatar = null
    this.animator = null
    this.avatarJson = null // what the current rig was built from
    this.generation = 0
    this.name = null
    this.tag = null
    this.bubble = createBubble(this.group, 3.15)
    this.placed = false
    this.vy = 0
    // Hands: the pickaxe (tool) rides the hand pivot while out, else the back; a carried block or
    // a held car model in front.
    this.hand = new Group()
    this.hand.position.set(-0.56, 1.32, 0.02)
    this.group.add(this.hand)
    this.tool = new Group()
    this.toolId = null
    this.inHand = null
    this.carry = new Mesh(carryGeo, blockMaterial('gold'))
    this.carry.position.set(0, 1.2, 0.85)
    this.carry.castShadow = true
    this.carry.visible = false
    this.group.add(this.carry)
    this.carryKey = ''
    this.heldHolder = new Group()
    this.heldHolder.position.set(0, 1.15, 0.9)
    this.group.add(this.heldHolder)
    this.heldLook = ''
    this.swingSeen = null
    this.swingT = -1
    this.emoteSeen = null
    this.busy = false
    this.toolOut = false
    this.setAvatar(buildDefaultCharacter())
  }

  // Arms posed over the locomotion, as game.js poses ours: both forward while the hands are full,
  // the right one holding / swinging the pickaxe.
  overlay = (pose) => {
    if (this.busy) {
      pose.set('ArmL1', -1.35, 0, 0.18)
      pose.set('ArmR1', -1.35, 0, -0.18)
      pose.set('ArmL2', 0)
      pose.set('ArmR2', 0)
    } else if (this.toolOut) {
      pose.set('ArmR1', -armAngle(this.swingT), 0, -0.08)
      pose.set('ArmR2', 0)
    }
  }

  setAvatar(next) {
    if (this.avatar) this.group.remove(this.avatar)
    disposeAnimator(this.animator)
    this.avatar = next
    this.group.add(next)
    this.animator = makeAnimator(next)
    if (this.animator) this.animator.overlay = this.overlay
  }

  // A signed-in player's look arrives as JSON { equipped, proportions, skin }; "" = the plain
  // Bloxity rig (as a guest's own character looks to them).
  async syncAvatar(json) {
    if (json === this.avatarJson) return
    this.avatarJson = json
    const mine = ++this.generation
    let look = null
    try {
      look = json ? JSON.parse(json) : null
    } catch {
      return
    }
    try {
      const group = await loadBaseCharacter()
      if (mine !== this.generation) return
      await attachEquippedAccessories(group, look?.equipped, { skinTextureUrl: look?.skin || undefined })
      if (mine !== this.generation) return
      applyProportions(group, look?.proportions)
      this.setAvatar(group)
    } catch (err) {
      console.warn('[remotePlayers] avatar load failed', err) // keep the default look
    }
  }

  syncName(name) {
    if (name === this.name) return
    this.name = name
    if (this.tag) {
      this.group.remove(this.tag)
      this.tag.material.map?.dispose()
      this.tag.material.dispose()
    }
    this.tag = label(name || 'Player', 0.5, TAG_STYLE)
    this.tag.position.y = 2.55
    this.group.add(this.tag)
  }

  syncHands(p) {
    // pickaxe model
    const id = PICK_BY_ID[p.tool] ? p.tool : PICKAXES[0].id
    if (id !== this.toolId) {
      this.toolId = id
      for (const c of [...this.tool.children]) {
        this.tool.remove(c)
        disposePickaxe(c)
      }
      this.tool.add(buildPickaxe(PICK_BY_ID[id].look))
      this.inHand = null // re-place it
    }
    this.busy = !!(p.carry || p.held)
    this.toolOut = !this.busy && p.toolOut !== false
    if (this.toolOut !== this.inHand) {
      this.inHand = this.toolOut
      if (this.toolOut) {
        this.hand.add(this.tool)
        this.tool.position.set(0, -0.66, 0.55)
        this.tool.rotation.set(Math.PI / 2, 0, 0)
        this.tool.scale.setScalar(1.25)
      } else {
        // slung across the back (playerfx.js's rest pose)
        this.group.add(this.tool)
        this.tool.position.set(0.05, 1.05, -0.36)
        this.tool.rotation.set(-0.12, 0, 0.75)
        this.tool.scale.setScalar(1)
      }
    }
    // carried block
    const ck = p.carry ? `${p.carry}|${p.carryVariant || ''}` : ''
    if (ck !== this.carryKey) {
      this.carryKey = ck
      this.carry.visible = !!p.carry
      if (p.carry) this.carry.material = this.blockMaterial(p.carry, p.carryVariant || undefined)
    }
    // held car
    const look = p.held || ''
    if (look !== this.heldLook) {
      this.heldLook = look
      this.heldHolder.clear()
      if (look) {
        try {
          const m = buildCar(look)
          m.scale.setScalar(0.34)
          m.rotation.y = -Math.PI / 2 // nose (+X) forward (+Z)
          m.position.y = -0.2
          this.heldHolder.add(m)
        } catch {
          // a look this client does not know
        }
      }
    }
  }

  update(p, dt, t) {
    this.syncName(p.username || 'Player')
    this.syncAvatar(p.avatar)
    this.syncHands(p)

    // A new swing (the counter moved since we last looked) plays from the top.
    if (this.swingSeen !== null && p.swing !== this.swingSeen) this.swingT = 0
    this.swingSeen = p.swing
    if (this.swingT >= 0 && (this.swingT += dt) >= GAME.swing.duration) this.swingT = -1
    // A new emote: the same clip ours would play.
    if (this.emoteSeen !== null && p.emoteSeq !== this.emoteSeen && p.emote) playEmote(() => this.animator, p.emote)
    this.emoteSeen = p.emoteSeq

    const g = this.group
    const k = this.placed ? 1 - Math.exp(-NET.remoteLerp * dt) : 1
    const prevY = g.position.y
    g.position.x += (p.x - g.position.x) * k
    g.position.y += (p.y - g.position.y) * k
    g.position.z += (p.z - g.position.z) * k
    g.rotation.y += angleDelta(g.rotation.y, p.yaw) * k
    this.vy = this.placed ? this.vy + ((g.position.y - prevY) / Math.max(dt, 1e-3) - this.vy) * Math.min(1, dt * 10) : 0
    this.placed = true
    this.animator?.update(dt, { grounded: Math.abs(this.vy) < 1.5, speed: p.speed, verticalVelocity: this.vy, turn: 0, busy: this.busy || this.swingT >= 0 })

    // The hand pivot follows the right shoulder and turns with the arm (game.js does the same).
    const shoulder = this.avatar?.nodes?.ArmR1
    if (shoulder) {
      shoulder.getWorldPosition(tmp)
      g.worldToLocal(tmp)
      this.hand.position.lerp(tmp, 0.5)
    }
    this.hand.rotation.x = -armAngle(this.swingT)
    if (this.carry.visible) this.carry.position.y = 1.2 + Math.sin(t * 6) * 0.03
    this.bubble.update(dt)
  }

  say(text, seconds) {
    this.bubble.say(text, seconds)
  }

  setVisible(on) {
    this.group.visible = on
  }

  dispose() {
    this.generation++ // drop an avatar load in flight
    this.parent.remove(this.group)
    this.bubble.clear()
    disposeAnimator(this.animator)
    for (const c of this.tool.children) disposePickaxe(c)
    if (this.tag) {
      this.tag.material.map?.dispose()
      this.tag.material.dispose()
    }
  }
}

// blockMaterial(theme, variant): the look of a carried block (any garage's base.blockMaterial).
export function createRemotePlayers(scene, { blockMaterial }) {
  const root = new Group()
  scene.add(root)
  const remotes = new Map() // sessionId -> Remote

  return {
    get count() {
      return remotes.size
    },
    remotes, // dev: sessionId -> Remote
    // A chat line for the player whose verified Bloxity id is `userId` (bloxity.onChat); false when
    // they are not drawn here.
    say(userId, text, seconds) {
      if (!userId) return false
      const players = roster()
      let hit = false
      players?.forEach?.((p, id) => {
        if (hit || p.uid !== userId) return
        const r = remotes.get(id)
        if (r) {
          r.say(text, seconds)
          hit = true
        }
      })
      return hit
    },
    // The closest drawn player within `range` m of `pos` (ground distance): { id, name, x, y, z } or null
    // (the Trade prompt, game/trade.js).
    nearest(pos, range) {
      let best = null
      let bestD = range
      for (const [id, r] of remotes) {
        if (!r.group.visible || !r.placed) continue
        const d = Math.hypot(r.group.position.x - pos.x, r.group.position.z - pos.z)
        if (d >= bestD || Math.abs(r.group.position.y - pos.y) > 4) continue
        bestD = d
        best = { id, name: r.name || 'Player', x: r.group.position.x, y: r.group.position.y, z: r.group.position.z }
      }
      return best
    },
    update(dt, t, viewer) {
      const players = roster()
      if (!players) {
        for (const r of remotes.values()) r.dispose()
        remotes.clear()
        return
      }
      const mine = mySessionId()
      const keep = new Set()
      players.forEach((p, id) => {
        if (id === mine) return
        keep.add(id)
        let r = remotes.get(id)
        if (!r) remotes.set(id, (r = new Remote(root, blockMaterial)))
        const visible = Math.hypot(p.x - viewer.x, p.z - viewer.z) < NET.remoteRange
        r.setVisible(visible)
        if (visible) r.update(p, dt, t)
        else {
          r.placed = false // out of range: skip the work, snap into place when it comes back
          r.group.position.set(p.x, p.y, p.z)
        }
      })
      for (const [id, r] of remotes) {
        if (keep.has(id)) continue
        r.dispose()
        remotes.delete(id)
      }
    },
  }
}
