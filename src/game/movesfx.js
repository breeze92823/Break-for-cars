// The local player's body sounds, driven once a frame from main.js: footsteps
// in time with the avatar's stride (same cadence as avatar/animator.js), a
// push-off on each jump, a landing thud scaled by the fall, and a swoop on
// respawn. The surface underfoot is grass at ground level and hard lego plastic
// on anything raised (road, plazas, aprons, garage floors, stairs).
import { player } from '../player.js'
import { ANIM } from '../config.js'
import * as sfx from './audio.js'

const L = ANIM.locomotion
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))
const GRASS_TOP = 0.04 // feet higher than this stand on something built (grass feet ~0.02, road ~0.07)

let phase = 0.5 // 0..1 between footfalls; starts half way so the first step comes quickly
let side = 1
let airTime = 0
let fallSpeed = 0
let wasGrounded = true
let jumps = 0
let respawns = 0

const surface = () => (player.position.y > GRASS_TOP ? 'hard' : 'grass')

export function updateMoveSounds(dt) {
  if (player.respawns !== respawns) {
    respawns = player.respawns
    sfx.respawn()
    airTime = fallSpeed = 0
    wasGrounded = true
    phase = 0.5
    return
  }
  if (player.jumps !== jumps) {
    jumps = player.jumps
    sfx.jump(surface())
  }

  if (!player.grounded) {
    airTime += dt
    fallSpeed = Math.max(fallSpeed, -player.velocity.y)
    wasGrounded = false
    return
  }
  if (!wasGrounded) {
    // Ignore the few frames of a step down a ledge, like the animator does.
    if (airTime > 0.12) {
      sfx.land(clamp((fallSpeed - 4) / 14, 0, 1), surface())
      phase = 0.2 // the next footfall waits a little after the landing
    }
    airTime = fallSpeed = 0
    wasGrounded = true
  }

  const speed = Math.hypot(player.velocity.x, player.velocity.z)
  if (speed < L.idleSpeed) {
    phase = 0.5
    return
  }
  // Two footfalls per stride cycle.
  phase += clamp(speed / L.strideDistance, L.minFrequency, L.maxFrequency) * 2 * dt
  if (phase >= 1) {
    phase -= Math.floor(phase)
    side = -side
    sfx.footstep(surface(), clamp((speed - L.walkSpeed) / (L.sprintSpeed - L.walkSpeed), 0, 1), side)
  }
}
