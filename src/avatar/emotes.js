// Bloxity's emotes: the wheel is theirs, this plays what is picked (ours, and the others' as net.js
// relays them). The catalogue is read once, the first time one is needed, since the SDK may not know
// its hosts any sooner. Never throws: an unknown id or an unreadable catalogue plays nothing.
// See animator.js playEmote.
import { fetchEmotes } from '../bloxity.js'

let clips = null // Promise of Map id -> clip

function catalogue() {
  clips ??= fetchEmotes()
    .then((list) => new Map(list.filter((e) => e?.id && e.clip).map((e) => [String(e.id), e.clip])))
    .catch((err) => {
      clips = null // the next emote asks again
      console.warn('[emotes] catalogue failed', err)
      return new Map()
    })
  return clips
}

// The animator is asked for once the clip is in hand: the avatar may have been rebuilt meanwhile.
export async function playEmote(animatorNow, id) {
  try {
    const clip = (await catalogue()).get(id)
    if (clip) animatorNow()?.playEmote(clip)
  } catch (err) {
    console.warn('[emotes] play failed', err)
  }
}
