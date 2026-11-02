// The conversation (design §14; its own place since Kenil's 20 Oct call that Home holds only the
// important things): the person's sentences and Alpha's replies in order, each with its topic
// chip as a lens; one live message per turn becoming the outcome; cards inline; the Now strip and
// the composer at the foot. A module's Conversation tab and Ask (⌘J) show it through a lens.
import type {
  AboutRows,
  CardView,
  LiveEvent,
  ModelView,
  Stream,
  WorkingModuleView,
} from '@alpha/core/api'
import {
  ArrowUp,
  Bot,
  Check,
  ChevronRight,
  FolderUp,
  ImageUp,
  KeyRound,
  Plus,
  Sparkles,
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
import { CardBox, GATE } from './CardBox.tsx'
import { type Answered, group, type Item, type Module, moduleOfItem, type Step } from './stream.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { Button, IconButton } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { dropped } from './ui/drop-zone.tsx'
import { Fold } from './ui/fold.tsx'
import { Topic } from './ui/pill.tsx'
import { MenuItem, MenuLine, Popover, SubMenu } from './ui/popover.tsx'
import { Words } from './ui/words.tsx'

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
    for (const f of dropped(e)) {
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
    // biome-ignore lint/a11y/noStaticElementInteractions: a drop target for files; the + menu is the keyboard way
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
    <div className="flex items-center gap-3 font-semibold text-ink-3 text-sm">
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
      {text && (
        <div
          className={cn(
            'max-w-full self-start rounded-2xl rounded-bl-sm border border-hair bg-surface px-4 py-3',
            item.error && 'text-bad',
          )}
        >
          {/* a finished reply folds when long; one still coming in shows whole */}
          <Fold id={item.turn} whole={working || !item.reply}>
            <Words text={text} wideTables />
          </Fold>
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
      <Ran
        module={item.module}
        at={item.at}
        steps={item.steps.length}
        doing={working ? (live?.doing ?? 'Working on it…') : null}
        onLens={onLens}
      />
    </div>
  )
}

// The grey line under a reply: who answered, what ran, and Stop while it runs.
function Ran({
  module,
  at,
  steps,
  doing,
  onLens,
}: {
  module: Module
  at: string
  steps: number
  doing: string | null
  onLens: (m: Module) => void
}) {
  return (
    <div className="flex items-center gap-2 text-ink-3 text-sm">
      {doing && (
        <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-accent-line border-t-accent" />
      )}
      <span className="font-medium text-ink-2">Alpha</span>
      {module && <Topic onClick={() => onLens(module)}>{module.name}</Topic>}
      <span>{clock(at)}</span>
      <span className="min-w-0 truncate">
        {doing ?? (steps ? `Ran ${steps} step${steps === 1 ? '' : 's'}` : 'Answered')}
      </span>
      {doing && (
        <span className="ml-auto shrink-0">
          <Button size="sm" variant="ghost" onClick={() => api.post('/api/stop')}>
            Stop
          </Button>
        </span>
      )}
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
      <span className="mr-0.5 font-semibold text-ink-3 text-sm">Now</span>
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

// Scrolls the stream to a card and flashes it.
function goToCard(id: string) {
  const el = document.getElementById(`card-${id}`)
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  el?.animate(
    [{ boxShadow: '0 0 0 4px var(--accent-line)' }, { boxShadow: '0 0 0 0 transparent' }],
    { duration: 1400 },
  )
}

// The route, named short beside "+" when it is not the person's own subscription (the default).
const ROUTE_WORDS = { key: 'API key', api: "Alpha's own loop" } as const
export const routeChip = (m: ModelView | null) =>
  !m || m.route === 'subscription' ? null : ROUTE_WORDS[m.route]

// The words before the caret that address an agent: "@" at the start or after a space, then a name.
export function mentionAt(text: string): string | null {
  const m = /(?:^|\s)@([^@\n]*)$/.exec(text)
  return m ? (m[1] ?? '') : null
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
  const folder = useRef<HTMLInputElement>(null)
  const plus = useRef<HTMLButtonElement>(null)
  const chipAt = useRef<HTMLButtonElement>(null)
  // the + menu, or the routes alone from the chip; the keys are the shared menu's (ui/popover.tsx)
  const [open, setOpen] = useState<'main' | 'routes' | null>(null)
  const [model, setModel] = useState<ModelView | null>(null)
  useEffect(() => {
    api.get<ModelView>('/api/model').then(setModel, () => setModel(null))
  }, [])
  const close = () => setOpen(null)
  const add = async (files: FileList | null) => {
    for (const f of Array.from(files ?? []))
      await api.upload(f).catch(() => onProblem(`${f.name} did not go in.`))
  }
  const route = (r: ModelView['route']) => {
    close()
    api
      .post<ModelView>('/api/model', { route: r })
      .then(setModel, (err: unknown) =>
        onProblem(err instanceof Problem ? err.message : 'That did not go in.'),
      )
  }
  const chip = routeChip(model)
  // how Alpha reaches Claude, for every conversation (Settings › Model is the same switch)
  const routes = model?.providers.map((p) => (
    <MenuItem
      key={p.route}
      checked={p.chosen}
      reason={p.needsKey && !model.hasKey ? 'Needs an API key: Settings › Model' : undefined}
      onClick={() => route(p.route)}
    >
      {p.title}
    </MenuItem>
  )) ?? (
    <MenuItem reason="The core did not say which routes it has." onClick={close}>
      Model
    </MenuItem>
  )
  // "@" suggests the agents of every module; loaded the first time it is typed
  const [agents, setAgents] = useState<string[] | null>(null)
  const [query, setQuery] = useState<string | null>(null)
  const [pick, setPick] = useState(0)
  const shown =
    query === null || !agents
      ? []
      : agents.filter((a) => a.toLowerCase().startsWith(query.toLowerCase())).slice(0, 6)
  const type = (w: string, caret: number) => {
    setWords(w)
    const q = mentionAt(w.slice(0, caret))
    setQuery(q)
    setPick(0)
    if (q !== null && !agents)
      api.get<WorkingModuleView[]>('/api/working').then(
        (ms) => setAgents([...new Set(ms.flatMap((m) => m.agents.map((a) => a.name)))]),
        () => setAgents([]),
      )
  }
  const choose = (name: string) => {
    const caret = area.current?.selectionStart ?? words.length
    const before = words.slice(0, caret).replace(/@[^@\n]*$/, `@${name} `)
    setWords(before + words.slice(caret))
    setQuery(null)
    requestAnimationFrame(() => area.current?.setSelectionRange(before.length, before.length))
  }
  const send = async () => {
    const w = words.trim()
    if (!w) return
    setWords('')
    setQuery(null)
    try {
      await api.post('/api/say', { words: w, ...(from ? { from: from.id } : {}) })
    } catch (err) {
      setWords(w)
      onProblem(err instanceof Problem ? err.message : 'That did not reach Alpha.')
    }
  }
  const key = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (shown.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const step = e.key === 'ArrowDown' ? 1 : shown.length - 1
        setPick((p) => (p + step) % shown.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        choose(shown[pick] ?? '')
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault() // App's Escape would fold the assistant too
        setQuery(null)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void send()
    }
  }
  return (
    <div className="relative flex flex-col gap-1 rounded-3xl border border-line bg-surface py-2.5 pr-2.5 pl-4 shadow-pop focus-within:border-accent-line focus-within:ring-3 focus-within:ring-accent-soft">
      {shown.length > 0 && (
        <div
          role="listbox"
          aria-label="Agents"
          className="absolute inset-x-3 bottom-full mb-2 flex flex-col overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-pop"
        >
          {shown.map((a, i) => (
            <button
              key={a}
              type="button"
              role="option"
              aria-selected={i === pick}
              onMouseDown={(e) => e.preventDefault()} // the composer keeps the caret
              onClick={() => choose(a)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-left text-ink text-md',
                i === pick ? 'bg-hover' : 'hover:bg-hover',
              )}
            >
              <Bot className="size-3.5 shrink-0 text-ink-3" />
              {a}
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={area}
        rows={1}
        value={words}
        onChange={(e) => type(e.target.value, e.target.selectionStart)}
        onKeyDown={key}
        onBlur={() => setQuery(null)}
        placeholder={from ? `Ask about ${from.name}` : 'Message Alpha, or @ an agent'}
        aria-label={from ? `Ask about ${from.name}` : 'Message Alpha'}
        className="max-h-30 min-h-5.5 w-full resize-none bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
      />
      <div className="flex items-center gap-1">
        <IconButton
          ref={plus}
          label="Add files and more"
          className="rounded-full"
          aria-haspopup="menu"
          aria-expanded={open === 'main'}
          onClick={() => setOpen(open ? null : 'main')}
        >
          <Plus className="size-4" />
        </IconButton>
        {chip && (
          <button
            ref={chipAt}
            type="button"
            data-tip={model?.providers.find((p) => p.chosen)?.title}
            onClick={() => setOpen(open === 'routes' ? null : 'routes')}
            className="flex h-6.5 items-center gap-1 rounded-full border border-line px-2.5 text-ink-2 text-sm hover:bg-hover hover:text-ink"
          >
            <Sparkles className="size-3.5 text-ink-3" />
            {chip}
          </button>
        )}
        <Popover anchor={plus} open={open === 'main'} onClose={close}>
          <MenuItem
            onClick={() => {
              close()
              file.current?.click()
            }}
          >
            <ImageUp className="size-3.5 text-ink-3" />
            Add files or images
          </MenuItem>
          <MenuItem
            onClick={() => {
              close()
              folder.current?.click()
            }}
          >
            <FolderUp className="size-3.5 text-ink-3" />
            Add a folder
          </MenuItem>
          <MenuLine />
          <SubMenu
            label={
              <>
                <Sparkles className="size-3.5 text-ink-3" />
                Model
              </>
            }
          >
            {routes}
          </SubMenu>
        </Popover>
        <Popover anchor={chipAt} open={open === 'routes'} onClose={close}>
          {routes}
        </Popover>
        <input
          ref={file}
          type="file"
          multiple
          hidden
          onChange={async (e) => {
            await add(e.target.files)
            e.target.value = ''
          }}
        />
        <input
          ref={folder}
          type="file"
          hidden
          {...{ webkitdirectory: '' }}
          onChange={async (e) => {
            await add(e.target.files)
            e.target.value = ''
          }}
        />
        <span className="ml-auto text-ink-3 text-xs">
          {compact ? '' : 'Return to send · Shift-Return for a new line'}
        </span>
        <button
          type="button"
          aria-label="Send"
          data-tip="Send"
          onClick={send}
          disabled={!words.trim()}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition-opacity disabled:opacity-35"
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
