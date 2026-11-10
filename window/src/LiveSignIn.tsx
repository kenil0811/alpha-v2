// A site's sign-in on a server: a live picture of the server's browser, which the person clicks and
// types in as if it were here. It closes by itself once they are in.
import { useEffect, useRef, useState } from 'react'
import { token } from './api.ts'
import { Button } from './ui/button.tsx'

const WIDTH = 1280
const HEIGHT = 800

export function LiveSignIn({
  card,
  site,
  onClose,
}: {
  card: string
  site: string
  onClose: () => void
}) {
  const box = useRef<HTMLDialogElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const keys = useRef<HTMLTextAreaElement>(null)
  const socket = useRef<WebSocket | null>(null)
  const [shown, setShown] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // the window behind re-renders often: that must not open the site again
  const closing = useRef(onClose)
  closing.current = onClose

  const send = (m: object) => {
    if (socket.current?.readyState === 1) socket.current.send(JSON.stringify(m))
  }
  const at = (e: { clientX: number; clientY: number }) => {
    const r = canvas.current?.getBoundingClientRect()
    return r
      ? {
          x: ((e.clientX - r.left) * WIDTH) / r.width,
          y: ((e.clientY - r.top) * HEIGHT) / r.height,
        }
      : { x: 0, y: 0 }
  }

  useEffect(() => {
    box.current?.showModal()
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(
      `${proto}://${window.location.host}/ws/live/${card}?t=${encodeURIComponent(token())}`,
    )
    socket.current = ws
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
        canvas.current?.getContext('2d')?.drawImage(img, 0, 0, WIDTH, HEIGHT)
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
      const m = JSON.parse(String(e.data)) as { frame?: string; done?: boolean; problem?: string }
      if (m.frame) draw(m.frame)
      if (m.problem) setProblem(m.problem)
      if (m.done) closing.current()
    }
    keys.current?.focus()
    return () => ws.close()
  }, [card])

  // the page scrolls under the pointer, not the window behind it
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      send({ kind: 'wheel', ...at(e), dx: e.deltaX, dy: e.deltaY })
    }
    c.addEventListener('wheel', wheel, { passive: false })
    return () => c.removeEventListener('wheel', wheel)
  })

  const button = (b: number) => (b === 2 ? 'right' : b === 1 ? 'middle' : 'left')
  return (
    <dialog
      ref={box}
      onClose={onClose}
      aria-label={`Sign in to ${site}`}
      className="m-auto w-full max-w-[1280px] rounded-lg border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-ink/40"
    >
      <div className="flex items-center justify-between gap-3 border-line border-b px-4 py-2.5">
        <div className="min-w-0">
          <div className="truncate font-medium text-md">Sign in to {site}</div>
          <div className="truncate text-ink-3 text-sm">
            {problem ?? 'Alpha never sees your password. This closes by itself once you are in.'}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={() => send({ kind: 'done' })}>
            I am signed in
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
      <div className="relative">
        {!shown && !problem && (
          <p className="absolute inset-0 grid place-items-center text-ink-3 text-md">Opening…</p>
        )}
        <canvas
          ref={canvas}
          width={WIDTH}
          height={HEIGHT}
          aria-label={`The sign-in page of ${site}`}
          className="block h-auto w-full bg-surface"
          onContextMenu={(e) => e.preventDefault()}
          onPointerMove={(e) => send({ kind: 'move', ...at(e) })}
          onPointerDown={(e) => {
            keys.current?.focus()
            e.preventDefault()
            send({ kind: 'down', ...at(e), button: button(e.button) })
          }}
          onPointerUp={(e) => send({ kind: 'up', ...at(e), button: button(e.button) })}
        />
        <textarea
          ref={keys}
          aria-label="What you type goes to the page"
          autoComplete="off"
          spellCheck={false}
          className="absolute top-0 left-0 size-px opacity-0"
          value=""
          onChange={() => undefined}
          onPaste={(e) => {
            e.preventDefault()
            send({ kind: 'paste', text: e.clipboardData.getData('text') })
          }}
          onKeyDown={(e) => {
            // paste comes as its own event, with the words
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') return
            e.preventDefault()
            if (e.key !== 'Meta') send({ kind: 'keydown', key: e.key })
          }}
          onKeyUp={(e) => {
            if (e.key !== 'Meta') send({ kind: 'keyup', key: e.key })
          }}
        />
      </div>
    </dialog>
  )
}
