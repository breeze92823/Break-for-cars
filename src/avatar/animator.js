// Procedural locomotion animator, ported from Clean Leaves for Loot (itself from
// +1 Cut Grass Adventure's PlayerAnimator + LocomotionCycle). States idle / run /
// airborne / landing are blended through pose buffers; the walk and run are ONE
// cycle at two depths, its phase advancing with distance travelled so the feet
// stay planted at any speed. Writes only to bones and the avatar root's
// rotation / position.y (the player group owns world placement).
import { Euler, MathUtils, Quaternion } from 'three'
import { ANIM } from '../config.js'
import { PlayerRig, PoseBuffer } from './rig.js'

const TAU = Math.PI * 2
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const lerp = (a, b, t) => a + (b - a) * t
const ease = (t) => t * t * (3 - 2 * t)
const smoothstep = (e0, e1, v) => ease(clamp((v - e0) / (e1 - e0 || 1), 0, 1))
const kneeCurve = (phase) => {
  const raw = Math.sin(phase - Math.PI / 2.6)
  return raw > 0 ? raw * raw : 0
}

const L = ANIM.locomotion

const euler = new Euler()
const delta = new Quaternion()
const target = new Quaternion()

// A Bloxity emote track's [[seconds, xDeg, yDeg, zDeg], ...] at time t into `euler`: smoothstep
// between keys, held outside them (docs.bloxity.io, Emotes: "Playing it").
function sampleTrack(keys, t) {
  let i = 1
  while (i < keys.length - 1 && keys[i][0] < t) i++
  const a = keys[i - 1] ?? keys[0]
  const b = keys[i] ?? a
  const s = ease(clamp((t - a[0]) / (b[0] - a[0] || 1), 0, 1))
  const at = (n) => MathUtils.degToRad(lerp(a[n], b[n], s) || 0)
  euler.set(at(1), at(2), at(3), 'XYZ')
}

export function makeAnimator(root) {
  if (!root) return null
  return new PlayerAnimator(root)
}

export function disposeAnimator(animator) {
  animator?.dispose()
}

class PlayerAnimator {
  constructor(root) {
    this.root = root
    this.rig = new PlayerRig(root)
    this.target = new PoseBuffer()
    this.from = new PoseBuffer()
    this.output = new PoseBuffer()
    this.scratch = new PoseBuffer()
    this.state = 'idle'
    this.stateTime = 0
    this.blendTime = 0
    this.blendDuration = 0
    this.phase = 0
    this.idleTime = 0
    this.airTime = 0
    this.bank = 0
    this.overlay = null // optional (pose, dt) => void, set by game code
    this.emote = null // { tracks: [{ bone, keys }], len, loop, time, weight, leaving }
    this.binds = new Map() // bone -> bind quaternion, of every bone an emote has moved
    for (const b of this.rig.bindings) this.binds.set(b.bone, b.rest)
    this.posed = new Set(this.rig.bindings.map((b) => b.bone)) // bones the rig rewrites every frame
  }

  dispose() {
    for (const [bone, bind] of this.binds) bone.quaternion.copy(bind)
    this.rig.resetToBindPose()
    this.root.rotation.set(0, 0, 0)
    this.root.position.y = 0
  }

  // input: { grounded, speed, verticalVelocity, turn (-1..1), busy (hands full or swinging) }
  update(dt, input) {
    if (!(dt > 0)) return
    this.stateTime += dt
    this.resolveState(dt, input)
    this.writePose(dt, input)
    this.blend(dt)
    this.overlay?.(this.output, dt) // game poses (carrying, hammer swing) override bones last
    this.rig.applyPose(this.output)
    this.applyEmote(dt, input)
    this.applyVisual(dt, input)
  }

  // clip: { len, loop, tracks: { bone: [[seconds, xDeg, yDeg, zDeg], ...] } }, from Bloxity's
  // catalogue (standard rig bone names). Bones this rig lacks are skipped; never throws.
  playEmote(clip) {
    const len = Number(clip?.len)
    if (!(len > 0) || !clip.tracks || typeof clip.tracks !== 'object') return
    const tracks = []
    for (const [name, keys] of Object.entries(clip.tracks)) {
      const bone = this.root.nodes?.[name]
      if (!bone || !Array.isArray(keys) || !keys.length || !keys.every(Array.isArray)) continue
      if (!this.binds.has(bone)) this.binds.set(bone, bone.quaternion.clone())
      tracks.push({ bone, keys })
    }
    if (tracks.length) this.emote = { tracks, len, loop: !!clip.loop, time: 0, weight: this.emote?.weight ?? 0, leaving: false }
  }

  // The clip goes on top of the pose, as degree deltas right-multiplied onto each bone's bind
  // quaternion. Moving, jumping, a full pair of hands or a swing ends it, and so does a clip that
  // doesn't loop running out.
  applyEmote(dt, input) {
    const e = this.emote
    if (!e) return
    e.time += dt
    if (input.speed >= L.idleSpeed || !input.grounded || input.busy || (!e.loop && e.time >= e.len)) e.leaving = true
    e.weight = clamp(e.weight + ((e.leaving ? -1 : 1) * dt) / ANIM.emoteFade, 0, 1)
    const t = e.loop ? e.time % e.len : Math.min(e.time, e.len)
    const k = ease(e.weight)
    for (const { bone, keys } of e.tracks) {
      const bind = this.binds.get(bone)
      if (!this.posed.has(bone)) bone.quaternion.copy(bind)
      sampleTrack(keys, t)
      bone.quaternion.slerp(target.copy(bind).multiply(delta.setFromEuler(euler)), k)
    }
    if (e.leaving && e.weight === 0) this.emote = null
  }

  resolveState(dt, input) {
    if (!input.grounded) {
      // Ignore the few frames of a step down a ledge; only a real drop is airborne.
      this.airTime += dt
      if (this.airTime > ANIM.airborneDelay) this.setState('airborne', ANIM.transitions.toAirborne)
      return
    }
    this.airTime = 0
    if (this.state === 'airborne') {
      this.setState('landing', ANIM.transitions.toLanding)
      return
    }
    if (this.state === 'landing' && this.stateTime < ANIM.landing.duration) return
    this.setState(input.speed < L.idleSpeed ? 'idle' : 'run', ANIM.transitions.toLocomotion)
  }

  setState(next, duration) {
    if (next === this.state) return
    this.from.copyFrom(this.output)
    this.state = next
    this.stateTime = 0
    this.blendTime = 0
    this.blendDuration = duration
  }

  writePose(dt, input) {
    const t = this.target
    switch (this.state) {
      case 'idle': {
        // Ease the stride back to a neutral standing phase.
        const goal = this.phase > Math.PI ? TAU : 0
        this.phase += (goal - this.phase) * (1 - Math.exp(-8 * dt))
        if (this.phase >= TAU - 1e-4) this.phase = 0
        this.idleTime += dt
        const breath = Math.sin(this.idleTime * ANIM.idle.breathFrequency * TAU)
        t.applyDefinition(ANIM.idle.basePose)
        t.add('Spine1', breath * ANIM.idle.breathAmount)
        t.add('Neck1', -breath * ANIM.idle.breathAmount * 0.6)
        t.bobY = breath * ANIM.idle.breathBob
        break
      }
      case 'run': {
        const frequency = clamp(input.speed / L.strideDistance, L.minFrequency, L.maxFrequency)
        this.phase = (this.phase + frequency * TAU * dt) % TAU
        this.writeLocomotion(t, input.speed)
        break
      }
      case 'airborne': {
        const rising = clamp(input.verticalVelocity / ANIM.airborne.velocityReference, -1, 1)
        t.applyDefinition(ANIM.airborne.fall)
        this.scratch.applyDefinition(ANIM.airborne.rise)
        t.lerpBetween(t, this.scratch, clamp(0.5 + rising * 0.5, 0, 1))
        t.bobY = 0
        break
      }
      case 'landing': {
        const depth = 1 - ease(clamp(this.stateTime / ANIM.landing.duration, 0, 1))
        t.applyDefinition(ANIM.landing.pose, depth)
        t.bobY = ANIM.landing.bobY * depth
        break
      }
    }
  }

  // One cycle at two depths (walk -> run), derived from actual speed.
  writeLocomotion(out, speed) {
    const run = smoothstep(L.walkSpeed, L.runSpeed, speed)
    const sprint = smoothstep(L.runSpeed, L.sprintSpeed, speed) * 0.4
    const depth = (d) => lerp(lerp(d.walk, d.run, run), d.sprint, sprint)
    const phase = this.phase
    const swing = Math.sin(phase)
    const opposite = -swing
    const hip = depth(L.hipSwing)
    const knee = depth(L.kneeBend)
    const arm = depth(L.armSwing)
    const elbow = depth(L.elbowBend)
    const twist = depth(L.torsoTwist)
    const lean = depth(L.torsoLean)
    const headTwist = depth(L.headCounterTwist)
    const roll = depth(L.torsoRoll)
    const bob = depth(L.bob)

    out.reset()
    // Thighs half a cycle apart; the stride is pushed back more than forward at speed.
    const back = 1 + sprint * 0.35
    out.set('LegL1', hip * (swing > 0 ? swing : swing * back))
    out.set('LegR1', hip * (opposite > 0 ? opposite : opposite * back))
    out.set('LegL2', knee * kneeCurve(phase))
    out.set('LegR2', knee * kneeCurve(phase + Math.PI))
    // Arms counter-swing against the leg on the same side.
    out.set('ArmL1', arm * opposite - sprint * 0.25, 0, sprint * 0.12)
    out.set('ArmR1', arm * swing - sprint * 0.25, 0, -sprint * 0.12)
    out.set('ArmL2', elbow + elbow * 0.35 * Math.max(0, opposite))
    out.set('ArmR2', elbow + elbow * 0.35 * Math.max(0, swing))
    // Torso leans in, twists with the stride and rolls on the footfall.
    out.set('Spine1', lean, twist * opposite, roll * Math.sin(phase * 2))
    out.set('Spine2', lean * 0.4, twist * 0.5 * opposite, 0)
    out.set('Neck1', -lean * 0.7, headTwist * swing, 0)
    out.bobY = -bob * Math.cos(phase * 2)
  }

  blend(dt) {
    if (this.blendDuration > 0) {
      this.blendTime += dt
      const t = clamp(this.blendTime / this.blendDuration, 0, 1)
      this.output.lerpBetween(this.from, this.target, ease(t))
      if (t >= 1) this.blendDuration = 0
    } else {
      this.output.copyFrom(this.target)
    }
  }

  applyVisual(dt, input) {
    const wantBank = this.state === 'run' ? -input.turn * L.bankAngle * 0.6 : 0
    this.bank += (wantBank - this.bank) * (1 - Math.exp(-L.bankRate * dt))
    this.root.rotation.set(0, 0, this.bank)
    this.root.position.y = this.output.bobY
  }
}
