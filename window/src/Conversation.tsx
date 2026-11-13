// The conversation (its own place, as Home holds only the important things): the person's
// sentences and one agent's replies in order, one live message per turn becoming the outcome;
// cards inline; the composer at the foot. One conversation per person and agent, the Chief of
// staff first. What happened otherwise is on Activity.
import type { AgentView, CardView, Stream } from '@alpha/core/api'
import { ArrowDown, Check, ChevronRight } from 'lucide-react'
import { type DragEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, Problem } from './api.ts'
import { takeAsk } from './ask.ts'
import { CardBox } from './CardBox.tsx'
import { Composer } from './Composer.tsx'
import { useFollow } from './follow.ts'
import { type LiveParts, useLiveTurn } from './live.ts'
import {
  type AgentChange,
  type Answered,
  type Asked,
  group,
  type Item,
  type Module,
  type Part,
  type Step,
} from './stream.ts'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { CopyButton } from './ui/copy.tsx'
import { dropped } from './ui/drop-zone.tsx'
import { StreamedWords, Words } from './ui/words.tsx'
import { WatchPage } from './WatchPage.tsx'

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

const NONE: Stream['waiting'] = []

export function Conversation({
  stream,
  busyTurn,
  from = null,
  agent = null,
  agents = [],
  compact = false,
  task,
}: {
  stream: Stream | null
  busyTurn: string | null
  from?: Module // asked from a module's screen
  agent?: AgentView | null // whose conversation this is
  agents?: AgentView[] // the team, for @
  compact?: boolean // in the Ask panel: narrow
  task?: string // this is a task's own thread
}) {
  const items = useMemo(() => group(stream?.lines ?? []), [stream])
  const cards = useMemo(() => new Map((stream?.cards ?? []).map((c) => [c.id, c])), [stream])
  const [dragging, setDragging] = useState(false)
  const [watching, setWatching] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [words, setWords] = useState('')
  const composer = useRef<HTMLTextAreaElement>(null)
  // words another screen started the assistant with
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

  const { scroller, content, onScroll, away, toLatest } = useFollow(
    task ?? agent?.id ?? 'chief',
    stream !== null,
    !task || stream?.busy === true, // a finished task opens at the top of what it found
  )
  // your own message brings you back to the end
  const said = items.filter((i) => i.kind === 'said').length
  useEffect(() => {
    if (said) toLatest()
  }, [said, toLatest])

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
  const changeCard = useCallback((card: CardView) => {
    setWords(`About “${card.words.replace(/\?$/, '')}”: `)
    composer.current?.focus()
  }, [])

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
        <div className="@container flex-1 overflow-y-auto" ref={scroller} onScroll={onScroll}>
          <div
            ref={content}
            className={cn(
              'mx-auto flex flex-col gap-6',
              compact ? 'px-4 pt-4 pb-3' : 'max-w-stream px-8 pt-7 pb-5 text-chat',
            )}
          >
            {items.length === 0 && (
              <p className="pt-24 text-center text-ink-3">
                {agent && !agent.chief
                  ? agent.description
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
                    working={item.kind === 'alpha' && busyTurn === item.turn}
                    cards={cards}
                    waiting={stream?.waiting ?? NONE}
                    onChangeCard={changeCard}
                    name={agent?.name ?? 'Chief of staff'}
                  />
                </div>
              )
            })}
            {stream?.asked
              .filter((id) => cards.has(id))
              .map((id) => (
                <CardBox key={id} id={id} card={cards.get(id) as CardView} onChange={changeCard} />
              ))}
            {stream?.watch && (
              <div>
                <Button size="sm" variant="ghost" onClick={() => setWatching(true)}>
                  {busyTurn !== null ? 'Watch it work on' : 'Open its page on'} {stream.watch.site}
                </Button>
                {watching && (
                  <WatchPage
                    tab={stream.watch.tab}
                    site={stream.watch.site}
                    name={agent?.name ?? 'Chief of staff'}
                    onClose={() => setWatching(false)}
                  />
                )}
              </div>
            )}
            {stream?.serving && (
              <div className="flex items-center gap-1.5 text-ink-3 text-sm">
                <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-accent-line border-t-accent" />
                Working for {stream.serving}
              </div>
            )}
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
            'relative mx-auto flex w-full flex-col gap-2',
            compact ? 'px-3 pt-1 pb-3' : 'max-w-composer px-4 pt-1.5 pb-3',
          )}
        >
          {away && (
            <button
              type="button"
              aria-label="Go to the latest"
              data-tip="Go to the latest"
              onClick={toLatest}
              className="-top-9 -translate-x-1/2 absolute left-1/2 grid size-8 place-items-center rounded-full border border-line bg-surface text-ink-2 hover:text-ink"
            >
              <ArrowDown className="size-4" />
            </button>
          )}
          <Composer
            words={words}
            setWords={setWords}
            area={composer}
            onProblem={setProblem}
            from={from}
            agent={agent}
            agents={agents}
            running={busyTurn !== null}
            {...(task ? { task } : {})}
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
  return <div className="text-center text-ink-3 text-sm">{day}</div>
}

// Alpha's name over a card a run opened: its mark, the module and when.
function Meta({ module, at, name }: { module: Module; at: string; name: string }) {
  return (
    <div className="flex items-center gap-2 text-ink-3 text-sm">
      <span className="font-semibold text-ink text-md">{name}</span>
      {module && <span>{module.name}</span>}
      <span>{clock(at)}</span>
    </div>
  )
}

// A question's answer stays in the chat as one line, the card's words after it; a yes or a no on a
// card leaves none, Activity has it. A closing line is "Chose Add: …" or
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

const Entry = memo(function Entry({
  item,
  working,
  cards,
  waiting,
  name,
  onChangeCard,
}: {
  item: Item
  working: boolean
  cards: Map<string, CardView>
  waiting: Stream['waiting']
  name: string
  onChangeCard: (c: CardView) => void
}) {
  const live = useLiveTurn(item.kind === 'alpha' ? item.turn : null)
  if (item.kind === 'said')
    return (
      <div className="max-w-[85%] self-end whitespace-pre-wrap rounded-xl bg-sunk px-4 py-3 text-ink">
        {item.words}
      </div>
    )
  if (item.kind === 'note') return <div className="text-center text-sm text-warn">{item.words}</div>
  if (item.kind === 'card') {
    const card = cards.get(item.id)
    if (!card && !(item.answered && answerOf(item.answered.words))) return null
    return (
      <div className="flex flex-col gap-2.25" id={`card-${item.id}`}>
        <Meta module={item.module} at={item.at} name={name} />
        {card ? (
          <CardBox id={item.id} card={card} onChange={onChangeCard} />
        ) : item.answered ? (
          <AnsweredLine answered={item.answered} />
        ) : null}
      </div>
    )
  }
  // a turn that asked teammates says nothing of its own: the reply comes when they have answered;
  // one agent named by the person answers it itself
  const asking = item.asks.length > 0
  const direct = item.asks.find((a) => a.direct)?.answer?.words ?? null
  // what is streaming until its reply is in the journal, so nothing goes in between
  const streaming = !item.reply && !item.error && !!live?.parts?.length
  const parts: Part[] = asking
    ? direct
      ? [{ kind: 'text', text: direct }]
      : []
    : streaming
      ? partsOf(live?.parts ?? [])
      : item.parts
  if (
    !parts.length &&
    !item.error &&
    !working &&
    !item.cards.length &&
    !item.asks.length &&
    !item.notes.length &&
    !item.changes.length
  )
    return null
  return (
    <div className="group/turn flex flex-col gap-4">
      {item.asks.map((a) => (
        <AskLine key={a.id} ask={a} waiting={waiting.find((w) => w.id === a.id)} />
      ))}
      {parts.map((part, i) =>
        part.kind === 'text' ? (
          <div key={i} className="min-w-0">
            <StreamedWords text={part.text} streaming={streaming && i === parts.length - 1} />
          </div>
        ) : (
          <Steps key={i} steps={part.steps} active={working && i === parts.length - 1} />
        ),
      )}
      {item.error && <div className="text-bad">{item.error}</div>}
      {item.notes.map((w) => (
        <div key={w} className="flex items-center gap-1.5 text-ink-3 text-sm">
          <Check className="size-3.5 shrink-0" />
          {w}
        </div>
      ))}
      {item.changes.map((c) => (
        <Change key={`${c.commit}${c.words}`} change={c} />
      ))}
      {item.cards.map((id) => {
        const card = cards.get(id)
        const answered = item.answered[id]
        return (
          <div key={id} id={`card-${id}`}>
            {card ? (
              // a card shows under the words that explain it: once its turn's message is in
              working ? null : (
                <CardBox id={id} card={card} onChange={onChangeCard} />
              )
            ) : answered ? (
              <AnsweredLine answered={answered} />
            ) : null}
          </div>
        )
      })}
      {parts.some((p) => p.kind === 'text') && (
        <CopyButton
          text={() => parts.flatMap((p) => (p.kind === 'text' ? [p.text] : [])).join('\n\n')}
          className={cn(
            '-my-2 self-start transition-opacity',
            working ? 'invisible' : 'opacity-0 group-hover/turn:opacity-100',
          )}
        />
      )}
    </div>
  )
})

// One teammate asked: Stop while it works, then its answer and evidence behind a fold.
function AskLine({ ask, waiting }: { ask: Asked; waiting: Stream['waiting'][number] | undefined }) {
  const head = waiting ? ask.words : ask.words.replace(/^Asking /, 'Asked ')
  const said = ask.answer
  const name = ask.direct ? head.replace(/^Asked /, '') : head
  const tag = !said
    ? waiting
      ? null
      : 'Stopped'
    : said.status === 'blocked'
      ? 'Blocked'
      : said.status === 'failed'
        ? 'Failed'
        : said.status === 'stopped'
          ? 'Stopped'
          : null
  const mark = tag && <span className={tag === 'Failed' ? 'text-bad' : 'text-warn'}>{tag}</span>
  if (said && ask.direct && !said.evidence && !said.unblock)
    return (
      <div className="flex items-center gap-1.5 text-ink-3">
        <span>{name}</span>
        {mark}
      </div>
    )
  if (!said)
    return (
      <div className="flex items-center gap-1.5 text-ink-3">
        {waiting ? (
          <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-accent-line border-t-accent" />
        ) : null}
        <span className="min-w-0">
          {head}
          {waiting?.doing && <span className="block text-ink-3">{waiting.doing}</span>}
        </span>
        {mark}
        {waiting && (
          <span className="ml-auto shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => api.post('/api/stop', { ask: ask.id })}
            >
              Stop
            </Button>
          </span>
        )}
      </div>
    )
  return (
    <details className="group text-ink-3">
      <summary className="flex cursor-pointer select-none list-none items-center gap-1 hover:text-ink-2">
        <span className="min-w-0 truncate">{name}</span>
        {mark}
        <ChevronRight className="size-3.5 shrink-0 transition-transform group-open:rotate-90" />
      </summary>
      <div className="mt-1.5 ml-2 flex flex-col gap-1.5 border-line border-l pl-3">
        {!ask.direct && (
          <div className="text-ink-2">
            <Words text={said.words} />
          </div>
        )}
        {said.unblock && <div className="text-warn">What would unblock it: {said.unblock}</div>}
        {said.evidence && <div>{said.evidence}</div>}
      </div>
    </details>
  )
}

// A change to an agent, in the conversation where it happened, with Undo.
function Change({ change }: { change: AgentChange }) {
  const [undone, setUndone] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const can = change.agent && change.commit && change.path
  return (
    <div className="flex items-center gap-2 text-ink-3 text-sm">
      <Check className="size-3.5 shrink-0" />
      <span>{change.words}</span>
      {can && !undone && (
        <button
          type="button"
          className="text-accent hover:underline"
          onClick={() =>
            api
              .post(`/api/agents/${change.agent}/undo`, {
                commit: change.commit,
                path: change.path,
              })
              .then(
                () => setUndone(true),
                (e: unknown) =>
                  setProblem(e instanceof Problem ? e.message : 'That was not undone.'),
              )
          }
        >
          Undo
        </button>
      )}
      {undone && <span>Undone.</span>}
      {problem && <span className="text-bad">{problem}</span>}
    </div>
  )
}

// A turn's live parts in the shape the journal gives them, so the two read the same.
function partsOf(live: LiveParts): Part[] {
  const out: Part[] = []
  live.forEach((p, i) => {
    if (p.kind === 'text') {
      out.push({ kind: 'text', text: p.text })
      return
    }
    const step: Step = { id: i, words: p.words, ok: null, results: [] }
    const last = out.at(-1)
    if (last?.kind === 'steps') last.steps.push(step)
    else out.push({ kind: 'steps', steps: [step] })
  })
  return out
}

// What a run of steps did, in a few words.
function summaryOf(steps: Step[]): string {
  const first = steps[0]
  if (first && steps.length === 1) return first.words
  const count = (re: RegExp) => steps.filter((s) => re.test(s.words)).length
  const searched = count(/^Searched the web/)
  const read = count(/^Read /)
  const ran = count(/^Ran/)
  const rest = steps.length - searched - read - ran
  if (rest === steps.length) return `Ran ${steps.length} steps`
  const said = [
    searched && (searched === 1 ? 'searched the web' : `searched the web ${searched} times`),
    read && (read === 1 ? 'read a page' : `read ${read} pages`),
    ran && (ran === 1 ? 'ran a command' : `ran ${ran} commands`),
    rest && (rest === 1 ? 'one more step' : `${rest} more steps`),
  ]
    .filter(Boolean)
    .join(', ')
  return `${said[0]?.toUpperCase()}${said.slice(1)}`
}

// One step, its verb quieter than what it acted on.
function StepRow({ step }: { step: Step }) {
  const at = step.words.indexOf(' ')
  return (
    <div className="flex min-w-0 flex-col border-hair border-t px-3 py-2 first:border-t-0">
      <span className="truncate">
        {step.ok === false && <span className="text-bad">Failed </span>}
        <span className="text-ink-3">{at > 0 ? step.words.slice(0, at) : step.words}</span>
        {at > 0 && <span className="text-ink-2">{step.words.slice(at)}</span>}
      </span>
      {step.results.map((r) => (
        <span key={r} className="truncate text-ink-3">
          {r}
        </span>
      ))}
      {step.picture && (
        <a
          href={api.tokened(`/api/pictures/${step.picture}`)}
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 w-fit"
        >
          <img
            src={api.tokened(`/api/pictures/${step.picture}`)}
            alt="The page after this step"
            className="h-28 w-auto rounded-sm border border-line"
          />
        </a>
      )}
    </div>
  )
}

// The steps between two pieces of text: what is happening while they run, then one quiet line
// that opens to each of them.
function Steps({ steps, active }: { steps: Step[]; active: boolean }) {
  if (active) return <div className="truncate text-ink-3">{steps.at(-1)?.words}</div>
  // a step that failed on the way and was got past is in the list, not on the line
  const failed = steps.at(-1)?.ok === false
  return (
    <details className="group text-ink-3">
      <summary className="inline-flex max-w-full cursor-pointer select-none list-none items-center gap-1 hover:text-ink-2">
        <span className="truncate">{summaryOf(steps)}</span>
        {failed && <span className="text-bad">Failed</span>}
        <ChevronRight className="size-3.5 shrink-0 transition-transform group-open:rotate-90" />
      </summary>
      <div className="mt-2 overflow-hidden rounded-lg border border-hair">
        {steps.map((s) => (
          <StepRow key={s.id} step={s} />
        ))}
      </div>
    </details>
  )
}
