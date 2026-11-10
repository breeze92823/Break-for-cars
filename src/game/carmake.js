// Hotbar car records made outside the break-a-block loop (Fuse Machine results,
// Daily Rewards). Same shape as the cars game.js keeps in state.cars:
// { theme, rarity, name, look, base, level, spent }.
import { BLOCK_THEMES, CAR_ROSTER, RARITY_COLORS, RARITY_INCOME, RARITY_LADDER } from '../config.js'
import { short } from '../lobby/paint.js'

export const tierOf = (rarity) => Math.max(0, RARITY_LADDER.indexOf(rarity))
export const rarityColor = (rarity) => RARITY_COLORS[rarity] ?? '#ffffff'
const themeOf = (rarity) => Object.keys(BLOCK_THEMES).find((k) => BLOCK_THEMES[k].rarity === rarity) ?? 'gold'

// rarity required; name/look default to a roster pick (`pick` index, else random).
export function makeCar({ rarity, name, look, bonus = 1, pick }) {
  const pool = CAR_ROSTER[rarity] ?? CAR_ROSTER.Common
  const p = pool[(pick ?? Math.floor(Math.random() * pool.length)) % pool.length]
  return {
    theme: themeOf(rarity),
    rarity,
    name: name ?? p.name,
    look: look ?? p.look,
    base: Math.max(1, Math.round((RARITY_INCOME[rarity] ?? 3) * bonus * 10) / 10),
    level: 1,
    spent: 0,
  }
}

export const incomeLabel = (car) => `$${car.base < 100 && car.base % 1 ? car.base.toFixed(1) : short(car.base)}/s`
