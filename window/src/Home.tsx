// Home is the stream (design §14): the person's sentences and Alpha's replies in order. Work shows
// as one live message that becomes the outcome, with "Show the work" folded under it.
import type { AboutRows, CardView, LiveEvent, Stream } from '@alpha/core/api'
import { ArrowUp, ChevronRight, Paperclip, TriangleAlert } from 'lucide-react'
import { type DragEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { api, Problem } from './api.ts'
import { group, type Item, type Step } from './stream.ts'
import { Button, IconButton } from './ui/button.tsx'
import { Card } from './ui/card.tsx'
import { cn } from './ui/cn.ts'
import { Field } from './ui/field.tsx'
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
        <div className="mx-auto flex max-w-196 flex-col gap-5 px-8 py-7">
          {items.length === 0 && (
            <p className="pt-24 text-center text-ink-3">Say what you want kept, tracked or done.</p>
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
          className="mx-auto mb-2 text-base text-bad"
          onClick={() => setProblem(null)}
        >
          {problem}
        </button>
      )}
      <Composer busy={busyTurn !== null} onProblem={setProblem} />
      {dragging && (
        <div className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-xl border border-dashed border-accent-line bg-surface/80 text-ink-2">
          Drop to keep it in Alpha
        </div>
      )}
    </div>
  )
}

// What an agent's run told the person: its words, and the rows it is about, each with Open and
// the one choice it offers (a deal's Pass).
function Told({ words, about }: { words: string; about: AboutRows | null }) {
  const [busy, setBusy] = useState<string | null>(null)
  const choose = async (row: string) => {
    if (!about?.choice) return
    setBusy(row)
    await api
      .post(`/api/tables/${about.table}/rows/${row}`, {
        field: about.choice.field,
        value: about.choice.value,
      })
      .catch(() => undefined)
    setBusy(null)
  }
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <p className="px-3.5 py-3 text-ink">{words}</p>
      {about?.rows.map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-3 border-hair border-t py-2 pr-2.5 pl-3.5 text-md"
        >
          <a
            className="min-w-0 flex-1 truncate font-medium text-ink underline decoration-line underline-offset-3 hover:decoration-ink-3"
            href={`#/table/${about.table}/${r.id}`}
          >
            {r.name}
          </a>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              window.location.hash = `#/table/${about.table}/${r.id}`
            }}
          >
            Open
          </Button>
          {about.choice &&
            (r.value === about.choice.value ? (
              <span className="shrink-0 px-2.5 text-ink-3 text-sm">{about.choice.value}</span>
            ) : (
              <Button size="sm" disabled={busy === r.id} onClick={() => choose(r.id)}>
                {about.choice.label}
              </Button>
            ))}
        </div>
      ))}
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
      <div className="self-end max-w-[85%] whitespace-pre-wrap rounded-2xl bg-sunk px-4 py-2 text-ink">
        {item.words}
      </div>
    )
  if (item.kind === 'told') return <Told words={item.words} about={item.about} />
  if (item.kind === 'note')
    return (
      <div className={cn('text-center text-sm', item.tone === 'warn' ? 'text-warn' : 'text-ink-3')}>
        {item.words}
      </div>
    )
  const text = item.reply ?? item.error ?? live?.text ?? ''
  return (
    <div className="flex flex-col gap-2">
      {text ? (
        <div className={cn(item.error && 'text-bad')}>
          <Words text={text} />
        </div>
      ) : working ? (
        <div className="text-ink-3">Working on it…</div>
      ) : null}
      {working && live?.doing && (
        <div className="flex items-center gap-2 text-sm text-ink-2">
          <span className="size-1.5 animate-pulse rounded-full bg-ink-3" />
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
    <details className="group text-ink-3 text-sm">
      <summary className="inline-flex cursor-pointer select-none list-none items-center gap-1 rounded-sm py-0.5 pr-1.5 pl-0.5 hover:bg-hover hover:text-ink">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
        <span className="group-open:hidden">Show the work</span>
        <span className="hidden group-open:inline">Hide the work</span>
      </summary>
      <ol className="mt-1.5 ml-2 flex flex-col gap-1.5 border-line border-l pl-3">
        {steps.map((s) => (
          <li key={s.id} className="text-ink-2">
            <span className={cn(s.ok === false && 'text-bad')}>
              {s.ok === false ? 'Did not work: ' : ''}
              {s.words}
            </span>
            {s.results.map((r) => (
              <div key={r} className="text-ink-3">
                {r}
              </div>
            ))}
          </li>
        ))}
      </ol>
    </details>
  )
}

// What each gate is called in a card's head.
const GATE: Record<string, string> = {
  leaves_world: 'Leaves your world',
  deletes_own: 'Removes your entries',
  sign_in: 'Sign-in',
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
      // A sign-in's yes opens the form where the person signs in themselves.
      if (card.gate === 'sign_in' && a === card.options[0])
        window.location.hash = `#/settings${card.connector ? `?connect=${card.connector}` : ''}`
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That answer did not go in.')
      setBusy(false)
    }
  }
  return (
    <Card
      label={card.gate ? (GATE[card.gate] ?? 'Waits for you') : 'A question'}
      waits="Waits for you"
    >
      <div className="font-medium text-ink text-lg">{card.words}</div>
      {card.detail && (
        <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md border border-hair bg-canvas px-3 py-2.5 text-ink text-md">
          {card.detail}
        </div>
      )}
      {card.cannotUndo && (
        <div className="flex items-center gap-1.5 text-sm text-warn">
          <TriangleAlert className="size-3.5 shrink-0" />
          {card.cannotUndo}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {card.options.map((o, i) => (
          <Button
            key={o}
            variant={i === 0 ? 'primary' : 'default'}
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
            <Field
              className="flex-1"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Your answer"
            />
            <Button type="submit" variant="primary" disabled={busy || !typed.trim()}>
              Answer
            </Button>
          </form>
        )}
      </div>
      {problem && <div className="text-bad text-sm">{problem}</div>}
    </Card>
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
    <div className="mx-auto w-full max-w-196 px-8 pt-1.5 pb-4">
      <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface py-2.5 pr-2 pl-3.5 shadow-pop focus-within:border-accent-line focus-within:ring-3 focus-within:ring-accent-soft">
        <textarea
          rows={1}
          value={words}
          onChange={(e) => setWords(e.target.value)}
          onKeyDown={key}
          placeholder="Message Alpha"
          className="max-h-30 min-h-5.5 w-full resize-none bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
        />
        <div className="flex items-center gap-2">
          <IconButton label="Add a file" onClick={() => file.current?.click()}>
            <Paperclip className="size-4" />
          </IconButton>
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
          <span className="ml-auto text-ink-3 text-xs">
            Return to send · Shift-Return for a new line
          </span>
          {busy && (
            <Button size="sm" onClick={() => api.post('/api/stop')}>
              Stop
            </Button>
          )}
          <button
            type="button"
            aria-label="Send"
            title="Send"
            onClick={send}
            disabled={!words.trim()}
            className="grid size-7.5 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition-opacity disabled:opacity-35"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function applyLive(live: Live, e: LiveEvent): Live {
  if (e.type !== 'live') return live
  return { ...live, [e.turn]: { text: e.text, doing: e.doing } }
}
