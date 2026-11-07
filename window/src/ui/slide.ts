// The rail and the assistant come and go alike (Vikas, 3 Nov): opened or folded by a click or a
// key, each slides a short way from its own edge, the same timing on both sides. Folded by a drag,
// it stays under the pointer (Batch D), and with reduced motion nothing slides.
type Side = 'left' | 'right'

const MS = 180
const away = (side: Side) => ({
  opacity: 0,
  transform: `translateX(${side === 'left' ? -12 : 12}px)`,
})
const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
// when a click or a key last swapped each side, so only what it brought slides in
const swapped: Record<Side, number> = { left: 0, right: 0 }
const leaving: Record<Side, boolean> = { left: false, right: false }

// Folds (`fold`) or opens the panel on `side` by `change`, sliding: an open panel, marked
// `data-slide`, slides out first; what replaces it slides in.
export function slide(side: Side, fold: boolean, change: () => void) {
  if (leaving[side]) return
  const open = document.querySelector<HTMLElement>(`[data-slide="${side}"]`)
  const swap = () => {
    leaving[side] = false
    swapped[side] = performance.now()
    change()
  }
  if (!fold || !open || still()) return swap()
  leaving[side] = true
  open
    .animate([{}, away(side)], { duration: MS, easing: 'ease-in', fill: 'forwards' })
    .finished.then(swap, swap)
}

// The ref for a side's panel or strip: it slides in when a click or a key just brought it.
export const slideIn = (side: Side) => (el: HTMLElement | null) => {
  if (!el || performance.now() - swapped[side] > 300) return
  swapped[side] = 0
  if (!still()) el.animate([away(side), {}], { duration: MS, easing: 'ease-out' })
}
