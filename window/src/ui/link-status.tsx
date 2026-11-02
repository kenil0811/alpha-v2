// Where a link goes, at the window's foot (Batch D, 66.24, Kenil's yes 2 Nov), as a browser's
// status bar says it: while the pointer rests on a link to a place in Alpha, a small line names
// it ("Settings › Usage"); an outside one shows its address with the outside mark. Mounted once.
import { ArrowRight, ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { floatRoot } from './popover.tsx'

const word = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replaceAll('-', ' ')

// A place's name from its address (#/settings/usage: Settings › Usage); one thing's (#/row/r1) from
// the link's own words, since an id names nothing.
export function placeName(href: string, said?: string | null): string {
  const [kind = '', rest, ...more] = href.replace(/^#\/?/, '').split(/[/?&]/)
  if (!kind) return 'Home'
  const own = said?.replace(/\s+/g, ' ').trim()
  if (rest && (/\d/.test(rest) || rest.length > 20 || more.length))
    return own && own.length <= 60 ? `${word(kind)}: ${own}` : word(kind)
  return rest ? `${word(kind)} › ${word(rest)}` : word(kind)
}

export function whereTo(el: Element): { outside: boolean; text: string } | null {
  const href = el.getAttribute('href')
  if (!href) return null
  if (href.startsWith('#'))
    return {
      outside: false,
      text: placeName(href, el.getAttribute('aria-label') ?? el.textContent),
    }
  if (/^mailto:/i.test(href)) return { outside: true, text: href.slice(7) }
  return { outside: true, text: new URL(href, window.location.href).href }
}

export function LinkStatus() {
  const [on, setOn] = useState<Element | null>(null)
  useEffect(() => {
    const over = (e: PointerEvent) =>
      setOn((e.target as Element | null)?.closest?.('a[href]') ?? null)
    const off = () => setOn(null)
    document.addEventListener('pointerover', over)
    document.addEventListener('pointerdown', off, true)
    document.addEventListener('scroll', off, true)
    return () => {
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerdown', off, true)
      document.removeEventListener('scroll', off, true)
    }
  }, [])
  const to = on?.isConnected ? whereTo(on) : null
  if (!to) return null
  return createPortal(
    <div
      role="status"
      className="pointer-events-none fixed bottom-3 left-3 z-(--z-tip) flex max-w-[min(36rem,calc(100vw-24px))] items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-0.5 text-ink-2 text-sm shadow-pop"
    >
      {to.outside ? (
        <ExternalLink className="size-3.25 shrink-0 text-ink-3" aria-label="Outside Alpha" />
      ) : (
        <ArrowRight className="size-3.25 shrink-0 text-ink-3" aria-label="In Alpha" />
      )}
      <span className="truncate">{to.text}</span>
    </div>,
    floatRoot(on),
  )
}
