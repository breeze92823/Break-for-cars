// The world-space interaction prompt: a dark pill with a key badge and
// "Action / Object" text, pinned over its target on screen. Holding E (or
// pressing and holding the prompt itself on touch / with the mouse) fills the
// ring; a target with hold 0 fires on the press. After firing, the key must be
// released before it fires again.
import { Vector3 } from 'three'
import * as sfx from './audio.js'

const RING = 2 * Math.PI * 21

export function createPrompt(layer, camera) {
  const el = document.createElement('div')
  el.className = 'ix-prompt'
  el.innerHTML = `<div class="ix-key"><svg viewBox="0 0 50 50"><circle class="bg" cx="25" cy="25" r="21"/><circle class="fg" cx="25" cy="25" r="21" stroke-dasharray="${RING}" stroke-dashoffset="${RING}"/></svg><span class="cap">E</span></div><div class="ix-text"><span class="ix-action"></span><span class="ix-object"></span></div>`
  layer.appendChild(el)
  const fg = el.querySelector('.fg')
  const cap = el.querySelector('.cap')
  const actionEl = el.querySelector('.ix-action')
  const objectEl = el.querySelector('.ix-object')

  let target = null
  let pressing = false
  let latched = false // fired; wait for release
  let progress = 0
  const v = new Vector3()

  const press = () => {
    if (pressing) return
    pressing = true
    if (target && !latched && !(target.hold > 0)) fire()
  }
  const release = () => {
    pressing = false
    latched = false
    progress = 0
    paintRing()
  }
  function fire() {
    latched = true
    progress = 0
    paintRing()
    el.classList.remove('pop')
    void el.offsetWidth
    el.classList.add('pop')
    target?.onDone()
  }
  const paintRing = () => fg.setAttribute('stroke-dashoffset', String(RING * (1 - progress)))

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyE' || e.repeat || e.target instanceof HTMLInputElement) return
    press()
  })
  window.addEventListener('keyup', (e) => e.code === 'KeyE' && release())
  window.addEventListener('blur', release)
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      // Capture is optional.
    }
    press()
  })
  el.addEventListener('pointerup', release)
  el.addEventListener('pointercancel', release)

  return {
    // t: { id, action, object, color?, hold (s), anchor: Vector3 (world), onDone } or null
    set(t) {
      if (!t) {
        if (target) {
          target = null
          el.classList.remove('show')
          progress = 0
          paintRing()
        }
        return
      }
      const changed = !target || target.id !== t.id
      target = t
      if (changed) {
        progress = 0
        latched = pressing // a held key does not carry over to the next target
        paintRing()
        el.classList.add('show')
        sfx.blip()
      }
      if (actionEl.textContent !== t.action) actionEl.textContent = t.action
      if (objectEl.textContent !== t.object) objectEl.textContent = t.object
      objectEl.style.color = t.color ?? ''
      const touch = document.body.classList.contains('touch-ui')
      const capText = touch ? (t.hold > 0 ? 'HOLD' : 'TAP') : 'E'
      if (cap.textContent !== capText) cap.textContent = capText
      cap.classList.toggle('word', touch)
    },
    update(dt) {
      if (!target) return
      v.copy(target.anchor).project(camera)
      const behind = v.z > 1
      el.style.visibility = behind ? 'hidden' : ''
      if (!behind) {
        const x = (v.x * 0.5 + 0.5) * window.innerWidth
        const y = (-v.y * 0.5 + 0.5) * window.innerHeight
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`
      }
      if (pressing && !latched && target.hold > 0) {
        progress = Math.min(1, progress + dt / target.hold)
        paintRing()
        if (progress >= 1) fire()
      }
    },
  }
}
