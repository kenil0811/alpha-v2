// The side panel: detail on the right, 320px, pushing the content rather than covering it. Given
// `width`, it is the person's to size: its left edge drags it wider (up to two thirds of the
// window), Expand makes it half the window and back, and Open full opens it as a screen.
import { Maximize2, Minimize2, SquareArrowOutUpRight, X } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { IconButton } from './button.tsx'
import { cn } from './cn.ts'

const NARROW = 320

export function SidePanel({
  title,
  onClose,
  children,
  width,
  onWidth,
  full,
  head,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  width?: number | null // the person's width; none is the usual 320px
  onWidth?: (w: number | null) => void // the width they left it at
  full?: string // where Open full goes
  head?: ReactNode // a header of its own, in place of the title and its buttons
}) {
  const sizable = onWidth !== undefined
  const [room, setRoom] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setRoom(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const widest = Math.max(NARROW, Math.floor((room * 2) / 3))
  const clamp = (w: number) => Math.round(Math.min(widest, Math.max(NARROW, w)))
  const [dragged, setDragged] = useState<number | null>(null)
  const shown = clamp(dragged ?? width ?? NARROW)
  const half = clamp(room / 2)
  const wide = shown >= half - 8
  const from = useRef<{ x: number; w: number } | null>(null)

  return (
    <aside
      style={sizable ? { width: shown } : undefined}
      className={cn(
        'relative flex min-h-0 shrink-0 flex-col border-line border-l bg-surface',
        !sizable && 'w-80',
      )}
    >
      {sizable && (
        <div
          title="Drag to make it wider or narrower"
          className={cn(
            '-left-1 absolute inset-y-0 z-10 w-2 cursor-col-resize transition-colors hover:bg-accent-line/40',
            dragged !== null && 'bg-accent-line/40',
          )}
          onPointerDown={(e) => {
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)
            from.current = { x: e.clientX, w: shown }
            setDragged(shown)
          }}
          onPointerMove={(e) => {
            if (from.current) setDragged(clamp(from.current.w + from.current.x - e.clientX))
          }}
          onPointerUp={(e) => {
            if (!from.current) return
            const w = clamp(from.current.w + from.current.x - e.clientX)
            from.current = null
            setDragged(null)
            onWidth?.(w <= NARROW ? null : w)
          }}
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
              label="Open full"
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
