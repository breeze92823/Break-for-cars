// Keeps the screen on while the game is open (Screen Wake Lock API), so a phone does not
// dim and lock while the player stands idle (the cars keep earning). The browser drops the
// lock whenever the tab is hidden, so it is asked for again when the tab returns, and on the
// first touch / key / click in case the page was not allowed to ask before a user gesture.
// Never throws: unsupported browsers (older iOS, insecure pages, iframes without
// `allow="screen-wake-lock"`) just keep their normal screen timeout.
let lock = null
let pending = false

async function acquire() {
  if (lock || pending || document.visibilityState !== 'visible') return
  if (!('wakeLock' in navigator)) return
  pending = true
  try {
    lock = await navigator.wakeLock.request('screen')
    lock.addEventListener('release', () => {
      lock = null
    })
  } catch {
    lock = null
  } finally {
    pending = false
  }
}

export function installWakeLock() {
  acquire()
  document.addEventListener('visibilitychange', acquire)
  for (const type of ['pointerdown', 'keydown'])
    window.addEventListener(type, acquire, { passive: true })
}
