// A module's screen (design §14, Ledger): its head (the kit it came from, its agents, the sites its
// readers may read) and one row of tabs: an Overview of the modules inside it when it holds any
// (a plain list: each one's name, where it comes from and what goes on in it right now; Kenil,
// 21 Oct), its pages (design §13), its tables with their counts, its Conversation (Home through
// the module's lens, with the modules inside it) and its Agents and notes. A module holding
// others opens on its Overview, else on its front page, else its first table.
import type { ModuleView, TableView as TableData } from '@alpha/core/api'
import { Bot, Briefcase, LayoutDashboard } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { AllAgents, when } from './ModulesAndAgents.tsx'
import { PageView } from './PageView.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { cn } from './ui/cn.ts'
import { List, Row, Tile } from './ui/list.tsx'
import { Pill } from './ui/pill.tsx'
import { Switch } from './ui/switch.tsx'
import { Words } from './ui/words.tsx'

export type ModuleTab =
  | { kind: 'overview' }
  | { kind: 'page'; name: string }
  | { kind: 'table'; id: string }
  | { kind: 'conversation' }
  | { kind: 'agents' }

export function ModuleScreen({
  moduleId,
  tab,
  version,
  table,
  conversation,
  renderTable,
}: {
  moduleId: string
  tab: ModuleTab | null
  version: number
  table: TableData | null
  conversation: ReactNode
  renderTable: (t: TableData) => ReactNode
}) {
  const [m, setM] = useState<ModuleView | null>(null)
  const load = useCallback(() => {
    api.get<ModuleView>(`/api/modules/${moduleId}`).then(setM, () => setM(null))
  }, [moduleId])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])

  // with no tab named, the Overview of the modules inside, else the front page, else the first
  // table, else the conversation
  const front = m?.pages.find((p) => p.front)
  const holds = (m?.modules.length ?? 0) > 0
  const current: ModuleTab =
    tab ??
    (holds
      ? { kind: 'overview' }
      : front
        ? { kind: 'page', name: front.name }
        : m?.tables[0]
          ? { kind: 'table', id: m.tables[0].id }
          : { kind: 'conversation' })
  // the module's own address opens its first table, as that table's address; only once this
  // module's own data is here (the last module's, still shown, would send it back there)
  const firstTable =
    !tab && m && m.id === moduleId && !front && !holds ? m.tables[0]?.id : undefined
  useEffect(() => {
    if (firstTable) window.location.replace(`#/table/${firstTable}`)
  }, [firstTable])
  const page = current.kind === 'page' ? m?.pages.find((p) => p.name === current.name) : undefined

  const on = m?.agents.filter((a) => a.state === 'on').length ?? 0
  const about = m
    ? [
        m.kit
          ? `From ${m.kit.name}, version ${m.kit.version}`
          : m.modules.length && !m.tables.length
            ? ''
            : 'Made in a conversation',
        m.agents.length ? `${on} agent${on === 1 ? '' : 's'} on` : '',
        m.modules.length
          ? `${m.modules.length} module${m.modules.length === 1 ? '' : 's'} inside`
          : '',
        m.sites ? `reads ${m.sites} site${m.sites === 1 ? '' : 's'}` : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  const tabClass = (sel: boolean) =>
    cn(
      '-mb-px flex h-9 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 text-ink-2 text-md hover:text-ink',
      sel ? 'border-accent font-medium text-ink' : 'border-transparent',
    )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3.5 px-7 pt-5.5">
        <span className="grid size-9.5 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          <Briefcase className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl text-ink">{m?.name ?? '…'}</h1>
          {about && <p className="mt-0.5 text-ink-3 text-sm">{about}</p>}
        </div>
      </div>
      <div
        role="tablist"
        className="mt-4 flex shrink-0 gap-0.5 overflow-x-auto border-line border-b px-5"
      >
        {holds && (
          <a
            role="tab"
            aria-selected={current.kind === 'overview'}
            href={`#/module/${moduleId}/overview`}
            className={tabClass(current.kind === 'overview')}
          >
            Overview
          </a>
        )}
        {m?.pages.map((p) => (
          <a
            key={p.name}
            role="tab"
            aria-selected={current.kind === 'page' && current.name === p.name}
            href={`#/module/${moduleId}/page/${p.name}`}
            className={tabClass(current.kind === 'page' && current.name === p.name)}
          >
            <LayoutDashboard className="size-3.5 text-ink-3" />
            {p.title}
          </a>
        ))}
        {m?.tables.map((t) => (
          <a
            key={t.id}
            role="tab"
            aria-selected={current.kind === 'table' && current.id === t.id}
            href={`#/table/${t.id}`}
            className={tabClass(current.kind === 'table' && current.id === t.id)}
          >
            {t.name}
            <span className="font-normal text-ink-3 text-xs tabular-nums">{t.rows}</span>
          </a>
        ))}
        <a
          role="tab"
          aria-selected={current.kind === 'conversation'}
          href={`#/module/${moduleId}/conversation`}
          className={tabClass(current.kind === 'conversation')}
        >
          Conversation
        </a>
        <a
          role="tab"
          aria-selected={current.kind === 'agents'}
          href={`#/module/${moduleId}/agents`}
          className={tabClass(current.kind === 'agents')}
        >
          Agents and notes
        </a>
      </div>
      <div className="min-h-0 flex-1">
        {current.kind === 'overview' ? (
          m && <Overview m={m} />
        ) : current.kind === 'page' ? (
          m && page ? (
            <PageView key={page.name} m={m} page={page} version={version} />
          ) : (
            <p className="p-7 text-ink-3">{m ? 'That page is not there.' : 'Loading…'}</p>
          )
        ) : current.kind === 'conversation' ? (
          conversation
        ) : current.kind === 'agents' ? (
          m && <AgentsAndNotes m={m} onChange={load} />
        ) : table && table.id === current.id ? (
          renderTable(table)
        ) : (
          <p className="p-7 text-ink-3">Loading…</p>
        )}
      </div>
    </div>
  )
}

// The modules inside this one, a row each: its name, where it comes from, and what goes on in
// it right now (agents on and running, open tasks); what waits on the person stands out.
function Overview({ m }: { m: ModuleView }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-page px-7 py-6">
        <List>
          {m.modules.map((c) => {
            const quiet = !c.agents && !c.running && !c.needs && !c.tasks
            const sub = [
              c.kit ? `From ${c.kit}` : 'Made in a conversation',
              c.agents
                ? `${c.agents} agent${c.agents === 1 ? '' : 's'} on${c.running ? `, ${c.running} running` : ''}`
                : c.running
                  ? `${c.running} running`
                  : '',
              c.tasks ? `${c.tasks} open task${c.tasks === 1 ? '' : 's'}` : '',
              quiet ? 'Quiet right now' : '',
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <Row
                key={c.id}
                className="relative hover:bg-canvas"
                lead={
                  <Tile>
                    <Briefcase className="size-4" />
                  </Tile>
                }
                title={
                  <a href={`#/module/${c.id}`} className="after:absolute after:inset-0">
                    {c.name}
                  </a>
                }
                sub={sub}
                actions={
                  c.needs > 0 && (
                    <Pill tone="warn">
                      {c.needs} need{c.needs === 1 ? 's' : ''} you
                    </Pill>
                  )
                }
              />
            )
          })}
        </List>
      </div>
    </div>
  )
}

function AgentsAndNotes({ m, onChange }: { m: ModuleView; onChange: () => void }) {
  const { busy, on, problem, act } = useAct(onChange)
  const turn = (id: string, state: boolean) =>
    act(() => api.post(`/api/agents/${id}`, { state: state ? 'on' : 'paused' }), id)
  return (
    <div className="@container h-full overflow-y-auto">
      <div className="grid max-w-page items-start gap-6 px-7 py-6 @min-[960px]:grid-cols-2">
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <h2 className="flex-1 font-medium font-serif text-ink text-xl">Agents</h2>
            {m.agents.length > 1 && (
              <AllAgents moduleId={m.id} agents={m.agents} onChange={onChange} />
            )}
          </div>
          {m.agents.length === 0 ? (
            <p className="text-ink-2 text-md">No agents yet. Ask Alpha to keep one.</p>
          ) : (
            <List>
              {m.agents.map((a) => (
                <Row
                  key={a.id}
                  lead={<Bot className="size-4 text-ink-3" />}
                  title={
                    <a href={`#/agent/${a.id}`} className="hover:underline">
                      {a.name}
                    </a>
                  }
                  sub={`${a.state === 'on' ? 'Runs' : 'Would run'} ${a.when} · last ran ${when(a.lastRunAt)}`}
                  actions={
                    <>
                      {on === a.id && <Refusal words={problem} />}
                      {a.running && <Pill tone="accent">Running</Pill>}
                      <Switch
                        checked={a.state === 'on'}
                        disabled={busy && on === a.id}
                        label={a.state === 'on' ? `Pause ${a.name}` : `Turn on ${a.name}`}
                        onChange={(on) => turn(a.id, on)}
                      />
                    </>
                  }
                />
              ))}
            </List>
          )}
        </section>
        <section className="flex flex-col gap-2.5">
          <h2 className="font-medium font-serif text-ink text-xl">Notes</h2>
          <p className="text-ink-3 text-sm">
            What Alpha reads about {m.name} before it works on it; ask Alpha to change them.
          </p>
          <div className="rounded-lg border border-line bg-surface px-5 py-4 text-md">
            <Words text={m.notes.replace(/^# .*\n+/, '') || 'No notes yet.'} />
          </div>
        </section>
      </div>
    </div>
  )
}
