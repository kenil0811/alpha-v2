// Tasks (Kenil's plan, 21 Oct, Ledger): one list of all work, each task on the place it concerns.
// Its lists (Today, This week, Overdue, Needs you, All open, Done, and Given to agents when
// an agent has some) are filters under the toolbar, beside what each task is for (Clients,
// Insurers…), not a switch in the bar (Vikas, 27 Oct). New under the list. A
// task's page: its state, due and reminder, repeat, priority, owner, place, notes, what it touches,
// its checklist, the place's values and the other tasks there, and its history.

import type { KeptTable, TaskLineView, TasksView, TaskView } from '@alpha/core/api'
import { Check, CircleDot, Clock, Repeat2, Trash2, X } from 'lucide-react'
import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { RunRow } from './Activity.tsx'
import { api, Problem } from './api.ts'
import { CardBox } from './Conversation.tsx'
import type { CardView, ModuleSummary, Stream } from './coming.ts'
import { peek } from './Peek.tsx'
import { Record } from './Record.tsx'
import { TableView } from './TableView.tsx'
import { Notes } from './table/Notes.tsx'
import { dueWords } from './time.ts'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { cutClass } from './ui/cut.tsx'
import { DateField, parseDay } from './ui/date-field.tsx'
import { Confirm, Dialog } from './ui/dialog.tsx'
import { Field, Select } from './ui/field.tsx'
import { More } from './ui/more.tsx'
import { Pill } from './ui/pill.tsx'
import { MenuItem, Popover } from './ui/popover.tsx'
import { Section } from './ui/section.tsx'
import { Segmented } from './ui/segmented.tsx'
import { Title } from './ui/title.tsx'
import { answerWords, NEEDS_YOU } from './vocabulary.ts'
import { actCell, dateCell, NeedsYou, needsCount, Rows, rowClass, wideCell } from './Waiting.tsx'

export type List = 'today' | 'week' | 'overdue' | 'waiting' | 'agents' | 'open' | 'done'

const LISTS: { value: List; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'waiting', label: NEEDS_YOU },
  { value: 'agents', label: 'Given to agents' },
  { value: 'open', label: 'All open' },
  { value: 'done', label: 'Done' },
]

const STATES: { value: TaskLineView['state']; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'doing', label: 'In progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'done', label: 'Done' },
  { value: 'dropped', label: 'Dropped' },
]

const open = (t: TaskLineView) => t.state === 'todo' || t.state === 'doing' || t.state === 'waiting'

const setState = (id: string, state: TaskLineView['state']) =>
  api.post(`/api/tasks/${id}/state`, { state })

export function Tasks({
  list,
  id,
  version,
  onName,
  agent,
}: {
  list: List
  id: string | null
  version: number
  onName: (name: string) => void
  agent?: string | null // Needs you from one agent only: its need line opens it so
}) {
  // on its own page, the agent comes in the address (#/tasks?list=waiting&agent=…)
  const from =
    agent === undefined
      ? new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('agent')
      : agent
  return id ? (
    <TaskPage id={id} version={version} onName={onName} />
  ) : (
    <TaskLists list={list} version={version} agent={from} />
  )
}

// Which list Tasks opens on when none was asked for: the first that holds something, so Tasks is
// never empty while something waits (Vikas, 30 Oct: "why is it empty?").
const firstWithSome = (counts: Record<string, number>, cards: number): List =>
  counts.today ? 'today' : (counts.waiting ?? 0) + cards ? 'waiting' : counts.week ? 'week' : 'open'

// The saved lists are the switch in the bar; the tasks are drawn by the shared table view, with its
// table, board, calendar and grouping, each opening on its own page. Needs you holds every
// card that waits on the person beside the tasks that do (Vikas, 30 Oct).
function TaskLists({
  list: asked,
  version,
  agent,
}: {
  list: List
  version: number
  agent: string | null
}) {
  const explicit = window.location.hash.includes('list=')
  const [cards, setCards] = useState<CardView[] | null>(null)
  const [signIns, setSignIns] = useState<Stream['attention']>([])
  const [modules, setModules] = useState<ModuleSummary[]>([])
  useEffect(() => {
    if (version < 0) return
    api.get<Stream>('/api/stream?limit=1').then(
      (st) => {
        setCards(st.cards)
        setSignIns(st.attention)
      },
      () => setCards([]),
    )
  }, [version])
  useEffect(() => {
    api.get<ModuleSummary[]>('/api/modules').then(setModules, () => setModules([]))
  }, [])
  // the core serves a saved list's tasks as a table: changed in a cell, or by a card dragged
  // across the board (UI batch 2, 26 Oct)
  const [data, setData] = useState<KeptTable | null>(null)
  const counts = data?.kept.counts ?? {}
  const list = explicit || !data || !cards ? asked : firstWithSome(counts, cards.length)
  const load = useCallback(() => {
    api.get<KeptTable>(`/api/kept/tasks?list=${list}`).then(setData, () => setData(null))
  }, [list])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])
  // Needs you counts what it draws, as Home and its badge do
  const waiting = needsCount(cards ?? [], signIns.length)
  const [adding, setAdding] = useState(false)
  const cuts = (
    <nav aria-label="When" className="contents">
      {LISTS.filter((l) => l.value !== 'agents' || counts.agents).map((l) => {
        const n = l.value === 'waiting' ? waiting : counts[l.value]
        return (
          <a key={l.value} href={`#/tasks?list=${l.value}`} className={cutClass(l.value === list)}>
            <span className="flex h-full items-center gap-1.5">
              {l.label}
              {l.value !== 'done' && n ? (
                <span className="text-ink-3 tabular-nums">{n}</span>
              ) : null}
            </span>
          </a>
        )
      })}
      <span className="mx-1 h-5 w-px bg-line" />
    </nav>
  )
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        {!data ? (
          <p className="p-7 text-ink-3">Loading…</p>
        ) : list === 'waiting' ? (
          <WaitingForYou
            cuts={cuts}
            cards={cards ?? []}
            signIns={signIns}
            moduleName={(id) => modules.find((m) => m.id === id)?.name}
            version={version}
            agent={agent}
          />
        ) : (
          <TableView
            key={list}
            data={data}
            start={{ kind: 'board' }}
            quickBy="For"
            filters={cuts}
            kept={{
              // a card's row (card:<id>, or card:<id>:<task> for a proposal's) opens the card
              open: (id) => {
                peek(id.startsWith('card:') ? `#/card/${id.split(':')[1]}` : `#/tasks/${id}`)
              },
              onNew: () => setAdding(true),
            }}
          />
        )}
      </div>
      <Dialog open={adding} title="New task" onClose={() => setAdding(false)}>
        <NewTask
          onAdded={() => {
            setAdding(false)
            load()
          }}
        />
      </Dialog>
    </div>
  )
}

// Needs you: the one list Home draws too (Waiting.tsx), every card its own row, then the tasks
// that wait on the person; from one agent only when its need line opened it.
function WaitingForYou({
  cuts,
  cards,
  signIns,
  moduleName,
  version,
  agent,
}: {
  cuts: ReactNode
  cards: CardView[]
  signIns: Stream['attention']
  moduleName: (id: string) => string | undefined
  version: number
  agent: string | null
}) {
  const [tasks, setTasks] = useState<TasksView | null>(null)
  const load = useCallback(() => {
    api.get<TasksView>('/api/tasks?list=waiting').then(setTasks, () => setTasks(null))
  }, [])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])
  // what waits on the person: a task waiting on someone else is in its own lists, not here
  const lines = (tasks?.lines ?? []).filter((l) => l.waitingForYou)
  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-6 px-7 pt-4 pb-10">
        <div className="flex flex-wrap items-center gap-1.5">
          {cuts}
          <span className="flex-1" />
        </div>
        {!tasks ? (
          <p className="text-ink-3">Loading…</p>
        ) : cards.length + lines.length + signIns.length === 0 ? (
          <p className="text-ink-3">
            Approvals, answers, drafts and tasks that need your word show here.
          </p>
        ) : (
          <NeedsYou
            cards={cards}
            signIns={signIns}
            tasks={lines}
            agent={agent}
            moduleName={moduleName}
            onChange={load}
          />
        )}
      </div>
    </div>
  )
}

// A task in a line: words, place and due, with a click to finish it.
export function NewTask({
  on,
  onAdded,
  placeholder,
}: {
  on?: { module?: string; table?: string; row?: string }
  onAdded: () => void
  placeholder?: string
}) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setProblem(null)
    try {
      await api.post('/api/tasks', {
        title: title.trim(),
        ...(due ? { due } : {}),
        ...(on ? { on } : {}),
      })
      setTitle('')
      setDue('')
      onAdded()
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That task did not go in.')
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Field
          aria-label="New task"
          placeholder={placeholder ?? 'New task'}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-64 flex-1"
        />
        <DateField
          aria-label="Due"
          placeholder="Due"
          value={due}
          onChange={setDue}
          className="w-40"
        />
        <Button type="submit" size="sm" variant="primary" disabled={!title.trim()}>
          Add
        </Button>
      </div>
      {problem && <p className="text-bad text-sm">{problem}</p>}
    </form>
  )
}

// A task's state as a circle; a click opens its five states, so a click never closes it by
// itself (Kenil, 21 Oct).
function Tick({ t, onChange }: { t: TaskLineView; onChange: () => void }) {
  const anchor = useRef<HTMLButtonElement>(null)
  const [choosing, setChoosing] = useState(false)
  const label = STATES.find((x) => x.value === t.state)?.label ?? t.state
  const choose = (state: TaskLineView['state']) => {
    setChoosing(false)
    if (state !== t.state) setState(t.id, state).then(onChange, onChange)
  }
  return (
    <>
      <button
        ref={anchor}
        type="button"
        data-tip={`${label}: change it`}
        aria-label={`${t.title}: ${label}. Change its state`}
        aria-haspopup="menu"
        onClick={() => setChoosing((c) => !c)}
        className={cn(
          'grid size-4.5 shrink-0 place-items-center rounded-full border transition-colors hover:border-accent',
          t.state === 'done'
            ? 'border-good bg-good text-surface'
            : t.state === 'doing'
              ? 'border-accent text-accent'
              : t.state === 'waiting'
                ? 'border-warn text-warn'
                : t.state === 'dropped'
                  ? 'border-line text-ink-3'
                  : 'border-line',
        )}
      >
        {t.state === 'done' && <Check className="size-3" />}
        {t.state === 'doing' && <span className="size-2 rounded-full bg-accent" />}
        {t.state === 'waiting' && <Clock className="size-2.75" />}
        {t.state === 'dropped' && <X className="size-2.75" />}
      </button>
      <Popover anchor={anchor} open={choosing} onClose={() => setChoosing(false)}>
        {STATES.map((x) => (
          <MenuItem key={x.value} checked={x.value === t.state} onClick={() => choose(x.value)}>
            {x.label}
          </MenuItem>
        ))}
      </Popover>
    </>
  )
}

// Under a task's title: where it sits past its module, and its checklist.
function Meta({ t, place = true }: { t: TaskLineView; place?: boolean }) {
  const bits: string[] = []
  if (place && t.place.path.length > 1) bits.push(t.place.path.slice(1).join(' › '))
  if (t.children) bits.push(`${t.childrenDone} of ${t.children} done`)
  return bits.length ? (
    <span className="block truncate text-ink-3 text-sm">{bits.join(' · ')}</span>
  ) : null
}

function Due({ t }: { t: TaskLineView }) {
  if (!t.due) return null
  return (
    <span className={cn('flex items-center gap-1', t.overdue ? 'text-bad' : 'text-ink-3')}>
      {t.repeat && <Repeat2 className="size-3" aria-label={t.repeat} />}
      {t.remindAt && <Clock className="size-3" aria-label="With a reminder" />}
      {dueWords(t.due)}
    </span>
  )
}

// A task's state in words, its agent's with it (Vikas, 30 Oct; Linear's and Planner's states):
// Needs your input while its cards wait, "Morning working" while its agent runs on it.
function stateWords(t: TaskLineView, cards: number): string {
  if (open(t) && t.waitingForYou) return cards ? `Needs your input · ${cards}` : 'Needs your input'
  if (t.working) return `${t.owner} working`
  return STATES.find((x) => x.value === t.state)?.label ?? t.state
}

// One task, one row of the grid it shares with Needs you's cards (Waiting.tsx): the state, the
// title with where it sits under it, the state in words, its module, its owner, its due at the
// same place on every row, and the one thing to do. A click on the title opens it in the panel.
export function TaskLine({
  t,
  onChange,
  place,
  cards = [],
}: {
  t: TaskLineView
  onChange: () => void
  place?: boolean
  cards?: CardView[] // what waits on the person, so Review opens the first of this task's
}) {
  const mine = cards.filter((c) => c.task === t.id)
  const words = stateWords(t, mine.length)
  return (
    <div className={rowClass}>
      <Tick t={t} onChange={onChange} />
      <span className="min-w-0">
        <button
          type="button"
          onClick={() => peek(`#/tasks/${t.id}`)}
          className={cn(
            'line-clamp-2 w-full text-left text-base hover:underline',
            open(t) ? 'text-ink' : 'text-ink-3 line-through',
          )}
        >
          {t.priority === 'high' && <span className="mr-1.5 text-warn">●</span>}
          {t.title}
        </button>
        <Meta t={t} place={place ?? true} />
      </span>
      <span className={cn(wideCell, (t.waitingForYou || t.working) && open(t) && 'text-warn')}>
        {words}
      </span>
      <span className={wideCell}>{place === false ? '' : (t.place.path[0] ?? '')}</span>
      <span className={wideCell}>{t.owner}</span>
      <span className={dateCell}>
        <Due t={t} />
      </span>
      <span className={actCell}>
        <Next t={t} first={mine[0]?.id} onChange={onChange} />
      </span>
    </div>
  )
}

// Every open task says what to do next as a button (Vikas, 28 Oct): Review what waits for your
// yes (its first card, in the panel), Start what is to do, Done what is under way.
function Next({
  t,
  first,
  onChange,
}: {
  t: TaskLineView
  first: string | undefined
  onChange: () => void
}) {
  if (!open(t)) return null
  if (t.waitingForYou)
    return (
      <Button
        size="sm"
        variant="primary"
        onClick={() => peek(first ? `#/card/${first}` : `#/tasks/${t.id}`)}
      >
        Review
      </Button>
    )
  const to = t.state === 'todo' ? 'doing' : 'done'
  return (
    <Button size="sm" onClick={() => setState(t.id, to).then(onChange, onChange)}>
      {to === 'doing' ? 'Start' : 'Done'}
    </Button>
  )
}

export function TaskList({
  lines,
  onChange,
  cards,
  place,
}: {
  lines: TaskLineView[]
  onChange: () => void
  cards?: CardView[]
  place?: boolean
}) {
  return (
    <Rows>
      {lines.map((t) => (
        <TaskLine key={t.id} t={t} cards={cards ?? []} onChange={onChange} place={place ?? true} />
      ))}
    </Rows>
  )
}

// ---- a task's page --------------------------------------------------------------------------

export function TaskPage({
  id,
  version,
  onName,
}: {
  id: string
  version: number
  onName: (name: string) => void
}) {
  const [t, setT] = useState<TaskView | null>(null)
  const [missing, setMissing] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const load = useCallback(() => {
    api.get<TaskView>(`/api/tasks/${id}`).then(
      (v) => {
        setT(v)
        setMissing(false)
        onName(v.title)
      },
      () => setMissing(true),
    )
  }, [id, onName])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])
  const change = async (body: Record<string, unknown>) => {
    setProblem(null)
    try {
      setT(await api.post<TaskView>(`/api/tasks/${id}`, body))
      return true
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That did not go in.')
      return false
    }
  }
  const state = async (s: TaskLineView['state']) => {
    try {
      setT(await api.post<TaskView>(`/api/tasks/${id}/state`, { state: s }))
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That did not go in.')
    }
  }
  if (missing)
    return (
      <p className="p-8 text-ink-2 text-md">
        That task is not there any more.{' '}
        <a className="text-accent hover:underline" href="#/tasks">
          All tasks
        </a>
      </p>
    )
  if (!t) return null
  const dueDay = t.due?.slice(0, 10) ?? ''
  const remind = t.remindAt ? toLocalInput(t.remindAt) : ''
  return (
    <Record kind={t.parent ? 'Subtask' : 'Task'}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          {t.parent && (
            <a href={`#/tasks/${t.parent}`} className="text-ink-3 text-sm hover:underline">
              Part of {t.parentTitle}
            </a>
          )}
          <div className="flex items-center gap-2">
            <Title title={t.title} onRename={(x) => change({ title: x })} className="flex-1" />
            <More label="More" shown>
              {(close) => (
                <MenuItem
                  danger
                  onClick={() => {
                    close()
                    setRemoving(true)
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </MenuItem>
              )}
            </More>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-ink-3 text-sm">
            <span>
              Made by {t.madeBy}, {new Date(t.createdAt).toLocaleDateString()}
            </span>
            {t.place.href ? (
              <a href={t.place.href} className="text-accent hover:underline">
                {t.place.words}
              </a>
            ) : (
              <span>{t.place.words}</span>
            )}
            {t.waitingForYou && <Pill tone="warn">Needs approval</Pill>}
          </div>
        </div>
        {problem && <p className="text-bad text-sm">{problem}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="State" value={t.state} onChange={state} options={STATES} />
        </div>

        <div className="grid gap-x-6 gap-y-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2">
          <Labelled label="Due">
            <WhenField
              type="date"
              label="Due"
              value={dueDay}
              onSave={(v) => change({ due: v || null })}
            />
          </Labelled>
          <Labelled label="Remind me">
            <WhenField
              type="datetime-local"
              label="Remind me"
              value={remind}
              onSave={(v) => change({ remindAt: v ? new Date(v).toISOString() : null })}
            />
          </Labelled>
          <Labelled label="Repeats">
            <RepeatField value={t.repeat} onSave={(repeat) => change({ repeat })} />
          </Labelled>
          <Labelled label="Priority">
            <Segmented
              label="Priority"
              value={t.priority}
              onChange={(priority) => change({ priority })}
              options={[
                { value: 'high', label: 'High' },
                { value: 'normal', label: 'Normal' },
                { value: 'low', label: 'Low' },
              ]}
            />
          </Labelled>
          <Labelled label="Owner">
            <Select
              aria-label="Owner"
              value={`${t.ownerKind}:${t.owners.find((o) => o.name === t.owner)?.id ?? ''}`}
              onChange={(e) => {
                const [kind, oid] = e.target.value.split(':')
                change({ owner: { kind, id: oid || null } })
              }}
            >
              {t.owners.map((o) => (
                <option key={`${o.kind}:${o.id ?? ''}`} value={`${o.kind}:${o.id ?? ''}`}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Labelled>
          <Labelled label="Where">
            <span className="flex items-center gap-2 text-md">
              <span className="truncate text-ink-2">{t.place.words}</span>
              {t.place.path.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => change({ on: null })}>
                  Take off
                </Button>
              )}
            </span>
          </Labelled>
        </div>

        {t.agent && <AgentOnTask t={t} onChange={load} onProblem={setProblem} />}

        {t.cards.length > 0 && (
          <Section title="Approvals" about="What its agent put to you about it">
            {t.cards
              .filter((c) => c.state === 'waiting')
              .map((c) => (
                <CardBox key={c.id} id={c.id} card={c} onChange={load} />
              ))}
            {t.cards
              .filter((c) => c.state !== 'waiting')
              .map((c) => (
                <div key={c.id} className="flex gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate text-ink-2">{c.words}</span>
                  <span className="shrink-0 text-ink-3">{decidedWords(c.state, c.answer)}</span>
                </div>
              ))}
          </Section>
        )}

        <Section title="Notes">
          <Notes value={t.notes ?? ''} onSave={(n) => change({ notes: n || null })} />
        </Section>

        <Section title="Checklist" about="The steps beneath it, each a task of its own">
          {t.subtasks.length > 0 && <TaskList lines={t.subtasks} onChange={load} place={false} />}
          <SubTask parent={t.id} onAdded={load} />
        </Section>

        {(t.context.values.length > 0 || t.context.siblings.length > 0) && (
          <Section title="Where it sits" about={t.place.words}>
            {t.context.values.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-line bg-surface">
                {t.context.values.slice(0, 14).map((v) => (
                  <div
                    key={v.field}
                    className="flex gap-3 border-hair border-t px-4 py-2 text-md first:border-t-0"
                  >
                    <span className="w-40 shrink-0 truncate text-ink-3 text-sm">{v.field}</span>
                    <span className="min-w-0 flex-1 truncate text-ink">{v.value}</span>
                  </div>
                ))}
              </div>
            )}
            {t.context.siblings.length > 0 && (
              <>
                <div className="text-ink-3 text-sm">Other open tasks there</div>
                <TaskList lines={t.context.siblings} onChange={load} place={false} />
              </>
            )}
          </Section>
        )}

        {t.touches.length > 0 && (
          <Section title="It touches">
            <div className="flex flex-wrap gap-2">
              {t.touches.map((r) => (
                <a
                  key={`${r.kind}:${r.name}`}
                  href={r.href ?? undefined}
                  className="rounded-md border border-line bg-surface px-2.5 py-1 text-ink-2 text-sm hover:text-ink"
                >
                  {r.name}
                </a>
              ))}
            </div>
          </Section>
        )}

        {t.history.length > 0 && (
          <Section title="History">
            <div className="flex flex-col gap-1">
              {t.history.map((h) => (
                <div key={`${h.at}${h.words}`} className="flex gap-3 text-sm">
                  <span className="w-28 shrink-0 text-ink-3 tabular-nums">
                    {new Date(h.at).toLocaleString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className="text-ink-2">{h.words}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        <div>
          <Confirm
            open={removing}
            title={`Delete this task${t.children ? ' and the ones beneath it' : ''}?`}
            yes="Delete"
            onClose={() => setRemoving(false)}
            onYes={async () => {
              await api.delete(`/api/tasks/${t.id}`)
              window.location.hash = '#/tasks'
            }}
          >
            It can’t be brought back; Activity keeps what it held.
          </Confirm>
        </div>
      </div>
    </Record>
  )
}

const decidedWords = (state: string, answer: string | null) =>
  state === 'withdrawn'
    ? 'Withdrawn'
    : state === 'yes'
      ? answerWords(answer ?? 'Yes')
      : state === 'no'
        ? answerWords(answer ?? 'No')
        : (answer ?? state)

// The agent a task is given to: Start (giving it never starts it), the run working on it with
// Stop, and its earlier runs with what each said. Only its run makes the task Done (Q93).
function AgentOnTask({
  t,
  onChange,
  onProblem,
}: {
  t: TaskView
  onChange: () => void
  onProblem: (p: string | null) => void
}) {
  const agent = t.agent as NonNullable<TaskView['agent']>
  const [opened, setOpened] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const running = agent.runs.find((r) => r.state === 'running')
  const closed = t.state === 'done' || t.state === 'dropped'
  const start = async () => {
    setBusy(true)
    onProblem(null)
    try {
      await api.post(`/api/tasks/${t.id}/start`)
    } catch (err) {
      onProblem(err instanceof Problem ? err.message : 'It did not start.')
    } finally {
      setBusy(false)
      onChange()
    }
  }
  const about = !agent.takes
    ? `${agent.name} does not take tasks; give it to someone else.`
    : !agent.on
      ? `${agent.name} is paused; turn it on in Settings › Modules and agents to start it.`
      : running
        ? `${agent.name} is working on it.`
        : t.waitingForYou
          ? `${agent.name} goes on once you decide what it put to you below.`
          : closed || agent.runs.length
            ? `Given to ${agent.name}.`
            : `Given to ${agent.name}. Giving it never starts it; Start does. It is Done when ${agent.name} says so.`
  return (
    <Section title="Agent" about={about}>
      {agent.said && !running && !t.waitingForYou && (
        <p className="text-ink text-md">{agent.said}</p>
      )}
      {!running && !closed && !t.waitingForYou && agent.takes && agent.on && (
        <div>
          <Button variant="primary" disabled={busy} onClick={start}>
            {agent.runs.length ? 'Start again' : 'Start'}
          </Button>
        </div>
      )}
      {agent.runs.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          {agent.runs.map((r) => (
            <RunRow
              key={r.id}
              run={r}
              open={r.state === 'running' || opened.has(r.id)}
              onOpen={() =>
                setOpened((o) => {
                  const next = new Set(o)
                  if (next.has(r.id)) next.delete(r.id)
                  else next.add(r.id)
                  return next
                })
              }
              onStop={() => api.post(`/api/runs/${r.id}/stop`).then(onChange, onChange)}
            />
          ))}
        </div>
      )}
    </Section>
  )
}

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-ink-3 text-sm">{label}</span>
      {children}
    </div>
  )
}

// A day, or a day and a time, saved once the person has settled on it: a day as soon as it is
// picked; a time when they leave the field, or a moment after they stop changing it, so stepping
// through the minutes is one change, not ten. A time with no day yet is today's; a day with no
// time yet is at 09:00.
function WhenField({
  type,
  label,
  value,
  onSave,
}: {
  type: 'date' | 'datetime-local'
  label: string
  value: string
  onSave: (v: string) => void
}) {
  const [v, setV] = useState(value)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => setV(value), [value])
  const save = (next: string) => {
    window.clearTimeout(timer.current)
    if (next !== value) onSave(next)
  }
  const [day = '', time = ''] = v.split('T')
  const pickDay = (d: string) => {
    const next = d && type === 'datetime-local' ? `${d}T${time || '09:00'}` : d
    setV(next)
    save(next)
  }
  return (
    <div className="flex gap-2">
      <DateField aria-label={label} value={day} onChange={pickDay} className="w-40" />
      {type === 'datetime-local' && (
        <Field
          type="time"
          aria-label={`${label}, time`}
          value={time}
          onChange={(e) => {
            if (!e.target.value) return
            const next = `${day || parseDay('today')}T${e.target.value}`
            setV(next)
            window.clearTimeout(timer.current)
            timer.current = window.setTimeout(() => save(next), 1500)
          }}
          onBlur={() => save(v)}
        />
      )}
    </div>
  )
}

function RepeatField({
  value,
  onSave,
}: {
  value: string | null
  onSave: (v: string | null) => void
}) {
  const [words, setWords] = useState(value ?? '')
  useEffect(() => setWords(value ?? ''), [value])
  return (
    <Field
      aria-label="Repeats"
      placeholder="every Monday, monthly…"
      value={words}
      onChange={(e) => setWords(e.target.value)}
      onBlur={() => (words.trim() || null) !== value && onSave(words.trim() || null)}
    />
  )
}

function SubTask({ parent, onAdded }: { parent: string; onAdded: () => void }) {
  const [title, setTitle] = useState('')
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        if (!title.trim()) return
        await api.post('/api/tasks', { title: title.trim(), parent })
        setTitle('')
        onAdded()
      }}
      className="flex items-center gap-2"
    >
      <CircleDot className="size-3.5 shrink-0 text-ink-3" />
      <Field
        aria-label="A step"
        placeholder="Add a step"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="flex-1"
      />
    </form>
  )
}

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
