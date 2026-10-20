// A module's screen (design §14, Ledger): its head (the kit it came from, its agents, the sites its
// readers may read) and one row of tabs: its tables with their counts, its Conversation (Home
// through the module's lens) and its Agents and notes. Pages join the tabs when pages come.
import type { ModuleView, TableView as TableData } from '@alpha/core/api'
import { Bot, Briefcase } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { AllAgents, when } from './Kits.tsx'
import { cn } from './ui/cn.ts'
import { List, Row } from './ui/list.tsx'
import { Pill } from './ui/pill.tsx'
import { Switch } from './ui/switch.tsx'
import { Words } from './ui/words.tsx'

export type ModuleTab =
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

  // with no tab named, the first table, else the conversation
  const current: ModuleTab =
    tab ?? (m?.tables[0] ? { kind: 'table', id: m.tables[0].id } : { kind: 'conversation' })
  // the module's own address opens its first table, as that table's address
  const firstTable = !tab ? m?.tables[0]?.id : undefined
  useEffect(() => {
    if (firstTable) window.location.replace(`#/table/${firstTable}`)
  }, [firstTable])

  const on = m?.agents.filter((a) => a.state === 'on').length ?? 0
  const about = m
    ? [
        m.kit ? `From the ${m.kit.name} kit ${m.kit.version}` : 'Made in a conversation',
        m.agents.length ? `${on} agent${on === 1 ? '' : 's'} on` : '',
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
        {current.kind === 'conversation' ? (
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

function AgentsAndNotes({ m, onChange }: { m: ModuleView; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const turn = async (id: string, on: boolean) => {
    setBusy(id)
    await api.post(`/api/agents/${id}`, { state: on ? 'on' : 'paused' }).catch(() => undefined)
    setBusy(null)
    onChange()
  }
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
                  title={a.name}
                  sub={`${a.state === 'on' ? 'Runs' : 'Would run'} ${a.when} · last ran ${when(a.lastRunAt)}`}
                  actions={
                    <>
                      {a.running && <Pill tone="accent">Running</Pill>}
                      <Switch
                        checked={a.state === 'on'}
                        disabled={busy === a.id}
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
