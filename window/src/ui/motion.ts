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
let pressedBox: DOMRect | null = null // where it was, for a burst once it has folded away
if (typeof document !== 'undefined')
  document.addEventListener(
    'pointerdown',
    (e) => {
      pressed = e.target instanceof Element ? e.target : null
      pressedBox = pressed?.getBoundingClientRect() ?? null
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

// ---- earned moments (motion, 23 Nov) ---------------------------------------------------------
// One small burst from what was just pressed, at a real milestone only: the last thing waiting on
// you answered, this Mac's setup finished. Never on a routine click; never in Set up Alpha (U3).
const BITS = ['--opt-1', '--opt-2', '--opt-3', '--opt-4', '--accent', '--good']
let pressedAt = 0
if (typeof document !== 'undefined')
  document.addEventListener('pointerdown', () => {
    pressedAt = Date.now()
  })

// Whether the person pressed something just now, so a milestone is theirs and not an agent's.
export const justPressed = (ms = 4000) => Date.now() - pressedAt < ms

export function celebrate(from: Element | null = pressed) {
  if (reduced() || typeof document === 'undefined') return
  const r = from?.isConnected
    ? from.getBoundingClientRect()
    : (pressedBox ?? { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 })
  const x = r.left + r.width / 2
  const y = r.top + r.height / 2
  for (let i = 0; i < 28; i++) {
    const b = document.createElement('i')
    Object.assign(b.style, {
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
      width: '7px',
      height: '10px',
      borderRadius: '2px',
      pointerEvents: 'none',
      zIndex: 'var(--z-tip)',
      background: `var(${BITS[i % BITS.length]})`,
    })
    document.body.append(b)
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2
    const v = 80 + Math.random() * 110
    const dx = Math.cos(a) * v
    const dy = Math.sin(a) * v
    b.animate(
      [
        { transform: 'translate(0, 0) rotate(0)', opacity: 1 },
        {
          transform: `translate(${dx}px, ${dy}px) rotate(${Math.random() * 360}deg)`,
          opacity: 1,
          offset: 0.55,
        },
        {
          transform: `translate(${dx * 1.2}px, ${dy + 110}px) rotate(${Math.random() * 720}deg)`,
          opacity: 0,
        },
      ],
      {
        duration: 1100 + Math.random() * 400,
        easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)',
        fill: 'forwards',
      },
    ).onfinish = () => b.remove()
  }
}

// ---- a card picked up to drag lifts with a slight tilt, and settles where it is dropped ---------
export function lift(el: HTMLElement) {
  if (reduced()) return
  el.classList.add('drag-lift') // the picture the pointer carries is taken now
  requestAnimationFrame(() => {
    el.classList.remove('drag-lift')
    el.classList.add('drag-source')
  })
}
export function settle(el: HTMLElement) {
  el.classList.remove('drag-lift', 'drag-source')
  if (reduced()) return
  el.animate([{ transform: 'rotate(2.5deg) scale(1.04)' }, { transform: 'none' }], {
    duration: 320,
    easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.15)',
  })
}
