// The inner edge of a side panel, to drag it wider or narrower. It shows
// only on hover or keyboard focus. Dragged well past the narrowest width, the panel folds to its
// strip; arrow keys step it 24px.
import { useRef, useState } from 'react'
import { cn } from './cn.ts'

export function Edge({
  side,
  width,
  min,
  max,
  onDrag,
  onDone,
  onFold,
}: {
  side: 'left' | 'right' // which edge of the panel it sits on
  width: number
  min: number
  max: number
  onDrag: (w: number | null) => void // the width while dragging; null when it ends
  onDone: (w: number) => void // the width it was left at
  onFold: () => void
}) {
  const from = useRef<{ x: number; w: number } | null>(null)
  const [on, setOn] = useState(false)
  const clamp = (w: number) => Math.round(Math.min(max, Math.max(min, w)))
  const raw = (x: number) =>
    from.current
      ? from.current.w + (side === 'left' ? from.current.x - x : x - from.current.x)
      : width
  return (
    // biome-ignore lint/a11y/useSemanticElements: a vertical splitter has no element of its own
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-label="Drag to resize; drag all the way in to fold"
      tabIndex={0}
      title="Drag to resize; drag all the way in to fold"
      className={cn(
        'absolute inset-y-0 z-10 w-2 cursor-col-resize outline-none transition-colors hover:bg-accent-line/40 focus-visible:bg-accent-line/40',
        side === 'left' ? '-left-1' : '-right-1',
        on && 'bg-accent-line/40',
      )}
      onKeyDown={(e) => {
        const step = e.key === 'ArrowLeft' ? -24 : e.key === 'ArrowRight' ? 24 : 0
        if (!step) return
        e.preventDefault()
        onDone(clamp(width + (side === 'left' ? -step : step)))
      }}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        from.current = { x: e.clientX, w: width }
        setOn(true)
      }}
      onPointerMove={(e) => {
        if (from.current) onDrag(clamp(raw(e.clientX)))
      }}
      onPointerCancel={() => {
        from.current = null
        setOn(false)
        onDrag(null)
      }}
      onLostPointerCapture={() => {
        if (!from.current) return
        from.current = null
        setOn(false)
        onDrag(null)
      }}
      onPointerUp={(e) => {
        if (!from.current) return
        const w = raw(e.clientX)
        from.current = null
        setOn(false)
        onDrag(null)
        if (w < min - 60) onFold()
        else onDone(clamp(w))
      }}
    />
  )
}
