// What waits on the person, one list on Home and on Tasks › Needs you (Vikas, 30 Oct: "on the
// tasks I want to see each task as a separate task"): sign-ins, then every card as its own row with
// its own buttons, under a heading per agent that carries Approve all where its cards share
// options (drafts never), then the tasks that wait on the person and no card stands for. Rows share
// one fixed grid with the task rows, the date at the same place on each. As a gallery, each card is
// a tile. A click on a row or tile, off its buttons, opens it whole in the side panel.
import type { RunView, TaskLineView } from '@alpha/core/api'
import { KeyRound } from 'lucide-react'
import { Fragment, type ReactNode, useEffect, useState } from 'react'
import { agoWords } from './AgentList.tsx'
import { api } from './api.ts'
import type { CardView, Stream, WorkingModuleView } from './coming.ts'
import { signalOf } from './Overview.tsx'
import { peek } from './Peek.tsx'
import { signInWith } from './SignInApps.tsx'
import { bulkOf, kindOf } from './stack.tsx'
import { TaskLine } from './Tasks.tsx'
import { dueWords } from './time.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { Card } from './ui/card.tsx'
import { cn } from './ui/cn.ts'
import { Dot } from './ui/dot.tsx'
import { Label } from './ui/pill.tsx'
import { Pager, pagesOf } from './ui/slides.tsx'
import { answerWords } from './vocabulary.ts'

export type CardsKind = 'list' | 'gallery' | 'slides'

// The view switch the tables use, offering the three a list of cards can be: rows, a gallery of
// cards, and one card at a time (Vikas, 30 Oct).
// How many things wait on the person: one per row Needs you draws (a sign-in, a card, each task a
// proposal still wants a word on). Home, its badge and Tasks all count with this.
export const needsCount = (cards: CardView[], signIns = 0) =>
  signIns + cards.reduce((k, c) => k + (c.proposed ? openTasks(c) : 1), 0)

// What a card is, in the words any business app uses.
export function kindWords(c: CardView): string {
  if (failedOf(c).length) return 'Failed'
  if (c.draft) return 'Draft'
  if (c.match) return 'Possible duplicate'
  if (c.review) return 'For you to decide'
  if (c.proposed) return 'Proposed tasks'
  if (c.filing) return 'A file from your mail'
  if (c.gate === 'sign_in' || c.site || c.connector) return 'Sign-in'
  if (c.kind === 'permission') return 'Needs approval'
  return 'Question'
}

// The one thing to do: an answer given from here, or the card opened where it needs more.
function primaryOf(c: CardView): { label: string; answer: string | null } {
  if (failedOf(c).length)
    return { label: c.options[0] ?? 'Try again', answer: c.options[0] ?? null }
  if (c.draft) return { label: 'Review draft', answer: null }
  if (c.match) return { label: 'Compare', answer: null }
  if (c.review) return { label: `Decide ${c.review.open}`, answer: null }
  if (c.proposed) return { label: 'Review tasks', answer: null }
  if (c.filing) return { label: 'File it', answer: null }
  if (c.gate === 'sign_in' || c.site || c.connector)
    return { label: c.options[0] ?? 'Sign in', answer: null }
  const first = c.options[0]
  return first ? { label: answerWords(first), answer: first } : { label: 'Answer', answer: null }
}

// What a card asks, written out (Vikas, 30 Oct: "if there are multiple requests combined, show the
// aggregated request as text on the card"): the agents that did not finish by their reasons, a
// proposal's tasks, a review's rows, a draft's message, else its detail or what it rests on.
export function bodyOf(c: CardView): string {
  const failed = failedOf(c)
  if (failed.length === 1) return `${failed[0]?.name}: ${failed[0]?.words}`
  // before P6 the reasons are on each agent's row, opened from the card
  if (failed.length && failed.every((f) => !f.words))
    return `Each did not finish its last runs: ${failed.map((f) => f.name).join(', ')}. Open it to see what happened to each and answer one at a time.`
  if (failed.length) {
    const by = new Map<string, string[]>()
    for (const f of failed) by.set(f.words, [...(by.get(f.words) ?? []), f.name])
    const said = [...by]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([w, names]) => `${w} for ${names.length === 1 ? names[0] : `${names.length} of them`}`)
      .join('; ')
    return `${said[0]?.toUpperCase()}${said.slice(1)}.`
  }
  if (c.draft) {
    const m = c.draft.message
    return `To ${m.to}: ${m.subject}\n${m.body}`
  }
  if (c.review) {
    const open = c.review.rows.filter((r) => !r.value)
    return `${c.review.open} of ${c.review.rows.length} in ${c.review.table} to decide on ${c.review.field}: ${open.map((r) => r.name).join(', ')}`
  }
  if (c.proposed) {
    const open = c.proposed.tasks.filter((t) => !t.word)
    return `${open.length === 1 ? 'A task' : `${open.length} tasks`} to add: ${open.map((t) => t.title).join('; ')}`
  }
  return c.detail ?? c.restsOn.join(' and ')
}
const aboutOf = (c: CardView) => bodyOf(c).split('\n')[0] ?? ''

type Failed = NonNullable<CardView['failed']>[number]

// The agents a card says did not finish: the core's own list (P6), else read from what the card
// rests on ("Fusion's last 3 runs"), so each is its own row even before P6 (Vikas, 1 Nov).
export function failedOf(c: CardView): Failed[] {
  if (c.failed?.length) return c.failed
  if (!/did not finish/.test(c.words)) return []
  return c.restsOn.flatMap((r) => {
    const m = /^(.+)'s last (\d+) runs$/.exec(r)
    return m?.[1] ? [{ agent: '', name: m[1], words: '', times: Number(m[2]) }] : []
  })
}

// What happened, agent by agent: one row each with its last failed run's words and when, the
// agent's page on a click, and its own Try again and Leave it; the card's buttons answer for all.
export function FailedCard({ card }: { card: CardView }) {
  const all = useAct()
  const failed = failedOf(card)
  return (
    <Card label="Failed" waits="Needs approval">
      <div className="font-medium text-ink text-lg">
        {failed.length > 1 ? `${failed.length} agents did not finish` : card.words}
      </div>
      {failed.length > 1 && <FailedRows card={card} />}
      <div className="flex flex-wrap items-center gap-2">
        {card.options.map((o, i) => (
          <Button
            key={o}
            variant={i === 0 ? 'primary' : 'default'}
            disabled={all.busy}
            onClick={() => all.act(() => api.post(`/api/cards/${card.id}`, { answer: o }))}
          >
            {o}
          </Button>
        ))}
        <Refusal words={all.problem} />
      </div>
    </Card>
  )
}

// The agents, three a page so the card stays half the work column: on the card where it waits,
// and on the card opened whole.
const PER = 3
function FailedRows({ card }: { card: CardView }) {
  const failed = useFilled(failedOf(card), !card.failed?.length)
  const [at, setAt] = useState(0)
  const pages = pagesOf(failed.length, PER)
  const page = Math.min(at, pages - 1)
  const shown = failed.slice(page * PER, page * PER + PER)
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
        {shown.map((f) => (
          <FailedAgent key={f.name} card={card.id} f={f} own={!!card.failed?.length} />
        ))}
      </ul>
      {/* it counts agents, not pages: "Agents 6–10 of 16" */}
      <Pager
        page={page}
        pages={pages}
        label="Agents that did not finish"
        words={`Agents ${page * PER + 1}–${page * PER + shown.length} of ${failed.length}`}
        onGo={setAt}
      />
    </div>
  )
}

// Before P6, each agent's id and what its last failed run said, from Agents and Activity.
function useFilled(failed: Failed[], fill: boolean): (Failed & { at?: string })[] {
  const [runs, setRuns] = useState<RunView[]>([])
  const [ids, setIds] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    if (!fill) return
    api.get<RunView[]>('/api/activity').then(setRuns, () => setRuns([]))
    api.get<WorkingModuleView[]>('/api/working').then(
      (ms) => setIds(new Map(ms.flatMap((m) => m.agents.map((a) => [a.name, a.id] as const)))),
      () => undefined,
    )
  }, [fill])
  if (!fill) return failed
  return failed.map((f) => {
    const last = runs.find((r) => r.kind === 'run' && r.name === f.name && r.state === 'failed')
    return {
      ...f,
      agent: ids.get(f.name) ?? '',
      words: last?.words ?? `Its last ${f.times} runs did not finish`,
      ...(last ? { at: last.startedAt } : {}),
    }
  })
}

function FailedAgent({
  card,
  f,
  own,
}: {
  card: string
  f: Failed & { at?: string }
  own: boolean
}) {
  const { busy, problem, act } = useAct()
  // the core's per-agent answer (P6); before it, Try again runs the agent once more
  const go = (again: boolean) =>
    act(() =>
      own
        ? api.post(`/api/cards/${card}/agents/${f.agent}`, { again })
        : api.post(`/api/agents/${f.agent}/run`),
    )
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
      <button
        type="button"
        disabled={!f.agent}
        onClick={() => peek(`#/agent/${f.agent}`)}
        className="min-w-0 flex-1 basis-48 text-left"
      >
        <span className="block font-medium text-ink hover:underline">{f.name}</span>
        <span data-tip={f.words} className="line-clamp-2 break-words text-ink-3 text-sm">
          {f.words}
          {f.at ? ` · ${agoWords(f.at)}` : ''}
        </span>
      </button>
      {f.agent && (
        <Button size="sm" disabled={busy} onClick={() => go(true)}>
          Try again
        </Button>
      )}
      {own && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => go(false)}>
          Leave it
        </Button>
      )}
      <Refusal words={problem} />
    </li>
  )
}

// One card as a card: what it is, its title, what it asks written out, and its buttons at the
// bottom right; large, one at a time, with the pager beside the buttons. A click anywhere else on it
// opens it whole.
function CardTile({
  card,
  module,
  onChange,
  pager,
}: {
  card: CardView
  module: string | undefined
  onChange: () => void
  pager?: ReactNode // a slide: larger, and the way to the others beside its buttons
}) {
  const { busy, problem, act } = useAct(onChange)
  const onOpen = () => peek(`#/card/${card.id}`)
  const primary = primaryOf(card)
  const second = primary.answer ? card.options[1] : undefined
  const answer = (a: string) => act(() => api.post(`/api/cards/${card.id}`, { answer: a }))
  const several = failedOf(card).length > 1
  const body = several ? '' : bodyOf(card)
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the title is the keyboard's way in, a button
    // biome-ignore lint/a11y/noStaticElementInteractions: as above
    <div
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('button')) onOpen()
      }}
      className={cn(
        // one size, the pager or not: a card is half the work column (Vikas, 1 Nov: "too big")
        'flex cursor-pointer flex-col gap-2 rounded-lg border border-line bg-surface p-4 hover:border-accent-line',
      )}
    >
      <div className="flex items-center gap-2">
        <Dot s={signalOf(card)} tip={kindWords(card)} />
        <Label className="text-ink-2">{kindWords(card)}</Label>
        <span className="ml-auto truncate text-ink-3 text-sm">
          {[card.agent?.name, module].filter(Boolean).join(' · ')}
        </span>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className={cn('line-clamp-3 text-left font-medium text-base text-ink hover:underline')}
      >
        {card.words}
      </button>
      {body && <p className={cn('line-clamp-5 whitespace-pre-line text-ink-2 text-sm')}>{body}</p>}
      {several && <FailedRows card={card} />}
      <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-1">
        {pager && <span className="mr-auto">{pager}</span>}
        <Refusal words={problem} />
        {second && (
          <Button size="sm" disabled={busy} onClick={() => answer(second)}>
            {answerWords(second)}
          </Button>
        )}
        <Button
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={() => (primary.answer ? answer(primary.answer) : onOpen())}
        >
          {primary.label}
        </Button>
      </div>
    </div>
  )
}

// One card at a time, large (Vikas, 30 Oct and 1 Nov: Agent approvals is one slideshow card): the
// dots and ‹ 2 of 10 › under it, as on every card; an answered card leaves the list, so the next
// one takes its place.
function OneAtATime({
  cards,
  moduleName,
  onChange,
}: {
  cards: CardView[]
  moduleName: (c: CardView) => string | undefined
  onChange: () => void
}) {
  // its pager inside the card, beside its buttons, so the card's corner is its own and a list
  // inside it never shows a second "1 of 4" under the first (Vikas, 1 Nov)
  const [at, setAt] = useState(0)
  const page = Math.min(at, cards.length - 1)
  const card = cards[page]
  return card ? (
    <CardTile
      key={card.id}
      card={card}
      module={moduleName(card)}
      onChange={onChange}
      pager={
        cards.length > 1 && (
          <Pager
            page={page}
            pages={cards.length}
            label="Agent approvals"
            words={`Approval ${page + 1} of ${cards.length}`}
            onGo={setAt}
          />
        )
      }
    />
  ) : null
}

// ---- the one grid, shared by card rows and task rows (Vikas, 30 Oct: "the layout is too fluid,
// not fixed") -----------------------------------------------------------------------------------
// state · title (what it is about under it) · state in words · module · owner · date · buttons.
// The columns sit on the list, each row a subgrid, so every date and button lines up; narrow, the
// module, owner and state words fold and the buttons drop to a line of their own, right; narrow is
// below 64rem, where the fixed columns and two buttons would leave the title no room. A subgrid's
// padding sits inside its first track, so that track is the padding plus the dot.
const COLS =
  'grid-cols-[2.25rem_minmax(0,1fr)_auto] @5xl:grid-cols-[2.25rem_minmax(0,1fr)_9rem_7rem_7rem_6rem_auto]'
export const rowClass =
  'col-span-full grid grid-cols-subgrid items-center gap-y-0.5 border-hair border-t px-4 py-2.5 hover:bg-hover'
// a cell that folds when the list is narrow
export const wideCell = 'hidden truncate text-ink-3 text-sm @5xl:block'
// the date cell: right-aligned, tabular, empty but kept when there is none
export const dateCell = 'flex justify-end whitespace-nowrap text-sm tabular-nums'
// the buttons: the one thing to do on the far right
export const actCell =
  'col-span-2 col-start-2 flex flex-wrap items-center justify-end gap-1.5 @5xl:col-auto'

export function Rows({ date = 'Due', children }: { date?: string; children: ReactNode }) {
  return (
    <div className="@container">
      <div
        className={cn(
          'grid gap-x-3 overflow-hidden rounded-lg border border-line bg-surface',
          COLS,
        )}
      >
        <div className={cn(rowClass, 'border-t-0 py-1.5 text-ink-3 text-sm hover:bg-transparent')}>
          <span />
          <span>Title</span>
          <span className="hidden @5xl:block">State</span>
          <span className="hidden @5xl:block">Module</span>
          <span className="hidden @5xl:block">Owner</span>
          <span className="text-right">{date}</span>
          <span className="hidden @5xl:block" />
        </div>
        {children}
      </div>
    </div>
  )
}

// A heading inside the list: who the rows under it are from, with what all of them can take.
// A click on its name shows that agent's rows only, in any view (Vikas: a slideshow per agent).
function Heading({
  name,
  count,
  onOnly,
  children,
}: {
  name: string
  count: number
  onOnly?: (() => void) | undefined
  children?: ReactNode
}) {
  return (
    <div className="col-span-full flex items-center gap-2 border-hair border-t bg-sunk px-4 py-1.5">
      {onOnly ? (
        <button
          type="button"
          data-tip={`${name}'s only`}
          onClick={onOnly}
          className="font-medium text-ink-2 text-sm hover:text-accent hover:underline"
        >
          {name}
        </button>
      ) : (
        <span className="font-medium text-ink-2 text-sm">{name}</span>
      )}
      <span className="text-ink-3 text-sm tabular-nums">{count}</span>
      <span className="flex-1" />
      {children}
    </div>
  )
}

// One card, one row: its words with what it is about, what it is, its module, who asks, when, and
// its buttons; a click elsewhere on it opens it whole.
function CardRow({
  card,
  module,
  about,
  onChange,
}: {
  card: CardView
  module: string | undefined
  about: string
  onChange: () => void
}) {
  const { busy, problem, act } = useAct(onChange)
  const primary = primaryOf(card)
  const second = primary.answer ? card.options[1] : undefined
  const open = () => peek(`#/card/${card.id}`)
  const answer = (a: string) => act(() => api.post(`/api/cards/${card.id}`, { answer: a }))
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the title is the keyboard's way in, a button
    // biome-ignore lint/a11y/noStaticElementInteractions: as above
    <div
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('button')) open()
      }}
      className={cn(rowClass, 'cursor-pointer')}
    >
      <Dot s={signalOf(card)} tip={kindWords(card)} />
      <span className="min-w-0">
        <button
          type="button"
          onClick={open}
          className="line-clamp-2 w-full text-left text-base text-ink hover:underline"
        >
          {card.words}
        </button>
        <span className="block truncate text-ink-3 text-sm">
          <span className="@5xl:hidden">{kindWords(card)} · </span>
          {about}
        </span>
      </span>
      <span className={wideCell}>{kindWords(card)}</span>
      <span className={wideCell}>{module ?? ''}</span>
      <span className={wideCell}>{card.agent?.name ?? 'Alpha'}</span>
      <span className={cn(dateCell, 'text-ink-3')}>
        {card.createdAt ? dueWords(card.createdAt.slice(0, 10)) : ''}
      </span>
      <span className={actCell}>
        <Refusal words={problem} />
        {second && (
          <Button size="sm" disabled={busy} onClick={() => answer(second)}>
            {answerWords(second)}
          </Button>
        )}
        <Button
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={() => (primary.answer ? answer(primary.answer) : open())}
        >
          {primary.label}
        </Button>
      </span>
    </div>
  )
}

// An agent's proposed tasks, one row each with Add and Decline (Vikas, 30 Oct); the card closes in
// the core once every task has a word.
function ProposedRows({
  card,
  module,
  onChange,
}: {
  card: CardView
  module: string | undefined
  onChange: () => void
}) {
  const tasks = card.proposed?.tasks ?? []
  return (
    <>
      {tasks.map((t, i) =>
        t.word ? null : (
          <ProposedRow key={i} card={card} i={i} module={module} onChange={onChange} />
        ),
      )}
    </>
  )
}

function ProposedRow({
  card,
  i,
  module,
  onChange,
}: {
  card: CardView
  i: number
  module: string | undefined
  onChange: () => void
}) {
  const { busy, problem, act } = useAct(onChange)
  const t = card.proposed?.tasks[i]
  if (!t) return null
  const open = () => peek(`#/card/${card.id}`)
  const say = (take: boolean) =>
    act(() =>
      api.post(
        `/api/cards/${card.id}/tasks`,
        take ? { take: [i], decline: [] } : { take: [], decline: [i] },
      ),
    )
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the title is the keyboard's way in, a button
    // biome-ignore lint/a11y/noStaticElementInteractions: as above
    <div
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('button')) open()
      }}
      className={cn(rowClass, 'cursor-pointer')}
    >
      <Dot s="yes" tip="Proposed task" />
      <span className="min-w-0">
        <button
          type="button"
          onClick={open}
          className="line-clamp-2 w-full text-left text-base text-ink hover:underline"
        >
          {t.priority === 'high' && <span className="mr-1.5 text-warn">●</span>}
          {t.title}
        </button>
        <span className="block truncate text-ink-3 text-sm">
          <span className="@5xl:hidden">Proposed task · </span>
          {t.place}
        </span>
      </span>
      <span className={wideCell}>Proposed task</span>
      <span className={wideCell}>{module ?? ''}</span>
      <span className={wideCell}>{t.owner}</span>
      <span className={cn(dateCell, 'text-ink-3')}>{t.due ? dueWords(t.due) : ''}</span>
      <span className={actCell}>
        <Refusal words={problem} />
        <Button size="sm" disabled={busy} onClick={() => say(false)}>
          Decline
        </Button>
        <Button size="sm" variant="primary" disabled={busy} onClick={() => say(true)}>
          Add
        </Button>
      </span>
    </div>
  )
}

// A connection that needs the person: to sign in again, in Chrome or with its organisation's
// sign-in in their browser, or waiting on a step only the customer can do.
function SignInRow({ a }: { a: Stream['attention'][number] }) {
  const { busy, problem, act } = useAct()
  const go = () => {
    if (a.waiting) window.location.hash = '#/intelligence/connections'
    else if (a.inBrowser) void act(() => api.post(`/api/connections/${a.connection}/sign-in`))
    else if (a.signsInWith) void signInWith(a.connection)
    else window.location.hash = `#/settings?connect=${a.connector}`
  }
  const kind = a.waiting ? 'Waiting for the customer' : 'Sign-in'
  return (
    <div className={rowClass}>
      <KeyRound className="size-3.5 text-warn" />
      <span className="min-w-0">
        <span className="block truncate text-base text-ink">
          {a.waiting
            ? `${a.title}: ${a.waiting}`
            : a.inBrowser || a.signsInWith
              ? `${a.title} needs you to sign in`
              : `${a.title} needs you to sign in again`}
        </span>
        <span className="block truncate text-ink-3 text-sm">
          <span className="@5xl:hidden">{kind} · </span>
          {a.waiting
            ? 'In Intelligence › Connections'
            : a.inBrowser
              ? 'It opens in Chrome'
              : a.signsInWith
                ? `With ${a.signsInWith}: it opens in your browser`
                : 'In Settings › Connections'}
        </span>
      </span>
      <span className={wideCell}>{kind}</span>
      <span className={wideCell} />
      <span className={wideCell}>{a.title}</span>
      <span className={dateCell} />
      <span className={actCell}>
        <Refusal words={problem} />
        <Button size="sm" variant="primary" disabled={busy} onClick={go}>
          {a.waiting ? 'See it' : 'Sign in'}
        </Button>
      </span>
    </div>
  )
}

// Who a card is from, for its heading: its agent, else its module, else Alpha.
const fromOf = (c: CardView, moduleName?: (id: string) => string | undefined) =>
  c.agent
    ? { key: `a:${c.agent.id}`, name: c.agent.name }
    : c.module
      ? { key: `m:${c.module}`, name: moduleName?.(c.module) ?? 'A module' }
      : { key: 'alpha', name: 'Alpha' }

// What a group's heading offers all its cards: only where every card is of one kind with the same
// options (a draft never: each leaves the Mac on its own yes).
function GroupBulk({ cards, onChange }: { cards: CardView[]; onChange: () => void }) {
  const { busy, problem, act } = useAct(onChange)
  const one = new Set(cards.map(kindOf)).size === 1
  const bulk = one && !cards[0]?.draft ? bulkOf(cards) : []
  if (!bulk.length) return null
  return (
    <span className="flex items-center gap-1.5">
      <Refusal words={problem} />
      {bulk.map((b) => (
        <Button key={b.label} size="sm" disabled={busy} onClick={() => act(b.go)}>
          {b.label}
        </Button>
      ))}
    </span>
  )
}

// Needs you, the one list on Home and in Tasks: sign-ins, every card as its own row under who it is
// from, then the tasks waiting on the person that no card here stands for. As cards, a gallery or
// one at a time; a heading's name narrows it to who it is from, in every view.
export function NeedsYou({
  cards: every,
  signIns = [],
  tasks = [],
  kind = 'slides',
  agent = null,
  moduleName,
  onChange,
}: {
  cards: CardView[]
  signIns?: Stream['attention']
  tasks?: TaskLineView[]
  kind?: CardsKind
  agent?: string | null // from this agent only, as its need line asks
  moduleName?: (id: string) => string | undefined
  onChange: () => void
}) {
  const [only, setOnly] = useState<string | null>(agent ? `a:${agent}` : null)
  useEffect(() => setOnly(agent ? `a:${agent}` : null), [agent])
  const cards = only ? every.filter((c) => fromOf(c, moduleName).key === only) : every
  const carded = new Set(every.map((c) => c.task).filter(Boolean))
  const alone = only ? [] : tasks.filter((t) => !carded.has(t.id))
  const shownSignIns = only ? [] : signIns
  const titleOf = new Map(tasks.map((t) => [t.id, t.title]))
  const about = (c: CardView) => {
    const task = c.task ? titleOf.get(c.task) : undefined
    return task ? `For “${task}”` : aboutOf(c)
  }
  const groups = new Map<string, { name: string; cards: CardView[] }>()
  for (const c of cards) {
    const f = fromOf(c, moduleName)
    const g = groups.get(f.key) ?? { name: f.name, cards: [] }
    g.cards.push(c)
    groups.set(f.key, g)
  }
  const nameOf = (c: CardView) => (c.module ? moduleName?.(c.module) : undefined)
  const rows = (
    <>
      {shownSignIns.map((a) => (
        <SignInRow key={a.connector} a={a} />
      ))}
      {kind === 'list' &&
        [...groups.entries()].map(([key, g]) => (
          <Fragment key={key}>
            <Heading
              name={g.name}
              count={needsCount(g.cards)}
              onOnly={groups.size > 1 ? () => setOnly(key) : undefined}
            >
              <GroupBulk cards={g.cards} onChange={onChange} />
            </Heading>
            {g.cards.map((c) =>
              c.proposed ? (
                <ProposedRows key={c.id} card={c} module={nameOf(c)} onChange={onChange} />
              ) : (
                <CardRow
                  key={c.id}
                  card={c}
                  module={nameOf(c)}
                  about={about(c)}
                  onChange={onChange}
                />
              ),
            )}
          </Fragment>
        ))}
      {alone.length > 0 && (
        <>
          {(kind !== 'list' || groups.size > 0 || shownSignIns.length > 0) && (
            <Heading name="Tasks" count={alone.length} />
          )}
          {alone.map((t) => (
            <TaskLine key={t.id} t={t} cards={cards} />
          ))}
        </>
      )}
    </>
  )
  const anyRows = shownSignIns.length + alone.length > 0 || (kind === 'list' && cards.length > 0)
  const from = only ? groups.get(only)?.name : undefined
  return (
    <div className="flex flex-col gap-3">
      {only && (
        <span>
          <Button size="sm" variant="ghost" onClick={() => setOnly(null)}>
            {from ? `From ${from} only · ` : ''}Clear filters
          </Button>
        </span>
      )}
      {kind === 'gallery' && cards.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(248px,1fr))] gap-3">
          {cards.map((c) => (
            <CardTile key={c.id} card={c} module={nameOf(c)} onChange={onChange} />
          ))}
        </div>
      )}
      {kind === 'slides' && cards.length > 0 && (
        <OneAtATime cards={cards} moduleName={nameOf} onChange={onChange} />
      )}
      {anyRows && <Rows date="Date">{rows}</Rows>}
    </div>
  )
}

// How many of a proposal's tasks still want a word.
const openTasks = (c: CardView) => c.proposed?.tasks.filter((t) => !t.word).length ?? 0
