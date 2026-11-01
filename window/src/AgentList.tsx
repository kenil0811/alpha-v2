// Intelligence › Agents (proposal 28 Oct §2 #1; Vikas, 29 Oct): every agent, Alpha's own
// included, in one list grouped by what it does (Sourcing, Outreach…), its module a column and a
// filter. Each row: how often it runs (changed here, written into its file), when it last ran,
// its next run, its last result, its cost this week from Usage, and Running or Paused. One that is
// blocked says why in red, with the one action that unblocks it. New agent opens New module's
// page for an agent. Agent approvals sit above the list, one at a time: they are the agents' asks,
// not tasks (Vikas, 1 Nov).

import { useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import type { AgentView, Stream, WorkingModuleView } from './coming.ts'
import { when } from './ModulesAndAgents.tsx'
import { peek } from './Peek.tsx'
import { dayWords } from './time.ts'
import { usdWords as usd } from './Usage.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { Cut } from './ui/cut.tsx'
import { Select } from './ui/field.tsx'
import { Section } from './ui/section.tsx'
import { Switch } from './ui/switch.tsx'
import { NEEDS_YOU } from './vocabulary.ts'
import { NeedsYou } from './Waiting.tsx'

// "25 Oct", the year only when it isn't this one (W5)
export const shortDay = (at: string) => {
  const d = new Date(at)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
  })
}

// A time gone by as a person says it: "just now", "12 min ago", "3 h ago", "25 Oct".
export function agoWords(at: string): string {
  const min = Math.round((Date.now() - new Date(at).getTime()) / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  if (min < 24 * 60) return `${Math.round(min / 60)} h ago`
  return shortDay(at)
}

// When it last ran, well or not: the last run's start, else the last that went well.
export const lastRun = (a: AgentView) => a.lastResult?.at ?? a.lastRunAt

export const resultWords = (r: AgentView['lastResult']) =>
  !r ? '' : r.failedSince ? `Failed since ${shortDay(r.failedSince)}` : r.words

export const costHref = (_id: string) => '#/settings/usage'

// Running or Paused, said beside the switch; Activate while the agent has never been turned on.
export function OnCell({ agent: a, onDone }: { agent: AgentView; onDone?: () => void }) {
  const { busy, problem, act } = useAct(onDone)
  const turn = (on: boolean) =>
    act(() => api.post(`/api/agents/${a.id}`, { state: on ? 'on' : 'paused' }))
  return (
    <span className="flex items-center gap-2">
      {a.fresh ? (
        <Button size="sm" variant="primary" disabled={busy} onClick={() => turn(true)}>
          Activate
        </Button>
      ) : (
        <>
          <Switch
            checked={a.state === 'on'}
            label={a.state === 'on' ? `Pause ${a.name}` : `Turn on ${a.name}`}
            disabled={busy}
            onChange={turn}
          />
          <span className={a.state === 'on' ? 'text-ink' : 'text-ink-3'}>
            {a.state === 'on' ? 'Running' : 'Paused'}
          </span>
        </>
      )}
      <Refusal words={problem} />
    </span>
  )
}

// Why the agent is not doing its work, in red, with the one action that unblocks it.
export function Blocked({ agent: a, onDone }: { agent: AgentView; onDone?: () => void }) {
  const { busy, problem, act } = useAct(onDone)
  const b = a.blocked
  if (!b) return null
  return (
    <span className="flex flex-wrap items-center gap-2 text-bad">
      <span aria-hidden className="size-2.25 shrink-0 rounded-full bg-bad" />
      <span>{b.words}</span>
      <Button
        size="sm"
        disabled={busy || a.running}
        onClick={() => {
          if (b.action.run) void act(() => api.post(`/api/agents/${a.id}/run`))
          else window.location.hash = b.action.href ?? '#/'
        }}
      >
        {b.action.label}
      </Button>
      <Refusal words={problem} />
    </span>
  )
}

const EVERY = [
  ['hour', 'Every hour'],
  ['day', 'Every day'],
  ['week', 'Every week'],
] as const
const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`)

// How often it runs: picked here where it runs at one time on the clock, written into its file;
// otherwise what it waits for, in words.
export function RunsCell({ agent: a, onDone }: { agent: AgentView; onDone?: () => void }) {
  const { busy, problem, act } = useAct(onDone)
  const s = a.schedule
  const events = (a.triggers ?? []).filter((t) => t.on === 'event').map((t) => t.words)
  if (!s)
    return (
      <span className="flex flex-col">
        {(a.triggers ?? []).length
          ? (a.triggers ?? []).map((t) => <span key={t.words}>{t.words}</span>)
          : 'When given a task'}
      </span>
    )
  const at = s.at ?? '08:00'
  const set = (every: string, time: string) =>
    act(() =>
      api.post(`/api/agents/${a.id}/when`, { every, ...(every === 'hour' ? {} : { at: time }) }),
    )
  return (
    <span className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5">
        <Select
          aria-label={`How often ${a.name} runs`}
          className="w-32"
          value={s.every}
          disabled={busy}
          onChange={(e) => set(e.target.value, at)}
        >
          {EVERY.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </Select>
        {s.every !== 'hour' && (
          <Select
            aria-label={`When ${a.name} runs`}
            className="w-24"
            value={at}
            disabled={busy}
            onChange={(e) => set(s.every, e.target.value)}
          >
            {(HOURS.includes(at) ? HOURS : [at, ...HOURS]).map((h) => (
              <option key={h} value={h}>
                at {h}
              </option>
            ))}
          </Select>
        )}
      </span>
      {events.map((w) => (
        <span key={w} className="text-ink-3">
          and {w.charAt(0).toLowerCase() + w.slice(1)}
        </span>
      ))}
      <Refusal words={problem} />
    </span>
  )
}

// Functions in the order a business reads them; any other a kit names comes after.
const FUNCTIONS = ['Sourcing', 'Intake', 'Analysis & insights', 'Outreach', 'Finance', 'Admin']
export const byFunction = (a: string, b: string) =>
  (FUNCTIONS.indexOf(a) + 1 || 99) - (FUNCTIONS.indexOf(b) + 1 || 99) || a.localeCompare(b)

type On = 'all' | 'time' | 'event'

export function AgentList({ version }: { version: number }) {
  const [working, setWorking] = useState<WorkingModuleView[] | null>(null)
  const [cost, setCost] = useState<Map<string, number>>(new Map())
  const [fn, setFn] = useState<string | null>(null)
  const [module, setModule] = useState('')
  const [on, setOn] = useState<On>('all')
  const [asks, setAsks] = useState<Stream | null>(null)
  const load = useCallback(() => {
    api.get<Stream>('/api/stream?limit=1').then(setAsks, () => setAsks(null))
    api.get<WorkingModuleView[]>('/api/working').then(setWorking, () => setWorking([]))
    // the same sum as Settings › Usage, for the last 7 days
    api.get<Record<string, number>>('/api/usage/agents').then(
      (u) => setCost(new Map(Object.entries(u))),
      () => setCost(new Map()),
    )
  }, [])
  useEffect(() => {
    if (version >= 0) load()
  }, [version, load])
  // while one runs, look again every few seconds so "Running now…" ends when the run does
  const anyRunning = working?.some((m) => m.agents.some((a) => a.running)) ?? false
  useEffect(() => {
    if (!anyRunning) return
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [anyRunning, load])
  if (!working) return <p className="text-ink-3">Loading…</p>
  // a core from before functions groups every agent under Admin until it restarts
  const every = working
    .flatMap((m) => m.agents)
    .map((a) => ({ ...a, function: a.function ?? 'Admin' }))
  const has = (a: AgentView, kind: On) =>
    kind === 'all' || (a.triggers ?? []).some((t) => t.on === kind)
  const inModule = every.filter((a) => !module || a.module?.id === module)
  const inFn = inModule.filter((a) => !fn || a.function === fn)
  const shown = inFn.filter((a) => has(a, on))
  const functions = [...new Set(inModule.map((a) => a.function))].sort(byFunction)
  const groups = [...new Set(shown.map((a) => a.function))]
    .sort(byFunction)
    .map((f) => [f, shown.filter((a) => a.function === f)] as const)
  const heads = [
    'Agent',
    'Module',
    'Runs',
    'Last run',
    'Next run',
    'Last result',
    'Cost this week',
    'Running',
  ]
  const waiting = (asks?.cards.length ?? 0) + (asks?.attention.length ?? 0)
  return (
    <div className="flex flex-col gap-3">
      {asks && waiting > 0 && (
        <Section title={NEEDS_YOU} small>
          <NeedsYou cards={asks.cards} signIns={asks.attention} onChange={load} />
        </Section>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button variant="primary" size="sm" onClick={() => (window.location.hash = '#/agent/new')}>
          New agent
        </Button>
        <span className="mx-1 h-5 w-px bg-line" />
        <Cut sel={!fn} count={inModule.length} onClick={() => setFn(null)}>
          All
        </Cut>
        {functions.map((f) => (
          <Cut
            key={f}
            sel={fn === f}
            count={inModule.filter((a) => a.function === f).length}
            onClick={() => setFn(f)}
          >
            {f}
          </Cut>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Select
          aria-label="Module"
          className="w-48"
          value={module}
          onChange={(e) => setModule(e.target.value)}
        >
          <option value="">All modules</option>
          {working
            .filter((m) => m.agents.length)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </Select>
        {(
          [
            ['all', 'Any trigger'],
            ['time', 'On a time'],
            ['event', 'On an event'],
          ] as const
        ).map(([k, label]) => (
          <Cut
            key={k}
            sel={on === k}
            count={inFn.filter((a) => has(a, k)).length}
            onClick={() => setOn(k)}
          >
            {label}
          </Cut>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full border-collapse text-md">
          <thead>
            <tr className="text-left text-ink-3 text-sm">
              {heads.map((h) => (
                <th key={h} className="h-9 whitespace-nowrap border-line border-b px-3 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map(([f, list]) => (
            <tbody key={f}>
              <tr>
                <th
                  colSpan={heads.length}
                  className="border-line border-b bg-sunk px-3 py-1.5 text-left font-medium text-ink-2 text-sm"
                >
                  {f} <span className="font-normal text-ink-3">{list.length}</span>
                </th>
              </tr>
              {list.map((a) => (
                <AgentRow key={a.id} agent={a} cost={cost.get(a.id) ?? 0} onDone={load} />
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  )
}

function AgentRow({
  agent: a,
  cost,
  onDone,
}: {
  agent: AgentView
  cost: number
  onDone: () => void
}) {
  const last = lastRun(a)
  return (
    <tr className="border-hair border-t align-top first:border-t-0">
      {/* wide enough for the name and its blocked line; the list scrolls sideways past that */}
      <td className="min-w-64 px-3 py-2">
        <button
          type="button"
          className={
            a.blocked ? 'text-left text-bad hover:underline' : 'text-left text-ink hover:underline'
          }
          onClick={() => peek(`#/agent/${a.id}`)}
        >
          {a.name}
        </button>
        {a.blocked && (
          <div className="mt-1 text-sm">
            <Blocked agent={a} onDone={onDone} />
          </div>
        )}
      </td>
      <td className="px-3 py-2">
        <a href={`#/module/${a.module?.id}`} className="text-ink-2 hover:underline">
          {a.module?.name}
        </a>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-ink-2">
        <RunsCell agent={a} onDone={onDone} />
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-ink-2">
        {a.running ? (
          'Running now…'
        ) : last ? (
          <span data-tip={when(last)}>{agoWords(last)}</span>
        ) : (
          'Not yet'
        )}
      </td>
      <td className="px-3 py-2 text-ink-2">
        {a.running
          ? 'Running now…'
          : a.state !== 'on'
            ? 'Paused'
            : a.nextRunAt
              ? dayWords(a.nextRunAt)
              : 'On its next event'}
      </td>
      <td className={a.lastResult?.ok === false ? 'px-3 py-2 text-bad' : 'px-3 py-2 text-ink-2'}>
        {resultWords(a.lastResult)}
      </td>
      <td className="px-3 py-2 tabular-nums">
        {cost ? (
          <a href={costHref(a.id)} className="text-ink-2 hover:underline">
            {usd(cost)}
          </a>
        ) : null}
      </td>
      <td className="px-3 py-2">
        <OnCell agent={a} onDone={onDone} />
      </td>
    </tr>
  )
}
