// A module's screen (design §14, Ledger; the shape Bridge and Alpha Brain share, 25 Oct): a header
// with a centred pill switch, one tab for the Overview of the modules inside it when it holds any
// (a plain list: each one's name, where it comes from and what goes on in it right now; Kenil,
// 21 Oct), one per page (design §13), one per table, and its Conversation (Home through the
// module's lens). Labels fold to icons when the window is narrow; the switch never wraps. A module
// with a single table shows its name in serif instead. Under a table or a page, as the page
// scrolls: Files, then Intelligence, then Governance, as Alpha Brain draws them (see Below). A
// module holding others opens
// on its Overview, else on its front page, else its first table.
import type {
  ModuleSummary,
  ModuleView,
  PermissionView,
  RunView,
  TableView as TableData,
} from '@alpha/core/api'
import {
  Ban,
  Bot,
  Briefcase,
  Check,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Table2,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { AllAgents, when } from './Kits.tsx'
import { PageView } from './PageView.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { cn } from './ui/cn.ts'
import { List, Row, Tile } from './ui/list.tsx'
import { Pill } from './ui/pill.tsx'
import { Segmented } from './ui/segmented.tsx'
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
    if (firstTable) window.location.replace(`#/table/${firstTable}`)
  }, [firstTable])
  const page = current.kind === 'page' ? m?.pages.find((p) => p.name === current.name) : undefined
  const single = !!m && !holds && !m.pages.length && m.tables.length === 1

  const tabs: { key: string; href: string; label: string; icon: ReactNode; sel: boolean }[] = m
    ? [
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
      <header className="@container flex h-13 shrink-0 items-center justify-center border-line border-b px-5">
        {single ? (
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate font-serif text-2xl text-ink">{m.name}</h1>
            <div className="flex rounded-full bg-sunk p-0.5">{talk}</div>
          </div>
        ) : (
          <div
            role="tablist"
            aria-label={m?.name ?? 'Module'}
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
                  t.sel
                    ? 'bg-surface font-medium text-ink shadow-btn'
                    : 'text-ink-2 hover:text-ink',
                )}
              >
                <span className={t.sel ? 'text-accent' : 'text-ink-3'}>{t.icon}</span>
                <span className="hidden truncate @min-[760px]:inline">{t.label}</span>
              </a>
            ))}
            {m && talk}
          </div>
        )}
      </header>
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
              c.kit ? `From the ${c.kit} kit` : 'Made in a conversation',
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

// A section card under the table (Alpha Brain's SectionCard): an icon and a small title, a grey
// line saying what it is, its content.
function Section({
  icon,
  title,
  sub,
  children,
}: {
  icon: ReactNode
  title: string
  sub: string
  children: ReactNode
}) {
  return (
    <section aria-label={title} className="rounded-lg border border-line bg-surface px-5 py-4">
      <h2 className="flex items-center gap-2 font-medium text-ink text-md">
        <span className="text-ink-3">{icon}</span>
        {title}
      </h2>
      <p className="mt-0.5 mb-3 text-ink-3 text-sm">{sub}</p>
      {children}
    </section>
  )
}

// A titled block inside a section card.
function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-medium text-ink-2 text-sm">{title}</h3>
      {children}
    </div>
  )
}

// A rule Alpha keeps here, with its one-sentence reason.
function Rule({ allowed, words, why }: { allowed: boolean; words: string; why: string }) {
  return (
    <Row
      lead={allowed ? <Check className="size-4 text-good" /> : <Ban className="size-4 text-bad" />}
      title={words}
      sub={why}
    />
  )
}

// Under a table or a page, in Alpha Brain's order (its ModuleSections, 9 Oct): Files; then
// Intelligence as tabs (Activity, Agents, Alpha's page, the modules inside); then Governance as
// Allowed and Denied, then what it keeps, where it reads from and where it sits. Only what the
// API serves: Allowed is the standing permissions, Denied the walls the core keeps.
function Below({ m, version, onChange }: { m: ModuleView; version: number; onChange: () => void }) {
  const [runs, setRuns] = useState<RunView[] | null>(null)
  const [allowed, setAllowed] = useState<PermissionView[] | null>(null)
  const [all, setAll] = useState<ModuleSummary[]>([])
  const [intel, setIntel] = useState<'activity' | 'agents' | 'page' | 'inside'>('activity')
  const [side, setSide] = useState<'allowed' | 'denied'>('allowed')
  useEffect(() => {
    if (version < 0) return
    api.get<RunView[]>('/api/activity').then(
      (runs) => setRuns(runs.filter((r) => r.moduleId === m.id)),
      () => setRuns([]),
    )
    api.get<PermissionView[]>('/api/permissions').then(
      (ps) => setAllowed(ps.filter((p) => !p.revokedAt)),
      () => setAllowed([]),
    )
    api.get<ModuleSummary[]>('/api/modules').then(setAll, () => setAll([]))
  }, [m.id, version])
  const { busy, on, problem, act } = useAct(onChange)
  const turn = (id: string, state: boolean) =>
    act(() => api.post(`/api/agents/${id}`, { state: state ? 'on' : 'paused' }), id)
  const parent = all.find((x) => x.id === m.parent)
  const denied = [
    {
      words: 'Change your data or reach someone without your yes',
      why: 'Every write and every message waits on a card until you say yes, unless a standing permission covers it.',
    },
    {
      words: m.sites
        ? `Read sites beyond the ${m.sites} its readers may read`
        : 'Read any site for this module',
      why: 'Its readers reach only the sites the module names; the core refuses the rest.',
    },
  ]

  return (
    <div className="flex max-w-page flex-col gap-4 px-7 pt-2 pb-8">
      <Section
        icon={<FileText className="size-4" />}
        title="Files"
        sub="What was dropped on this module’s rows."
      >
        <p className="text-ink-2 text-md">
          Files sit on the row they belong to: open a row to see its files, or drop one on it.
        </p>
      </Section>
      <Section
        icon={<Sparkles className="size-4" />}
        title="Intelligence"
        sub={`What Alpha does in ${m.name}: what happened, its agents, and what it reads first.`}
      >
        <div className="flex flex-col gap-3">
          <div>
            <Segmented
              label="Intelligence"
              value={intel}
              onChange={setIntel}
              options={[
                { value: 'activity', label: 'Activity' },
                { value: 'agents', label: `Agents · ${m.agents.length}` },
                { value: 'page', label: 'Alpha’s page' },
                ...(m.modules.length
                  ? [{ value: 'inside' as const, label: `Modules inside · ${m.modules.length}` }]
                  : []),
              ]}
            />
          </div>
          {intel === 'activity' ? (
            runs === null ? (
              <p className="text-ink-3 text-md">Loading…</p>
            ) : runs.length === 0 ? (
              <p className="text-ink-3 text-md">Nothing has happened here yet.</p>
            ) : (
              <div className="flex flex-col">
                <List>
                  {runs.slice(0, 10).map((r) => (
                    <Row
                      key={r.id}
                      lead={
                        <span className="w-24 shrink-0 text-ink-3 text-sm tabular-nums">
                          {when(r.startedAt)}
                        </span>
                      }
                      title={r.name}
                      sub={r.words ?? undefined}
                      actions={
                        r.state === 'failed' ? (
                          <Pill tone="bad">Didn’t finish</Pill>
                        ) : r.state === 'running' ? (
                          <Pill tone="accent">Running</Pill>
                        ) : undefined
                      }
                    />
                  ))}
                </List>
                <a
                  href="#/activity"
                  className="mt-2 self-start text-accent text-sm hover:underline"
                >
                  All activity
                </a>
              </div>
            )
          ) : intel === 'agents' ? (
            <div className="flex flex-col gap-2">
              {m.agents.length > 1 && (
                <div className="flex justify-end">
                  <AllAgents moduleId={m.id} agents={m.agents} onChange={onChange} />
                </div>
              )}
              {m.agents.length === 0 ? (
                <p className="text-ink-3 text-md">No agents yet. Ask Alpha to keep one.</p>
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
          ) : intel === 'page' ? (
            <div className="flex flex-col gap-1">
              <p className="text-ink-3 text-sm">
                What Alpha reads about {m.name} before it works on it; ask Alpha to change it.
              </p>
              <div className="rounded-md border border-hair bg-canvas px-4 py-3 text-md">
                <Words text={m.notes.replace(/^# .*\n+/, '') || 'No page yet.'} />
              </div>
            </div>
          ) : (
            <List>
              {m.modules.map((c) => (
                <Row
                  key={c.id}
                  lead={<Briefcase className="size-4 text-ink-3" />}
                  title={
                    <a href={`#/module/${c.id}`} className="hover:underline">
                      {c.name}
                    </a>
                  }
                  sub={`${c.agents} agent${c.agents === 1 ? '' : 's'} on · ${c.tasks} open task${c.tasks === 1 ? '' : 's'}`}
                />
              ))}
            </List>
          )}
        </div>
      </Section>
      <Section
        icon={<ShieldCheck className="size-4" />}
        title="Governance"
        sub="What Alpha may and may not do here, where the data is kept and where it is read from."
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div>
              <Segmented
                label="What Alpha may do here"
                value={side}
                onChange={setSide}
                options={[
                  { value: 'allowed', label: `Allowed · ${allowed?.length ?? 0}` },
                  { value: 'denied', label: `Denied · ${denied.length}` },
                ]}
              />
            </div>
            {side === 'allowed' ? (
              allowed?.length ? (
                <List>
                  {allowed.map((p) => (
                    <Rule
                      key={p.id}
                      allowed
                      words={p.sentence}
                      why={`You said Always allow (${p.grantedBy}, ${when(p.grantedAt)}); it holds across Alpha, and Settings can take it back.`}
                    />
                  ))}
                </List>
              ) : (
                <p className="text-ink-3 text-md">
                  Nothing yet: Alpha asks first. Say Always allow on a card to add one here.
                </p>
              )
            ) : (
              <List>
                {denied.map((d) => (
                  <Rule key={d.words} allowed={false} words={d.words} why={d.why} />
                ))}
              </List>
            )}
          </div>
          <Sub title="What it keeps">
            {m.tables.length ? (
              <List>
                {m.tables.map((t) => (
                  <Row
                    key={t.id}
                    lead={<Table2 className="size-4 text-ink-3" />}
                    title={
                      <a href={`#/table/${t.id}`} className="hover:underline">
                        {t.name}
                      </a>
                    }
                    actions={
                      <span className="text-ink-3 text-sm tabular-nums">
                        {t.rows} row{t.rows === 1 ? '' : 's'}
                      </span>
                    }
                  />
                ))}
              </List>
            ) : (
              <p className="text-ink-3 text-md">Nothing yet.</p>
            )}
          </Sub>
          <Sub title="Where it reads from">
            <p className="text-ink-2 text-md">
              {m.sites
                ? `Its readers may read ${m.sites} site${m.sites === 1 ? '' : 's'}, and no others.`
                : 'It reads no sites; what is here came from you, your files and your connections.'}
            </p>
          </Sub>
          <Sub title="Where it sits">
            <List>
              <Row
                lead={<Briefcase className="size-4 text-ink-3" />}
                title={m.name}
                sub={
                  parent ? (
                    <>
                      Inside{' '}
                      <a href={`#/module/${parent.id}`} className="text-accent hover:underline">
                        {parent.name}
                      </a>
                    </>
                  ) : (
                    'At the top level'
                  )
                }
              />
            </List>
          </Sub>
        </div>
      </Section>
    </div>
  )
}
