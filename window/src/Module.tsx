// A module's screen: its name in the bar, then one row of tabs: People and Organizations when
// people live in it (module.yaml's people: true), an Overview of the modules inside it when it
// holds any (a plain list: each one's name, where it comes from and what goes on in it right
// now), its pages with the front one first, its tables with their counts, and Setup, always
// last: its schedules and every table, with the rest about the module on a details page under
// it (ModuleSetup.tsx). Nothing sits under a table or a page. A
// module holding others opens on its Overview, else on its front page, else its first table,
// else its Setup.
import type {
  ModuleSummary,
  ModuleView,
  TableView as TableData,
  TableSummary,
} from '@alpha/core/api'
import { Briefcase, LayoutDashboard } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { api } from './api.ts'
import { useLayout } from './layout.ts'
import { ModuleDetails, ModuleSetup } from './ModuleSetup.tsx'
import { PageView } from './PageView.tsx'
import { List, Row, Tile } from './ui/list.tsx'
import { Pill } from './ui/pill.tsx'
import { arrangeTabs, moveBefore, type TabKeeping } from './ui/tab-order.ts'
import { type Tab, Tabs } from './ui/tabs.tsx'
import { Waiting } from './ui/waiting.tsx'

export type ModuleTab =
  | { kind: 'overview' }
  | { kind: 'page'; name: string }
  | { kind: 'table'; id: string }
  | { kind: 'setup' }
  | { kind: 'details' } // the rest about the module, a page under Setup

export function ModuleScreen({
  moduleId,
  known,
  inside,
  tab,
  version,
  table,
  renderTable,
}: {
  moduleId: string
  known: ModuleSummary | null // what the rail already knows of it, until its own view is here
  inside: number // how many modules sit inside it
  tab: ModuleTab | null
  version: number
  table: TableData | null
  renderTable: (t: TableData, summary: TableSummary | null) => ReactNode
}) {
  const [m, setM] = useState<ModuleView | null>(null)
  const { barHidden } = useLayout().layout
  const load = useCallback(() => {
    api.get<ModuleView>(`/api/modules/${moduleId}`).then(setM, () => setM(null))
  }, [moduleId])
  useEffect(() => {
    if (version >= 0) load()
  }, [load, version])

  // until this module's own view is here (or while the last module's still is), what the rail knows
  // of it draws its tabs, so they never blink as a table loads
  const view = m && m.id === moduleId ? m : null
  const facts = view ?? known
  // with no tab named, the Overview of the modules inside, else the front page, else the first
  // table, else Setup
  const front = facts?.pages.find((p) => p.front)
  const holds = view ? view.modules.length > 0 : inside > 0
  // its main tables are its tabs; a part shows on its row, a setup table on Setup
  const first = facts?.tables.find((t) => t.place === 'main')
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

  const { layout, change } = useLayout()
  const all: Tab[] = facts
    ? [
        ...(facts.people ? peopleTabs(null) : []),
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
        ...moduleTabs(facts, current, barHidden),
      ]
    : []
  // the person's own order and hidden table tabs, kept per person (the layout)
  const order = layout.tabOrder[moduleId] ?? []
  // hidden tabs come from barHidden, which moduleTabs already leaves out; here to show again
  const hidden: Tab[] = (facts?.tables ?? [])
    .filter((t) => t.place === 'main' && barHidden.includes(t.id))
    .map((t) => ({ key: `t:${t.id}`, href: `#/table/${t.id}`, label: t.name, sel: false }))
  const { shown: tabs } = arrangeTabs(all, order)
  const idOf = (key: string) => key.slice(2)
  // every table tab in its order now, hidden ones too
  const ids = arrangeTabs(all, order, [])
    .shown.filter((t) => t.key.startsWith('t:'))
    .map((t) => idOf(t.key))
  const keeping: TabKeeping = {
    hidden,
    move: (key, before) =>
      change({
        tabOrder: {
          ...layout.tabOrder,
          [moduleId]: moveBefore(ids, idOf(key), before === null ? null : idOf(before)),
        },
      }),
    step: (key, by) => {
      const seen = tabs.filter((t) => t.key.startsWith('t:')).map((t) => idOf(t.key))
      const i = seen.indexOf(idOf(key))
      const to = seen[i + by]
      if (to === undefined) return
      // right: before the one after the neighbour, or last
      keeping.move(key, by < 0 ? `t:${to}` : seen[i + 2] === undefined ? null : `t:${seen[i + 2]}`)
    },
    show: (key) => change({ barHidden: barHidden.filter((x) => x !== idOf(key)) }),
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs label={facts?.name ?? 'Module'} tabs={tabs} keeping={keeping} />
      <div className="min-h-0 flex-1">
        {current.kind === 'overview' ? (
          m && <Overview m={m} />
        ) : current.kind === 'page' ? (
          m && page ? (
            <PageView key={page.name} m={m} page={page} version={version} />
          ) : m ? (
            <p className="p-7 text-ink-3">That page is not there.</p>
          ) : (
            <Waiting className="p-7" />
          )
        ) : current.kind === 'setup' ? (
          m && <ModuleSetup m={m} onChange={load} />
        ) : current.kind === 'details' ? (
          m && <ModuleDetails m={m} onChange={load} />
        ) : table && table.id === current.id ? (
          renderTable(table, m?.tables.find((x) => x.id === table.id) ?? null)
        ) : (
          <Waiting className="p-7" />
        )}
      </div>
    </div>
  )
}

// A module's own tabs after People and the Overview: its pages, the front one first, its main
// tables with their counts (a table that is part of a row, or setup, is not a tab), then the
// parts and setup tables kept as tabs, and Setup. People's screen shows them too, none chosen.
export const moduleTabs = (
  m: Pick<ModuleView, 'id' | 'pages' | 'tables'>,
  current: ModuleTab | null,
  hidden: string[] = [], // the tables the person took out of the bar
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
    ...m.tables.filter((t) => t.place === 'main' && !hidden.includes(t.id)),
    ...m.tables.filter((t) => t.place !== 'main' && t.tab),
  ].map((t) => ({
    table: t,
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
    sel: current?.kind === 'setup' || current?.kind === 'details',
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
