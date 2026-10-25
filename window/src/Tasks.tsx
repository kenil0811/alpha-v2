// Tasks (Kenil's plan, 21 Oct, Ledger): one list of all work, each task on the place it concerns.
// Saved lists (Today, This week, Overdue, Waiting for you, Agents, All open, Done) in four views:
// a list, a tree by place, a board by state and a calendar by due date. New task at the top. A
// task's page: its state, due and reminder, repeat, priority, owner, place, notes, what it touches,
// its checklist, the place's values and the other tasks there, and its history.
import type { TaskLineView, TasksView, TaskView } from '@alpha/core/api'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  Repeat2,
  Trash2,
  X,
} from 'lucide-react'
import {
  type DragEvent,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { RunRow } from './Activity.tsx'
import { api, Problem } from './api.ts'
import { CardBox } from './Conversation.tsx'
import { dueWords } from './time.ts'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { Confirm } from './ui/dialog.tsx'
import { Field, Select } from './ui/field.tsx'
import { Pill } from './ui/pill.tsx'
import { MenuItem, Popover } from './ui/popover.tsx'
import { Section } from './ui/section.tsx'
import { Segmented } from './ui/segmented.tsx'
import { answerWords } from './vocabulary.ts'

type List = 'today' | 'week' | 'overdue' | 'waiting' | 'agents' | 'open' | 'done'
type Look = 'list' | 'tree' | 'board' | 'calendar'

const LISTS: { value: List; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'waiting', label: 'Waiting for you' },
  { value: 'agents', label: 'Agents' },
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
}: {
  list: List
  id: string | null
  version: number
  onName: (name: string) => void
}) {
  return id ? (
    <TaskPage id={id} version={version} onName={onName} />
  ) : (
    <TaskLists list={list} version={version} />
  )
}

function TaskLists({ list, version }: { list: List; version: number }) {
  const [view, setView] = useState<TasksView | null>(null)
  const [look, setLook] = useState<Look>(() => {
    try {
      return (localStorage.getItem('alpha-tasks-look') as Look | null) ?? 'list'
    } catch {
      return 'list'
    }
  })
  const load = useCallback(() => {
    api.get<TasksView>(`/api/tasks?list=${list}`).then(setView, () => setView(null))
  }, [list])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])
  const pick = (l: Look) => {
    setLook(l)
    try {
      localStorage.setItem('alpha-tasks-look', l)
    } catch {
      // kept for this visit only
    }
  }
  const lines = view?.lines ?? []
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-page flex-col gap-4 px-8 pt-7 pb-10">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl text-ink">Tasks</h1>
          <span className="flex-1" />
          <Segmented
            label="View"
            value={look}
            onChange={pick}
            options={[
              { value: 'list', label: 'List' },
              { value: 'tree', label: 'By place' },
              { value: 'board', label: 'Board' },
              { value: 'calendar', label: 'Calendar' },
            ]}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LISTS.map((l) => (
            <a
              key={l.value}
              href={`#/tasks?list=${l.value}`}
              className={cn(
                'rounded-md border px-2.5 py-1 text-sm transition-colors',
                l.value === list
                  ? 'border-accent-line bg-accent-soft font-medium text-accent'
                  : 'border-line bg-surface text-ink-2 hover:text-ink',
              )}
            >
              {l.label}
              {view && l.value !== 'done' && view.counts[l.value] ? (
                <span className="ml-1.5 tabular-nums">{view.counts[l.value]}</span>
              ) : null}
            </a>
          ))}
        </div>
        <NewTask onAdded={load} />
        {view && lines.length === 0 && (
          <p className="text-ink-3 text-md">
            {list === 'today'
              ? 'Nothing due today. Say a task to Alpha, or add one above.'
              : 'Nothing here.'}
          </p>
        )}
        {lines.length > 0 && look === 'list' && <TaskList lines={lines} onChange={load} />}
        {lines.length > 0 && look === 'tree' && <TaskTree lines={lines} onChange={load} />}
        {look === 'board' && <TaskBoard lines={lines} onChange={load} />}
        {look === 'calendar' && <TaskCalendar lines={lines} />}
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
        <Field
          aria-label="Due"
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
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
        title={`${label}: change it`}
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

function Meta({ t, place = true }: { t: TaskLineView; place?: boolean }) {
  const bits: ReactNode[] = []
  if (place && t.place.path.length)
    bits.push(
      <span key="p" className="truncate">
        {t.place.path.join(' › ')}
      </span>,
    )
  if (t.ownerKind !== 'person') bits.push(<span key="o">{t.owner}</span>)
  if (t.children) bits.push(<span key="c">{`${t.childrenDone} of ${t.children} done`}</span>)
  return bits.length ? (
    <span className="flex min-w-0 items-center gap-2 truncate text-ink-3 text-sm">{bits}</span>
  ) : null
}

function Due({ t }: { t: TaskLineView }) {
  if (!t.due) return null
  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1 text-sm tabular-nums',
        t.overdue ? 'text-bad' : 'text-ink-3',
      )}
    >
      {t.repeat && <Repeat2 className="size-3" aria-label={t.repeat} />}
      {t.remindAt && <Clock className="size-3" aria-label="With a reminder" />}
      {dueWords(t.due)}
    </span>
  )
}

function TaskLine({
  t,
  onChange,
  place,
}: {
  t: TaskLineView
  onChange: () => void
  place?: boolean
}) {
  return (
    <div className="flex items-center gap-3 border-hair border-t px-4 py-2.5 first:border-t-0 hover:bg-hover">
      <Tick t={t} onChange={onChange} />
      <a href={`#/tasks/${t.id}`} className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-base',
            open(t) ? 'text-ink' : 'text-ink-3 line-through',
          )}
        >
          {t.priority === 'high' && <span className="mr-1.5 text-warn">●</span>}
          {t.title}
        </span>
        <Meta t={t} place={place ?? true} />
      </a>
      {t.waitingForYou && <Pill tone="warn">Waiting for your yes</Pill>}
      {t.working && <Pill tone="accent">{t.owner} working</Pill>}
      {t.state === 'doing' && !t.working && <Pill tone="accent">In progress</Pill>}
      {t.state === 'waiting' && !t.waitingForYou && <Pill>Waiting</Pill>}
      <Due t={t} />
    </div>
  )
}

export function TaskList({ lines, onChange }: { lines: TaskLineView[]; onChange: () => void }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      {lines.map((t) => (
        <TaskLine key={t.id} t={t} onChange={onChange} />
      ))}
    </div>
  )
}

// By place: the module, then what is inside it, with the tasks there beneath.
function TaskTree({ lines, onChange }: { lines: TaskLineView[]; onChange: () => void }) {
  const groups = useMemo(() => {
    const out = new Map<string, { path: string[]; href: string | null; tasks: TaskLineView[] }>()
    for (const t of lines) {
      const key = t.place.path.join(' › ') || 'Nowhere yet'
      const g = out.get(key) ?? { path: t.place.path, href: t.place.href, tasks: [] }
      g.tasks.push(t)
      out.set(key, g)
    }
    return [...out.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [lines])
  const [shut, setShut] = useState<string[]>([])
  return (
    <div className="flex flex-col gap-3">
      {groups.map(([key, g]) => {
        const folded = shut.includes(key)
        return (
          <div key={key} className="overflow-hidden rounded-lg border border-line bg-surface">
            <div className="flex items-center gap-2 border-line border-b bg-sunk px-4 py-2">
              <button
                type="button"
                aria-label={folded ? `Open ${key}` : `Fold ${key}`}
                onClick={() => setShut(folded ? shut.filter((k) => k !== key) : [...shut, key])}
                className="text-ink-3 hover:text-ink"
              >
                <ChevronRight
                  className={cn('size-3.5 transition-transform', !folded && 'rotate-90')}
                />
              </button>
              {g.href ? (
                <a
                  href={g.href}
                  className="min-w-0 flex-1 truncate font-medium text-ink text-md hover:underline"
                >
                  {key}
                </a>
              ) : (
                <span className="min-w-0 flex-1 truncate font-medium text-ink-2 text-md">
                  {key}
                </span>
              )}
              <span className="text-ink-3 text-sm tabular-nums">{g.tasks.length}</span>
            </div>
            {!folded &&
              g.tasks.map((t) => <TaskLine key={t.id} t={t} onChange={onChange} place={false} />)}
          </div>
        )
      })}
    </div>
  )
}

function TaskBoard({ lines, onChange }: { lines: TaskLineView[]; onChange: () => void }) {
  const [over, setOver] = useState<string | null>(null)
  const drop = (state: TaskLineView['state']) => (e: DragEvent) => {
    e.preventDefault()
    setOver(null)
    const id = e.dataTransfer.getData('text/task')
    if (id) setState(id, state).then(onChange, onChange)
  }
  return (
    <div className="grid grid-cols-4 gap-3">
      {STATES.slice(0, 4).map((s) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: a column a task is dragged to; its state is also set on its page
        <div
          key={s.value}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(s.value)
          }}
          onDragLeave={() => setOver(null)}
          onDrop={drop(s.value)}
          className={cn(
            'flex min-h-40 flex-col gap-2 rounded-lg border bg-sunk p-2',
            over === s.value ? 'border-accent-line' : 'border-line',
          )}
        >
          <div className="px-1 font-medium text-ink-2 text-sm">
            {s.label}{' '}
            <span className="text-ink-3 tabular-nums">
              {lines.filter((t) => t.state === s.value).length}
            </span>
          </div>
          {lines
            .filter((t) => t.state === s.value)
            .map((t) => (
              <a
                key={t.id}
                href={`#/tasks/${t.id}`}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/task', t.id)}
                className="flex flex-col gap-1 rounded-md border border-line bg-surface px-3 py-2 hover:border-accent-line"
              >
                <span className="text-base text-ink">
                  {t.priority === 'high' && <span className="mr-1.5 text-warn">●</span>}
                  {t.title}
                </span>
                <Meta t={t} />
                <Due t={t} />
              </a>
            ))}
        </div>
      ))}
    </div>
  )
}

function TaskCalendar({ lines }: { lines: TaskLineView[] }) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const first = new Date(month)
  const start = new Date(first)
  start.setDate(1 - ((first.getDay() + 6) % 7)) // weeks start on Monday
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const byDay = new Map<string, TaskLineView[]>()
  for (const t of lines)
    if (t.due) byDay.set(t.due.slice(0, 10), [...(byDay.get(t.due.slice(0, 10)) ?? []), t])
  const today = key(new Date())
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          aria-label="The month before"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <span className="font-medium text-ink text-md">
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </span>
        <Button
          size="sm"
          variant="ghost"
          aria-label="The month after"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
        >
          <ChevronRight className="size-3.5" />
        </Button>
        {lines.some((t) => !t.due) && (
          <span className="text-ink-3 text-sm">
            {lines.filter((t) => !t.due).length} with no due day are not shown
          </span>
        )}
      </div>
      <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-line bg-line">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="bg-sunk px-2 py-1 text-ink-3 text-xs">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const k = key(d)
          const here = byDay.get(k) ?? []
          return (
            <div
              key={k}
              className={cn(
                'mt-px mr-px flex min-h-24 flex-col gap-1 bg-surface p-1.5',
                d.getMonth() !== month.getMonth() && 'bg-canvas',
              )}
            >
              <span
                className={cn(
                  'text-xs tabular-nums',
                  k === today ? 'font-semibold text-accent' : 'text-ink-3',
                )}
              >
                {d.getDate()}
              </span>
              {here.slice(0, 4).map((t) => (
                <a
                  key={t.id}
                  href={`#/tasks/${t.id}`}
                  className={cn(
                    'truncate rounded-sm px-1 text-xs',
                    open(t) ? 'bg-accent-soft text-accent' : 'text-ink-3 line-through',
                  )}
                >
                  {t.title}
                </a>
              ))}
              {here.length > 4 && (
                <span className="text-ink-3 text-xs">{here.length - 4} more</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- a task's page --------------------------------------------------------------------------

function TaskPage({
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
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [removing, setRemoving] = useState(false)
  const load = useCallback(() => {
    api.get<TaskView>(`/api/tasks/${id}`).then(
      (v) => {
        setT(v)
        setTitle(v.title)
        setNotes(v.notes ?? '')
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
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That did not go in.')
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
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-page flex-col gap-6 px-8 pt-7 pb-10">
        <div className="flex flex-col gap-2">
          {t.parent && (
            <a href={`#/tasks/${t.parent}`} className="text-ink-3 text-sm hover:underline">
              Part of {t.parentTitle}
            </a>
          )}
          <input
            aria-label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() =>
              title.trim() && title.trim() !== t.title && change({ title: title.trim() })
            }
            className="w-full bg-transparent font-serif text-2xl text-ink outline-none"
          />
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
            {t.waitingForYou && <Pill tone="warn">Waiting for your yes</Pill>}
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
          <textarea
            aria-label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (t.notes ?? '') && change({ notes: notes || null })}
            rows={4}
            placeholder="Anything worth keeping with it"
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-ink text-md outline-none focus:border-accent-line"
          />
        </Section>

        <Section title="Checklist" about="The steps beneath it, each a task of its own">
          {t.subtasks.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-line bg-surface">
              {t.subtasks.map((s) => (
                <TaskLine key={s.id} t={s} onChange={load} place={false} />
              ))}
            </div>
          )}
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
                <div className="overflow-hidden rounded-lg border border-line bg-surface">
                  {t.context.siblings.map((s) => (
                    <TaskLine key={s.id} t={s} onChange={load} place={false} />
                  ))}
                </div>
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
          <Button size="sm" variant="ghost" onClick={() => setRemoving(true)}>
            <Trash2 className="size-3.5" />
            Delete
          </Button>
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
    </div>
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

// A day or a moment, saved once the person has settled on it: when they leave the field, or a
// moment after they stop changing it, so stepping through the minutes is one change, not ten.
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
  return (
    <Field
      type={type}
      aria-label={label}
      value={v}
      onChange={(e) => {
        const next = e.target.value
        setV(next)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => save(next), 1500)
      }}
      onBlur={() => save(v)}
    />
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
