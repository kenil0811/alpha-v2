import { flushSync } from 'react-dom'

// Motion's helpers for what leaves (Vikas, 23 Nov): what is finished shows it first, then folds
// away so the rest close up smoothly, and you see where it went. Reduced motion skips straight on.

export const reduced = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export const pause = (ms: number) =>
  reduced() ? Promise.resolve() : new Promise<void>((r) => setTimeout(r, ms))

// Folds an element to nothing (height, padding, border and opacity), and resolves when it has.
// It stays folded until the caller lets it go (unfold), so a list reloading after it never flashes it.
export async function fold(el: HTMLElement | null): Promise<void> {
  if (!el || reduced()) return
  const h = el.getBoundingClientRect().height
  await el.animate(
    [
      { height: `${h}px`, opacity: 1 },
      {
        height: '0px',
        opacity: 0,
        paddingTop: '0px',
        paddingBottom: '0px',
        borderTopWidth: '0px',
        borderBottomWidth: '0px',
        marginTop: '0px',
        marginBottom: '0px',
      },
    ],
    { duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' },
  ).finished
  el.style.overflow = 'hidden'
}

// Lets a folded element show again, when it stayed on after all (a list that keeps finished ones).
export function unfold(el: HTMLElement | null) {
  if (!el) return
  for (const a of el.getAnimations()) a.cancel()
  el.style.overflow = ''
}

// ---- a record grows out of its row, and goes back into it (Vikas, 23 Nov) -----------------------
// The browser's own View Transitions morph one named thing into another; where they are missing,
// or motion is reduced, the change just happens.

// what the person pressed last, so an open knows which row it came from
let pressed: Element | null = null
if (typeof document !== 'undefined')
  document.addEventListener(
    'pointerdown',
    (e) => {
      pressed = e.target instanceof Element ? e.target : null
    },
    true,
  )
const ROW = 'tr, [role="row"], li, button, a'
let grewFrom: HTMLElement | null = null

// One transition; a newer one skips it, which is no failure, so its promises never go unheard.
function transition(update: () => void): ViewTransition {
  const t = document.startViewTransition(update)
  t.ready.catch(() => undefined)
  t.finished.catch(() => undefined)
  return t
}

const canMorph = () =>
  typeof document !== 'undefined' && 'startViewTransition' in document && !reduced()

// Opens what update() draws (a panel marked with this name) out of the row just pressed.
export function grow(update: () => void, name = 'record') {
  const from = pressed?.closest<HTMLElement>(ROW) ?? null
  grewFrom = from
  if (!from || !canMorph()) return update()
  from.style.viewTransitionName = name
  transition(() => {
    from.style.viewTransitionName = ''
    flushSync(update)
  })
}

// Closes it back into the row it grew from, when that row is still there.
export function shrink(update: () => void, name = 'record') {
  const to = grewFrom?.isConnected ? grewFrom : null
  grewFrom = null
  if (!to || !canMorph()) return update()
  const t = transition(() => {
    flushSync(update)
    to.style.viewTransitionName = name
  })
  t.finished
    .catch(() => undefined)
    .then(() => {
      to.style.viewTransitionName = ''
    })
}

// A move from one screen to the next: a short cross-fade, so the page never just swaps.
export function crossFade(update: () => void) {
  if (!canMorph()) return update()
  transition(() => flushSync(update))
}
