// The companion (Kenil's plan, 21 Oct): Alpha in a small window that stays on top in a corner of
// the screen. Its face says what Alpha is doing (quiet, working, needs you); a bubble carries the
// one thing that needs the person, with its buttons when it is a plain yes or no or a reminder; a
// click on the face opens a box to type to Alpha, answered right there in the same conversation as
// the window's. The face is a stand-in until Kenil picks Alpha's character. The Mac app sizes its
// window to what this draws, and lets clicks anywhere else through to what is behind it.
import type { CardView, Stream, StreamLine } from '@alpha/core/api'
import { X } from 'lucide-react'
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { api, listen, Problem } from './api.ts'
import { openInAlpha, shell } from './macApp.ts'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { answerWords } from './vocabulary.ts'

type Mood = 'quiet' | 'working' | 'needs' | 'typing'

// a card the bubble can settle in place: two plain choices, nothing to read or pick first
const plain = (c: CardView) =>
  c.options.length === 2 &&
  !c.filing &&
  !c.draft &&
  !c.match &&
  !c.review &&
  !c.proposed &&
  !c.site &&
  !c.connector

export function Companion() {
  const [stream, setStream] = useState<Stream | null>(null)
  const [doing, setDoing] = useState<string | null>(null)
  const [live, setLive] = useState('')
  const [open, setOpen] = useState(false)
  const [gone, setGone] = useState<Set<string>>(new Set()) // bubbles put away
  const [problem, setProblem] = useState<string | null>(null)
  const since = useRef<number | null>(null) // reminders that came after the companion opened
  const root = useRef<HTMLDivElement>(null)

  const refresh = useCallback(() => {
    api.get<Stream>('/api/stream').then(
      (s) => {
        if (since.current === null) since.current = s.lastId
        setStream(s)
      },
      () => undefined,
    )
  }, [])
  useEffect(() => {
    document.documentElement.classList.add('companion')
    return listen((e) => {
      if (e.type === 'lines') refresh()
      if (e.type === 'live') {
        setDoing(e.doing)
        setLive(e.text)
      }
      if (e.type === 'idle') {
        setDoing(null)
        setLive('')
        refresh()
      }
    })
  }, [refresh])
  // ⌃⌥A, from the Mac app: the box opens wherever the person is
  useEffect(() => {
    const on = () => setOpen(true)
    window.addEventListener('alpha-companion-open', on)
    return () => window.removeEventListener('alpha-companion-open', on)
  }, [])

  // the window follows what is drawn: its size, and the places a click lands, measured from the
  // drawing's own corner (the window is the drawing's size once it has grown to it)
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const tell = () => {
      const r = el.getBoundingClientRect()
      void shell('companion_layout', { width: Math.ceil(r.width), height: Math.ceil(r.height) })
      const hot = [...el.querySelectorAll<HTMLElement>('[data-hot]')].map((h) => {
        const b = h.getBoundingClientRect()
        return [b.left - r.left, b.top - r.top, b.width, b.height]
      })
      void shell('companion_hot', { areas: hot, open: !!el.querySelector('[data-box]') })
    }
    tell()
    const watch = new ResizeObserver(tell)
    watch.observe(el)
    const seen = new MutationObserver(tell)
    seen.observe(el, { childList: true, subtree: true })
    window.addEventListener('resize', tell)
    return () => {
      watch.disconnect()
      seen.disconnect()
      window.removeEventListener('resize', tell)
    }
  }, [])

  const reminder = (stream?.lines ?? [])
    .filter((l) => l.kind === 'reminder' && l.id > (since.current ?? Number.POSITIVE_INFINITY))
    .filter((l) => !gone.has(`r${l.id}`))
    .at(-1)
  const card = (stream?.cards ?? []).find((c) => !gone.has(c.id))
  const waiting = (stream?.cards.length ?? 0) + (stream?.attention.length ?? 0)
  const working = !!stream?.busy || (stream?.running.length ?? 0) > 0
  const mood: Mood = open ? 'typing' : waiting || reminder ? 'needs' : working ? 'working' : 'quiet'
  const away = (key: string) => setGone((g) => new Set(g).add(key))
  const close = useCallback(() => setOpen(false), [])

  const act = async (run: () => Promise<unknown>) => {
    setProblem(null)
    try {
      await run()
      refresh()
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That did not go through.')
    }
  }

  return (
    <div ref={root} className="fixed right-0 bottom-0 flex flex-col items-end gap-2 p-2">
      {open ? (
        <Box stream={stream} live={live} busy={!!stream?.busy} onClose={close} />
      ) : reminder ? (
        <Bubble
          kind="Reminder"
          words={reminder.words.replace(/^Reminder: /, '').replace(/\.$/, '')}
          onAway={() => away(`r${reminder.id}`)}
          problem={problem}
        >
          <Button
            size="sm"
            variant="primary"
            onClick={() =>
              act(async () => {
                await api.post(`/api/tasks/${taskOf(reminder)}/state`, { state: 'done' })
                away(`r${reminder.id}`)
              })
            }
          >
            Done
          </Button>
          <Button size="sm" onClick={() => openInAlpha(`#/tasks/${taskOf(reminder)}`)}>
            Open
          </Button>
        </Bubble>
      ) : card ? (
        <Bubble
          kind={waiting > 1 ? `Needs you · ${waiting}` : 'Needs you'}
          words={card.words}
          onAway={() => away(card.id)}
          problem={problem}
        >
          {plain(card) ? (
            card.options.map((o, i) => (
              <Button
                key={o}
                size="sm"
                variant={i === 0 ? 'primary' : 'default'}
                onClick={() => act(() => api.post(`/api/cards/${card.id}`, { answer: o }))}
              >
                {answerWords(o)}
              </Button>
            ))
          ) : (
            <Button size="sm" variant="primary" onClick={() => openInAlpha('#/')}>
              Open in Alpha
            </Button>
          )}
        </Bubble>
      ) : working && (doing || stream?.running[0]) ? (
        <div
          data-hot
          className="max-w-60 truncate rounded-lg border border-line bg-surface px-3 py-1.5 text-ink-2 text-sm shadow-pop"
        >
          {doing ?? `${stream?.running[0]?.name} is working`}
        </div>
      ) : null}
      <FaceButton mood={mood} onToggle={() => setOpen((o) => !o)} />
    </div>
  )
}

// A grip to drag the companion by: the box and the bubble carry one at their top.
function Grip() {
  return (
    <div
      aria-hidden="true"
      onPointerDown={(e) => {
        if (e.button === 0) void shell('plugin:window|start_dragging', { label: 'companion' })
      }}
      className="-mt-1 flex h-3 cursor-grab items-center justify-center"
    >
      <span className="h-1 w-8 rounded-full bg-line" />
    </div>
  )
}

const taskOf = (l: StreamLine) => String((l.data as { task?: string }).task ?? '')

function Bubble({
  kind,
  words,
  onAway,
  problem,
  children,
}: {
  kind: string
  words: string
  onAway: () => void
  problem: string | null
  children: ReactNode
}) {
  return (
    <div
      data-hot
      className="flex w-64 flex-col gap-2 rounded-lg border border-line bg-surface p-3 shadow-pop"
    >
      <Grip />
      <div className="flex items-center gap-2">
        <span className="flex-1 font-medium text-sm text-warn">{kind}</span>
        <button
          type="button"
          aria-label="Put it away"
          title="Put it away"
          onClick={onAway}
          className="grid size-5 place-items-center rounded-sm text-ink-3 hover:bg-hover hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="line-clamp-4 text-base text-ink">{words}</div>
      {problem && <div className="text-bad text-sm">{problem}</div>}
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

// The box: the last of the conversation, the reply as it comes, and a line to type in.
function Box({
  stream,
  live,
  busy,
  onClose,
}: {
  stream: Stream | null
  live: string
  busy: boolean
  onClose: () => void
}) {
  const [words, setWords] = useState('')
  const [sending, setSending] = useState(false)
  const field = useRef<HTMLTextAreaElement>(null)
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => field.current?.focus(), [])
  const talk = (stream?.lines ?? [])
    .filter((l) => l.kind === 'said' || l.kind === 'replied')
    .slice(-30)
  // a click anywhere else closes the box: the companion is no longer the window in front
  useEffect(() => {
    window.addEventListener('blur', onClose)
    return () => window.removeEventListener('blur', onClose)
  }, [onClose])
  // the newest at the foot, in sight
  const newest = `${talk.at(-1)?.id ?? 0}:${live.length}`
  useEffect(() => {
    if (newest && list.current) list.current.scrollTop = list.current.scrollHeight
  }, [newest])
  const send = async () => {
    const w = words.trim()
    if (!w || sending) return
    setSending(true)
    try {
      await api.post('/api/say', { words: w })
      setWords('')
    } finally {
      setSending(false)
    }
  }
  const key = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }
  return (
    <div
      data-hot
      data-box
      className="flex w-80 flex-col gap-2 rounded-lg border border-line bg-surface p-3 shadow-pop"
    >
      <Grip />
      <div
        ref={list}
        className="flex max-h-80 flex-col gap-2 overflow-y-auto overscroll-contain pr-1"
      >
        {talk.map((l) => (
          <div
            key={l.id}
            className={cn(
              'whitespace-pre-wrap text-base',
              l.kind === 'said'
                ? 'self-end rounded-md bg-sunk px-2.5 py-1.5 text-ink-2'
                : 'text-ink',
            )}
          >
            {l.words}
          </div>
        ))}
        {busy && (
          <div className="whitespace-pre-wrap text-base text-ink-2">
            {live || 'Alpha is on it…'}
          </div>
        )}
      </div>
      <textarea
        ref={field}
        rows={2}
        value={words}
        onChange={(e) => setWords(e.target.value)}
        onKeyDown={key}
        placeholder="Ask Alpha…"
        aria-label="Ask Alpha"
        className="w-full resize-none rounded-md border border-line bg-surface px-2.5 py-1.5 text-base text-ink outline-none focus:border-accent-line"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => openInAlpha('#/conversation')}
          className="text-ink-3 text-sm hover:text-ink hover:underline"
        >
          Open in Alpha
        </button>
        <span className="flex-1" />
        <Button size="sm" variant="primary" disabled={!words.trim() || sending} onClick={send}>
          Send
        </Button>
      </div>
    </div>
  )
}

// The face: a click opens or closes the box; a drag moves the companion.
function FaceButton({ mood, onToggle }: { mood: Mood; onToggle: () => void }) {
  const press = useRef<{ x: number; y: number; dragged: boolean } | null>(null)
  return (
    <button
      type="button"
      data-hot
      aria-label={mood === 'typing' ? 'Close the box' : 'Type to Alpha'}
      title={MOOD_WORDS[mood]}
      onPointerDown={(e) => {
        press.current = { x: e.screenX, y: e.screenY, dragged: false }
      }}
      onPointerMove={(e) => {
        const p = press.current
        if (!p || p.dragged || e.buttons !== 1) return
        if (Math.abs(e.screenX - p.x) + Math.abs(e.screenY - p.y) > 4) {
          p.dragged = true
          void shell('plugin:window|start_dragging', { label: 'companion' })
        }
      }}
      onPointerUp={() => {
        if (press.current && !press.current.dragged) onToggle()
        press.current = null
      }}
      className="size-18 cursor-pointer rounded-full outline-none"
    >
      <Face mood={mood} />
    </button>
  )
}

const MOOD_WORDS: Record<Mood, string> = {
  quiet: 'Alpha · nothing waits on you',
  working: 'Alpha is working',
  needs: 'Something needs you',
  typing: 'Alpha is listening',
}

export function Face({ mood }: { mood: Mood }) {
  const light = {
    quiet: 'var(--face-quiet)',
    working: 'var(--face-busy)',
    needs: 'var(--face-needs)',
    typing: 'var(--face-busy)',
  }[mood]
  const eyeY = mood === 'typing' ? 42 : 46
  const eyeRy = mood === 'needs' ? 8.5 : 7
  const look = mood === 'working' ? 3 : 0
  const ink = 'var(--face-ink)'
  return (
    <svg viewBox="0 0 100 100" className="size-full" aria-hidden="true">
      <line x1="50" y1="16" x2="50" y2="8" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
      <circle
        cx="50"
        cy="6.5"
        r="5"
        fill={light}
        stroke={ink}
        strokeWidth="2"
        className={cn(mood === 'working' && 'face-pulse')}
      />
      <rect
        x="12"
        y="15"
        width="76"
        height="70"
        rx="30"
        fill="var(--face)"
        stroke={ink}
        strokeWidth="2.6"
      />
      <ellipse cx="38" cy="26" rx="14" ry="5" fill="var(--face-shine)" opacity="0.28" />
      <g className={cn(mood !== 'needs' && 'face-blink')}>
        <ellipse cx={37 + look} cy={eyeY} rx="5.5" ry={eyeRy} fill={ink} />
        <ellipse cx={63 + look} cy={eyeY} rx="5.5" ry={eyeRy} fill={ink} />
      </g>
      <circle cx={39 + look} cy={eyeY - 3} r="1.8" fill="var(--face-shine)" />
      <circle cx={65 + look} cy={eyeY - 3} r="1.8" fill="var(--face-shine)" />
      <ellipse cx="26" cy="60" rx="6" ry="3.6" fill="var(--face-cheek)" opacity="0.75" />
      <ellipse cx="74" cy="60" rx="6" ry="3.6" fill="var(--face-cheek)" opacity="0.75" />
      {mood === 'needs' ? (
        <ellipse cx="50" cy="63" rx="3.6" ry="4.2" fill={ink} />
      ) : mood === 'working' ? (
        <path
          d="M45 62 Q50 64 55 62"
          stroke={ink}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      ) : (
        <path
          d={`M43 59 Q50 ${mood === 'typing' ? 68 : 66} 57 59`}
          stroke={ink}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}
