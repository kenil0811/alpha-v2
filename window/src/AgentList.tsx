// Intelligence › Agents (proposal 28 Oct §2 #1; Vikas, 29 Oct): every agent, Alpha's own
// included, in one list. Each row: how often it runs, when it last ran, and Running or Paused
// beside the switch. One that is blocked says why in red.
// Waiting on the core: grouping by what an agent does (AgentView.function) — until then the list
// is grouped by module; its schedule picker (POST /api/agents/:id/when), next run, last result,
// cost (GET /api/usage/agents) and the one action that unblocks it (AgentView.blocked).
import type { AgentView, WorkingModuleView } from '@alpha/core/api'
import { useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { when } from './ModulesAndAgents.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { Switch } from './ui/switch.tsx'

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

// Running or Paused, said beside the switch.
export function OnCell({ agent: a, onDone }: { agent: AgentView; onDone?: () => void }) {
  const { busy, problem, act } = useAct(onDone)
  const on = a.state === 'on'
  return (
    <span className="flex items-center gap-2">
      <Switch
        checked={on}
        label={on ? `Pause ${a.name}` : `Turn on ${a.name}`}
        disabled={busy}
        onChange={(v) => act(() => api.post(`/api/agents/${a.id}`, { state: v ? 'on' : 'paused' }))}
      />
      <span className={on ? 'text-ink' : 'text-ink-3'}>{on ? 'Running' : 'Paused'}</span>
      <Refusal words={problem} />
    </span>
  )
}

// Why the agent is not doing its work, in red: what it needs that is not there.
export function Blocked({ agent: a }: { agent: AgentView }) {
  if (!a.needs) return null
  return (
    <span className="flex items-center gap-2 text-bad">
      <span aria-hidden className="size-2.25 shrink-0 rounded-full bg-bad" />
      <span>{a.needs.charAt(0).toUpperCase() + a.needs.slice(1)}</span>
    </span>
  )
}

const HEADS = ['Agent', 'Runs', 'Last run', 'Running']

export function AgentList({ version }: { version: number }) {
  const [working, setWorking] = useState<WorkingModuleView[] | null>(null)
  const load = useCallback(() => {
    api.get<WorkingModuleView[]>('/api/working').then(setWorking, () => setWorking([]))
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
  const groups = working.filter((m) => m.agents.length)
  if (!groups.length)
    return <p className="text-ink-2 text-md">No agents yet. A module's agents show here.</p>
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full border-collapse text-md">
        <thead>
          <tr className="text-left text-ink-3 text-sm">
            {HEADS.map((h) => (
              <th key={h} className="h-9 whitespace-nowrap border-line border-b px-3 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((m) => (
          <tbody key={m.id}>
            <tr>
              <th
                colSpan={HEADS.length}
                className="border-line border-b bg-sunk px-3 py-1.5 text-left font-medium text-ink-2 text-sm"
              >
                <a href={`#/module/${m.id}`} className="hover:underline">
                  {m.name}
                </a>{' '}
                <span className="font-normal text-ink-3">{m.agents.length}</span>
              </th>
            </tr>
            {m.agents.map((a) => (
              <AgentRow key={a.id} agent={a} onDone={load} />
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}

function AgentRow({ agent: a, onDone }: { agent: AgentView; onDone: () => void }) {
  return (
    <tr className="border-hair border-t align-top first:border-t-0">
      {/* wide enough for the name and its blocked line; the list scrolls sideways past that */}
      <td className="min-w-64 px-3 py-2">
        <a
          href={`#/agent/${a.id}`}
          className={a.needs ? 'text-bad hover:underline' : 'text-ink hover:underline'}
        >
          {a.name}
        </a>
        {a.needs && (
          <div className="mt-1 text-sm">
            <Blocked agent={a} />
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-ink-2">{a.when}</td>
      <td className="whitespace-nowrap px-3 py-2 text-ink-2">
        {a.running ? (
          'Running now…'
        ) : a.lastRunAt ? (
          <span data-tip={when(a.lastRunAt)}>{agoWords(a.lastRunAt)}</span>
        ) : (
          'Not yet'
        )}
      </td>
      <td className="px-3 py-2">
        <OnCell agent={a} onDone={onDone} />
      </td>
    </tr>
  )
}
