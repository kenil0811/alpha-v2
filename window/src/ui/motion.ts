import { useEffect, useRef, useState } from 'react'

// Motion's helpers for what leaves : what is finished shows it first, then folds away so the
// rest close up smoothly, and you see where it went. Reduced motion skips straight on.

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

// ---- what is on its way out ---------------------------------------------------------------------
// A finished task is saved and a card's answer is sent at once, never after the animation; what
// leaves is held here, by its id, and a list drawn through useLeaving keeps drawing it where it
// was until its animation lets it go, whatever a live update says meanwhile (ui-rules L23).
const out = new Set<string>()
const listeners = new Set<() => void>()
const told = () => {
  for (const f of listeners) f()
}

// Holds a thing on its way out; the returned call lets it go.
export function hold(id: string): () => void {
  out.add(id)
  told()
  return () => {
    out.delete(id)
    told()
  }
}

// The items as drawn: any on their way out that a live update dropped, put back where they were.
export function keepLeaving<T>(
  items: readonly T[],
  last: readonly T[],
  idOf: (t: T) => string,
): T[] {
  const shown = [...items]
  last.forEach((t, i) => {
    const k = idOf(t)
    if (out.has(k) && !items.some((x) => idOf(x) === k))
      shown.splice(Math.min(i, shown.length), 0, t)
  })
  return shown
}

// A list's items through keepLeaving, drawn again as things are held and let go.
export function useLeaving<T>(items: readonly T[], idOf: (t: T) => string): T[] {
  const [, redraw] = useState(0)
  useEffect(() => {
    const f = () => redraw((n) => n + 1)
    listeners.add(f)
    return () => {
      listeners.delete(f)
    }
  }, [])
  const last = useRef<readonly T[]>(items)
  const shown = keepLeaving(items, last.current, idOf)
  last.current = shown
  return shown
}

// The order that keeps a change safe: it is sent at once, the thing is held and animated out while
// it goes, and if it did not go the thing comes back (back) and the failure is thrown to say so.
export async function leaveWith(
  id: string,
  send: () => Promise<unknown>,
  animate: () => Promise<void>,
  back: () => void,
): Promise<void> {
  const release = hold(id)
  const sent = send().then(
    () => null,
    (err: unknown) => err ?? new Error('It did not go.'),
  )
  try {
    await animate()
    const failed = await sent
    if (failed) {
      back()
      throw failed
    }
  } finally {
    release()
  }
}

// what the person pressed last, and where it was, for a burst once it has folded away
let pressed: Element | null = null
let pressedBox: DOMRect | null = null
if (typeof document !== 'undefined')
  document.addEventListener(
    'pointerdown',
    (e) => {
      pressed = e.target instanceof Element ? e.target : null
      pressedBox = pressed?.getBoundingClientRect() ?? null
    },
    true,
  )

// ---- earned moments ----------------------------------------------------------------------------
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
