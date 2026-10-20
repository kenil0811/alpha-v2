// A popover: a small panel under the thing that opened it, above everything (a table's scroll box
// would clip it otherwise). Closes on a click outside, Escape, or the page scrolling away.
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from './cn.ts'

export function Popover({
  anchor,
  open,
  onClose,
  children,
  align = 'start',
  className,
}: {
  anchor: RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
  children: ReactNode
  align?: 'start' | 'end'
  className?: string
}) {
  const panel = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) return setAt(null)
    const a = anchor.current?.getBoundingClientRect()
    if (!a) return
    const width = panel.current?.offsetWidth ?? 0
    const height = panel.current?.offsetHeight ?? 0
    let left = align === 'end' ? a.right - width : a.left
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
    let top = a.bottom + 4
    if (top + height > window.innerHeight - 8) top = Math.max(8, a.top - height - 4)
    setAt((was) => (was && was.top === top && was.left === left ? was : { top, left }))
  })

  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => {
      const t = e.target as Node
      if (!panel.current?.contains(t) && !anchor.current?.contains(t)) onClose()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const scrolled = (e: Event) => {
      if (!panel.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    document.addEventListener('scroll', scrolled, true)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', key)
      document.removeEventListener('scroll', scrolled, true)
    }
  }, [open, onClose, anchor])

  if (!open) return null
  return createPortal(
    <div
      ref={panel}
      style={{ top: at?.top ?? -9999, left: at?.left ?? -9999 }}
      className={cn(
        'fixed z-50 min-w-48 rounded-md border border-line bg-surface p-1 text-md shadow-pop',
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  )
}

// A line in a popover's menu.
export function MenuItem({
  children,
  onClick,
  checked,
  disabled,
  danger,
}: {
  children: ReactNode
  onClick: () => void
  checked?: boolean | undefined
  disabled?: boolean | undefined
  danger?: boolean | undefined
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-7.5 w-full items-center gap-2 whitespace-nowrap rounded-sm px-2.5 text-left hover:bg-hover disabled:opacity-50',
        danger ? 'text-bad' : 'text-ink',
      )}
    >
      <span className="w-3.5 shrink-0 text-accent">{checked ? '✓' : ''}</span>
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
    </button>
  )
}

export function MenuLine() {
  return <div className="my-1 h-px bg-hair" />
}
