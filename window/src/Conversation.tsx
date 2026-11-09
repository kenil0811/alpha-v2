// The conversation (design §14; its own place since Kenil's 20 Oct call that Home holds only the
// important things): the person's sentences and Alpha's replies in order, each with its topic
// chip as a lens; one live message per turn becoming the outcome; cards inline; the composer at the
// foot. Only the conversation is here: what happened otherwise is on Activity (clean base, 7 Nov).
// A module's Conversation tab and Ask (⌘J) show it through a lens.
import type { CardView, LiveEvent, Stream, WorkingModuleView } from '@alpha/core/api'
import { ArrowUp, Bot, Check, ChevronRight, FolderUp, ImageUp, Plus } from 'lucide-react'
import {
  type DragEvent,
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { api, Problem } from './api.ts'
import { takeAsk } from './ask.ts'
import { CardBox } from './CardBox.tsx'
import { type Answered, group, type Item, type Module, moduleOfItem, type Step } from './stream.ts'
import { Button, IconButton } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { dropped } from './ui/drop-zone.tsx'
import { Fold } from './ui/fold.tsx'
import { Topic } from './ui/pill.tsx'
import { MenuItem, Popover } from './ui/popover.tsx'
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
  compact?: boolean // in the Ask panel: narrow
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

// Alpha's name over a card a run opened: its mark, the module and when.
function Meta({ module, at, onLens }: { module: Module; at: string; onLens: (m: Module) => void }) {
  return (
    <div className="flex items-center gap-2 text-ink-3 text-sm">
      <span className="grid size-5 shrink-0 place-items-center rounded-sm bg-ink font-semibold font-serif text-canvas text-sm leading-none">
        A
      </span>
      <span className="font-semibold text-ink text-md">Alpha</span>
      {module && <Topic onClick={() => onLens(module)}>{module.name}</Topic>}
      <span>{clock(at)}</span>
    </div>
  )
}

// A question's answer stays in the chat as one line, the card's words after it; a yes or a no on a
// card leaves none, Activity has it (Kenil's call 3, 7 Nov). A closing line is "Chose Add: …" or
// "Answered Soon: …".
export function answerOf(words: string): string | null {
  const head = words.split(': ')[0] ?? ''
  if (head.startsWith('Chose ')) return `You chose ${head.slice(6)}`
  if (head.startsWith('Answered ')) return `You answered ${head.slice(9)}`
  return null
}

function AnsweredLine({ answered }: { answered: Answered }) {
  const said = answerOf(answered.words)
  if (!said) return null
  return (
    <div className="flex items-center gap-2 rounded-md bg-sunk px-3 py-2.25 text-ink-2 text-md">
      <Check className="size-4 shrink-0" />
      <span className="shrink-0 font-medium">{said}</span>
      <span className="min-w-0 flex-1 truncate opacity-80">
        {answered.words.split(': ').slice(1).join(': ')}
      </span>
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
  if (item.kind === 'note') return <div className="text-center text-sm text-warn">{item.words}</div>
  if (item.kind === 'card') {
    const card = cards.get(item.id)
    if (!card && !(item.answered && answerOf(item.answered.words))) return null
    return (
      <div className="flex flex-col gap-2.25" id={`card-${item.id}`}>
        <Meta module={item.module} at={item.at} onLens={onLens} />
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

// The words before the caret that address a schedule: "@" at the start or after a space, then a name.
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
  // the + menu; its keys are the shared menu's (ui/popover.tsx)
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const add = async (files: FileList | null) => {
    for (const f of Array.from(files ?? []))
      await api.upload(f).catch(() => onProblem(`${f.name} did not go in.`))
  }
  // "@" suggests the schedules of every module; loaded the first time it is typed
  const [schedules, setSchedules] = useState<string[] | null>(null)
  const [query, setQuery] = useState<string | null>(null)
  const [pick, setPick] = useState(0)
  const shown =
    query === null || !schedules
      ? []
      : schedules.filter((a) => a.toLowerCase().startsWith(query.toLowerCase())).slice(0, 6)
  const type = (w: string, caret: number) => {
    setWords(w)
    const q = mentionAt(w.slice(0, caret))
    setQuery(q)
    setPick(0)
    if (q !== null && !schedules)
      api.get<WorkingModuleView[]>('/api/working').then(
        (ms) => setSchedules([...new Set(ms.flatMap((m) => m.schedules.map((a) => a.name)))]),
        () => setSchedules([]),
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
          aria-label="Schedules"
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
        placeholder={from ? `Ask about ${from.name}` : 'Message Alpha, or @ a schedule'}
        aria-label={from ? `Ask about ${from.name}` : 'Message Alpha'}
        className="max-h-30 min-h-5.5 w-full resize-none bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
      />
      <div className="flex items-center gap-1">
        <IconButton
          ref={plus}
          label="Add files and more"
          className="rounded-full"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Plus className="size-4" />
        </IconButton>
        <Popover anchor={plus} open={open} onClose={close}>
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
