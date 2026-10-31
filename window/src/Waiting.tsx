// What waits on the person, one list on Home and on Tasks › Needs you (Vikas, 30 Oct: "on the
// tasks I want to see each task as a separate task"): sign-ins, then every card as its own row with
// its own buttons, under a heading per agent that carries Approve all where its cards share
// options (drafts never), then the tasks that wait on the person. Rows share one fixed grid with the
// task rows, the date at the same place on each. As a gallery, each card is a tile; as slides, one
// at a time. A click on a row or tile, off its buttons, opens it whole in the side panel.
//
// Waiting on the core (not on main yet): a card's agent, run, task and createdAt; `failed` (the
// agents that did not finish, combined on one card, POST /api/cards/:id/agents/:agent); a proposed
// task's `word` with `decline` on POST /api/cards/:id/tasks. Until then a card is grouped by the
// agent its draft or proposal names, else its module; its date cell is empty; a proposal is one
// row that opens the card; each repeat of an agent that did not finish is its own card.
import type { CardView, Stream, TaskLineView } from '@alpha/core/api'
import { KeyRound } from 'lucide-react'
import { Fragment, type ReactNode, useEffect, useState } from 'react'
import { api } from './api.ts'
import { peek } from './Peek.tsx'
import { signInWith } from './SignInApps.tsx'
import { bulkOf, kindOf } from './stack.tsx'
import { TaskLine } from './Tasks.tsx'
import { ViewSwitch } from './table/KindPicker.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Dot, type Signal } from './ui/dot.tsx'
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

// How many things wait on the person: one per row Needs you draws (a sign-in, a card). Home, its
// badge and Tasks all count with this.
export const needsCount = (cards: CardView[], signIns = 0) => signIns + cards.length

// A card's one signal: a sign-in needs the person now; anything with a yes or an answer waits for
// it; the rest is for their information.
const signalOf = (c: CardView): Signal =>
  c.gate === 'sign_in' || c.site || c.connector
    ? 'now'
    : c.draft || c.proposed || c.review || c.match || c.filing || c.options.length
      ? 'yes'
      : 'opt'

// What a card is, in the words any business app uses.
export function kindWords(c: CardView): string {
  if (c.draft) return 'Draft'
  if (c.match) return 'Possible duplicate'
  if (c.review) return 'For you to decide'
  if (c.proposed) return 'Proposed tasks'
  if (c.filing) return 'A file from your mail'
  if (c.gate === 'sign_in' || c.site || c.connector) return 'Sign-in'
  if (c.kind === 'permission') return 'Needs approval'
  return 'Question'
}

// The agent a card names, where it names one: a draft's or a proposal's.
const agentOf = (c: CardView) => c.draft?.agent ?? c.proposed?.agent ?? null

// The one thing to do: an answer given from here, or the card opened where it needs more.
function primaryOf(c: CardView): { label: string; answer: string | null } {
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
// aggregated request as text on the card"): a proposal's tasks, a review's rows, a draft's message,
// else its detail or what it rests on.
export function bodyOf(c: CardView): string {
  if (c.draft) {
    const m = c.draft.message
    return `To ${m.to}: ${m.subject}\n${m.body}`
  }
  if (c.review) {
    const open = c.review.rows.filter((r) => !r.value)
    return `${c.review.open} of ${c.review.rows.length} in ${c.review.table} to decide on ${c.review.field}: ${open.map((r) => r.name).join(', ')}`
  }
  if (c.proposed) {
    const all = c.proposed.tasks
    return `${all.length === 1 ? 'A task' : `${all.length} tasks`} to add: ${all.map((t) => t.title).join('; ')}`
  }
  return c.detail ?? c.restsOn.join(' and ')
}
const aboutOf = (c: CardView) => bodyOf(c).split('\n')[0] ?? ''

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
          {[agentOf(card), module].filter(Boolean).join(' · ')}
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
// A click on its name shows that one's rows only, in any view (Vikas: a slideshow per agent).
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

// One card, one row: its words with what it is about, what it is, its module, who asks, and its
// buttons; a click elsewhere on it opens it whole.
function CardRow({
  card,
  module,
  onChange,
}: {
  card: CardView
  module: string | undefined
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
          {aboutOf(card)}
        </span>
      </span>
      <span className={wideCell}>{kindWords(card)}</span>
      <span className={wideCell}>{module ?? ''}</span>
      <span className={wideCell}>{agentOf(card) ?? 'Alpha'}</span>
      {/* when it was put to the person waits on the card's createdAt */}
      <span className={dateCell} />
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

// Who a card is from, for its heading: the agent it names, else its module, else Alpha.
const fromOf = (c: CardView, moduleName?: (id: string) => string | undefined) => {
  const agent = agentOf(c)
  return agent
    ? { key: `a:${agent}`, name: agent }
    : c.module
      ? { key: `m:${c.module}`, name: moduleName?.(c.module) ?? 'A module' }
      : { key: 'alpha', name: 'Alpha' }
}

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
// from, then the tasks waiting on the person. As cards, a gallery or one at a time; a heading's name
// narrows it to who it is from, in every view.
export function NeedsYou({
  cards: every,
  signIns = [],
  tasks = [],
  kind = 'list',
  moduleName,
  onChange,
}: {
  cards: CardView[]
  signIns?: Stream['attention']
  tasks?: TaskLineView[]
  kind?: CardsKind
  moduleName?: (id: string) => string | undefined
  onChange: () => void
}) {
  const [only, setOnly] = useState<string | null>(null)
  const cards = only ? every.filter((c) => fromOf(c, moduleName).key === only) : every
  const alone = only ? [] : tasks
  const shownSignIns = only ? [] : signIns
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
            {g.cards.map((c) => (
              <CardRow key={c.id} card={c} module={nameOf(c)} onChange={onChange} />
            ))}
          </Fragment>
        ))}
      {alone.length > 0 && (
        <>
          {(kind !== 'list' || groups.size > 0 || shownSignIns.length > 0) && (
            <Heading name="Tasks" count={alone.length} />
          )}
          {alone.map((t) => (
            <TaskLine key={t.id} t={t} onChange={onChange} />
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
