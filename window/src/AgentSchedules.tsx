// An agent's schedules: a line each on its page, and each one's own page with what it does, when,
// and how its runs came out. Made in chat with the agent, or here.
import type { AgentScheduleView } from '@alpha/core/api'
import { CalendarClock, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { Record } from './Record.tsx'
import { dayWords } from './time.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { Confirm } from './ui/dialog.tsx'
import { Field, Select } from './ui/field.tsx'
import { List, Row } from './ui/list.tsx'
import { Pill } from './ui/pill.tsx'
import { Switch } from './ui/switch.tsx'
import { Words } from './ui/words.tsx'

const EVERY: [string, string][] = [
  ['day', 'Every day'],
  ['weekday', 'Every weekday'],
  ['monday', 'Every Monday'],
  ['tuesday', 'Every Tuesday'],
  ['wednesday', 'Every Wednesday'],
  ['thursday', 'Every Thursday'],
  ['friday', 'Every Friday'],
  ['saturday', 'Every Saturday'],
  ['sunday', 'Every Sunday'],
  ['week', 'Every week'],
  ['hour', 'Every hour'],
]

const money = (usd: number | null) => (usd === null ? '' : ` ($${usd.toFixed(2)})`)

function ScheduleForm({
  agent,
  was,
  onDone,
  onCancel,
}: {
  agent: string
  was?: AgentScheduleView
  onDone: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState(was?.name ?? '')
  const [what, setWhat] = useState(was?.what ?? '')
  const [every, setEvery] = useState(was?.every?.every ?? 'day')
  const [at, setAt] = useState(was?.every?.at ?? '08:00')
  const [next, setNext] = useState<string | null>(null)
  // a pattern or a change in a table is kept as it is here: the agent changes those in chat
  const fixed = !!was && !was.every
  useEffect(() => {
    if (fixed) return
    api
      .post<{ next: string | null }>('/api/schedules/when', {
        when: every === 'hour' ? { every } : { every, at },
      })
      .then(
        (r) => setNext(r.next),
        () => setNext(null),
      )
  }, [every, at, fixed])
  const { busy, problem, act } = useAct(onDone)
  const save = () =>
    act(() => {
      const body = {
        name: name.trim(),
        what: what.trim(),
        ...(fixed ? {} : { when: every === 'hour' ? { every } : { every, at } }),
      }
      return was
        ? api.post(`/api/schedules/${was.id}/change`, body)
        : api.post(`/api/agents/${agent}/schedules`, body)
    })
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
      <Field
        placeholder="What to call it"
        aria-label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <textarea
        placeholder="What to do each time, written so it needs nothing else to go on"
        aria-label="What to do"
        value={what}
        onChange={(e) => setWhat(e.target.value)}
        className="min-h-20 rounded-md border border-line bg-surface px-2.5 py-1.5 text-ink text-md outline-none focus:border-accent-line"
      />
      {fixed ? (
        <p className="text-ink-3 text-sm">Runs {was.when}. Ask the agent to change this.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={every} aria-label="How often" onChange={(e) => setEvery(e.target.value)}>
            {EVERY.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </Select>
          {every !== 'hour' && (
            <Field type="time" aria-label="At" value={at} onChange={(e) => setAt(e.target.value)} />
          )}
          {next && <span className="text-ink-3 text-sm">Next {dayWords(next)}</span>}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={busy || !name.trim() || !what.trim()} onClick={save}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Refusal words={problem} />
      </div>
    </div>
  )
}

function Controls({ s, onChange }: { s: AgentScheduleView; onChange: () => void }) {
  const { busy, problem, act } = useAct(onChange)
  return (
    <>
      <Refusal words={problem} />
      {s.running && <Pill tone="accent">Running</Pill>}
      <Button
        size="sm"
        variant="ghost"
        disabled={busy || s.running}
        onClick={() => act(() => api.post(`/api/schedules/${s.id}/run`))}
      >
        Run now
      </Button>
      <Switch
        checked={s.state === 'on'}
        disabled={busy}
        label={s.state === 'on' ? `Pause ${s.name}` : `Turn on ${s.name}`}
        onChange={(on) =>
          act(() => api.post(`/api/schedules/${s.id}`, { state: on ? 'on' : 'paused' }))
        }
      />
    </>
  )
}

function lineUnder(s: AgentScheduleView): string {
  const last = s.runs[0]
  return [
    s.when,
    s.state === 'on' ? (s.next ? `next ${dayWords(s.next)}` : '') : 'paused',
    last ? `last: ${last.words}${money(last.usd)}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

export function AgentSchedules({
  agent,
  schedules,
  onChange,
}: {
  agent: string
  schedules: AgentScheduleView[]
  onChange: () => void
}) {
  const [adding, setAdding] = useState(false)
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <h2 className="font-medium font-serif text-ink text-xl">Schedules</h2>
        <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>
      {adding && (
        <ScheduleForm
          agent={agent}
          onCancel={() => setAdding(false)}
          onDone={() => {
            setAdding(false)
            onChange()
          }}
        />
      )}
      {schedules.length === 0 && !adding ? (
        <p className="text-ink-3 text-sm">Nothing runs by itself yet.</p>
      ) : (
        schedules.length > 0 && (
          <List>
            {schedules.map((s) => (
              <Row
                key={s.id}
                lead={<CalendarClock className="size-4 text-ink-3" />}
                title={
                  <a href={`#/schedule/${s.id}`} className="hover:underline">
                    {s.name}
                  </a>
                }
                sub={lineUnder(s)}
                actions={<Controls s={s} onChange={onChange} />}
              />
            ))}
          </List>
        )
      )}
    </section>
  )
}

export function AgentSchedulePage({
  id,
  version,
  onName,
}: {
  id: string
  version: number
  onName: (name: string) => void
}) {
  const [s, setS] = useState<AgentScheduleView | null | undefined>(undefined)
  const gone = useCallback(() => setS(null), [])
  const load = useCallback(() => {
    api.get<AgentScheduleView>(`/api/schedules/${id}`).then((d) => {
      setS(d)
      onName(d.name)
    }, gone)
  }, [id, onName, gone])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])
  const [changing, setChanging] = useState(false)
  const [asking, setAsking] = useState(false)
  const { busy, problem, act } = useAct()
  if (s === undefined) return <p className="p-6 text-ink-3">Loading…</p>
  if (s === null) return <p className="p-6 text-ink-2">This schedule is not there any more.</p>
  return (
    <Record kind={`Schedule of ${s.agent.name}`}>
      <h1 className="font-serif text-2xl text-ink">{s.name}</h1>
      <p className="text-ink-2 text-md">
        Runs {s.when}
        {s.next ? `, next ${dayWords(s.next)}` : ''}.{' '}
        {s.hasCheck
          ? 'A small script looks first, and it wakes the agent only when it finds something.'
          : 'It wakes the agent every time.'}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Controls s={s} onChange={load} />
        <Button size="sm" variant="ghost" onClick={() => setChanging(true)}>
          Change
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAsking(true)}>
          Delete
        </Button>
        <Refusal words={problem} />
      </div>
      {changing && (
        <ScheduleForm
          agent={s.agent.id}
          was={s}
          onCancel={() => setChanging(false)}
          onDone={() => {
            setChanging(false)
            load()
          }}
        />
      )}
      <section className="flex flex-col gap-1.5">
        <h2 className="font-medium font-serif text-ink text-xl">What it does</h2>
        <div className="text-md">
          <Words text={s.what || 'Nothing written yet.'} />
        </div>
      </section>
      <section className="flex flex-col gap-1.5">
        <h2 className="font-medium font-serif text-ink text-xl">Runs</h2>
        {s.runs.length === 0 ? (
          <p className="text-ink-3 text-sm">It has not run yet.</p>
        ) : (
          <List>
            {s.runs.map((r) => (
              <Row
                key={r.id}
                title={`${r.words}${money(r.usd)}`}
                sub={dayWords(r.at)}
                actions={
                  r.task ? (
                    <a
                      href={`#/tasks/${r.task}/work`}
                      className="text-ink-3 text-sm hover:text-ink"
                    >
                      Open the work
                    </a>
                  ) : undefined
                }
              />
            ))}
          </List>
        )}
      </section>
      {asking && (
        <Confirm
          open
          title={`Delete ${s.name}?`}
          yes="Delete it"
          busy={busy}
          onClose={() => setAsking(false)}
          onYes={() => {
            setAsking(false)
            act(async () => {
              await api.post(`/api/schedules/${s.id}/remove`)
              window.location.hash = `#/agent/${s.agent.id}`
            })
          }}
        >
          It stops running. What it already reported stays.
        </Confirm>
      )}
    </Record>
  )
}
