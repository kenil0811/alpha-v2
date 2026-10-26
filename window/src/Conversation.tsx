// The conversation (design §14; its own place since Kenil's 20 Oct call that Home holds only the
// important things): the person's sentences and Alpha's replies in order, each with its topic
// chip as a lens; one live message per turn becoming the outcome; cards inline; the Now strip and
// the composer at the foot. A module's Conversation tab and Ask (⌘J) show it through a lens.
import type { AboutRows, CardView, LiveEvent, Stream } from '@alpha/core/api'
import {
  ArrowUp,
  Bot,
  Check,
  ChevronRight,
  KeyRound,
  Paperclip,
  TriangleAlert,
  X,
} from 'lucide-react'
import {
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { api, Problem } from './api.ts'
import { takeAsk } from './ask.ts'
import { Beside } from './Beside.tsx'
import { DraftCard } from './DraftCard.tsx'
import { FilingCard } from './FilingCard.tsx'
import { MatchCard } from './MatchCard.tsx'
import { ProposedCard } from './ProposedCard.tsx'
import { ReviewCard } from './ReviewCard.tsx'
import { type Answered, group, type Item, type Module, moduleOfItem, type Step } from './stream.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { Button, IconButton } from './ui/button.tsx'
import { Card } from './ui/card.tsx'
import { cn } from './ui/cn.ts'
import { Field } from './ui/field.tsx'
import { Topic } from './ui/pill.tsx'
import { Words } from './ui/words.tsx'
import { answerWords } from './vocabulary.ts'

export interface Live {
  [turn: string]: { text: string; doing: string | null }
}

const clock = (at: string) =>
  new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })

function dayOf(at: string): string {
  const d = new Date(at)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
}

export function Conversation({
  stream,
  live,
  busyTurn,
  lens,
  onLens,
  from = null,
  compact = false,
}: {
  stream: Stream | null
  live: Live
  busyTurn: string | null
  lens: Module
  onLens: (m: Module) => void
  from?: Module // asked from a module's screen or its Ask panel
  compact?: boolean // in the Ask panel: narrow, no Now strip
}) {
  const all = useMemo(() => group(stream?.lines ?? []), [stream])
  const cards = useMemo(() => new Map((stream?.cards ?? []).map((c) => [c.id, c])), [stream])
  // through a lens, a sentence stays when the turn it began does
  const items = useMemo(() => {
    if (!lens) return all
    const ids = new Set(lens.ids ?? [lens.id])
    const kept = new Set(
      all
        .filter((i) => i.kind === 'alpha' && i.module && ids.has(i.module.id))
        .map((i) => i.kind === 'alpha' && i.turn),
    )
    return all.filter((i) => {
      if (i.kind === 'said') return kept.has(String(i.id))
      const m = moduleOfItem(i)
      return !!m && ids.has(m.id)
    })
  }, [all, lens])
  const end = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [words, setWords] = useState('')
  const composer = useRef<HTMLTextAreaElement>(null)
  // words another screen started the assistant with (Governance's + Add)
  useEffect(() => {
    const take = () => {
      const w = takeAsk()
      if (!w) return
      setWords((d) => (d.trim() ? `${d.trimEnd()}\n${w}` : w)) // a draft stays
      composer.current?.focus()
    }
    take()
    window.addEventListener('alpha:ask', take)
    return () => window.removeEventListener('alpha:ask', take)
  }, [])

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
  // "Change something" on a card: the composer, started with the card's words
  const changeCard = (card: CardView) => {
    setWords(`About “${card.words.replace(/\?$/, '')}”: `)
    composer.current?.focus()
  }

  let lastDay = ''
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a drop target for files; the paperclip is the keyboard way
    <div
      className="@container relative flex h-full"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="@container flex-1 overflow-y-auto">
          <div
            className={cn(
              'mx-auto flex flex-col gap-5',
              compact ? 'px-4 pt-4 pb-3 text-md' : 'max-w-stream px-8 pt-7 pb-5',
            )}
          >
            {items.length === 0 && (
              <p className="pt-24 text-center text-ink-3">
                {lens
                  ? `Nothing about ${lens.name} yet.`
                  : 'Say what you want kept, tracked or done.'}
              </p>
            )}
            {items.map((item) => {
              const day = dayOf(item.at)
              const line = day !== lastDay
              lastDay = day
              return (
                <div key={keyOf(item)} className="flex flex-col gap-5">
                  {line && <DayLine day={day} />}
                  <Entry
                    item={item}
                    live={item.kind === 'alpha' ? live[item.turn] : undefined}
                    working={item.kind === 'alpha' && busyTurn === item.turn}
                    cards={cards}
                    onLens={onLens}
                    onChangeCard={changeCard}
                  />
                </div>
              )
            })}
            <div ref={end} />
          </div>
        </div>
        {problem && (
          <button
            type="button"
            className="mx-auto mb-2 text-bad text-md"
            onClick={() => setProblem(null)}
          >
            {problem}
          </button>
        )}
        <div
          className={cn(
            'mx-auto flex w-full flex-col gap-2',
            compact ? 'px-3 pt-1 pb-3' : 'max-w-stream px-8 pt-1.5 pb-4',
          )}
        >
          {!compact && (
            <div className="@min-[1100px]:hidden">
              <Now stream={stream} />
            </div>
          )}
          <Composer
            words={words}
            setWords={setWords}
            area={composer}
            onProblem={setProblem}
            from={from}
            compact={compact}
          />
        </div>
      </div>
      {!compact && (
        <Beside
          stream={stream}
          lens={lens}
          gate={(g) => (g ? (GATE[g] ?? 'Waits for you') : 'A question')}
          onCard={goToCard}
        />
      )}
      {dragging && (
        <div className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-xl border border-accent-line border-dashed bg-surface/80 text-ink-2">
          Drop to keep it in Alpha
        </div>
      )}
    </div>
  )
}

const keyOf = (i: Item) =>
  i.kind === 'alpha' ? `a${i.turn}` : i.kind === 'card' ? `c${i.id}` : `${i.kind}${i.id}`

function DayLine({ day }: { day: string }) {
  return (
    <div className="flex items-center gap-3 font-semibold text-ink-3 text-xs">
      <span className="h-px flex-1 bg-hair" />
      {day}
      <span className="h-px flex-1 bg-hair" />
    </div>
  )
}

// The mark beside Alpha's name, or an agent's.
function Mark({ agent }: { agent?: boolean | undefined }) {
  return agent ? (
    <span className="grid size-5 shrink-0 place-items-center rounded-sm border border-line bg-sunk text-ink-2">
      <Bot className="size-3" />
    </span>
  ) : (
    <span className="grid size-5 shrink-0 place-items-center rounded-sm bg-ink font-semibold font-serif text-canvas text-sm leading-none">
      A
    </span>
  )
}

function Meta({
  who,
  agent,
  module,
  at,
  onLens,
}: {
  who: string
  agent?: boolean | undefined
  module: Module
  at: string
  onLens: (m: Module) => void
}) {
  return (
    <div className="flex items-center gap-2 text-ink-3 text-sm">
      <Mark agent={agent} />
      <span className="font-semibold text-ink text-md">{who}</span>
      {module && <Topic onClick={() => onLens(module)}>{module.name}</Topic>}
      <span>{clock(at)}</span>
    </div>
  )
}

// A closing line is "Yes: the card's words" or "Chose Add: …": said as the person's answer, then
// the card's words on what is left of the line.
function saidOf(words: string): string {
  const head = words.split(': ')[0] ?? ''
  if (head === 'Yes') return 'You approved'
  if (head === 'No') return 'You declined'
  if (head === 'Withdrawn') return 'Withdrawn'
  if (head.startsWith('Chose ')) return `You chose ${head.slice(6)}`
  if (head.startsWith('Answered ')) return `You answered ${head.slice(9)}`
  return head
}
const restOf = (words: string) => words.split(': ').slice(1).join(': ')

// A card once answered: one line, where the card was.
function AnsweredLine({ answered }: { answered: Answered }) {
  const no = answered.state === 'no' || answered.state === 'withdrawn'
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2.25 text-md',
        no ? 'bg-sunk text-ink-2' : 'bg-good-soft text-good',
      )}
    >
      {no ? <X className="size-4 shrink-0" /> : <Check className="size-4 shrink-0" />}
      <span className="shrink-0 font-medium">{saidOf(answered.words)}</span>
      <span className="min-w-0 flex-1 truncate opacity-80">{restOf(answered.words)}</span>
      <span className="shrink-0 text-sm opacity-80">
        {answered.done ? `Done at ${clock(answered.done)}` : clock(answered.at)}
      </span>
    </div>
  )
}

function Entry({
  item,
  live,
  working,
  cards,
  onLens,
  onChangeCard,
}: {
  item: Item
  live: Live[string] | undefined
  working: boolean
  cards: Map<string, CardView>
  onLens: (m: Module) => void
  onChangeCard: (c: CardView) => void
}) {
  if (item.kind === 'said')
    return (
      <div className="max-w-3/4 self-end whitespace-pre-wrap rounded-2xl rounded-br-sm bg-sunk px-3.5 py-2.25 text-ink">
        {item.words}
      </div>
    )
  if (item.kind === 'note')
    return (
      <div className={cn('text-center text-sm', item.tone === 'warn' ? 'text-warn' : 'text-ink-3')}>
        {item.words}
      </div>
    )
  if (item.kind === 'told') {
    const who = item.agent ?? 'An agent'
    const words = item.words.startsWith(`${who}: `) ? item.words.slice(who.length + 2) : item.words
    return (
      <div className="flex flex-col gap-2.25">
        <Meta who={who} agent module={item.module} at={item.at} onLens={onLens} />
        <Told words={words} about={item.about} />
      </div>
    )
  }
  if (item.kind === 'card') {
    const card = cards.get(item.id)
    if (!card && !item.answered) return null
    return (
      <div className="flex flex-col gap-2.25" id={`card-${item.id}`}>
        <Meta who="Alpha" module={item.module} at={item.at} onLens={onLens} />
        {card ? (
          <CardBox id={item.id} card={card} onChange={onChangeCard} />
        ) : item.answered ? (
          <AnsweredLine answered={item.answered} />
        ) : null}
      </div>
    )
  }
  const text = item.reply ?? item.error ?? live?.text ?? ''
  if (!text && !working && !item.cards.length && !item.steps.length) return null
  return (
    <div className="flex flex-col gap-2.25">
      <Meta who="Alpha" module={item.module} at={item.at} onLens={onLens} />
      {text && (
        <div className={cn(item.error && 'text-bad')}>
          <Words text={text} wideTables />
        </div>
      )}
      {working && (
        <div className="flex items-center gap-2.25 text-ink-2 text-md">
          <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-accent-line border-t-accent" />
          <span className="min-w-0 flex-1 truncate">{live?.doing ?? 'Working on it…'}</span>
          <Button size="sm" variant="ghost" onClick={() => api.post('/api/stop')}>
            Stop
          </Button>
        </div>
      )}
      {item.cards.map((id) => {
        const card = cards.get(id)
        const answered = item.answered[id]
        return (
          <div key={id} id={`card-${id}`}>
            {card ? (
              <CardBox id={id} card={card} onChange={onChangeCard} />
            ) : answered ? (
              <AnsweredLine answered={answered} />
            ) : null}
          </div>
        )
      })}
      {item.steps.length > 0 && <Work steps={item.steps} />}
    </div>
  )
}

// What runs now and what waits on the person: three chips at most, each going where it is.
function Now({ stream }: { stream: Stream | null }) {
  if (!stream) return null
  const chips: { key: string; need: boolean; icon: ReactNode; words: string; go: () => void }[] = []
  for (const r of stream.running)
    chips.push({
      key: `r${r.id}`,
      need: false,
      icon: (
        <span className="size-2.75 animate-spin rounded-full border-2 border-accent-line border-t-accent" />
      ),
      words: `${r.name} is running`,
      go: () => {
        window.location.hash = '#/activity'
      },
    })
  for (const c of stream.cards)
    chips.push({
      key: `c${c.id}`,
      need: true,
      icon: <TriangleAlert className="size-3.25" />,
      words: c.words.length > 48 ? `${c.words.slice(0, 47)}…` : c.words,
      go: () => goToCard(c.id),
    })
  for (const a of stream.attention)
    chips.push({
      key: `s${a.connector}`,
      need: true,
      icon: <KeyRound className="size-3.25" />,
      words: `${a.title} needs you to sign in`,
      go: () => {
        window.location.hash = `#/settings?connect=${a.connector}`
      },
    })
  if (!chips.length) return null
  // what needs the person comes before what is running
  const shown = [...chips.filter((c) => c.need), ...chips.filter((c) => !c.need)].slice(0, 3)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 font-semibold text-ink-3 text-xs">Now</span>
      {shown.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.go}
          className={cn(
            'inline-flex h-6.5 max-w-80 items-center gap-1.75 rounded-full border px-2.5 text-sm transition-colors',
            c.need
              ? 'border-transparent bg-warn-soft text-warn'
              : 'border-line bg-surface text-ink-2 hover:border-accent-line hover:text-ink',
          )}
        >
          <span className="shrink-0">{c.icon}</span>
          <span className="truncate">{c.words}</span>
        </button>
      ))}
    </div>
  )
}

// What an agent's run told the person: its words, and the rows it is about, each with Open and
// the one choice it offers (a deal's Pass).
function Told({ words, about }: { words: string; about: AboutRows | null }) {
  const { busy, on, problem, act } = useAct()
  const choose = (row: string) => {
    if (!about?.choice) return
    const choice = about.choice
    void act(
      () =>
        api.post(`/api/tables/${about.table}/rows/${row}`, {
          field: choice.field,
          value: choice.value,
        }),
      row,
    )
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
          {on === r.id && <Refusal words={problem} />}
          {about.choice &&
            (r.value === about.choice.value ? (
              <span className="shrink-0 px-2.5 text-ink-3 text-sm">{about.choice.value}</span>
            ) : (
              <Button size="sm" disabled={busy && on === r.id} onClick={() => choose(r.id)}>
                {about.choice.label}
              </Button>
            ))}
        </div>
      ))}
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

// What a card would send, as it will go: a message's head (From, To, Subject…) laid out, then its
// body. Anything without such a head is shown as written.
export function Preview({ detail }: { detail: string }) {
  const [head, ...rest] = detail.split('\n\n')
  const lines = (head ?? '').split('\n')
  const fields = lines.map((l) => /^([A-Z][A-Za-z-]{0,12}):\s(.*)$/.exec(l))
  if (!fields.length || fields.some((f) => !f))
    return (
      <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md border border-hair bg-canvas px-3 py-2.5 text-ink text-md">
        {detail}
      </div>
    )
  return (
    <div className="rounded-md border border-hair bg-canvas text-md">
      <dl className="grid grid-cols-[60px_1fr] gap-x-2.5 gap-y-0.75 border-hair border-b px-3 py-2.5">
        {fields.map((f) =>
          f ? (
            <div key={f[1]} className="contents">
              <dt className="text-ink-3">{f[1]}</dt>
              <dd className="min-w-0 break-words text-ink">{f[2]}</dd>
            </div>
          ) : null,
        )}
      </dl>
      {rest.length > 0 && (
        <div className="max-h-64 overflow-y-auto whitespace-pre-wrap px-3 py-2.5 text-ink leading-relaxed">
          {rest.join('\n\n')}
        </div>
      )}
    </div>
  )
}

// What each gate is called in a card's head.
const GATE: Record<string, string> = {
  leaves_world: 'Leaves your world',
  deletes_own: 'Deletes your entries',
  sign_in: 'Sign-in',
  filing: 'A file from your mail',
  match: 'Maybe the same',
  rows: 'For you to decide',
}

// Scrolls the stream to a card and flashes it.
function goToCard(id: string) {
  const el = document.getElementById(`card-${id}`)
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  el?.animate(
    [{ boxShadow: '0 0 0 4px var(--accent-line)' }, { boxShadow: '0 0 0 0 transparent' }],
    { duration: 1400 },
  )
}

// How an option reads on its button: a plain Yes is Approve, a plain No is Decline.
const optionWords = answerWords

export function CardBox({
  id,
  card,
  onChange,
}: {
  id: string
  card: CardView
  onChange: (c: CardView) => void
}) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [opened, setOpened] = useState(false)
  if (card.filing) return <FilingCard card={card} filing={card.filing} />
  if (card.draft) return <DraftCard card={card} draft={card.draft} />
  if (card.match) return <MatchCard card={card} match={card.match} />
  if (card.review) return <ReviewCard card={card} review={card.review} />
  if (card.proposed) return <ProposedCard card={card} proposed={card.proposed} />
  const answer = async (a: string) => {
    setBusy(true)
    try {
      // A site's sign-in opens the site in the person's own Google Chrome; the card is answered when
      // they quit it. A connection's opens the form where they sign in themselves.
      if (card.site && a === card.options[0]) {
        await api.post(`/api/cards/${id}/sign-in`)
        setOpened(true)
        return
      }
      await api.post(`/api/cards/${id}`, { answer: a })
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
      {card.detail && <Preview detail={card.detail} />}
      {card.restsOn.length > 0 && (
        <div className="text-ink-3 text-sm">Rests on {card.restsOn.join(' and ')}</div>
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
            {optionWords(o)}
          </Button>
        ))}
        {card.kind === 'permission' && (
          <Button variant="ghost" disabled={busy} onClick={() => onChange(card)}>
            Change something
          </Button>
        )}
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
      {opened && (
        <div className="text-ink-2 text-sm">
          {card.site} is open in Google Chrome on your Mac. Sign in there, then quit that Chrome
          with ⌘Q; the reader runs again.
        </div>
      )}
      {problem && <div className="text-bad text-sm">{problem}</div>}
    </Card>
  )
}

function Composer({
  words,
  setWords,
  area,
  onProblem,
  from,
  compact,
}: {
  words: string
  setWords: (w: string) => void
  area: RefObject<HTMLTextAreaElement | null>
  onProblem: (p: string) => void
  from: Module
  compact: boolean
}) {
  const file = useRef<HTMLInputElement>(null)
  const send = async () => {
    const w = words.trim()
    if (!w) return
    setWords('')
    try {
      await api.post('/api/say', { words: w, ...(from ? { from: from.id } : {}) })
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
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface py-2.5 pr-2 pl-3.5 shadow-pop focus-within:border-accent-line focus-within:ring-3 focus-within:ring-accent-soft">
      <textarea
        ref={area}
        rows={1}
        value={words}
        onChange={(e) => setWords(e.target.value)}
        onKeyDown={key}
        placeholder={from ? `Ask about ${from.name}` : 'Message Alpha'}
        aria-label={from ? `Ask about ${from.name}` : 'Message Alpha'}
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
          {compact ? '' : 'Return to send · Shift-Return for a new line'}
        </span>
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
  )
}

export function applyLive(live: Live, e: LiveEvent): Live {
  if (e.type !== 'live') return live
  return { ...live, [e.turn]: { text: e.text, doing: e.doing } }
}
