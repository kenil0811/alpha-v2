// A popover: a small panel under the thing that opened it, or at the pointer for a right-click,
// above everything (a table's scroll box would clip it otherwise). Closes on a click outside,
// Escape (the innermost one only), or the page scrolling away. Inside, the arrow keys, Home and
// End move between a menu's lines and a letter jumps to the next line starting with it; → opens a
// submenu and ← goes back out of it.
import { ChevronRight, Star } from 'lucide-react'
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from './cn.ts'

// Where what floats is drawn (Batch D, 66.12, Kenil's yes 2 Nov): inside the open dialog it
// belongs to, since the browser draws a modal dialog over everything in the page and a menu drawn
// against the window would sit behind it; else against the window.
export function floatRoot(from?: Element | null): Element {
  return (
    from?.closest('dialog[open]') ??
    [...document.querySelectorAll('dialog[open]')].at(-1) ??
    document.body
  )
}

export function Popover({
  anchor,
  point,
  open,
  onClose,
  children,
  align = 'start',
  className,
}: {
  anchor?: RefObject<HTMLElement | null>
  point?: { x: number; y: number } | null // a right-click's place, instead of an anchor
  open: boolean
  onClose: () => void
  children: ReactNode
  align?: 'start' | 'end' | 'side' // side: to the right of the anchor, for a submenu
  className?: string
}) {
  const panel = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) return setAt(null)
    const a = point
      ? { left: point.x, right: point.x, top: point.y, bottom: point.y }
      : anchor?.current?.getBoundingClientRect()
    if (!a) return
    const width = panel.current?.offsetWidth ?? 0
    const height = panel.current?.offsetHeight ?? 0
    let left = align === 'side' ? a.right + 2 : align === 'end' ? a.right - width : a.left
    if (align === 'side' && left + width > window.innerWidth - 8) left = a.left - width - 2
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
    let top = align === 'side' ? a.top - 5 : a.bottom + 4
    if (top + height > window.innerHeight - 8)
      top = Math.max(8, align === 'side' ? window.innerHeight - height - 8 : a.top - height - 4)
    setAt((was) => (was && was.top === top && was.left === left ? was : { top, left }))
  })

  // a menu takes the focus when it opens, on its first line, so the keys work at once
  useEffect(() => {
    if (open && at) {
      const first = panel.current?.querySelector<HTMLElement>(
        '[role=menuitem]:not(:disabled), input, select, textarea',
      )
      if (first?.getAttribute('role') === 'menuitem') first.focus()
    }
  }, [open, at])

  useEffect(() => {
    if (!open) return
    const down = (e: globalThis.MouseEvent) => {
      const t = e.target as Element
      // a click in a submenu, or any panel opened over this one, is not outside
      if (!t.closest?.('[data-popover]') && !anchor?.current?.contains(t)) onClose()
    }
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const panels = document.querySelectorAll('[data-popover]')
      if (panels[panels.length - 1] !== panel.current) return // the innermost closes first
      e.preventDefault() // used here: the screen's own Escape leaves it
      onClose()
      anchor?.current?.focus()
    }
    // a scroll that leaves the anchor where it was (a list scrolled to where it already is) keeps it
    const was = anchor?.current?.getBoundingClientRect()
    const scrolled = (e: Event) => {
      if ((e.target as Element).closest?.('[data-popover]')) return
      const now = anchor?.current?.getBoundingClientRect()
      if (!was || !now || now.top !== was.top || now.left !== was.left) onClose()
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
    // biome-ignore lint/a11y/noStaticElementInteractions: the keys move between the menu's lines, which are buttons
    <div
      ref={panel}
      data-popover
      onKeyDown={move}
      style={{ top: at?.top ?? -9999, left: at?.left ?? -9999 }}
      className={cn(
        'fixed z-(--z-pop) max-h-[calc(100vh-16px)] min-w-48 overflow-y-auto rounded-md border border-line bg-surface p-1 text-md shadow-pop',
        className,
      )}
    >
      {children}
    </div>,
    floatRoot(anchor?.current),
  )
}

// The arrow keys, Home, End and a letter, between the lines of the menu that has the focus.
function move(e: KeyboardEvent<HTMLDivElement>) {
  const now = document.activeElement as HTMLElement | null
  const lines = [
    ...e.currentTarget.querySelectorAll<HTMLElement>('[role=menuitem]:not(:disabled)'),
  ].filter((l) => l.closest('[data-popover]') === e.currentTarget)
  // from a menu's search line, ↓ goes down into its lines
  if (now?.tagName === 'INPUT' && e.key === 'ArrowDown' && lines[0]) {
    e.preventDefault()
    lines[0].focus()
    return
  }
  if (!now?.matches('[role=menuitem]')) return
  const i = lines.indexOf(now)
  const go = (j: number) => {
    e.preventDefault()
    e.stopPropagation()
    lines[(j + lines.length) % lines.length]?.focus()
  }
  if (e.key === 'ArrowDown') go(i + 1)
  else if (e.key === 'ArrowUp') go(i - 1)
  else if (e.key === 'Home') go(0)
  else if (e.key === 'End') go(lines.length - 1)
  else if (e.key.length === 1 && /\S/.test(e.key)) {
    const k = e.key.toLowerCase()
    const after = [...lines.slice(i + 1), ...lines.slice(0, i + 1)]
    const hit = after.find((l) => l.textContent?.trim().toLowerCase().startsWith(k))
    if (hit) go(lines.indexOf(hit))
  }
}

// A line in a popover's menu. One that can't be used stays in the menu, greyed, and says why on
// hover. With `star`, a ★ on its right shows on hover, filled on the default line; a click on the
// ★ makes the line the default (on the default, stops it being one) and never picks the line.
export function MenuItem({
  children,
  onClick,
  checked,
  disabled,
  reason,
  danger,
  hint,
  star,
}: {
  children: ReactNode
  onClick: () => void
  checked?: boolean | undefined
  disabled?: boolean | undefined
  reason?: string | undefined // why it can't be used, shown on hover
  danger?: boolean | undefined
  hint?: ReactNode // on the right: a count, a shortcut
  star?: { on: boolean; onClick: (() => void) | undefined } | undefined // no onClick: kept as it is
}) {
  const off = disabled || !!reason
  const line = (
    <button
      type="button"
      role="menuitem"
      aria-disabled={off || undefined}
      disabled={off}
      data-tip={reason}
      onClick={onClick}
      className={cn(
        'flex h-7.5 w-full items-center gap-2 whitespace-nowrap rounded-sm px-2.5 text-left outline-none hover:bg-hover focus-visible:bg-hover disabled:opacity-50 disabled:hover:bg-transparent',
        danger ? 'text-bad' : 'text-ink',
        // a disabled button gets no pointer events in some browsers; its reason still shows
        off && 'pointer-events-auto cursor-default',
      )}
    >
      <span className="w-3.5 shrink-0 text-accent">{checked ? '✓' : ''}</span>
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
      {hint && <span className="shrink-0 text-ink-3 text-sm">{hint}</span>}
      {star && <span className="size-3.5 shrink-0" />}
    </button>
  )
  if (!star) return line
  return (
    <div className="group relative">
      {line}
      <button
        type="button"
        aria-pressed={star.on}
        aria-label={star.on ? 'The default' : 'Make it the default'}
        data-tip={star.on ? 'The default' : 'Make it the default'}
        disabled={!star.onClick}
        onClick={star.onClick}
        className={cn(
          'absolute top-1/2 right-1.5 grid size-5 -translate-y-1/2 place-items-center rounded-sm text-ink-3 outline-none focus-visible:ring-2 focus-visible:ring-accent-soft enabled:hover:text-accent',
          star.on ? 'text-accent' : 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100',
        )}
      >
        <Star className={cn('size-3.25', star.on && 'fill-current')} />
      </button>
    </div>
  )
}

// A line that opens a menu of its own, on hover, a click or →; ← or Escape goes back.
export function SubMenu({
  label,
  children,
  reason,
  hint,
}: {
  label: ReactNode
  children: ReactNode
  reason?: string | undefined
  hint?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const line = useRef<HTMLButtonElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const later = (to: boolean) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(to), to ? 120 : 250)
  }
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hovering the line or its menu keeps it open
    <div onMouseEnter={() => !reason && later(true)} onMouseLeave={() => later(false)}>
      <button
        ref={line}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={!!reason}
        data-tip={reason}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className="flex h-7.5 w-full items-center gap-2 whitespace-nowrap rounded-sm px-2.5 text-left text-ink outline-none hover:bg-hover focus-visible:bg-hover disabled:pointer-events-auto disabled:opacity-50 disabled:hover:bg-transparent"
      >
        <span className="w-3.5 shrink-0" />
        <span className="flex min-w-0 flex-1 items-center gap-2">{label}</span>
        {hint && <span className="shrink-0 text-ink-3 text-sm">{hint}</span>}
        <ChevronRight className="size-3.5 shrink-0 text-ink-3" />
      </button>
      <Popover anchor={line} open={open} onClose={() => setOpen(false)} align="side">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: ← leaves the submenu */}
        <div
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault()
              setOpen(false)
              line.current?.focus()
            }
          }}
          onClickCapture={(e) => {
            // a choice among the submenu's own lines closes it (not one in a dropdown inside it);
            // its line's own onClick closes the parent
            const t = e.target as Element
            const panel = e.currentTarget.closest('[data-popover]')
            if (t.closest('[role=menuitem]') && t.closest('[data-popover]') === panel)
              setTimeout(() => setOpen(false))
          }}
        >
          {children}
        </div>
      </Popover>
    </div>
  )
}

export function MenuLine() {
  return <div className="my-1 h-px bg-hair" />
}

// A small heading over a group of lines in a menu.
export function MenuHeading({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pt-1.5 pb-0.5 text-ink-3 text-sm">{children}</div>
}

// A right-click menu, opened as well by the keyboard (Shift+F10 or the menu key) on what has the
// focus; the same lines a ⋮ button opens. Spread `on` over the thing it belongs to.
export function useContextMenu() {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
  const on = {
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault()
      setPoint({ x: e.clientX, y: e.clientY })
    },
    onKeyDown: (e: KeyboardEvent) => {
      if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
        e.preventDefault()
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        setPoint({ x: r.left + 8, y: r.bottom })
      }
    },
  }
  return { on, point, open: !!point, close: () => setPoint(null) }
}
