// The side panel: detail on the right, 320px, pushing the content rather than covering it. Given
// `width`, it is the person's to size: its left edge drags it wider (up to two thirds of the
// window) or, dragged all the way in, closes it, Expand makes it half the window and back, and Open page opens it as a screen.
import { Maximize2, Minimize2, SquareArrowOutUpRight, X } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { IconButton } from './button.tsx'
import { cn } from './cn.ts'
import { Edge } from './edge.tsx'

const NARROW = 320

export function SidePanel({
  title,
  onClose,
  children,
  width,
  onWidth,
  full,
  head,
  keep,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  width?: number | null // the person's width; none is the usual 320px
  onWidth?: (w: number | null) => void // the width they left it at
  full?: string // where Open page goes
  head?: ReactNode // a header of its own, in place of the title and its buttons
  keep?: number // the room it always leaves the rest of the window (the rail and the screen)
}) {
  const sizable = onWidth !== undefined
  const [room, setRoom] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setRoom(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  // up to two thirds of the window, and never so wide the screen beside it is squeezed
  const widest = Math.max(
    NARROW,
    Math.min(Math.floor((room * 2) / 3), keep ? room - keep : Number.POSITIVE_INFINITY),
  )
  const clamp = (w: number) => Math.round(Math.min(widest, Math.max(NARROW, w)))
  const [dragged, setDragged] = useState<number | null>(null)
  const shown = clamp(dragged ?? width ?? NARROW)
  const half = clamp(room / 2)
  const wide = shown >= half - 8

  return (
    <aside
      style={sizable ? { width: shown } : undefined}
      className={cn(
        'relative flex min-h-0 shrink-0 flex-col border-line border-l bg-surface',
        !sizable && 'w-80',
      )}
    >
      {sizable && (
        <Edge
          side="left"
          width={shown}
          min={NARROW}
          max={widest}
          onDrag={setDragged}
          onDone={(w) => onWidth?.(w <= NARROW ? null : w)}
          onFold={onClose}
        />
      )}
      {head ?? (
        <div className="flex h-11.5 shrink-0 items-center gap-0.5 border-hair border-b pr-2 pl-4.5 font-semibold text-ink text-md">
          <span className="flex-1 truncate">{title}</span>
          {sizable && (
            <IconButton
              label={wide ? 'Make it narrow' : 'Expand to half the window'}
              onClick={() => onWidth?.(wide ? null : half)}
            >
              {wide ? <Minimize2 className="size-3.75" /> : <Maximize2 className="size-3.75" />}
            </IconButton>
          )}
          {full && (
            <IconButton
              label="Open page"
              onClick={() => {
                window.location.hash = full
              }}
            >
              <SquareArrowOutUpRight className="size-3.75" />
            </IconButton>
          )}
          <IconButton label="Close" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </aside>
  )
}
