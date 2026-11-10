import { CanvasTexture, SRGBColorSpace } from 'three'
import { mulberry32 } from '../textures.js'

// Canvas painters for the lobby props: mystery-block faces, leaderboard boards,
// titles and screens. Text uses Fredoka; callers repaint once the font loads.

const FONT = 'Fredoka, "Arial Black", sans-serif'

export function canvasTex(c) {
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  return t
}

function makeCanvas(w, h = w) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

// One face of a mystery block: framed colour, bevel, and a big outlined "?".
export function paintBlockFace(theme, size = 256) {
  const c = makeCanvas(size)
  const g = c.getContext('2d')
  const draw = () => {
    g.clearRect(0, 0, size, size)
    g.fillStyle = theme.edge
    g.fillRect(0, 0, size, size)
    const m = size * 0.085
    g.fillStyle = theme.base
    g.fillRect(m, m, size - m * 2, size - m * 2)
    if (theme.grid) {
      g.strokeStyle = theme.edge
      g.globalAlpha = 0.35
      g.lineWidth = 2
      for (let i = 1; i < 8; i++) {
        const p = m + ((size - m * 2) * i) / 8
        g.beginPath()
        g.moveTo(p, m)
        g.lineTo(p, size - m)
        g.moveTo(m, p)
        g.lineTo(size - m, p)
        g.stroke()
      }
      g.globalAlpha = 1
    }
    if (theme.stars) {
      const rand = mulberry32(31)
      const grad = g.createRadialGradient(size * 0.3, size * 0.3, 0, size * 0.5, size * 0.5, size * 0.7)
      grad.addColorStop(0, '#ff6ad5')
      grad.addColorStop(0.5, theme.base)
      grad.addColorStop(1, '#1b0a5c')
      g.fillStyle = grad
      g.fillRect(m, m, size - m * 2, size - m * 2)
      g.fillStyle = '#ffffff'
      for (let i = 0; i < 40; i++) {
        const r = rand() * 2.2 + 0.6
        g.globalAlpha = 0.5 + rand() * 0.5
        g.beginPath()
        g.arc(m + rand() * (size - m * 2), m + rand() * (size - m * 2), r, 0, Math.PI * 2)
        g.fill()
      }
      g.globalAlpha = 1
    }
    // bevel: light top-left, dark bottom-right
    g.fillStyle = 'rgba(255,255,255,0.28)'
    g.fillRect(m, m, size - m * 2, size * 0.05)
    g.fillRect(m, m, size * 0.05, size - m * 2)
    g.fillStyle = 'rgba(0,0,0,0.18)'
    g.fillRect(m, size - m - size * 0.05, size - m * 2, size * 0.05)
    g.fillRect(size - m - size * 0.05, m, size * 0.05, size - m * 2)
    // corner rivets
    g.fillStyle = theme.edge
    for (const [x, y] of [[m * 2, m * 2], [size - m * 2, m * 2], [m * 2, size - m * 2], [size - m * 2, size - m * 2]]) {
      g.beginPath()
      g.arc(x, y, size * 0.03, 0, Math.PI * 2)
      g.fill()
    }
    g.font = `700 ${size * 0.66}px ${FONT}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineJoin = 'round'
    g.lineWidth = size * 0.07
    g.strokeStyle = theme.ink
    g.strokeText('?', size / 2, size * 0.54)
    g.fillStyle = theme.mark
    g.fillText('?', size / 2, size * 0.54)
  }
  draw()
  return { canvas: c, draw }
}

const BOARD_STYLE = {
  cash: { title: 'Cash', color: '#7dff1a', dark: '#2f8a00', unit: (v) => '$' + short(v) },
  playtime: { title: 'PlayTime', color: '#1ee6ff', dark: '#007f9c', unit: (v) => `${Math.floor(v / 60)}h ${v % 60}m` },
  income: { title: 'Total Income', color: '#ff22e8', dark: '#8a0080', unit: (v) => '$' + short(v) + '/s' },
}
export const boardStyle = (kind) => BOARD_STYLE[kind]

export function short(v) {
  const units = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx']
  let i = 0
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000
    i++
  }
  return (i === 0 ? String(Math.round(v)) : v.toFixed(2).replace(/\.?0+$/, '')) + units[i]
}

const ROW_COLORS = ['#ffd84a', '#d9e2f2', '#f0a466', '#f2ead6', '#f2ead6', '#f2ead6', '#f2ead6', '#f2ead6']
const AVATAR_TONES = ['#f2c79a', '#8d5a3b', '#e9b98f', '#c58c5c', '#f5d2b0', '#6b4128', '#e0a77a', '#b07246']

// The board inside a leaderboard frame: top-three avatars, then ranked rows.
// `entries` = [{ name, value }] sorted best first (placeholder until the backend exists).
export function paintBoard(kind, entries, w = 512, h = 760) {
  const st = BOARD_STYLE[kind]
  const c = makeCanvas(w, h)
  const g = c.getContext('2d')
  const avatar = (x, y, r, i) => {
    g.fillStyle = '#20232c'
    g.beginPath()
    g.arc(x, y, r + 5, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#c9d3e6'
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
    // tiny blocky head + hair
    g.fillStyle = AVATAR_TONES[i % AVATAR_TONES.length]
    g.fillRect(x - r * 0.45, y - r * 0.45, r * 0.9, r * 0.95)
    g.fillStyle = ['#2b1a10', '#f0d36a', '#111', '#8a3b12', '#f3f3f3'][i % 5]
    g.fillRect(x - r * 0.5, y - r * 0.6, r, r * 0.3)
    g.fillStyle = '#111'
    g.fillRect(x - r * 0.25, y - r * 0.1, r * 0.12, r * 0.15)
    g.fillRect(x + r * 0.13, y - r * 0.1, r * 0.12, r * 0.15)
  }
  const draw = () => {
    g.fillStyle = '#eef1f8'
    g.fillRect(0, 0, w, h)
    g.fillStyle = st.color
    g.globalAlpha = 0.18
    g.fillRect(0, 0, w, h * 0.2)
    g.globalAlpha = 1
    // podium avatars: #2 #1 #3
    const top = [1, 0, 2]
    top.forEach((rank, i) => {
      const x = w * (0.22 + i * 0.28)
      const y = h * (rank === 0 ? 0.095 : 0.115)
      avatar(x, y, rank === 0 ? 46 : 38, rank)
      g.font = `700 26px ${FONT}`
      g.textAlign = 'center'
      g.fillStyle = '#20232c'
      g.fillText(`#${rank + 1}`, x, y + 66)
    })
    const rowsTop = h * 0.235
    const rowH = (h - rowsTop - 18) / entries.length
    entries.forEach((e, i) => {
      const y = rowsTop + i * rowH
      g.fillStyle = ROW_COLORS[i] ?? '#f2ead6'
      roundRect(g, 14, y + 4, w - 28, rowH - 8, 12)
      g.fill()
      g.strokeStyle = 'rgba(0,0,0,0.25)'
      g.lineWidth = 3
      g.stroke()
      g.textBaseline = 'middle'
      g.textAlign = 'left'
      g.font = `700 ${rowH * 0.42}px ${FONT}`
      g.fillStyle = '#20232c'
      g.fillText(`#${i + 1}`, 28, y + rowH / 2)
      avatar(118, y + rowH / 2, rowH * 0.28, i + 3)
      g.font = `600 ${rowH * 0.36}px ${FONT}`
      g.fillText(e.name, 160, y + rowH / 2)
      g.textAlign = 'right'
      g.font = `700 ${rowH * 0.36}px ${FONT}`
      g.fillStyle = st.dark
      g.fillText(st.unit(e.value), w - 30, y + rowH / 2)
    })
  }
  draw()
  return { canvas: c, draw }
}

// Big outlined title over a leaderboard ("Cash" / "Global Leaderboard").
export function paintTitle(text, sub, color, w = 768, h = 300) {
  const c = makeCanvas(w, h)
  const g = c.getContext('2d')
  const draw = () => {
    g.clearRect(0, 0, w, h)
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineJoin = 'round'
    let size = 150
    g.font = `700 ${size}px ${FONT}`
    while (g.measureText(text).width > w - 60 && size > 40) g.font = `700 ${(size -= 6)}px ${FONT}`
    g.lineWidth = 22
    g.strokeStyle = '#151826'
    g.strokeText(text, w / 2, h * 0.36)
    g.fillStyle = color
    g.fillText(text, w / 2, h * 0.36)
    // white sheen on the upper half of the letters
    g.save()
    g.globalCompositeOperation = 'source-atop'
    g.fillStyle = 'rgba(255,255,255,0.25)'
    g.fillRect(0, h * 0.12, w, h * 0.16)
    g.restore()
    g.font = `700 64px ${FONT}`
    g.lineWidth = 14
    g.strokeText(sub, w / 2, h * 0.8)
    g.fillStyle = '#ffffff'
    g.fillText(sub, w / 2, h * 0.8)
  }
  draw()
  return { canvas: c, draw }
}

// A dark display screen with glowing text lines (shop billboard, machine screen).
export function paintScreen(lines, color, w = 512, h = 256) {
  const c = makeCanvas(w, h)
  const g = c.getContext('2d')
  const draw = () => {
    const grad = g.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, '#0b0f1a')
    grad.addColorStop(1, '#141c2e')
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
    // scanlines
    g.fillStyle = 'rgba(255,255,255,0.035)'
    for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 2)
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    lines.forEach((ln, i) => {
      g.font = `700 ${ln.size}px ${FONT}`
      g.shadowColor = ln.color ?? color
      g.shadowBlur = 18
      g.fillStyle = ln.color ?? color
      g.fillText(ln.text, w / 2, h * ln.y)
      g.shadowBlur = 0
      void i
    })
  }
  draw()
  return { canvas: c, draw }
}

// Soft swirl ribbon (player tool aura): a bright arc fading along its length.
export function paintSwirl(size = 256) {
  const c = makeCanvas(size)
  const g = c.getContext('2d')
  const cx = size / 2
  for (let i = 0; i < 60; i++) {
    const t = i / 60
    g.strokeStyle = `rgba(160, 235, 255, ${(1 - t) * 0.9})`
    g.lineWidth = size * 0.05 * (1 - t * 0.7)
    g.beginPath()
    g.arc(cx, cx, size * 0.4, t * Math.PI * 1.4, (t + 1 / 60) * Math.PI * 1.4 + 0.02)
    g.stroke()
  }
  return c
}
