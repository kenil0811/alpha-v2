// A short notice at the window's foot after something is deleted, hidden, turned off or
// disconnected: what happened, and where to find it again as a link. It goes by
// itself after a few seconds, or by ✕. Mounted once (Notices); anything calls notify().
import { X } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { FRAME } from './frame.tsx'

// where: a place to go, and the part of it to scroll to (a Part's id, ModuleSetup.tsx)
export type Notice = { words: string; where?: { label: string; href: string; part?: string } }
type Shown = Notice & { id: number }

const SHOWN_MS = 7000
let shown: Shown[] = []
let next = 0
const listeners = new Set<() => void>()
const set = (to: Shown[]) => {
  shown = to
  for (const l of listeners) l()
}
const drop = (id: number) => set(shown.filter((n) => n.id !== id))

export function notify(n: Notice) {
  const id = next++
  set([...shown.slice(-2), { ...n, id }])
  setTimeout(() => drop(id), SHOWN_MS)
}

// the part shows once its page has drawn: looked for each frame, for two seconds at most
const reach = (id: string, until = Date.now() + 2000) => {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  else if (Date.now() < until) requestAnimationFrame(() => reach(id, until))
}

export function Notices() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => shown,
  )
  if (!list.length) return null
  return createPortal(
    <div
      role="status"
      className="-translate-x-1/2 fixed bottom-4 left-1/2 z-(--z-pop) flex w-max max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      {list.map((n) => (
        <div
          key={n.id}
          className={`${FRAME} flex items-center gap-3 py-2 pr-2 pl-4 text-md text-ink shadow-pop`}
        >
          <span>
            {n.words}
            {n.where && (
              <>
                {' '}
                <a
                  href={n.where.href}
                  onClick={() => {
                    drop(n.id)
                    if (n.where?.part) reach(n.where.part)
                  }}
                  className="font-medium text-accent hover:underline"
                >
                  {n.where.label}
                </a>
              </>
            )}
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={() => drop(n.id)}
            className="grid size-6 shrink-0 place-items-center rounded-sm text-ink-3 hover:bg-hover hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>,
    // the page itself, never the pop-up it came from, which closes as it shows
    document.body,
  )
}
