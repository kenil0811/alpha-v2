// What waits on the person, one list on Home and on Tasks › Needs you (Vikas, 30 Oct: "on the
// tasks I want to see each task as a separate task"): sign-ins, then every card as its own row with
// its own buttons, under a heading per agent that carries Approve all where its cards share
// options (drafts never), then the tasks that wait on the person and no card stands for. Rows share
// one fixed grid with the task rows, the date at the same place on each. As a gallery, each card is
// a tile. A click on a row or tile, off its buttons, opens it whole in the side panel.
import type { CardView, Stream, TaskLineView } from '@alpha/core/api'
import { KeyRound } from 'lucide-react'
import { Fragment, type ReactNode, useEffect, useState } from 'react'
import { api } from './api.ts'
import { signalOf } from './Overview.tsx'
import { peek } from './Peek.tsx'
import { bulkOf, kindOf } from './stack.tsx'
import { TaskLine } from './Tasks.tsx'
import { ViewSwitch } from './table/KindPicker.tsx'
import { dueWords } from './time.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { Card } from './ui/card.tsx'
import { cn } from './ui/cn.ts'
import { Dot } from './ui/dot.tsx'
import { Pager } from './ui/pager.tsx'
import { Label } from './ui/pill.tsx'
import { answerWords } from './vocabulary.ts'

export type CardsKind = 'list' | 'gallery' | 'slides'

// The view switch the tables use, offering the three a list of cards can be: rows, a gallery of
// cards, and one card at a time (Vikas, 30 Oct).
export function CardsSwitch({ kind, onPick }: { kind: CardsKind; onPick: (k: CardsKind) => void }) {
  return (
    <ViewSwitch
      kind={kind}
      offered={['list', 'gallery', 'slides'] as CardsKind[]}
      onPick={onPick}
    />
  )
}

// How many things wait on the person: one per row Needs you draws (a sign-in, a card, each task a
// proposal still wants a word on). Home, its badge and Tasks all count with this.
export const needsCount = (cards: CardView[], signIns = 0) =>
  signIns + cards.reduce((k, c) => k + (c.proposed ? openTasks(c) : 1), 0)

// What a card is, in the words any business app uses.
export function kindWords(c: CardView): string {
  if (c.failed?.length) return 'Failed'
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
  if (c.failed?.length) return { label: c.options[0] ?? 'Try again', answer: c.options[0] ?? null }
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
  const failed = c.failed ?? []
  if (failed.length === 1) return `${failed[0]?.name}: ${failed[0]?.words}`
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

export function FailedCard({ card }: { card: CardView }) {
  const all = useAct()
  const failed = card.failed ?? []
  return (
    <Card label="Failed" waits="Needs approval">
      <div className="font-medium text-ink text-lg">{card.words}</div>
      {failed.length > 1 && (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {failed.map((f) => (
            <FailedAgent key={f.agent} card={card.id} f={f} />
          ))}
        </ul>
      )}
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

function FailedAgent({ card, f }: { card: string; f: NonNullable<CardView['failed']>[number] }) {
  const { busy, problem, act } = useAct()
  const go = (again: boolean) =>
    act(() => api.post(`/api/cards/${card}/agents/${f.agent}`, { again }))
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
      <button
        type="button"
        onClick={() => peek(`#/agent/${f.agent}`)}
        className="min-w-0 flex-1 basis-48 text-left"
      >
        <span className="block font-medium text-ink hover:underline">{f.name}</span>
        <span className="block text-ink-3 text-sm">{f.words}</span>
      </button>
      <Button size="sm" disabled={busy} onClick={() => go(true)}>
        Try again
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => go(false)}>
        Leave it
      </Button>
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
  const body = bodyOf(card)
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the title is the keyboard's way in, a button
    // biome-ignore lint/a11y/noStaticElementInteractions: as above
    <div
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('button')) onOpen()
      }}
      className={cn(
        'flex cursor-pointer flex-col gap-2 rounded-lg border border-line bg-surface hover:border-accent-line',
        pager ? 'min-h-72 gap-3 p-6' : 'p-4',
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
        className={cn(
          'text-left font-medium text-ink hover:underline',
          pager ? 'text-lg' : 'line-clamp-3 text-base',
        )}
      >
        {card.words}
      </button>
      {body && (
        <p
          className={cn(
            'whitespace-pre-line text-ink-2',
            pager ? 'max-h-80 overflow-y-auto text-base' : 'line-clamp-5 text-sm',
          )}
        >
          {body}
        </p>
      )}
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

// One card at a time, large (Vikas, 30 Oct: "a slideshow kind of view where I can navigate across
// multiple cards"): the pager beside its buttons, ← and → to go; an answered card leaves the list,
// so the next one takes its place.
function Slides({
  cards,
  moduleName,
  onChange,
}: {
  cards: CardView[]
  moduleName: (c: CardView) => string | undefined
  onChange: () => void
}) {
  const [at, setAt] = useState(0)
  const i = Math.min(at, cards.length - 1)
  const n = cards.length
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.metaKey || e.ctrlKey || e.altKey || t?.closest('input, textarea, [contenteditable]'))
        return
      if (e.key === 'ArrowLeft') setAt((a) => Math.max(0, Math.min(a, n - 1) - 1))
      if (e.key === 'ArrowRight') setAt((a) => Math.min(n - 1, a + 1))
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [n])
  const card = cards[i]
  if (!card) return null
  return (
    <CardTile
      key={card.id}
      card={card}
      module={moduleName(card)}
      onChange={onChange}
      pager={<Pager at={i} count={n} onAt={setAt} />}
    />
  )
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

// A connection that needs the person to sign in again.
function SignInRow({ a }: { a: Stream['attention'][number] }) {
  const { busy, problem, act } = useAct()
  const go = () => {
    if (a.inBrowser) void act(() => api.post(`/api/connections/${a.connection}/sign-in`))
    else window.location.hash = `#/settings?connect=${a.connector}`
  }
  return (
    <div className={rowClass}>
      <KeyRound className="size-3.5 text-warn" />
      <span className="min-w-0">
        <span className="block truncate text-base text-ink">
          {a.inBrowser
            ? `${a.title} needs you to sign in`
            : `${a.title} needs you to sign in again`}
        </span>
        <span className="block truncate text-ink-3 text-sm">
          <span className="@5xl:hidden">Sign-in · </span>
          {a.inBrowser ? 'It opens in Chrome' : 'In Settings › Connections'}
        </span>
      </span>
      <span className={wideCell}>Sign-in</span>
      <span className={wideCell} />
      <span className={wideCell}>{a.title}</span>
      <span className={dateCell} />
      <span className={actCell}>
        <Refusal words={problem} />
        <Button size="sm" variant="primary" disabled={busy} onClick={go}>
          Sign in
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
  kind = 'list',
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
            <TaskLine key={t.id} t={t} cards={cards} onChange={onChange} />
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
        <Slides cards={cards} moduleName={nameOf} onChange={onChange} />
      )}
      {anyRows && <Rows date="Date">{rows}</Rows>}
    </div>
  )
}

// How many of a proposal's tasks still want a word.
const openTasks = (c: CardView) => c.proposed?.tasks.filter((t) => !t.word).length ?? 0
