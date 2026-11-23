// Motion's two helpers for what leaves (Vikas, 23 Nov): what is finished shows it first, then folds
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
