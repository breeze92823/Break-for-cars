// The "New Update!" window: what the latest update added, with pictures of its best cars. It opens
// by itself once per NEWS.version for a player who has not seen it, and closes with X or the button.
// Seen = the newest version shown, kept in this browser (NEWS.saveKey) and, for a signed-in player,
// on the game server (backend news.ts): net.js sends `newsSync` { seen } once joined and the server
// answers `news` { tracked, seen }; closing sends `newsSeen` { version }. A guest / offline player
// decides from this browser alone (`decide()` after a timeout when no answer comes).
import { CAR_ROSTER, NEWS, RARITY_LADDER } from '../config.js'
import { renderSideCarIcons } from '../hud/thumbnails.js'
import { rarityColor } from './carmake.js'
import './pickshop.css'
import './windows.css'

const STAR = `<svg viewBox="0 0 100 100"><path d="M50 6 L62 36 L94 38 L69 58 L78 90 L50 72 L22 90 L31 58 L6 38 L38 36 Z" fill="#ffe14a" stroke="#0d0f17" stroke-width="6" stroke-linejoin="round"/><path d="M50 22 L57 40 L76 41 L61 53" fill="none" stroke="#fff7c0" stroke-width="5" stroke-linecap="round"/></svg>`

const ROSTER = RARITY_LADDER.flatMap((rarity) => (CAR_ROSTER[rarity] ?? []).map((c) => ({ ...c, rarity })))

// onShow() (close the other windows), onSeen(version) (tell the server)
export function createNews(layer, { sfx, onShow, onSeen }) {
  let seen = 0
  try {
    seen = Math.max(0, Math.floor(Number(localStorage.getItem(NEWS.saveKey)) || 0))
  } catch {
    // blocked storage: shows this session
  }
  const save = () => {
    try {
      localStorage.setItem(NEWS.saveKey, String(seen))
    } catch {
      // ignore
    }
  }

  const cars = NEWS.showcase.map((n) => ROSTER.find((c) => c.name === n)).filter(Boolean)
  const root = document.createElement('div')
  root.className = 'pick-shop news-shop'
  root.innerHTML = `<div class="pick-win news-win" role="dialog" aria-label="${NEWS.title}">
    <div class="pick-head win-news studs"><span class="pick-ico">${STAR}</span><span class="pick-title ol">${NEWS.title}</span><button class="pick-x studs" aria-label="Close"><span class="ol">X</span></button></div>
    <div class="pick-body news-body">
      <div class="news-headline ol">${NEWS.headline}</div>
      <div class="news-text ol-thin">${NEWS.text}</div>
      <div class="news-grid">${cars
        .map(
          (c) => `<div class="news-card" style="--glow:${rarityColor(c.rarity)}">
            <span class="news-new ol">NEW!</span>
            <img alt="" data-look="${c.look}">
            <div class="news-name ol">${c.name}</div>
            <div class="news-rarity ol" style="color:${rarityColor(c.rarity)}">${c.rarity}</div>
          </div>`,
        )
        .join('')}</div>
      <button class="lego-btn green studs news-go"><span class="ol">${NEWS.button}</span></button>
    </div>
  </div>`
  layer.appendChild(root)

  let open = false
  let pictures = false
  let decided = false
  function show() {
    if (open) return
    open = true
    if (!pictures) {
      pictures = true
      const icons = renderSideCarIcons([...new Set(cars.map((c) => c.look))])
      for (const img of root.querySelectorAll('img[data-look]')) img.src = icons[img.dataset.look]
    }
    onShow?.()
    root.classList.add('show')
    sfx.reveal?.(4)
  }
  function hide() {
    if (!open) return
    open = false
    root.classList.remove('show')
    sfx.close?.()
    if (seen < NEWS.version) {
      seen = NEWS.version
      save()
      onSeen?.(seen)
    }
  }
  root.querySelector('.pick-x').addEventListener('click', hide)
  root.querySelector('.news-go').addEventListener('click', hide)

  // Opens the window if this player has not seen this update (once per page load).
  function decide() {
    if (decided) return
    decided = true
    if (seen < NEWS.version) setTimeout(show, 800)
  }

  return {
    open: show,
    close: hide,
    toggle: () => (open ? hide() : show()),
    get isOpen() {
      return open
    },
    // The version this browser has seen (net.js `newsSync`).
    get seen() {
      return seen
    },
    // The server's `news` { tracked, seen }: a signed-in player's account may have seen it elsewhere.
    sync(msg) {
      if (msg?.tracked && Number.isFinite(msg.seen) && msg.seen > seen) {
        seen = Math.floor(msg.seen)
        save()
        if (open && seen >= NEWS.version) hide()
      }
      decide()
    },
    decide,
  }
}
