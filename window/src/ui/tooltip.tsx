// The window's one tooltip: a short phrase under the thing it names, shortly after the pointer
// rests on it or at once when the keyboard reaches it. Anything with a `data-tip` gets it (an
// IconButton always does; a control that can't be used puts its reason there), so a screen never
// draws its own. Mounted once; it sits above everything, against the window, so nothing clips it.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { floatRoot } from './popover.tsx'

const WAIT = 150

// An element's tip shown now: a double-click on what can't change says why.
export const tipNow = (el: Element) => el.dispatchEvent(new Event('alpha:tip', { bubbles: true }))

export function Tooltips() {
  const [on, setOn] = useState<HTMLElement | null>(null)
  const [at, setAt] = useState<{ top: number; left: number } | null>(null)
  const label = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let showing = false // once one shows, the next comes at once
    const tipped = (t: EventTarget | null) =>
      (t as Element | null)?.closest?.<HTMLElement>('[data-tip]:not([data-tip=""])') ?? null
    const show = (el: HTMLElement | null, wait: number) => {
      clearTimeout(timer)
      if (!el) {
        showing = false
        return setOn(null)
      }
      timer = setTimeout(
        () => {
          showing = true
          setOn(el)
        },
        showing ? 0 : wait,
      )
    }
    const hide = () => show(null, 0)
    const over = (e: PointerEvent) => {
      const el = tipped(e.target)
      if (el !== tipped(e.relatedTarget)) show(el, WAIT)
    }
    const out = (e: PointerEvent) => !e.relatedTarget && hide() // the pointer left the window
    const focus = (e: FocusEvent) => {
      const el = tipped(e.target)
      if (el && (e.target as Element).matches(':focus-visible')) show(el, 0)
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && hide()
    const now = (e: Event) => show(tipped(e.target), 0)
    document.addEventListener('alpha:tip', now)
    window.addEventListener('hashchange', hide) // a new place: the tip of the last one goes
    document.addEventListener('pointerover', over)
    document.addEventListener('pointerout', out)
    document.addEventListener('pointerdown', hide, true)
    document.addEventListener('focusin', focus)
    document.addEventListener('focusout', hide)
    document.addEventListener('keydown', key)
    document.addEventListener('scroll', hide, true)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('alpha:tip', now)
      window.removeEventListener('hashchange', hide)
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerout', out)
      document.removeEventListener('pointerdown', hide, true)
      document.removeEventListener('focusin', focus)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('keydown', key)
      document.removeEventListener('scroll', hide, true)
    }
  }, [])

  // under the thing, centred on it; above it when there is no room below; never past an edge
  useLayoutEffect(() => {
    if (!on?.isConnected) return setAt(null)
    const a = on.getBoundingClientRect()
    const width = label.current?.offsetWidth ?? 0
    const height = label.current?.offsetHeight ?? 0
    const left = Math.max(8, Math.min(a.left + a.width / 2 - width / 2, innerWidth - width - 8))
    let top = a.bottom + 6
    if (top + height > innerHeight - 8) top = a.top - height - 6
    setAt((was) => (was && was.top === top && was.left === left ? was : { top, left }))
  })

  const text = on?.isConnected ? on.dataset.tip : undefined
  if (!text) return null
  return createPortal(
    <div
      ref={label}
      role="tooltip"
      style={{ top: at?.top ?? -9999, left: at?.left ?? -9999 }}
      className="pointer-events-none fixed z-(--z-tip) max-w-80 truncate rounded-sm border border-line bg-surface px-2 py-1 text-ink text-sm shadow-pop"
    >
      {text}
    </div>,
    floatRoot(on),
  )
}
