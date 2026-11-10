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

// A stack of outlined text lines, each made of coloured parts; a part's fill is a
// colour or an array of colours (a left-to-right gradient). Used for the block
// labels ("Lucky Block / Common / $100") and the limited-car signs.
// lines: [{ size, parts: [{ text, fill }] }]
export function paintStack(lines, { outline = '#0d0f17', width = 512, pad = 14 } = {}) {
  const c = makeCanvas(width, 16)
  const g = c.getContext('2d')
  const draw = () => {
    const total = lines.reduce((h, l) => h + l.size * 1.12, 0) + pad * 2
    c.height = Math.ceil(total)
    g.clearRect(0, 0, c.width, c.height)
    g.textBaseline = 'middle'
    g.lineJoin = 'round'
    let y = pad
    for (const line of lines) {
      g.font = `700 ${line.size}px ${FONT}`
      const widths = line.parts.map((p) => g.measureText(p.text).width)
      const full = widths.reduce((a, b) => a + b, 0)
      let x = (c.width - full) / 2
      const cy = y + (line.size * 1.12) / 2
      line.parts.forEach((p, i) => {
        g.textAlign = 'left'
        g.lineWidth = Math.max(4, line.size * 0.22)
        g.strokeStyle = outline
        g.strokeText(p.text, x, cy)
        if (Array.isArray(p.fill)) {
          const grad = g.createLinearGradient(x, 0, x + widths[i], 0)
          p.fill.forEach((col, k) => grad.addColorStop(k / (p.fill.length - 1), col))
          g.fillStyle = grad
        } else g.fillStyle = p.fill
        g.fillText(p.text, x, cy)
        x += widths[i]
      })
      y += line.size * 1.12
    }
  }
  draw()
  return { canvas: c, draw }
}

// The garage billboard: owner portrait on the left, "<name>'s / Car Garage / $x/s".
// Draws into `c` (a canvas) so the texture can be repainted when the name changes.
export function paintGarageScreen(c, name, income) {
  const w = c.width
  const h = c.height
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#2b3350')
  grad.addColorStop(1, '#1b2136')
  g.fillStyle = grad
  g.fillRect(0, 0, w, h)
  // portrait: sky-blue tile with a blocky smiling head in a red cap
  const px = 34
  const py = 70
  const ps = 180
  g.fillStyle = '#4fa8e8'
  roundRect(g, px, py, ps, ps, 18)
  g.fill()
  g.fillStyle = '#3d7fc4'
  g.fillRect(px + 40, py + 150, 100, 30) // shoulders
  g.fillStyle = '#f2c79a'
  roundRect(g, px + 45, py + 40, 90, 100, 22)
  g.fill()
  g.fillStyle = '#c4161c'
  roundRect(g, px + 38, py + 22, 104, 40, 14)
  g.fill()
  g.fillRect(px + 30, py + 52, 60, 12)
  g.fillStyle = '#1b1c22'
  g.fillRect(px + 70, py + 82, 9, 16)
  g.fillRect(px + 102, py + 82, 9, 16)
  g.lineWidth = 6
  g.strokeStyle = '#1b1c22'
  g.beginPath()
  g.arc(px + 90, py + 108, 18, 0.15 * Math.PI, 0.85 * Math.PI)
  g.stroke()
  // text
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineJoin = 'round'
  const tx = px + ps + (w - px - ps) / 2
  const line = (text, y, size, fill) => {
    let s = size
    g.font = `700 ${s}px ${FONT}`
    while (g.measureText(text).width > w - px - ps - 40 && s > 18) g.font = `700 ${(s -= 2)}px ${FONT}`
    g.lineWidth = s * 0.2
    g.strokeStyle = '#0d0f17'
    g.strokeText(text, tx, y)
    g.fillStyle = fill
    g.fillText(text, tx, y)
  }
  // name null = nobody in the room owns this garage
  if (name == null) {
    line('Free', 110, 52, '#ffffff')
    line('Car Garage', 180, 46, '#9fb0d8')
    return c
  }
  line(`${name}'s`, 100, 46, '#ffffff')
  line('Car Garage', 160, 46, '#ffffff')
  line(`$${short(income)}/s`, 232, 58, '#6dff3a')
  return c
}

// Steel-truss mullion: a light frame with X bracing, tiled along its length.
export function paintTruss(w = 64, h = 128) {
  const c = makeCanvas(w, h)
  const g = c.getContext('2d')
  g.fillStyle = '#a9b5dc'
  g.fillRect(0, 0, w, h)
  g.strokeStyle = '#dfe6f8'
  g.lineWidth = 7
  g.beginPath()
  g.moveTo(6, 4)
  g.lineTo(w - 6, h / 2)
  g.lineTo(6, h - 4)
  g.moveTo(w - 6, 4)
  g.lineTo(6, h / 2)
  g.lineTo(w - 6, h - 4)
  g.stroke()
  g.strokeStyle = '#6f7ba6'
  g.lineWidth = 8
  g.strokeRect(0, 0, w, h)
  return c
}
