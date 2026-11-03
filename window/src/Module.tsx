// A module's screen (design §14, Ledger; Vikas, 27 Oct): its switch in the middle of the bar, in
// place of its name: Overview first, then the tables pinned to it, lowest on the spine first (a
// deal before its source), then after a rule its pages. People and
// Organizations come first when people live in it. A module opens on its Overview: what waits on
// the person, its main table as a chart, its tables, agents, notes and what Alpha may do. A module
// holding others and no tables of its own lists them instead (a plain list: each one's name, where
// it comes from and what goes on in it right now; Kenil, 21 Oct). Agents and notes keeps the whole
// of each, reached from the Overview's cards.
import type {
  CardView,
  ModuleSummary,
  ModuleView,
  RuleView,
  RunView,
  TableView as TableData,
} from '@alpha/core/api'
import { Ban, Bot, Briefcase, Check, LayoutDashboard, Plus } from 'lucide-react'
import { type HTMLAttributes, type ReactNode, useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { Arranged } from './arrange.tsx'
import { GovernanceSection } from './Governance.tsx'
import { useLayout } from './layout.ts'
import { AllAgents, when } from './ModulesAndAgents.tsx'
import { lowerFirst, Overview, usePins } from './Overview.tsx'
import { PageView } from './PageView.tsx'
import { moduleNumbers, numberTables } from './Parts.tsx'
import { InNav } from './Shell.tsx'
import { dayWords } from './time.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { Confirm } from './ui/dialog.tsx'
import { List, Row, Tile } from './ui/list.tsx'
import { More } from './ui/more.tsx'
import { Pill } from './ui/pill.tsx'
import { PillSwitch, SwitchPill, type Tab } from './ui/pill-switch.tsx'
import { MenuItem, Popover, useContextMenu } from './ui/popover.tsx'
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
  cards,
  conversation,
  renderTable,
}: {
  moduleId: string
  tab: ModuleTab | null
  version: number
  table: TableData | null
  cards: CardView[]
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
  // its main tables whole: the switch's order, the Overview's chart and its agents' groups
  const [main, setMain] = useState<TableData[]>([])
  const mainIds = (m?.tables ?? [])
    .filter((t) => t.place === 'main')
    .map((t) => t.id)
    .join(',')
  useEffect(() => {
    if (version < 0) return
    if (!mainIds) return setMain([])
    Promise.all(mainIds.split(',').map((id) => api.get<TableData>(`/api/tables/${id}`))).then(
      setMain,
      () => setMain([]),
    )
  }, [mainIds, version])
  const { pins } = usePins(m)

  // with no tab named, the Overview, or People in the module people live in, or the one table of
  // a module that has nothing else (Calendar, Documents)
  const holds = (m?.modules.length ?? 0) > 0
  const current: ModuleTab = tab ?? { kind: 'overview' }
  const toPeople = !tab && m && m.id === moduleId && m.people
  const only = m && m.id === moduleId && current.kind === 'overview' ? straight(m) : null
  useEffect(() => {
    if (toPeople) window.location.replace('#/people')
    else if (only) window.location.replace(`#/table/${only}`)
  }, [toPeople, only])
  const page = current.kind === 'page' ? m?.pages.find((p) => p.name === current.name) : undefined

  return (
    <div className="flex h-full min-h-0 flex-col">
      {m && <ModuleSwitch m={m} main={main} pins={pins} current={current} onRenamed={load} />}
      <div className="min-h-0 flex-1">
        {current.kind === 'overview' ? (
          m &&
          (holds && !m.tables.length ? (
            <Inside m={m} />
          ) : (
            <Overview m={m} main={main} cards={cards} version={version} onChange={load} />
          ))
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

// A module with one main table and no pages, people or modules inside opens on that table, no
// Overview (Vikas, 3 Nov: Calendar shows its calendar, Documents its list).
export const straight = (
  m: Pick<ModuleSummary, 'people' | 'pages' | 'tables'> & { modules?: unknown[] },
): string | null => {
  const main = m.tables.filter((t) => t.place === 'main')
  return main.length === 1 && !m.pages.length && !m.people && !m.modules?.length
    ? (main[0]?.id ?? null)
    : null
}

// The switch in the bar: Overview, the pinned tables (main ones lowest on the spine first, then
// any part or setup table pinned), a rule, then the pages; Conversation is in the rail, filtered
// to the module there, never a tab of each module (Vikas, 27 Oct). A table not
// pinned but open shows too, so the person sees where they are.
function ModuleSwitch({
  m,
  main,
  pins,
  current,
  onRenamed,
}: {
  m: ModuleView
  main: TableData[]
  pins: string[]
  current: ModuleTab
  onRenamed: () => void
}) {
  const order = [
    ...lowerFirst(main).map((t) => t.id),
    ...m.tables.map((t) => t.id).filter((id) => !main.some((t) => t.id === id)),
  ]
  const shown = m.tables
    .filter((t) => pins.includes(t.id) || (current.kind === 'table' && current.id === t.id))
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
  // one table and nothing else: the module's name, no switch (Vikas, 3 Nov)
  if (straight(m))
    return (
      <InNav>
        <span className="font-semibold text-base text-ink">{m.name}</span>
      </InNav>
    )
  const overview: Tab = {
    key: 'overview',
    href: `#/module/${m.id}/overview`,
    label: 'Overview',
    sel: current.kind === 'overview',
  }
  // the module people live in (Network): Overview and People only
  const groups: Tab[][] = m.people
    ? [[overview, ...peopleTabs(null)]]
    : [
        [
          overview,
          ...shown.map((t) => ({
            key: t.id,
            href: `#/table/${t.id}`,
            label: t.name,
            count: t.rows,
            sel: current.kind === 'table' && current.id === t.id,
          })),
        ],
        // a page of one row opens from that row, never a tab (Vikas, 3 Nov: the bar is tables)
        m.pages
          .filter((p) => !p.for)
          .map((p) => ({
            key: `p:${p.name}`,
            href: `#/module/${m.id}/page/${p.name}`,
            label: p.title,
            sel: current.kind === 'page' && current.name === p.name,
          })),
      ].filter((g) => g.length)
  return <Tabs m={m} groups={groups} tables={shown.map((t) => t.id)} onRenamed={onRenamed} />
}

// The switch's tabs as the person left them (Vikas, 3 Nov): dragged into an order, Overview or a
// page hidden and shown again, renamed; a table's tab renames the table and hides by unpinning.
// A tab hidden but open still shows, so the person sees where they are.
function Tabs({
  m,
  groups,
  tables,
  onRenamed,
}: {
  m: ModuleView
  groups: Tab[][]
  tables: string[]
  onRenamed: () => void
}) {
  const { layout, change } = useLayout()
  const { pins, toggle } = usePins(m)
  const mine = layout.tabs?.[m.id] ?? { order: [], hidden: [], names: {} }
  const save = (next: Partial<typeof mine>) =>
    change({ tabs: { ...layout.tabs, [m.id]: { ...mine, ...next } } })
  const all = groups.flat()
  const rank = (k: string) => {
    const i = mine.order.indexOf(k)
    return i < 0 ? mine.order.length + all.findIndex((t) => t.key === k) : i
  }
  const tabs = all
    .filter((t) => t.sel || !mine.hidden.includes(t.key))
    .map((t) => ({ ...t, label: mine.names[t.key] ?? t.label }))
    .sort((a, b) => rank(a.key) - rank(b.key))
  // what can come back: a hidden tab, or a main table not pinned
  const back = [
    ...all
      .filter((t) => mine.hidden.includes(t.key))
      .map((t) => ({
        key: t.key,
        label: mine.names[t.key] ?? t.label,
        show: () => save({ hidden: mine.hidden.filter((h) => h !== t.key) }),
      })),
    ...m.tables
      .filter((t) => t.place === 'main' && !pins.includes(t.id) && !tables.includes(t.id))
      .map((t) => ({ key: t.id, label: t.name, show: () => toggle(t.id) })),
  ]
  const [dragging, setDragging] = useState<string | null>(null)
  const drop = (on: string) => {
    if (!dragging || dragging === on) return
    const keys = tabs.map((t) => t.key).filter((k) => k !== dragging)
    keys.splice(keys.indexOf(on), 0, dragging)
    save({ order: keys })
    setDragging(null)
  }
  return (
    <InNav>
      <PillSwitch label={m.name}>
        {tabs.map((t) => (
          <TabPill
            key={t.key}
            tab={t}
            table={tables.includes(t.key)}
            back={back}
            onRename={(name) =>
              tables.includes(t.key)
                ? api.post(`/api/tables/${t.key}/name`, { name }).then(onRenamed)
                : save({ names: { ...mine.names, [t.key]: name } })
            }
            onHide={() =>
              tables.includes(t.key) ? toggle(t.key) : save({ hidden: [...mine.hidden, t.key] })
            }
            drag={{
              draggable: true,
              onDragStart: () => setDragging(t.key),
              onDragEnd: () => setDragging(null),
              onDragOver: (e) => e.preventDefault(),
              onDrop: (e) => {
                e.preventDefault()
                drop(t.key)
              },
            }}
          />
        ))}
      </PillSwitch>
    </InNav>
  )
}

// A tab's pill: a double-click renames it in place (Return keeps it, Escape leaves it); a
// right-click opens Open, Rename…, Hide, and what was hidden to show again, as a module's does
function TabPill({
  tab,
  table,
  back,
  onRename,
  onHide,
  drag,
}: {
  tab: Tab
  table: boolean
  back: { key: string; label: string; show: () => void }[]
  onRename: (name: string) => unknown
  onHide: () => void
  drag: HTMLAttributes<HTMLAnchorElement>
}) {
  const menu = useContextMenu()
  const [naming, setNaming] = useState<string | null>(null)
  const { problem, act } = useAct(() => undefined)
  const save = () => {
    const name = naming?.trim()
    setNaming(null)
    if (name && name !== tab.label) act(async () => onRename(name))
  }
  return (
    <>
      {naming !== null ? (
        <input
          // biome-ignore lint/a11y/noAutofocus: opened by a double-click to type the new name
          autoFocus
          aria-label={`Rename ${tab.label}`}
          value={naming}
          onChange={(e) => setNaming(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') setNaming(null)
          }}
          size={Math.max(6, naming.length)}
          className="h-6.5 shrink-0 rounded-full bg-surface px-3.5 text-ink text-md shadow-btn outline-none ring-2 ring-accent-soft"
        />
      ) : (
        <SwitchPill
          tab={tab}
          {...menu.on}
          {...drag}
          onDoubleClick={(e) => {
            e.preventDefault()
            setNaming(tab.label)
          }}
        />
      )}
      {problem && <Refusal words={problem} />}
      <Popover point={menu.point} open={menu.open} onClose={menu.close}>
        <div role="menu" className="flex min-w-44 flex-col p-1">
          <MenuItem
            onClick={() => {
              menu.close()
              window.location.hash = tab.href
            }}
          >
            Open
          </MenuItem>
          <MenuItem
            onClick={() => {
              menu.close()
              setNaming(tab.label)
            }}
          >
            Rename…
          </MenuItem>
          <MenuItem
            onClick={() => {
              menu.close()
              onHide()
            }}
          >
            {table ? 'Hide from the bar' : 'Hide'}
          </MenuItem>
          {back.length > 0 && (
            <>
              <span className="mx-2 mt-1.5 mb-0.5 text-ink-3 text-xs">Show again</span>
              {back.map((b) => (
                <MenuItem
                  key={b.key}
                  onClick={() => {
                    menu.close()
                    b.show()
                  }}
                >
                  {b.label}
                </MenuItem>
              ))}
            </>
          )}
        </div>
      </Popover>
    </>
  )
}

// A module's own tabs after People and the Overview: its pages, its main tables with their counts
// (a table that is part of a row, or setup, is not a tab: core step 3a), its
// Agents and notes; People's screen shows them too, none chosen.
export const moduleTabs = (
  m: Pick<ModuleView, 'id' | 'pages' | 'tables'>,
  current: ModuleTab | null,
): Tab[] => [
  ...m.pages
    .filter((p) => !p.for)
    .map((p) => ({
      key: `p:${p.name}`,
      href: `#/module/${m.id}/page/${p.name}`,
      label: p.title,
      icon: <LayoutDashboard className="size-3.5" />,
      sel: current?.kind === 'page' && current.name === p.name,
    })),
  ...m.tables
    .filter((t) => t.place === 'main')
    .map((t) => ({
      key: `t:${t.id}`,
      href: `#/table/${t.id}`,
      label: t.name,
      count: t.rows,
      sel: current?.kind === 'table' && current.id === t.id,
    })),
  {
    key: 'agents',
    href: `#/module/${m.id}/agents`,
    label: 'Agents and notes',
    sel: current?.kind === 'agents',
  },
]

// The module people live in: People, Organizations as a switch beside it (Vikas, 3 Nov, back
// after 2 Nov), and the map of where everything is
export const peopleTabs = (kind: 'person' | 'company' | 'map' | null): Tab[] => [
  { key: 'people', href: '#/people', label: 'People', sel: kind === 'person' },
  { key: 'companies', href: '#/people?companies', label: 'Organizations', sel: kind === 'company' },
]

// The modules inside this one, a row each: its name, where it comes from, and what goes on in
// it right now (agents on and running, open tasks); what waits on the person stands out.
function Inside({ m }: { m: ModuleView }) {
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

// The Agents and notes tab, in the module page's order (Vikas, 29 Oct): where the module comes
// from, its agents, Governance (what they can and cannot do), every table numbered, then the notes
// Alpha reads first and what ran lately.
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
  const [number, setNumber] = useState('')
  useEffect(() => {
    if (version < 0) return
    api.get<RunView[]>('/api/activity').then(
      (all) => setRuns(all.filter((r) => r.moduleId === m.id).slice(0, 5)),
      () => setRuns([]),
    )
    api.get<ModuleSummary[]>('/api/modules').then(
      (ms) => setNumber(moduleNumbers(ms).get(m.id) ?? ''),
      () => setNumber(''),
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
        {/* each section a block the person moves and resizes, one arrangement for every module (Vikas, 30 Oct) */}
        <Arranged
          page="module:agents-and-notes"
          start={[['agents'], ['governance'], ['tables'], ['notes'], ['activity']]}
          blocks={[
            {
              key: 'agents',
              name: 'Agents',
              node: (
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
              ),
            },
            {
              key: 'governance',
              name: 'Governance',
              node: <GovernanceSection module={m.id} version={version} />,
            },
            ...(m.tables.length > 0
              ? [
                  {
                    key: 'tables',
                    name: 'Tables',
                    node: (
                      <Section
                        title="Tables"
                        sub={`Every table of ${m.name}, numbered: the tables that are part of a row sit under it.`}
                      >
                        <ul className="flex flex-col">
                          {numberTables(m.tables, number).map(({ table: t, n, depth }) => (
                            <li
                              key={t.id}
                              className="flex gap-3 border-hair border-t py-1.5 text-md first:border-t-0"
                              style={{ paddingLeft: depth * 20 }}
                            >
                              <span className="w-14 shrink-0 text-ink-3 tabular-nums">{n}</span>
                              <a
                                href={`#/table/${t.id}`}
                                className="min-w-0 flex-1 truncate text-ink hover:underline"
                              >
                                {t.name}
                              </a>
                              {t.place === 'setup' && <span className="text-ink-3">Setup</span>}
                              <span className="w-14 text-right text-ink-3 tabular-nums">
                                {t.rows.toLocaleString()}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </Section>
                    ),
                  },
                ]
              : []),
            {
              key: 'notes',
              name: 'Notes',
              node: (
                <Section
                  title="Notes"
                  sub={`What Alpha reads about ${m.name} before it works on it; ask Alpha to change them.`}
                >
                  <div className="text-md">
                    <Words text={m.notes.replace(/^# .*\n+/, '') || 'No notes yet.'} />
                  </div>
                </Section>
              ),
            },
            {
              key: 'activity',
              name: 'Recent activity',
              node: (
                <Section title="Recent activity" sub={`What ran in ${m.name} lately.`}>
                  {runs === null ? (
                    <p className="text-ink-3 text-md">Loading…</p>
                  ) : runs.length === 0 ? null : (
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
                  <a
                    href="#/activity"
                    className="mt-1 inline-block text-accent text-sm hover:underline"
                  >
                    All activity
                  </a>
                </Section>
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}

// The agent page's rule columns (Items.tsx); a module's Governance is GovernanceSection.
export type Rule = { key: string; words: string; why: string; href?: string; rule?: RuleView }

export function why(r: RuleView): string {
  const day = dayWords(r.madeAt)
  const across = r.module ? '' : '; it holds across Alpha'
  if (r.kind === 'inferred') return `Alpha noticed, ${day}; approve or dismiss it`
  if (r.always) return `You said Always on its card, ${day}${across}`
  return `You said, ${day}${across}`
}

// A rule's ⋮: Revoke for yours, after a yes; Approve or Dismiss for what Alpha noticed.
function RuleMenu({ rule: r, onChange }: { rule: RuleView; onChange: () => void }) {
  const [asking, setAsking] = useState(false)
  const { busy, problem, act } = useAct(onChange)
  const noticed = r.kind === 'inferred'
  return (
    <>
      <More label="More">
        {(close) => (
          <>
            {noticed && (
              <MenuItem
                onClick={() => {
                  close()
                  void act(() => api.post(`/api/rules/${r.id}/approve`))
                }}
              >
                Approve
              </MenuItem>
            )}
            <MenuItem
              danger={!noticed}
              onClick={() => {
                close()
                setAsking(true)
              }}
            >
              {noticed ? 'Dismiss' : 'Revoke'}
            </MenuItem>
          </>
        )}
      </More>
      <Confirm
        open={asking}
        title={noticed ? 'Dismiss this?' : 'Revoke this rule?'}
        yes={noticed ? 'Dismiss it' : 'Revoke it'}
        busy={busy}
        onClose={() => setAsking(false)}
        onYes={() => act(() => api.post(`/api/rules/${r.id}/revoke`)).then(() => setAsking(false))}
      >
        “{r.words}” {noticed ? 'Alpha stops following it.' : 'stops holding.'}
        <Refusal words={problem} />
      </Confirm>
    </>
  )
}

export function RuleColumn({
  side,
  rules,
  onAdd,
  onChange,
}: {
  side: 'allowed' | 'denied'
  rules: Rule[]
  onAdd: () => void
  onChange: () => void
}) {
  return (
    <section
      aria-label={side === 'allowed' ? 'Allowed' : 'Denied'}
      className="flex min-w-0 flex-col gap-3"
    >
      <h3 className="flex h-9 items-center gap-1.5 border-line border-b font-medium text-ink text-md">
        {side === 'allowed' ? (
          <Check className="size-3.5 text-good" />
        ) : (
          <Ban className="size-3.5 text-bad" />
        )}
        {side === 'allowed' ? 'Allowed' : 'Denied'}
        <span className="font-normal text-ink-3 tabular-nums">{rules.length}</span>
      </h3>
      {rules.length === 0 ? null : (
        <ul className="flex flex-col gap-2">
          {rules.map((r) => (
            <li key={r.key} className="group/row flex items-start gap-2">
              <span className="flex min-w-0 flex-1 flex-col">
                {r.href ? (
                  <a href={r.href} className="text-ink text-md hover:underline">
                    {r.words}
                  </a>
                ) : (
                  <span className="text-ink text-md">{r.words}</span>
                )}
                <span className="text-ink-3 text-sm">{r.why}</span>
              </span>
              {r.rule && <RuleMenu rule={r.rule} onChange={onChange} />}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={onAdd}
        className="flex h-8 w-fit items-center gap-1.5 rounded-md border border-line border-dashed px-3 text-ink-2 text-md hover:border-accent-line hover:bg-accent-soft hover:text-accent"
      >
        <Plus className="size-3.5" />
        {side === 'allowed' ? 'Add allowed action' : 'Add denied action'}
      </button>
    </section>
  )
}
