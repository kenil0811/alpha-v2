// A module's screen (Ledger): its name in the bar, then one row of tabs: People and
// Organizations when people live in it (module.yaml's people: true), an Overview of the modules
// inside it when it holds any (a plain list: each one's name, where it comes from and what goes on
// in it right now; Kenil, 21 Oct), its pages with the front one first, its tables with
// their counts, and Setup, always last: all the rest about the module (ModuleSetup.tsx). Nothing
// sits under a table or a page (Kenil, 26 Oct). A module holding others opens on its Overview, else
// on its front page, else its first table, else its Setup.
import type { ModuleView, TableView as TableData, TableSummary } from '@alpha/core/api'
import { Briefcase, LayoutDashboard } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { ModuleSetup } from './ModuleSetup.tsx'
import { PageView } from './PageView.tsx'
import { List, Row, Tile } from './ui/list.tsx'
import { Pill } from './ui/pill.tsx'
import { type Tab, Tabs } from './ui/tabs.tsx'

export type ModuleTab =
  | { kind: 'overview' }
  | { kind: 'page'; name: string }
  | { kind: 'table'; id: string }
  | { kind: 'setup' }

export function ModuleScreen({
  moduleId,
  tab,
  version,
  table,
  renderTable,
}: {
  moduleId: string
  tab: ModuleTab | null
  version: number
  table: TableData | null
  renderTable: (t: TableData, summary: TableSummary | null) => ReactNode
}) {
  const [m, setM] = useState<ModuleView | null>(null)
  const load = useCallback(() => {
    api.get<ModuleView>(`/api/modules/${moduleId}`).then(setM, () => setM(null))
  }, [moduleId])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])

  // with no tab named, the Overview of the modules inside, else the front page, else the first
  // table, else Setup
  const front = m?.pages.find((p) => p.front)
  const holds = (m?.modules.length ?? 0) > 0
  // its main tables are its tabs; a part shows on its row, a setup table on Setup
  const first = m?.tables.find((t) => t.place === 'main')
  const current: ModuleTab =
    tab ??
    (holds
      ? { kind: 'overview' }
      : front
        ? { kind: 'page', name: front.name }
        : first
          ? { kind: 'table', id: first.id }
          : { kind: 'setup' })
  // the module's own address opens its first table, as that table's address; only once this
  // module's own data is here (the last module's, still shown, would send it back there)
  const firstTable = !tab && m && m.id === moduleId && !front && !holds ? first?.id : undefined
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
        ) : current.kind === 'setup' ? (
          m && <ModuleSetup m={m} onChange={load} />
        ) : table && table.id === current.id ? (
          renderTable(table, m?.tables.find((x) => x.id === table.id) ?? null)
        ) : (
          <p className="p-7 text-ink-3">Loading…</p>
        )}
      </div>
    </div>
  )
}

// A module's own tabs after People and the Overview: its pages, the front one first, its main
// tables with their counts (a table that is part of a row, or setup, is not a tab: core step 3a),
// then the parts and setup tables kept as tabs (28 Oct), and Setup. People's screen shows them
// too, none chosen.
export const moduleTabs = (
  m: Pick<ModuleView, 'id' | 'pages' | 'tables'>,
  current: ModuleTab | null,
): Tab[] => [
  ...[...m.pages]
    .sort((a, b) => Number(!!b.front) - Number(!!a.front))
    .map((p) => ({
      key: `p:${p.name}`,
      href: `#/module/${m.id}/page/${p.name}`,
      label: p.title,
      icon: <LayoutDashboard className="size-3.5" />,
      sel: current?.kind === 'page' && current.name === p.name,
    })),
  ...[
    ...m.tables.filter((t) => t.place === 'main'),
    ...m.tables.filter((t) => t.place !== 'main' && t.tab),
  ].map((t) => ({
    key: `t:${t.id}`,
    href: `#/table/${t.id}`,
    label: t.name,
    count: t.rows,
    sel: current?.kind === 'table' && current.id === t.id,
  })),
  {
    key: 'setup',
    href: `#/module/${m.id}/setup`,
    label: 'Setup',
    sel: current?.kind === 'setup',
  },
]

// People and Organizations, the first two tabs of the module people live in.
export const peopleTabs = (kind: 'person' | 'company' | null): Tab[] => [
  { key: 'people', href: '#/people', label: 'People', sel: kind === 'person' },
  { key: 'companies', href: '#/people?companies', label: 'Organizations', sel: kind === 'company' },
]

// The modules inside this one, a row each: its name, where it comes from, and what goes on in
// it right now (schedules on and running, open tasks); what waits on the person stands out.
function Overview({ m }: { m: ModuleView }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-page px-7 py-6">
        <List>
          {m.modules.map((c) => {
            const quiet = !c.schedules && !c.running && !c.needs && !c.tasks
            const sub = [
              c.kit ? `From ${c.kit}` : 'Made in a conversation',
              c.schedules
                ? `${c.schedules} schedule${c.schedules === 1 ? '' : 's'} on${c.running ? `, ${c.running} running` : ''}`
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
