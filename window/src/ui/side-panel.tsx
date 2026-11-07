// The side panel: detail on the right, 320px, pushing the content rather than covering it. Given
// `width`, it is the person's to size: its left edge drags it wider (up to two thirds of the
// window) or, dragged all the way in, closes it, Expand makes it half the window and back, and Open page opens it as a screen.
import { ArrowLeft, Maximize2, Minimize2, SquareArrowOutUpRight, X } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { Button, IconButton } from './button.tsx'
import { cn } from './cn.ts'
import { Edge, SIDE_MIN } from './edge.tsx'
import { slideIn } from './slide.ts'

const NARROW = 320 // its usual width; it narrows to SIDE_MIN (Batch D, 79.1)

export function SidePanel({
  title,
  onClose,
  children,
  width,
  onWidth,
  full,
  head,
  keep,
  onBack,
  slides = false,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  width?: number | null // the person's width; none is the usual 320px
  onWidth?: (w: number | null) => void // the width they left it at
  full?: string // where Open page goes: a large button across the panel's foot (Batch D, 79.10)
  onBack?: (() => void) | undefined // a step back inside the panel (79.8)
  head?: ReactNode // a header of its own, in place of the title and its buttons
  keep?: number // the room it always leaves the rest of the window (the rail and the screen)
  slides?: boolean // the assistant: it slides in and out from the right, like the rail (slide.ts)
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
    SIDE_MIN,
    Math.min(Math.floor((room * 2) / 3), keep ? room - keep : Number.POSITIVE_INFINITY),
  )
  const clamp = (w: number) => Math.round(Math.min(widest, Math.max(SIDE_MIN, w)))
  const [dragged, setDragged] = useState<number | null>(null)
  const shown = clamp(dragged ?? width ?? NARROW)
  const half = clamp(room / 2)
  const wide = shown >= half - 8

  return (
    <aside
      ref={slides ? slideIn('right') : undefined}
      data-slide={slides ? 'right' : undefined}
      style={sizable ? { width: shown } : undefined}
      className={cn(
        // a firmer edge and a soft shadow, so it reads as lying over the page (Batch E, 66.15)
        'relative z-(--z-raised) flex min-h-0 shrink-0 flex-col border-edge border-l bg-surface shadow-(--elev-side)',
        !sizable && 'w-80',
      )}
    >
      {sizable && (
        <Edge
          side="left"
          width={shown}
          max={widest}
          onDrag={setDragged}
          onDone={(w) => onWidth?.(w === NARROW ? null : w)}
          onFold={onClose}
        />
      )}
      {head ?? (
        <div className="flex h-11.5 shrink-0 items-center gap-0.5 border-hair border-b pr-2 pl-4.5 font-semibold text-ink text-md">
          {onBack && (
            <IconButton label="Back" onClick={onBack}>
              <ArrowLeft className="size-4" />
            </IconButton>
          )}
          <span className="flex-1 truncate">{title}</span>
          {sizable && (
            <IconButton
              label={wide ? 'Make it narrow' : 'Expand to half the window'}
              onClick={() => onWidth?.(wide ? null : half)}
            >
              {wide ? <Minimize2 className="size-3.75" /> : <Maximize2 className="size-3.75" />}
            </IconButton>
          )}
          <IconButton label="Close" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      {full && (
        <div className="shrink-0 border-hair border-t p-2.5">
          <Button
            variant="soft"
            className="w-full"
            onClick={() => {
              window.location.hash = full
            }}
          >
            <SquareArrowOutUpRight className="size-3.75" />
            Open page
          </Button>
        </div>
      )}
    </aside>
  )
}
