// A module's screen (design §14, Ledger): its name in the bar, then one row of tabs: People and
// Organizations when people live in it (module.yaml's people: true), an Overview of the modules
// inside it when it holds any (a plain list: each one's name, where it comes from and what goes on
// in it right now; Kenil, 21 Oct), its pages (design §13), its tables with their counts, its
// Conversation (Home through the module's lens) and its Agents and notes: its agents, the notes
// Alpha reads first, what ran lately, and what Alpha may do here. Nothing sits under a table or a
// page (Kenil, 26 Oct). A module holding others opens on its Overview, else on its front page,
// else its first table.
import type { ModuleView, PermissionView, RunView, TableView as TableData } from '@alpha/core/api'
import { Ban, Bot, Briefcase, Check, LayoutDashboard, Plus } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { startAsk } from './ask.ts'
import { AllAgents, when } from './ModulesAndAgents.tsx'
import { PageView } from './PageView.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { cn } from './ui/cn.ts'
import { List, Row, Tile } from './ui/list.tsx'
import { Pill } from './ui/pill.tsx'
import { Switch } from './ui/switch.tsx'
import { type Tab, Tabs } from './ui/tabs.tsx'
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
    // the module people live in opens on its People
    if (firstTable) window.location.replace(m?.people ? '#/people' : `#/table/${firstTable}`)
  }, [firstTable, m?.people])
  const page = current.kind === 'page' ? m?.pages.find((p) => p.name === current.name) : undefined

  const tabs: Tab[] = m
    ? [
        ...(m.people ? peopleTabs(null) : []),
        ...(holds
          ? [
              {
                key: 'overview',
                href: `#/module/${moduleId}/overview`,
                label: 'Overview',
                sel: current.kind === 'overview',
              },
            ]
          : []),
        ...moduleTabs(m, current),
      ]
    : []

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs label={m?.name ?? 'Module'} tabs={tabs} />
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
          m && <AgentsAndNotes m={m} version={version} onChange={load} />
        ) : table && table.id === current.id ? (
          renderTable(table)
        ) : (
          <p className="p-7 text-ink-3">Loading…</p>
        )}
      </div>
    </div>
  )
}

// A module's own tabs after People and the Overview: its pages, its tables with their counts, its
// Conversation and its Agents and notes; People's screen shows them too, none chosen.
export const moduleTabs = (
  m: Pick<ModuleView, 'id' | 'pages' | 'tables'>,
  current: ModuleTab | null,
): Tab[] => [
  ...m.pages.map((p) => ({
    key: `p:${p.name}`,
    href: `#/module/${m.id}/page/${p.name}`,
    label: p.title,
    icon: <LayoutDashboard className="size-3.5" />,
    sel: current?.kind === 'page' && current.name === p.name,
  })),
  ...m.tables.map((t) => ({
    key: `t:${t.id}`,
    href: `#/table/${t.id}`,
    label: t.name,
    count: t.rows,
    sel: current?.kind === 'table' && current.id === t.id,
  })),
  {
    key: 'conversation',
    href: `#/module/${m.id}/conversation`,
    label: 'Conversation',
    sel: current?.kind === 'conversation',
  },
  {
    key: 'agents',
    href: `#/module/${m.id}/agents`,
    label: 'Agents and notes',
    sel: current?.kind === 'agents',
  },
]

// People and Organizations, the first two tabs of the module people live in.
export const peopleTabs = (kind: 'person' | 'company' | null): Tab[] => [
  { key: 'people', href: '#/people', label: 'People', sel: kind === 'person' },
  { key: 'companies', href: '#/people?companies', label: 'Organizations', sel: kind === 'company' },
]

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

// A part of the Agents and notes tab: its title in serif, a grey line saying what it is, its
// content; no card around it (Kenil, 26 Oct).
function Section({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <section className="flex flex-col">
      <h2 className="font-medium font-serif text-ink text-xl">{title}</h2>
      <p className="mt-0.5 mb-2.5 text-ink-3 text-sm">{sub}</p>
      {children}
    </section>
  )
}

// The Agents and notes tab: where the module comes from, then its agents, the notes Alpha reads
// first, what ran lately and what Alpha may do here.
function AgentsAndNotes({
  m,
  version,
  onChange,
}: {
  m: ModuleView
  version: number
  onChange: () => void
}) {
  const [runs, setRuns] = useState<RunView[] | null>(null)
  const [allowed, setAllowed] = useState<PermissionView[] | null>(null)
  useEffect(() => {
    if (version < 0) return
    api.get<RunView[]>('/api/activity').then(
      (all) => setRuns(all.filter((r) => r.moduleId === m.id).slice(0, 5)),
      () => setRuns([]),
    )
    api.get<PermissionView[]>('/api/permissions').then(
      (all) => setAllowed(all.filter((p) => !p.revokedAt)),
      () => setAllowed([]),
    )
  }, [m.id, version])
  const { busy, on, problem, act } = useAct(onChange)
  const turn = (id: string, state: boolean) =>
    act(() => api.post(`/api/agents/${id}`, { state: state ? 'on' : 'paused' }), id)
  const running = m.agents.filter((a) => a.state === 'on').length
  const about = [
    m.kit
      ? `From ${m.kit.name}, version ${m.kit.version}`
      : m.modules.length && !m.tables.length
        ? ''
        : 'Made in a conversation',
    m.agents.length ? `${running} agent${running === 1 ? '' : 's'} on` : '',
    m.modules.length ? `${m.modules.length} module${m.modules.length === 1 ? '' : 's'} inside` : '',
    m.sites ? `reads ${m.sites} site${m.sites === 1 ? '' : 's'}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex max-w-page flex-col gap-7 px-7 py-6">
        {about && <p className="text-ink-3 text-sm">{about}</p>}
        <Section title="Agents" sub={`The agents that work on ${m.name}.`}>
          <div className="flex flex-col gap-2">
            {m.agents.length > 1 && (
              <div className="flex justify-end">
                <AllAgents moduleId={m.id} agents={m.agents} onChange={onChange} />
              </div>
            )}
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
          </div>
        </Section>
        <Section
          title="Notes"
          sub={`What Alpha reads about ${m.name} before it works on it; ask Alpha to change them.`}
        >
          <div className="text-md">
            <Words text={m.notes.replace(/^# .*\n+/, '') || 'No notes yet.'} />
          </div>
        </Section>
        <Section title="Recent activity" sub={`What ran in ${m.name} lately.`}>
          {runs === null ? (
            <p className="text-ink-3 text-md">Loading…</p>
          ) : runs.length === 0 ? (
            <p className="text-ink-2 text-md">Nothing has run here yet.</p>
          ) : (
            <ul className="flex flex-col">
              {runs.map((r) => (
                <li
                  key={r.id}
                  className="flex gap-3 border-hair border-t py-1.5 text-md first:border-t-0"
                >
                  <span className="w-28 shrink-0 text-ink-3 tabular-nums">{when(r.startedAt)}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {r.name}
                    {r.words && <span className="text-ink-3"> · {r.words}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <a href="#/activity" className="mt-1 inline-block text-accent text-sm hover:underline">
            All activity
          </a>
        </Section>
        <Section
          title="Governance"
          sub="What Alpha may and may not do here, each with its reason. Anything else that changes your data or reaches someone, it asks you first."
        >
          <Governance m={m} allowed={allowed} />
        </Section>
      </div>
    </div>
  )
}

// Governance's rules under two tabs, Allowed n and Denied n (Alpha Brain §5): each rule a sentence
// opening its page, and + Add starting the assistant with the rule's first words, for the person
// to finish; Alpha keeps it from the conversation.
function Governance({ m, allowed }: { m: ModuleView; allowed: PermissionView[] | null }) {
  const [tab, setTab] = useState<'allowed' | 'denied'>('allowed')
  const may: { key: string; words: string; why: string; href?: string }[] = [
    {
      key: 'sites',
      words: m.sites
        ? `Its readers may read ${m.sites} site${m.sites === 1 ? '' : 's'}, and no others.`
        : 'Its readers read no sites.',
      why: 'The sites were named when the module was made.',
    },
    ...(allowed ?? []).map((p) => ({
      key: p.id,
      words: p.sentence,
      why: `You said Always on its card (${p.grantedBy}); it holds across Alpha.`,
      href: `#/permission/${p.id}`,
    })),
  ]
  const never: typeof may = [] // nothing serves a module's denied rules yet; + Add asks Alpha
  const rules = tab === 'allowed' ? may : never
  const tabClass = (on: boolean) =>
    cn(
      '-mb-px flex h-9 items-center gap-1.5 border-b-2 px-1 text-md',
      on ? 'border-accent font-medium text-ink' : 'border-transparent text-ink-2 hover:text-ink',
    )
  return (
    <div className="flex flex-col gap-3">
      <fieldset
        aria-label="Governance"
        className="m-0 flex min-w-0 gap-4 border-0 border-line border-b p-0"
      >
        <button
          type="button"
          aria-pressed={tab === 'allowed'}
          onClick={() => setTab('allowed')}
          className={tabClass(tab === 'allowed')}
        >
          <Check className="size-3.5 text-good" />
          Allowed <span className="text-ink-3 tabular-nums">{may.length}</span>
        </button>
        <button
          type="button"
          aria-pressed={tab === 'denied'}
          onClick={() => setTab('denied')}
          className={tabClass(tab === 'denied')}
        >
          <Ban className="size-3.5 text-bad" />
          Denied <span className="text-ink-3 tabular-nums">{never.length}</span>
        </button>
      </fieldset>
      {rules.length === 0 ? (
        <p className="text-ink-3 text-md">
          {tab === 'allowed' ? 'Nothing allowed.' : 'Nothing denied.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rules.map((r) => (
            <li key={r.key} className="flex flex-col">
              {r.href ? (
                <a href={r.href} className="text-ink text-md hover:underline">
                  {r.words}
                </a>
              ) : (
                <span className="text-ink text-md">{r.words}</span>
              )}
              <span className="text-ink-3 text-sm">{r.why}</span>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() =>
          startAsk(
            tab === 'allowed'
              ? `From now on, in ${m.name}, you may `
              : `From now on, in ${m.name}, never `,
          )
        }
        className="flex h-8 w-fit items-center gap-1.5 rounded-md border border-line border-dashed px-3 text-ink-2 text-md hover:border-accent-line hover:text-ink"
      >
        <Plus className="size-3.5" />
        {tab === 'allowed' ? 'Add allowed action' : 'Add denied action'}
      </button>
    </div>
  )
}
