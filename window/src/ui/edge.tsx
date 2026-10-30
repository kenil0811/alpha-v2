// The inner edge of a side panel, the same on the rail and the assistant (Vikas, 27 Oct): it
// drags the panel wider or narrower; dragged past the narrowest width, the panel folds to its
// strip at once; from the strip, dragged out, it opens at the width it is let go at, a shadow
// showing that width while it moves. It shows on hover or keyboard focus; arrow keys step 24px.
import { useRef, useState } from 'react'
import { cn } from './cn.ts'

// Both panels' narrowest open width, and how far past it a drag goes before the panel folds.
export const SIDE_MIN = 200
const FOLD_PAST = 48
export const STRIP = 80 // a folded panel's strip

// A place on a folded strip, the rail's and the assistant's alike (Vikas, 28 Oct): its icon with
// its name under it, so a folded panel still reads without hovering.
export const stripItem = (current = false) =>
  cn(
    'relative flex w-full shrink-0 flex-col items-center gap-0.5 rounded-md px-0.5 py-1.5 text-xs',
    current ? 'bg-accent-soft text-accent' : 'text-ink-3 hover:bg-hover hover:text-ink',
  )
export const stripName = 'w-full truncate text-center leading-tight'

export function Edge({
  side,
  width,
  min = SIDE_MIN,
  max,
  folded = false,
  onDrag,
  onDone,
  onFold,
}: {
  side: 'left' | 'right' // which edge of the panel it sits on
  width: number
  min?: number
  max: number
  folded?: boolean // on the folded strip: a drag out opens the panel
  onDrag: (w: number | null) => void // the width while dragging; null when it ends
  onDone: (w: number) => void // the width it was left at (from the strip: opens at it)
  onFold: () => void
}) {
  const from = useRef<{ x: number; w: number } | null>(null)
  const [on, setOn] = useState(false)
  const clamp = (w: number) => Math.round(Math.min(max, Math.max(min, w)))
  const raw = (x: number) =>
    from.current
      ? from.current.w + (side === 'left' ? from.current.x - x : x - from.current.x)
      : width
  const end = () => {
    from.current = null
    setOn(false)
    onDrag(null)
  }
  const label = folded ? 'Drag out to open' : 'Drag to resize; drag past the narrowest to fold'
  return (
    // biome-ignore lint/a11y/useSemanticElements: a vertical splitter has no element of its own
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-label={label}
      tabIndex={0}
      data-tip={label}
      className={cn(
        'absolute inset-y-0 z-(--z-raised) w-2 cursor-col-resize outline-none transition-colors hover:bg-accent-line/40 focus-visible:bg-accent-line/40',
        side === 'left' ? '-left-1' : '-right-1',
        on && 'bg-accent-line/40',
      )}
      onKeyDown={(e) => {
        const step = e.key === 'ArrowLeft' ? -24 : e.key === 'ArrowRight' ? 24 : 0
        if (!step) return
        e.preventDefault()
        const w = width + (side === 'left' ? -step : step)
        if (folded) {
          if (w > width) onDone(min)
        } else if (w < min) onFold()
        else onDone(clamp(w))
      }}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        from.current = { x: e.clientX, w: width }
        setOn(true)
      }}
      onPointerMove={(e) => {
        if (!from.current) return
        const w = raw(e.clientX)
        if (folded) return onDrag(Math.min(max, Math.max(width, w)))
        // past the narrowest, it folds there and then
        if (w < min - FOLD_PAST) {
          end()
          return onFold()
        }
        onDrag(clamp(w))
      }}
      onPointerCancel={end}
      onLostPointerCapture={() => {
        if (from.current) end()
      }}
      onPointerUp={(e) => {
        if (!from.current) return
        const w = raw(e.clientX)
        end()
        if (folded) {
          if (w > width + FOLD_PAST) onDone(clamp(w))
        } else onDone(clamp(w))
      }}
    />
  )
}

// What a folded panel would open to while its edge is dragged out: a shadow against its side of
// the window.
export function Opening({ side, width }: { side: 'left' | 'right'; width: number | null }) {
  if (width === null) return null
  return (
    <div
      aria-hidden="true"
      style={{ width }}
      className={cn(
        'pointer-events-none fixed inset-y-0 z-(--z-overlay) border-accent-line bg-accent-soft/60',
        side === 'left' ? 'left-0 border-r' : 'right-0 border-l',
      )}
    />
  )
}
