import { label } from './propkit.js'

// A chat message over a character's head (docs.bloxity.io, Overhead chat bubbles). Bloxity draws the
// chat itself: the game only shows each player's latest line above their head for the seconds it
// says (Legion.SDK.chat.bubbleSeconds). A newer one replaces it.
const STYLE = { color: '#1a1420', outline: '#ffffff', font: '700 64px Fredoka, sans-serif', outlineWidth: 12 }

export function createBubble(group, y) {
  let sprite = null
  let left = 0
  function clear() {
    if (!sprite) return
    group.remove(sprite)
    sprite.material.map?.dispose()
    sprite.material.dispose()
    sprite = null
  }
  return {
    say(text, seconds) {
      clear()
      if (!text) return
      sprite = label(text, 0.42, STYLE)
      sprite.position.y = y
      sprite.renderOrder = 6
      group.add(sprite)
      left = seconds
    },
    update(dt) {
      if (left > 0 && (left -= dt) <= 0) clear()
    },
    clear,
  }
}
