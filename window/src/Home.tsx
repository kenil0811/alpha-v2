// Home is the stream (design §14): the person's sentences and Alpha's replies in order. Work shows
// as one live message that becomes the outcome, with "Show the work" folded under it.
import type { CardView, LiveEvent, Stream } from '@alpha/core/api'
import { type DragEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { api, Problem } from './api.ts'
import { group, type Item, type Step } from './stream.ts'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Words } from './ui/words.tsx'

export interface Live {
  [turn: string]: { text: string; doing: string | null }
}

export function Home({
  stream,
  live,
  busyTurn,
}: {
  stream: Stream | null
  live: Live
  busyTurn: string | null
}) {
  const items = useMemo(() => group(stream?.lines ?? []), [stream])
  const cards = useMemo(() => new Map((stream?.cards ?? []).map((c) => [c.id, c])), [stream])
  const end = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [items.length, live])

  const drop = async (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    for (const f of Array.from(e.dataTransfer.files)) {
      try {
        await api.upload(f)
      } catch (err) {
        setProblem(err instanceof Problem ? err.message : 'That file did not go in.')
      }
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a drop target for files; the paperclip is the keyboard way
    <div
      className="relative flex h-full flex-col"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
    >
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-5 px-6 py-8">
          {items.length === 0 && (
            <p className="pt-24 text-center text-neutral-400">
              Say what you want kept, tracked or done.
            </p>
          )}
          {items.map((item) => (
            <Entry
              key={item.kind === 'alpha' ? `a${item.turn}` : `${item.kind}${item.id}`}
              item={item}
              live={item.kind === 'alpha' ? live[item.turn] : undefined}
              working={item.kind === 'alpha' && busyTurn === item.turn}
              cards={cards}
            />
          ))}
          <div ref={end} />
        </div>
      </div>
      {problem && (
        <button
          type="button"
          className="mx-auto mb-2 text-sm text-red-600"
          onClick={() => setProblem(null)}
        >
          {problem}
        </button>
      )}
      <Composer busy={busyTurn !== null} onProblem={setProblem} />
      {dragging && (
        <div className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-xl border border-dashed border-neutral-400 bg-white/80 text-neutral-500">
          Drop to keep it in Alpha
        </div>
      )}
    </div>
  )
}

function Entry({
  item,
  live,
  working,
  cards,
}: {
  item: Item
  live: Live[string] | undefined
  working: boolean
  cards: Map<string, CardView>
}) {
  if (item.kind === 'said')
    return (
      <div className="self-end max-w-[85%] whitespace-pre-wrap rounded-2xl bg-neutral-100 px-4 py-2 text-neutral-900">
        {item.words}
      </div>
    )
  if (item.kind === 'note')
    return (
      <div
        className={cn(
          'text-center text-xs',
          item.tone === 'warn' ? 'text-amber-700' : 'text-neutral-400',
        )}
      >
        {item.words}
      </div>
    )
  const text = item.reply ?? item.error ?? live?.text ?? ''
  return (
    <div className="flex flex-col gap-2">
      {text ? (
        <div className={cn(item.error && 'text-red-700')}>
          <Words text={text} />
        </div>
      ) : working ? (
        <div className="text-neutral-400">Working on it…</div>
      ) : null}
      {working && live?.doing && (
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span className="size-1.5 animate-pulse rounded-full bg-neutral-400" />
          {live.doing}
        </div>
      )}
      {item.cards.map((id) => (
        <CardBox key={id} id={id} card={cards.get(id)} />
      ))}
      {item.steps.length > 0 && <Work steps={item.steps} />}
    </div>
  )
}

function Work({ steps }: { steps: Step[] }) {
  return (
    <details className="group text-xs text-neutral-500">
      <summary className="cursor-pointer select-none list-none hover:text-neutral-800">
        <span className="group-open:hidden">Show the work</span>
        <span className="hidden group-open:inline">Hide the work</span>
      </summary>
      <ol className="mt-2 flex flex-col gap-1.5 border-l border-neutral-200 pl-3">
        {steps.map((s) => (
          <li key={s.id}>
            <span className={cn(s.ok === false && 'text-red-600')}>
              {s.ok === false ? 'Did not work: ' : ''}
              {s.words}
            </span>
            {s.results.map((r) => (
              <div key={r} className="text-neutral-400">
                {r}
              </div>
            ))}
          </li>
        ))}
      </ol>
    </details>
  )
}

function CardBox({ id, card }: { id: string; card: CardView | undefined }) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  if (!card) return null // answered: its note says how
  const answer = async (a: string) => {
    setBusy(true)
    try {
      await api.post(`/api/cards/${id}`, { answer: a })
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That answer did not go in.')
      setBusy(false)
    }
  }
  return (
    <div className="rounded-lg border border-neutral-200 px-4 py-3">
      <div className="text-neutral-900">{card.words}</div>
      {card.cannotUndo && <div className="mt-1 text-xs text-neutral-500">{card.cannotUndo}</div>}
      <div className="mt-3 flex flex-wrap gap-2">
        {card.options.map((o, i) => (
          <Button
            key={o}
            size="sm"
            variant={i === 0 ? 'default' : 'outline'}
            disabled={busy}
            onClick={() => answer(o)}
          >
            {o}
          </Button>
        ))}
        {card.options.length === 0 && (
          <form
            className="flex w-full gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (typed.trim()) void answer(typed.trim())
            }}
          >
            <input
              className="flex-1 rounded-md border border-neutral-200 px-2 py-1 text-sm outline-none focus:border-neutral-400"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Your answer"
            />
            <Button size="sm" disabled={busy || !typed.trim()}>
              Answer
            </Button>
          </form>
        )}
      </div>
      {problem && <div className="mt-2 text-xs text-red-600">{problem}</div>}
    </div>
  )
}

function Composer({ busy, onProblem }: { busy: boolean; onProblem: (p: string) => void }) {
  const [words, setWords] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const send = async () => {
    const w = words.trim()
    if (!w) return
    setWords('')
    try {
      await api.post('/api/say', { words: w })
    } catch (err) {
      setWords(w)
      onProblem(err instanceof Problem ? err.message : 'That did not reach Alpha.')
    }
  }
  const key = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void send()
    }
  }
  return (
    <div className="border-t border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-2xl items-end gap-2 px-6 py-3">
        <button
          type="button"
          title="Add a file"
          className="mb-1 rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          onClick={() => file.current?.click()}
        >
          <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M21 11.5 12.5 20a5 5 0 0 1-7-7L14 4.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3L15 7.5" />
          </svg>
        </button>
        <input
          ref={file}
          type="file"
          multiple
          hidden
          onChange={async (e) => {
            for (const f of Array.from(e.target.files ?? []))
              await api.upload(f).catch(() => onProblem('That file did not go in.'))
            e.target.value = ''
          }}
        />
        <textarea
          rows={1}
          value={words}
          onChange={(e) => setWords(e.target.value)}
          onKeyDown={key}
          placeholder="Message Alpha"
          className="max-h-40 min-h-9 flex-1 resize-none rounded-lg border border-neutral-200 px-3 py-2 outline-none focus:border-neutral-400"
        />
        {busy && (
          <Button variant="outline" onClick={() => api.post('/api/stop')}>
            Stop
          </Button>
        )}
        <Button onClick={send} disabled={!words.trim()}>
          Send
        </Button>
      </div>
    </div>
  )
}

export function applyLive(live: Live, e: LiveEvent): Live {
  if (e.type !== 'live') return live
  return { ...live, [e.turn]: { text: e.text, doing: e.doing } }
}
