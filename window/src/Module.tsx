// A module's screen (design §14, Ledger; the shape Bridge and Alpha Brain share, 25 Oct): a header
// with a centred pill switch, one tab for the Overview of the modules inside it when it holds any
// (a plain list: each one's name, where it comes from and what goes on in it right now; Kenil,
// 21 Oct), one per page (design §13), one per table, and its Conversation (Home through the
// module's lens). Labels fold to icons when the window is narrow; the switch never wraps. A module
// with a single table shows its name in serif instead. Under a table or a page, as the page
// scrolls: Files, then Intelligence (its agents, notes and recent activity), then Governance (the
// sites its readers may read and what Alpha may do without asking). A module holding others opens
// on its Overview, else on its front page, else its first table.
import type { ModuleView, PermissionView, RunView, TableView as TableData } from '@alpha/core/api'
import {
  Ban,
  Bot,
  Briefcase,
  Building2,
  Check,
  LayoutDashboard,
  LayoutGrid,
  MessageSquare,
  Plus,
  Table2,
  Users,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { startAsk } from './ask.ts'
import { AllAgents, when } from './ModulesAndAgents.tsx'
import { PageView } from './PageView.tsx'
import { InBar } from './Shell.tsx'
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
  | { kind: 'agents' } // the old Agents and notes tab: now below the table, so its address opens the module

export function ModuleScreen({
  moduleId,
  tab: asked,
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
  const tab = asked?.kind === 'agents' ? null : asked
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
    // Network opens on its People
    if (firstTable)
      window.location.replace(m?.name === 'Network' ? '#/people' : `#/table/${firstTable}`)
  }, [firstTable, m?.name])
  const page = current.kind === 'page' ? m?.pages.find((p) => p.name === current.name) : undefined
  const single = !!m && !holds && !m.pages.length && m.tables.length === 1

  const tabs: Tab[] = m
    ? [
        ...(m.name === 'Network' && !m.parent ? peopleTabs(null) : []),
        ...(holds
          ? [
              {
                key: 'overview',
                href: `#/module/${moduleId}/overview`,
                label: 'Overview',
                icon: <LayoutGrid className="size-3.5" />,
                sel: current.kind === 'overview',
              },
            ]
          : []),
        ...m.pages.map((p) => ({
          key: `p:${p.name}`,
          href: `#/module/${moduleId}/page/${p.name}`,
          label: p.title,
          icon: <LayoutDashboard className="size-3.5" />,
          sel: current.kind === 'page' && current.name === p.name,
        })),
        ...m.tables.map((t) => ({
          key: `t:${t.id}`,
          href: `#/table/${t.id}`,
          label: t.name,
          icon: <Table2 className="size-3.5" />,
          sel: current.kind === 'table' && current.id === t.id,
        })),
      ]
    : []
  const talk = (
    <a
      href={`#/module/${moduleId}/conversation`}
      aria-current={current.kind === 'conversation' ? 'page' : undefined}
      title="Conversation"
      aria-label="Conversation"
      className={cn(
        'flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-md',
        current.kind === 'conversation'
          ? 'bg-surface font-medium text-ink shadow-btn'
          : 'text-ink-2 hover:text-ink',
      )}
    >
      <MessageSquare className="size-3.5" />
      <span className="hidden @min-[760px]:inline">Conversation</span>
    </a>
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <InBar>
        {single ? (
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate font-serif text-ink text-xl">{m.name}</h1>
            <div className="flex rounded-full bg-sunk p-0.5">{talk}</div>
          </div>
        ) : (
          <PillSwitch label={m?.name ?? 'Module'} tabs={tabs}>
            {m && talk}
          </PillSwitch>
        )}
      </InBar>
      <div className="min-h-0 flex-1">
        {current.kind === 'overview' ? (
          m && <Overview m={m} />
        ) : current.kind === 'conversation' ? (
          conversation
        ) : (
          // the page scrolls: the table or the page fills the first screen, the sections follow
          <div className="h-full overflow-y-auto">
            <div className="h-full">
              {current.kind === 'page' ? (
                m && page ? (
                  <PageView key={page.name} m={m} page={page} version={version} />
                ) : (
                  <p className="p-7 text-ink-3">{m ? 'That page is not there.' : 'Loading…'}</p>
                )
              ) : current.kind === 'table' && table && table.id === current.id ? (
                renderTable(table)
              ) : (
                <p className="p-7 text-ink-3">Loading…</p>
              )}
            </div>
            {m && <Below m={m} version={version} onChange={load} />}
          </div>
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

// A section card under the table: a small title, a grey line saying what it is, its content.
function Section({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface px-5 py-4">
      <h2 className="font-medium text-ink text-md">{title}</h2>
      <p className="mt-0.5 mb-3 text-ink-3 text-sm">{sub}</p>
      {children}
    </section>
  )
}

function Below({ m, version, onChange }: { m: ModuleView; version: number; onChange: () => void }) {
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

  return (
    <div className="flex max-w-page flex-col gap-4 px-7 pt-2 pb-8">
      <Section title="Files" sub="What was dropped on this module’s rows.">
        <p className="text-ink-2 text-md">
          Files sit on the row they belong to: open a row to see its files, or drop one on it.
        </p>
      </Section>
      <Section
        title="Intelligence"
        sub={`The agents that work on ${m.name}, what Alpha reads first, and what ran lately.`}
      >
        <div className="flex flex-col gap-4">
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
          <div>
            <h3 className="mb-1 font-medium text-ink-2 text-sm">Notes Alpha reads first</h3>
            <div className="text-md">
              <Words text={m.notes.replace(/^# .*\n+/, '') || 'No notes yet.'} />
            </div>
          </div>
          <div>
            <h3 className="mb-1 font-medium text-ink-2 text-sm">Recent activity</h3>
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
                    <span className="w-28 shrink-0 text-ink-3 tabular-nums">
                      {when(r.startedAt)}
                    </span>
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
          </div>
        </div>
      </Section>
      <Section
        title="Governance"
        sub="What Alpha may and may not do here, each with its reason. Anything else that changes your data or reaches someone, it asks you first."
      >
        <Governance m={m} allowed={allowed} />
      </Section>
    </div>
  )
}

export type Tab = { key: string; href: string; label: string; icon: ReactNode; sel: boolean }

// The pill switch in the bar's middle: one tab per page or table, labels folding to icons when the
// bar is narrow; it never wraps.
export function PillSwitch({
  label,
  tabs,
  children,
}: {
  label: string
  tabs: Tab[]
  children?: ReactNode
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex min-w-0 flex-nowrap items-center gap-0.5 overflow-hidden rounded-full bg-sunk p-0.5"
    >
      {tabs.map((t) => (
        <a
          key={t.key}
          role="tab"
          aria-selected={t.sel}
          href={t.href}
          title={t.label}
          className={cn(
            'flex h-7 min-w-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-md',
            t.sel ? 'bg-surface font-medium text-ink shadow-btn' : 'text-ink-2 hover:text-ink',
          )}
        >
          <span className={t.sel ? 'text-accent' : 'text-ink-3'}>{t.icon}</span>
          <span className="hidden truncate @min-[760px]:inline">{t.label}</span>
        </a>
      ))}
      {children}
    </div>
  )
}

// People and Organizations, the first two tabs of Network.
export const peopleTabs = (kind: 'person' | 'company' | null): Tab[] => [
  {
    key: 'people',
    href: '#/people',
    label: 'People',
    icon: <Users className="size-3.5" />,
    sel: kind === 'person',
  },
  {
    key: 'companies',
    href: '#/people?companies',
    label: 'Organizations',
    icon: <Building2 className="size-3.5" />,
    sel: kind === 'company',
  },
]

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
