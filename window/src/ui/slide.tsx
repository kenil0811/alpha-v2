// Side panels slide instead of jumping: the page beside them eases into its new width over a fifth
// of a second. A panel is clipped only while it moves, so its edge and shadow show once it is
// still, and a drag moves it at once.
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { cn } from './cn.ts'

export const SLIDE_MS = 200
const EASE = 'duration-200 ease-out motion-reduce:transition-none'

// Whether what a panel is keyed by changed in the last fifth of a second.
function useMoving(key: unknown, still: boolean): boolean {
  const [moving, setMoving] = useState(false)
  const last = useRef(key)
  useLayoutEffect(() => {
    if (Object.is(last.current, key)) return
    last.current = key
    if (still) return
    setMoving(true)
    const t = setTimeout(() => setMoving(false), SLIDE_MS + 20)
    return () => clearTimeout(t)
  }, [key, still])
  return moving
}

// A panel that is always there, whose width changes: the rail, open and folded.
export function SlideWidth({
  width,
  still = false,
  children,
}: {
  width: number
  still?: boolean // being dragged: it follows the pointer
  children: ReactNode
}) {
  const moving = useMoving(width, still)
  return (
    <div
      style={{ width }}
      className={cn(
        'flex shrink-0',
        moving && 'overflow-hidden',
        !still && 'transition-[width]',
        EASE,
      )}
    >
      {children}
    </div>
  )
}

// A panel that comes and goes: the assistant. It grows from its edge and shrinks back, drawn until
// it has gone.
export function SlideIn({ open, children }: { open: boolean; children: ReactNode }) {
  const [present, setPresent] = useState(open)
  const [wide, setWide] = useState(open)
  useLayoutEffect(() => {
    if (open) {
      setPresent(true)
      const f = requestAnimationFrame(() => setWide(true))
      return () => cancelAnimationFrame(f)
    }
    setWide(false)
    const t = setTimeout(() => setPresent(false), SLIDE_MS)
    return () => clearTimeout(t)
  }, [open])
  const moving = useMoving(wide, false)
  if (!present) return null
  return (
    <div
      // its one row as tall as the window, so what is in it scrolls inside it
      style={{ gridTemplateColumns: wide ? '1fr' : '0fr', gridTemplateRows: 'minmax(0, 1fr)' }}
      className={cn('grid shrink-0 transition-[grid-template-columns]', EASE)}
    >
      <div className={cn('flex min-h-0 min-w-0', (moving || !wide) && 'overflow-hidden')}>
        {children}
      </div>
    </div>
  )
}
