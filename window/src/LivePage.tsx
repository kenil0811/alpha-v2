// A live picture of a page in Alpha's browser, over one websocket: frames drawn as they come, and,
// where the person has the page, what they click and type sent back. A site's sign-in on a server
// and a work's tab watched or taken over are both this.
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { token } from './api.ts'

// Two presses this close in time and place are a double click, as on a Mac.
const DOUBLE_MS = 500
const DOUBLE_PX = 6

type Told = { frame?: string; done?: boolean; problem?: string; held?: boolean }

export function LivePage({
  path,
  title,
  sub,
  label,
  hands,
  first,
  actions,
  onClose,
  onTold,
}: {
  path: string // the websocket's path
  title: string
  sub: string
  label: string // what the picture is, read aloud
  hands: boolean // whether what the person does here goes to the page
  first?: object // said to the core as soon as the picture opens
  actions: (send: (m: object) => void) => ReactNode
  onClose: () => void
  onTold?: (m: Told) => void
}) {
  const box = useRef<HTMLDialogElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const keys = useRef<HTMLTextAreaElement>(null)
  const socket = useRef<WebSocket | null>(null)
  const [shown, setShown] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [size, setSize] = useState({ width: 1280, height: 800 })
  // the window behind re-renders often: that must not open the page again
  const told = useRef(onTold)
  told.current = onTold
  const reach = useRef(hands)
  reach.current = hands
  const dims = useRef(size)
  dims.current = size
  const opening = useRef(first)

  const send = (m: object) => {
    if (socket.current?.readyState === 1) socket.current.send(JSON.stringify(m))
  }
  const act = (m: object) => {
    if (reach.current) send(m)
  }
  const at = (e: { clientX: number; clientY: number }) => {
    const r = canvas.current?.getBoundingClientRect()
    return r
      ? {
          x: ((e.clientX - r.left) * dims.current.width) / r.width,
          y: ((e.clientY - r.top) * dims.current.height) / r.height,
        }
      : { x: 0, y: 0 }
  }

  useEffect(() => {
    box.current?.showModal()
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(
      `${proto}://${window.location.host}${path}?t=${encodeURIComponent(token())}`,
    )
    socket.current = ws
    ws.onopen = () => {
      if (opening.current) ws.send(JSON.stringify(opening.current))
    }
    let drawing = false
    let next: string | null = null
    const draw = (frame: string) => {
      if (drawing) {
        next = frame // only the newest is worth drawing
        return
      }
      drawing = true
      const img = new Image()
      img.onload = () => {
        const c = canvas.current
        c?.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height)
        setShown(true)
        drawing = false
        if (next) {
          const f = next
          next = null
          draw(f)
        }
      }
      img.src = `data:image/jpeg;base64,${frame}`
    }
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data)) as Told & { size?: { width: number; height: number } }
      if (m.size) setSize(m.size)
      if (m.frame) draw(m.frame)
      if (m.problem) setProblem(m.problem)
      told.current?.(m)
    }
    keys.current?.focus()
    return () => ws.close()
  }, [path])

  // the page scrolls under the pointer, not the window behind it
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      act({ kind: 'wheel', ...at(e), dx: e.deltaX, dy: e.deltaY })
    }
    c.addEventListener('wheel', wheel, { passive: false })
    return () => c.removeEventListener('wheel', wheel)
  })

  const button = (b: number) => (b === 2 ? 'right' : b === 1 ? 'middle' : 'left')
  // the modifier keys really down now: the page lets go of any other, so a key whose release
  // never reached this window (a screenshot's shortcut takes the keys) is not left held there
  const held = (e: { ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }) =>
    [
      e.ctrlKey ? 'Control' : '',
      e.shiftKey ? 'Shift' : '',
      e.altKey ? 'Alt' : '',
      e.metaKey ? 'Meta' : '',
    ].filter(Boolean)
  // which press this is of quick presses in one place: the page needs to be told, or two clicks
  // on a folder select it twice and never open it
  const last = useRef({ at: 0, x: 0, y: 0, button: '', count: 0 })
  const press = (e: { clientX: number; clientY: number; button: number }) => {
    const l = last.current
    const again =
      button(e.button) === l.button &&
      performance.now() - l.at < DOUBLE_MS &&
      Math.hypot(e.clientX - l.x, e.clientY - l.y) < DOUBLE_PX
    last.current = {
      at: performance.now(),
      x: e.clientX,
      y: e.clientY,
      button: button(e.button),
      count: again && l.count < 3 ? l.count + 1 : 1,
    }
    return last.current.count
  }
  const sent = useRef(new Set<string>())
  const release = () => {
    for (const key of sent.current) act({ kind: 'keyup', key })
    sent.current.clear()
  }
  return (
    <dialog
      ref={box}
      onClose={onClose}
      aria-label={title}
      className="m-auto w-full max-w-[1280px] rounded-lg border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-ink/40"
    >
      <div className="flex items-center justify-between gap-3 border-line border-b px-4 py-2.5">
        <div className="min-w-0">
          <div className="truncate font-medium text-md">{title}</div>
          <div className="truncate text-ink-3 text-sm">{problem ?? sub}</div>
        </div>
        <div className="flex shrink-0 gap-2">{actions(send)}</div>
      </div>
      <div className="relative">
        {!shown && !problem && (
          <p className="absolute inset-0 grid place-items-center text-ink-3 text-md">Opening…</p>
        )}
        <canvas
          ref={canvas}
          width={size.width}
          height={size.height}
          aria-label={label}
          className="block h-auto w-full bg-surface"
          onContextMenu={(e) => e.preventDefault()}
          onPointerMove={(e) => act({ kind: 'move', ...at(e) })}
          onPointerDown={(e) => {
            keys.current?.focus()
            e.preventDefault()
            act({
              kind: 'down',
              ...at(e),
              button: button(e.button),
              held: held(e),
              count: press(e),
            })
          }}
          onPointerUp={(e) =>
            act({ kind: 'up', ...at(e), button: button(e.button), count: last.current.count })
          }
        />
        <textarea
          ref={keys}
          aria-label="What you type goes to the page"
          autoComplete="off"
          spellCheck={false}
          className="absolute top-0 left-0 size-px opacity-0"
          value=""
          onChange={() => undefined}
          onBlur={release}
          onPaste={(e) => {
            e.preventDefault()
            act({ kind: 'paste', text: e.clipboardData.getData('text') })
          }}
          onKeyDown={(e) => {
            // paste comes as its own event, with the words
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') return
            if (e.key === 'Escape' && !reach.current) return // closes the picture
            e.preventDefault()
            if (e.key === 'Meta') return
            sent.current.add(e.key)
            act({ kind: 'keydown', key: e.key })
          }}
          onKeyUp={(e) => {
            if (e.key === 'Meta') return
            sent.current.delete(e.key)
            act({ kind: 'keyup', key: e.key })
          }}
        />
      </div>
    </dialog>
  )
}
