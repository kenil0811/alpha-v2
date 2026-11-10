// Tasks (Kenil's plan, 21 Oct, Ledger): one list of all work, each task on the place it concerns.
// Saved lists (Today, This week, Overdue, Waiting for you, Schedules, All open, Done) in four views:
// a list, a tree by place, a board by state and a calendar by due date. New under the list. A
// task's page: its state, due and reminder, repeat, priority, owner, place, notes, what it touches,
// its checklist, the place's values and the other tasks there, and its history.
import type { KeptTable, TaskLineView, TaskView } from '@alpha/core/api'
import { Check, CircleDot, Clock, Repeat2, Trash2, X } from 'lucide-react'
import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { api, Problem } from './api.ts'
import { Record } from './Record.tsx'
import { TableView } from './TableView.tsx'
import { TaskWorkLine } from './TaskThread.tsx'
import { dueWords, toLocalInput } from './time.ts'
import { Button } from './ui/button.tsx'
import { cn } from './ui/cn.ts'
import { DateField, parseDay } from './ui/date-field.tsx'
import { Confirm, Dialog } from './ui/dialog.tsx'
import { Field, Select } from './ui/field.tsx'
import { More } from './ui/more.tsx'
import { Pill } from './ui/pill.tsx'
import { MenuItem, Popover } from './ui/popover.tsx'
import { PageTitle } from './ui/rename.tsx'
import { Section } from './ui/section.tsx'
import { Segmented } from './ui/segmented.tsx'
import { Tabs } from './ui/tabs.tsx'

type List = 'today' | 'week' | 'overdue' | 'waiting' | 'open' | 'done'

const LISTS: { value: List; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'waiting', label: 'Waiting' },
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

// The saved lists are the switch in the bar; the tasks are drawn by the shared table view, with its
// table, board, calendar and grouping, each opening on its own page.
function TaskLists({ list, version }: { list: List; version: number }) {
  // the core serves a saved list's tasks as a table: changed in a cell, or by a card dragged
  // across the board (UI batch 2, 26 Oct)
  const [data, setData] = useState<KeptTable | null>(null)
  const load = useCallback(() => {
    api.get<KeptTable>(`/api/kept/tasks?list=${list}`).then(setData, () => setData(null))
  }, [list])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])
  const counts = data?.kept.counts ?? {}
  const [adding, setAdding] = useState(false)
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs
        label="Tasks"
        tabs={LISTS.map((l) => ({
          key: l.value,
          href: `#/tasks?list=${l.value}`,
          label: l.label,
          count: l.value !== 'done' && counts[l.value] ? counts[l.value] : undefined,
          sel: l.value === list,
        }))}
      />
      <div className="min-h-0 flex-1">
        {data ? (
          <TableView
            key={list}
            data={data}
            kept={{
              open: (id) => {
                window.location.hash = `#/tasks/${id}`
              },
              onNew: () => setAdding(true),
            }}
          />
        ) : (
          <p className="p-7 text-ink-3">Loading…</p>
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
      {t.state === 'doing' && <Pill tone="accent">In progress</Pill>}
      {t.state === 'waiting' && <Pill>Waiting</Pill>}
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
  const [notes, setNotes] = useState('')
  const [removing, setRemoving] = useState(false)
  const load = useCallback(() => {
    api.get<TaskView>(`/api/tasks/${id}`).then(
      (v) => {
        setT(v)
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
    <Record kind={t.parent ? 'Subtask' : 'Task'}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          {t.parent && (
            <a href={`#/tasks/${t.parent}`} className="text-ink-3 text-sm hover:underline">
              Part of {t.parentTitle}
            </a>
          )}
          <div className="flex items-center gap-2">
            <PageTitle
              name={t.title}
              className="flex-1 text-2xl"
              rename={(to) => api.post<TaskView>(`/api/tasks/${id}`, { title: to }).then(setT)}
            />
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

        <TaskWorkLine task={t} />
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
