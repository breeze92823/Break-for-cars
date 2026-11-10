// Canvas painters for the game objects: the health label over a placed block,
// the yellow upgrade sign by each car, and the money written on a collect pad.
import { RARITY_COLORS } from '../config.js'
import { short } from '../lobby/paint.js'

const FONT = 'Fredoka, "Arial Black", sans-serif'
const INK = '#0d0f17'

function rr(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

// Outlined text centred on (x, y), shrunk to fit maxW.
function text(g, s, x, y, size, fill, maxW = Infinity, outline = 0.22) {
  let px = size
  g.font = `700 ${px}px ${FONT}`
  while (g.measureText(s).width > maxW && px > 12) g.font = `700 ${(px -= 2)}px ${FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineJoin = 'round'
  g.lineWidth = px * outline
  g.strokeStyle = INK
  g.strokeText(s, x, y)
  g.fillStyle = fill
  g.fillText(s, x, y)
}

export function makeCanvas(w, h) {
  return Object.assign(document.createElement('canvas'), { width: w, height: h })
}

// "Epic Lucky Block / Epic / [=====  7K/7K]"
export function paintHpLabel(c, theme, hp, max) {
  const g = c.getContext('2d')
  const w = c.width
  g.clearRect(0, 0, w, c.height)
  text(g, theme.name, w / 2, 38, 58, '#ffffff', w - 20)
  text(g, theme.rarity, w / 2, 98, 48, RARITY_COLORS[theme.rarity] ?? '#fff', w - 20)
  const bx = 46
  const by = 136
  const bw = w - 92
  const bh = 62
  rr(g, bx, by, bw, bh, 18)
  g.fillStyle = '#1b2030'
  g.fill()
  g.lineWidth = 8
  g.strokeStyle = INK
  g.stroke()
  const f = Math.max(0, Math.min(1, hp / max))
  if (f > 0) {
    g.save()
    rr(g, bx + 6, by + 6, bw - 12, bh - 12, 12)
    g.clip()
    const col = f > 0.5 ? '#43e83a' : f > 0.25 ? '#ffc21a' : '#ff4a2e'
    g.fillStyle = col
    g.fillRect(bx + 6, by + 6, (bw - 12) * f, bh - 12)
    g.fillStyle = 'rgba(255,255,255,0.28)'
    g.fillRect(bx + 6, by + 6, (bw - 12) * f, (bh - 12) * 0.38)
    g.restore()
  }
  text(g, `${short(Math.max(0, Math.ceil(hp)))}/${short(max)}`, w / 2, by + bh / 2 + 2, 40, '#ffffff')
}

// The yellow upgrade sign: an up arrow, "$cost" and "Lvl n > Lvl n+1" (or MAX).
export function paintUpgradeSign(c, cost, level, maxed, affordable) {
  const g = c.getContext('2d')
  const w = c.width
  const h = c.height
  g.clearRect(0, 0, w, h)
  rr(g, 6, 6, w - 12, h - 12, 26)
  const grad = g.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, maxed ? '#c9cfdc' : '#ffe14a')
  grad.addColorStop(1, maxed ? '#8d95a8' : '#ffb800')
  g.fillStyle = grad
  g.fill()
  g.lineWidth = 10
  g.strokeStyle = INK
  g.stroke()
  // arrow
  const ax = 78
  const ay = h / 2
  g.beginPath()
  g.moveTo(ax, ay - 70)
  g.lineTo(ax + 56, ay - 8)
  g.lineTo(ax + 24, ay - 8)
  g.lineTo(ax + 24, ay + 62)
  g.lineTo(ax - 24, ay + 62)
  g.lineTo(ax - 24, ay - 8)
  g.lineTo(ax - 56, ay - 8)
  g.closePath()
  g.fillStyle = maxed ? '#eef1f7' : '#ff9a0a'
  g.fill()
  g.lineWidth = 9
  g.lineJoin = 'round'
  g.strokeStyle = INK
  g.stroke()
  const tx = (150 + w - 16) / 2
  if (maxed) {
    text(g, 'MAX', tx, h / 2 - 22, 92, '#ffffff', w - 180)
    text(g, `Lvl ${level}`, tx, h / 2 + 62, 52, '#2b6cff', w - 180)
  } else {
    text(g, `$${short(cost)}`, tx, h / 2 - 24, 88, affordable ? '#ffffff' : '#ff5a4a', w - 180)
    text(g, `Lvl ${level} > Lvl ${level + 1}`, tx, h / 2 + 62, 50, '#2b6cff', w - 180, 0.18)
  }
}

// The pad money: "$54K", written along the pad's length.
export function paintPadMoney(c, amount) {
  const g = c.getContext('2d')
  g.clearRect(0, 0, c.width, c.height)
  g.save()
  g.translate(c.width / 2, c.height / 2)
  g.rotate(-Math.PI / 2)
  text(g, '$' + short(Math.floor(amount)), 0, 4, 92, '#ffffff', c.height - 30, 0.2)
  g.restore()
}
