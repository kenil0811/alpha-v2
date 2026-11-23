// Tasks: one list of all work, each task on the place it concerns.
// Saved lists (Today, This week, Overdue, Waiting for you, Schedules, All open, Done) in four views:
// a list, a tree by place, a board by state and a calendar by due date. New under the list. A
// task's page: its state, due and reminder, repeat, priority, owner, place, notes, what it touches,
// its checklist, the place's values and the other tasks there, and its history.
import type { KeptTable, TaskLineView, TaskView } from '@alpha/core/api'
import { CircleDot, Trash2 } from 'lucide-react'
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react'
import { api, Problem } from './api.ts'
import { Record } from './Record.tsx'
import { TableView } from './TableView.tsx'
import { RepeatField, WhenField } from './TaskFields.tsx'
import { STATES, TaskLine } from './TaskLine.tsx'
import { TasksSetup } from './TasksSetup.tsx'
import { TaskWorkLine } from './TaskThread.tsx'
import { frameOf } from './table/frame.ts'
import { toLocalInput } from './time.ts'
import { Button } from './ui/button.tsx'
import { DateField } from './ui/date-field.tsx'
import { Confirm, Dialog } from './ui/dialog.tsx'
import { Field, Select } from './ui/field.tsx'
import { Frame } from './ui/frame.tsx'
import { List as Rows } from './ui/list.tsx'
import { More } from './ui/more.tsx'
import { MenuItem } from './ui/popover.tsx'
import { PageTitle } from './ui/rename.tsx'
import { Section } from './ui/section.tsx'
import { Segmented } from './ui/segmented.tsx'
import { Tabs } from './ui/tabs.tsx'

const TASKS_FRAME = frameOf('tasks', 'Tasks', { id: 'tasks', name: 'Tasks' })

type List = 'today' | 'week' | 'overdue' | 'waiting' | 'open' | 'done'

const LISTS: { value: List; label: string }[] = [
  { value: 'open', label: 'All open' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'done', label: 'Done' },
]

export function Tasks({
  list,
  id,
  setup = false,
  version,
  onName,
}: {
  list: List
  id: string | null
  setup?: boolean
  version: number
  onName: (name: string) => void
}) {
  return id ? (
    <TaskPage id={id} version={version} onName={onName} />
  ) : (
    <TaskLists list={list} setup={setup} version={version} />
  )
}

// The saved lists are the switch in the bar; the tasks are drawn by the shared table view, with its
// table, board, calendar and grouping, each opening on its own page.
function TaskLists({ list, setup, version }: { list: List; setup: boolean; version: number }) {
  // the core serves a saved list's tasks as a table: changed in a cell, or by a card dragged
  // across the board
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
        tabs={[
          { key: 'tasks', href: '#/tasks', label: 'Tasks', sel: !setup },
          { key: 'setup', href: '#/tasks/setup', label: 'Setup', sel: setup },
        ]}
      />
      {setup ? (
        <TasksSetup version={version} fields={data?.fields ?? []} />
      ) : (
        <div className="min-h-0 flex-1">
          {/* its frame from the first moment, its rows filling in */}
          <TableView
            key={list}
            data={data ?? TASKS_FRAME}
            loading={!data}
            lists={LISTS.map((l) => ({
              key: l.value,
              href: `#/tasks?list=${l.value}`,
              label: l.label,
              count: l.value !== 'done' && counts[l.value] ? counts[l.value] : undefined,
              sel: l.value === list,
            }))}
            kept={{
              open: (id) => {
                window.location.hash = `#/tasks/${id}`
              },
              onNew: () => setAdding(true),
            }}
          />
        </div>
      )}
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

        <Frame className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
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
                  Clear
                </Button>
              )}
            </span>
          </Labelled>
        </Frame>

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
            <Rows>
              {t.subtasks.map((s) => (
                <TaskLine key={s.id} t={s} onChange={load} place={false} />
              ))}
            </Rows>
          )}
          <SubTask parent={t.id} onAdded={load} />
        </Section>

        {(t.context.values.length > 0 || t.context.siblings.length > 0) && (
          <Section title="Where it sits" about={t.place.words}>
            {t.context.values.length > 0 && (
              <Rows>
                {t.context.values.slice(0, 14).map((v) => (
                  <div
                    key={v.field}
                    className="flex gap-3 border-hair border-t px-4 py-2 text-md first:border-t-0"
                  >
                    <span className="w-40 shrink-0 truncate text-ink-3 text-sm">{v.field}</span>
                    <span className="min-w-0 flex-1 truncate text-ink">{v.value}</span>
                  </div>
                ))}
              </Rows>
            )}
            {t.context.siblings.length > 0 && (
              <>
                <div className="text-ink-3 text-sm">Other open tasks there</div>
                <Rows>
                  {t.context.siblings.map((s) => (
                    <TaskLine key={s.id} t={s} onChange={load} place={false} />
                  ))}
                </Rows>
              </>
            )}
          </Section>
        )}

        {t.touches.length > 0 && (
          <Section title="What it changes">
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
            done={{ words: 'The task is deleted.' }}
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
