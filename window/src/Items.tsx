// A page for each agent, run and standing permission (item 50, 25 Oct), so each can be linked to,
// reviewed and shared: #/agent/<id>, #/run/<id>, #/permission/<id>. Each is built from what the
// core already serves (/api/working, /api/activity, /api/permissions) and comes again when the
// world changes, so a running run's steps arrive as they happen.
import type { AgentView, PermissionView, RunView, WorkingModuleView } from '@alpha/core/api'
import { type ReactNode, useEffect, useState } from 'react'
import { RunRow } from './Activity.tsx'
import { api } from './api.ts'
import { Record } from './Record.tsx'
import { dayWords } from './time.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { Confirm } from './ui/dialog.tsx'
import { List, Row } from './ui/list.tsx'
import { Pill } from './ui/pill.tsx'
import { Switch } from './ui/switch.tsx'

export type ItemKind = 'agent' | 'run' | 'permission'

// The bar holds the way back (the crumb); the page names what the item is, then its title.
function Page({ kind, title, children }: { kind: string; title: string; children: ReactNode }) {
  return (
    <Record kind={kind}>
      <h1 className="font-serif text-2xl text-ink">{title}</h1>
      {children}
    </Record>
  )
}

// Facts about an item, a term and its value a line each.
function Facts({ lines }: { lines: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[160px_1fr] gap-x-4 gap-y-2 rounded-lg border border-line bg-surface px-4.5 py-3.5 text-md">
      {lines.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-ink-3">{term}</dt>
          <dd className="text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

// The module and agent a run or an agent belongs to, found among what does work on its own.
function findAgent(
  modules: WorkingModuleView[],
  pick: (m: WorkingModuleView, a: AgentView) => boolean,
) {
  for (const m of modules) for (const a of m.agents) if (pick(m, a)) return { module: m, agent: a }
  return null
}

function useLoaded<T>(path: string, version: number): T | null | undefined {
  const [data, setData] = useState<T | null | undefined>(undefined)
  useEffect(() => {
    if (version >= 0) api.get<T>(path).then(setData, () => setData(null))
  }, [path, version])
  return data
}

export function ItemPage({
  kind,
  id,
  version,
  onName,
}: {
  kind: ItemKind
  id: string
  version: number
  onName: (name: string) => void
}) {
  const working = useLoaded<WorkingModuleView[]>('/api/working', version)
  const runs = useLoaded<RunView[]>('/api/activity', version)
  const permissions = useLoaded<PermissionView[]>('/api/permissions', version)
  // what the page is about, found before anything is drawn, so its name reaches the bar
  const agent = kind === 'agent' && working ? findAgent(working, (_, a) => a.id === id) : null
  const run = kind === 'run' ? runs?.find((r) => r.id === id) : undefined
  const permission = kind === 'permission' ? permissions?.find((p) => p.id === id) : undefined
  const name = agent?.agent.name ?? run?.name ?? (permission ? 'A standing permission' : undefined)
  useEffect(() => {
    onName(name ?? '')
  }, [name, onName])
  const loaded = { agent: working, run: runs, permission: permissions }[kind]
  if (loaded === undefined) return <Loading />
  if (agent)
    return (
      <AgentPage
        module={agent.module}
        agent={agent.agent}
        runs={(runs ?? []).filter(
          (r) => r.moduleId === agent.module.id && r.name === agent.agent.name,
        )}
      />
    )
  if (run) {
    const by = working
      ? findAgent(working, (m, a) => m.id === run.moduleId && a.name === run.name)
      : null
    return <RunPage run={run} agent={by?.agent ?? null} />
  }
  if (permission) return <PermissionPage permission={permission} />
  return (
    <Gone what={{ agent: 'This agent', run: 'This run', permission: 'This permission' }[kind]} />
  )
}

const Loading = () => <p className="p-6 text-ink-3">Loading…</p>
const Gone = ({ what }: { what: string }) => (
  <p className="p-6 text-ink-2">{what} is not there any more.</p>
)

function AgentPage({
  module: m,
  agent: a,
  runs,
}: {
  module: WorkingModuleView
  agent: AgentView
  runs: RunView[]
}) {
  // what changes comes back through the world's next change, which loads the page again
  const { busy, problem, act } = useAct()
  return (
    <Page kind={`Agent in ${m.name}`} title={a.name}>
      {a.description && <p className="text-ink-2 text-md">{a.description}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Switch
          checked={a.state === 'on'}
          label={a.state === 'on' ? `Pause ${a.name}` : `Turn on ${a.name}`}
          disabled={busy}
          onChange={(on) =>
            act(() => api.post(`/api/agents/${a.id}`, { state: on ? 'on' : 'paused' }))
          }
        />
        <span className="text-ink-2 text-md">{a.state === 'on' ? 'On' : 'Paused'}</span>
        <Button
          size="sm"
          disabled={busy || a.running}
          onClick={() => act(() => api.post(`/api/agents/${a.id}/run`))}
        >
          Run now
        </Button>
        {a.running && <Pill tone="accent">Running</Pill>}
        {a.needs && <Pill tone="warn">{a.needs}</Pill>}
        <Refusal words={problem} />
      </div>
      <Facts
        lines={[
          [
            'Module',
            <a key="m" href={`#/module/${m.id}`} className="hover:underline">
              {m.name}
            </a>,
          ],
          [a.state === 'on' ? 'Runs' : 'Would run', a.when],
          ['Last ran', a.lastRunAt ? dayWords(a.lastRunAt) : 'not yet'],
        ]}
      />
      <h2 className="font-medium font-serif text-ink text-xl">Runs</h2>
      {runs.length === 0 ? (
        <p className="text-ink-2 text-md">No runs yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          {runs.map((r) => (
            <RunRow
              key={r.id}
              run={r}
              open={false}
              onOpen={() => {
                window.location.hash = `#/run/${r.id}`
              }}
              onStop={() => act(() => api.post(`/api/runs/${r.id}/stop`))}
            />
          ))}
        </div>
      )}
    </Page>
  )
}

function RunPage({ run, agent }: { run: RunView; agent: AgentView | null }) {
  return (
    <Page kind="Run" title={run.name}>
      <Facts
        lines={[
          ...(agent
            ? ([
                [
                  'Agent',
                  <a key="a" href={`#/agent/${agent.id}`} className="hover:underline">
                    {agent.name}
                  </a>,
                ],
              ] as [string, ReactNode][])
            : []),
          ...(run.module && run.moduleId
            ? ([
                [
                  'Module',
                  <a key="m" href={`#/module/${run.moduleId}`} className="hover:underline">
                    {run.module}
                  </a>,
                ],
              ] as [string, ReactNode][])
            : []),
          ['Started', dayWords(run.startedAt)],
        ]}
      />
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <RunRow
          run={run}
          open
          onOpen={() => undefined}
          onStop={() => void api.post(`/api/runs/${run.id}/stop`)}
        />
      </div>
    </Page>
  )
}

function PermissionPage({ permission: p }: { permission: PermissionView }) {
  const [asking, setAsking] = useState(false)
  const { busy, problem, act } = useAct()
  return (
    <Page kind="Permission" title={p.sentence}>
      <Facts
        lines={[
          ['Given by', `${p.grantedBy}, ${dayWords(p.grantedAt)}`],
          ['Used', p.uses === 1 ? 'once' : `${p.uses} times`],
          ['Last used', p.lastUsedAt ? dayWords(p.lastUsedAt) : 'not yet'],
          ...(p.revokedAt ? ([['Revoked', dayWords(p.revokedAt)]] as [string, ReactNode][]) : []),
        ]}
      />
      {!p.revokedAt && (
        <List>
          <Row
            title="Revoke it"
            sub="Alpha asks you again each time."
            actions={
              <Button size="sm" variant="danger" onClick={() => setAsking(true)}>
                Revoke
              </Button>
            }
          />
        </List>
      )}
      <Confirm
        open={asking}
        title="Revoke this?"
        yes="Revoke it"
        busy={busy}
        onClose={() => setAsking(false)}
        onYes={() =>
          act(() => api.post(`/api/permissions/${p.id}/revoke`)).then(() => setAsking(false))
        }
      >
        Alpha asks you again each time: “{p.sentence}”
      </Confirm>
      <Refusal words={problem} />
    </Page>
  )
}
