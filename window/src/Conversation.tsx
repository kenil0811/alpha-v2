// The conversation (design §14; its own place since Kenil's 20 Oct call that Home holds only the
// important things): the person's sentences and one agent's replies in order, one live message per
// turn becoming the outcome; cards inline; the composer at the foot. One conversation per person
// and agent (clean base step 7), the Chief of staff first. What happened otherwise is on Activity.
import type { AgentView, CardView, LiveEvent, Stream } from '@alpha/core/api'
import { Bot, Check, ChevronRight } from 'lucide-react'
import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import { api, Problem } from './api.ts'
import { takeAsk } from './ask.ts'
import { CardBox } from './CardBox.tsx'
import { Composer } from './Composer.tsx'
import {
  type AgentChange,
  type Answered,
  type Asked,
  group,
  type Item,
  type Module,
  type Step,
} from './stream.ts'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { dropped } from './ui/drop-zone.tsx'
import { Fold } from './ui/fold.tsx'
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
  from = null,
  agent = null,
  agents = [],
  compact = false,
}: {
  stream: Stream | null
  live: Live
  busyTurn: string | null
  from?: Module // asked from a module's screen
  agent?: AgentView | null // whose conversation this is
  agents?: AgentView[] // the team, for @
  compact?: boolean // in the Ask panel: narrow
}) {
  const items = useMemo(() => group(stream?.lines ?? []), [stream])
  const cards = useMemo(() => new Map((stream?.cards ?? []).map((c) => [c.id, c])), [stream])
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
                    live={item.kind === 'alpha' ? live[item.turn] : undefined}
                    working={item.kind === 'alpha' && busyTurn === item.turn}
                    cards={cards}
                    waiting={stream?.waiting ?? []}
                    onChangeCard={changeCard}
                    name={agent?.name ?? 'Chief of staff'}
                    agentId={agent?.id ?? 'chief'}
                  />
                </div>
              )
            })}
            {stream?.asked
              .filter((id) => cards.has(id))
              .map((id) => (
                <CardBox key={id} id={id} card={cards.get(id) as CardView} onChange={changeCard} />
              ))}
            {stream?.serving && (
              <div className="flex items-center gap-1.5 text-ink-3 text-sm">
                <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-accent-line border-t-accent" />
                Working for {stream.serving}
              </div>
            )}
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
            agent={agent}
            agents={agents}
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
  waiting,
  name,
  agentId,
  onChangeCard,
}: {
  item: Item
  live: Live[string] | undefined
  working: boolean
  cards: Map<string, CardView>
  waiting: Stream['waiting']
  name: string
  agentId: string
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
        <Meta module={item.module} at={item.at} name={name} />
        {card ? (
          <CardBox id={item.id} card={card} onChange={onChangeCard} />
        ) : item.answered ? (
          <AnsweredLine answered={item.answered} />
        ) : null}
      </div>
    )
  }
  // a turn that asked teammates says nothing of its own: the reply comes when they have answered
  const asking = item.asks.length > 0
  const text = asking ? (item.error ?? '') : (item.reply ?? item.error ?? live?.text ?? '')
  const doing = working ? (live?.doing ?? 'Working on it…') : null
  if (
    !text &&
    !working &&
    !item.cards.length &&
    !item.steps.length &&
    !item.asks.length &&
    !item.notes.length &&
    !item.changes.length
  )
    return null
  return (
    <div className="flex flex-col gap-2.25">
      {item.asks.map((a) => (
        <AskLine key={a.id} ask={a} waiting={waiting.find((w) => w.id === a.id)} />
      ))}
      {(doing || (item.steps.length > 0 && !asking)) && (
        <WorkLine
          steps={item.steps}
          module={item.module}
          at={item.at}
          doing={doing}
          agentId={agentId}
        />
      )}
      {text && (
        <div className={cn('min-w-0', item.error && 'text-bad')}>
          {/* a finished reply folds when long; one still coming in shows whole */}
          <Fold id={item.turn} whole={working || !item.reply}>
            <Words text={text} />
          </Fold>
        </div>
      )}
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
              <CardBox id={id} card={card} onChange={onChangeCard} />
            ) : answered ? (
              <AnsweredLine answered={answered} />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

// One teammate asked: Stop while it works, then its answer and evidence behind a fold.
function AskLine({ ask, waiting }: { ask: Asked; waiting: Stream['waiting'][number] | undefined }) {
  const head = waiting ? ask.words : ask.words.replace(/^Asking /, 'Asked ')
  const said = ask.answer
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
  if (!said)
    return (
      <div className="flex items-center gap-1.5 text-ink-3 text-sm">
        {waiting ? (
          <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-accent-line border-t-accent" />
        ) : (
          <Bot className="size-3.5 shrink-0" />
        )}
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
    <details className="group text-ink-3 text-sm">
      <summary className="flex cursor-pointer select-none list-none items-start gap-1.5">
        <ChevronRight className="mt-0.5 size-3.5 shrink-0 transition-transform group-open:rotate-90" />
        <span className="min-w-0">{head}</span>
        {mark}
      </summary>
      <div className="mt-1.5 ml-2 flex flex-col gap-1.5 border-line border-l pl-3">
        <div className="text-ink-2">
          <Words text={said.words} />
        </div>
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

// A turn's steps on one grey line above its words, folded; while it runs, what it is doing and Stop.
function WorkLine({
  steps,
  module,
  at,
  doing,
  agentId,
}: {
  steps: Step[]
  module: Module
  at: string
  doing: string | null
  agentId: string
}) {
  if (doing)
    return (
      <div className="flex items-center gap-2 text-ink-3 text-sm">
        <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-accent-line border-t-accent" />
        <span className="min-w-0 truncate">{doing}</span>
        <span className="ml-auto shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => api.post('/api/stop', { agent: agentId })}
          >
            Stop
          </Button>
        </span>
      </div>
    )
  return (
    <details className="group text-ink-3 text-sm">
      <summary className="inline-flex cursor-pointer select-none list-none items-center gap-1 rounded-sm py-0.5 pr-1.5 pl-0.5 hover:bg-hover hover:text-ink">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
        <span>
          Ran {steps.length} step{steps.length === 1 ? '' : 's'}
        </span>
        {module && <span>· {module.name}</span>}
        <span>· {clock(at)}</span>
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

export function applyLive(live: Live, e: LiveEvent): Live {
  if (e.type !== 'live') return live
  return { ...live, [e.turn]: { text: e.text, doing: e.doing } }
}
