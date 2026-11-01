// What a click opens first (Vikas, 26 and 28 Oct): the side panel, beside the screen and left of
// the assistant, editable there, with a large Open page at its foot to the page itself.
// - A link to an element (a row, agent, run, rule, task or person) opens here wherever it is.
// - On Home and inside the panel, every link does: a module, a table, a list, Activity,
//   Intelligence. The rail still goes to the page.
// - What the panel opens from inside itself is a step further, and Back returns; a link from
//   outside starts afresh. A ⌘-click, Open page, or a link inside [data-page] goes to the page.
import type { TableView as TableData } from '@alpha/core/api'
import { useEffect, useState } from 'react'
import { Activity } from './Activity.tsx'
import { api } from './api.ts'
import { CardPage } from './CardPage.tsx'
import type { CardView, ModuleSummary } from './coming.ts'
import { ItemPage } from './Items.tsx'
import { ModuleScreen, type ModuleTab } from './Module.tsx'
import { People, PersonPage } from './People.tsx'
import { RowPage } from './RowPage.tsx'
import { Settings } from './Settings.tsx'
import { BarMiddle, network } from './Shell.tsx'
import { TableView } from './TableView.tsx'
import { type List, TaskPage, Tasks } from './Tasks.tsx'
import { Back } from './ui/back.tsx'
import { SidePanel } from './ui/side-panel.tsx'

const ELEMENT = /^#\/(row|agent|run|rule|permission|tasks|people|card)\/([\w-]+)$/
// every screen the panel can draw: an element, or a whole screen opened from Home or the panel
const SCREEN =
  /^#\/(?:row|agent|run|rule|permission|tasks|people|card|module|table|activity|intelligence|settings)\b/

// the rows a figure counted (`rowsHref`): a tile's button, a chart's mark, a goal's line open here
// wherever they are, never as a page (Vikas, 30 Oct: "Review listings… takes me to a new page")
const COUNTED = /^#\/table\/[\w-]+\?(?:.*&)?only=/

// a screen that opens something by script, not by a link, opens it here the same way
export const peek = (href: string) =>
  window.dispatchEvent(new CustomEvent('alpha:peek', { detail: href }))

// whether the last press was inside the panel: what it opens by script is then a step further
let fromPanel = false
const press = (e: PointerEvent) => {
  fromPanel = !!(e.target as Element | null)?.closest?.('[data-peek-panel]')
}

export function usePeek() {
  const [trail, setTrail] = useState<string[]>([])
  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]')
      const href = a?.getAttribute('href')
      if (!a || !href || a.closest('[data-page]') || href === '#/module/new') return
      const inPanel = !!a.closest('[data-peek-panel]')
      const wide = inPanel || !!a.closest('[data-peek-all]')
      if (!(ELEMENT.test(href) || COUNTED.test(href) || (wide && SCREEN.test(href)))) return
      e.preventDefault()
      setTrail((t) => (inPanel ? [...t, href] : [href]))
    }
    // the page it opens, or any other place, closes it
    const away = () => setTrail([])
    const asked = (e: Event) => {
      const href = (e as CustomEvent<string>).detail
      setTrail((t) => (fromPanel ? [...t, href] : [href]))
    }
    document.addEventListener('pointerdown', press, true)
    document.addEventListener('click', click)
    window.addEventListener('hashchange', away)
    window.addEventListener('alpha:peek', asked)
    return () => {
      document.removeEventListener('pointerdown', press, true)
      document.removeEventListener('click', click)
      window.removeEventListener('hashchange', away)
      window.removeEventListener('alpha:peek', asked)
    }
  }, [])
  return {
    href: trail.at(-1) ?? null,
    canBack: trail.length > 1,
    back: () => setTrail((t) => t.slice(0, -1)),
    close: () => setTrail([]),
  }
}

export function Peek({
  href,
  canBack,
  onBack,
  onClose,
  version,
  modules,
  cards,
}: {
  href: string
  canBack: boolean
  onBack: () => void
  onClose: () => void
  version: number
  modules: ModuleSummary[]
  cards: CardView[]
}) {
  const [name, setName] = useState('')
  const element = ELEMENT.test(href)
  // an element reads at 480px; a whole screen wants half the window
  const [width, setWidth] = useState<number | null>(null)
  const [bar, setBar] = useState<HTMLElement | null>(null)
  const shown = width ?? (element ? 480 : Math.round(window.innerWidth * 0.42))
  return (
    <SidePanel
      title={name}
      onClose={onClose}
      full={href}
      width={shown}
      onWidth={setWidth}
      lead={canBack && <Back to="the last thing opened here" onClick={onBack} />}
    >
      <div data-peek-panel className="flex h-full min-h-0 flex-col">
        {/* a screen's own switch (a module's pills) draws here, not in the window's bar */}
        <div
          ref={setBar}
          className="flex shrink-0 justify-center border-hair border-b py-2 empty:hidden"
        />
        <BarMiddle value={bar}>
          <div key={href} className="min-h-0 flex-1 overflow-y-auto">
            <Screen
              href={href}
              version={version}
              modules={modules}
              cards={cards}
              onName={setName}
            />
          </div>
        </BarMiddle>
      </div>
    </SidePanel>
  )
}

function Screen({
  href,
  version,
  modules,
  cards,
  onName,
}: {
  href: string
  version: number
  modules: ModuleSummary[]
  cards: CardView[]
  onName: (name: string) => void
}) {
  const [path = '', query = ''] = href.slice(2).split('?')
  const [kind = '', id = '', sub] = path.split('/')
  const q = new URLSearchParams(query)
  const [table, setTable] = useState<TableData | null>(null)
  useEffect(() => {
    if (kind === 'table')
      api.get<TableData>(`/api/tables/${id}`).then(setTable, () => setTable(null))
  }, [kind, id])
  useEffect(() => {
    const m = modules.find((x) => x.id === (kind === 'module' ? id : table?.module.id))
    if (kind === 'module' || kind === 'table') onName(table?.name ?? m?.name ?? '')
    else if (kind === 'activity') onName('Activity')
    else if (kind === 'intelligence') onName('Second Brain')
    else if (kind === 'settings') onName('Settings')
  }, [kind, id, table, modules, onName])

  if (kind === 'row')
    return <RowPage id={id} version={version} onPlace={(p) => onName(p?.title ?? '')} inside />
  if (kind === 'tasks')
    return id ? (
      <TaskPage id={id} version={version} onName={onName} />
    ) : (
      <Tasks
        list={(q.get('list') as List | null) ?? 'today'}
        id={null}
        version={version}
        onName={onName}
        agent={q.get('agent')}
      />
    )
  if (kind === 'people')
    return id ? (
      <PersonPage id={id} version={version} onName={onName} />
    ) : (
      <People
        kind={q.has('companies') ? 'company' : 'person'}
        id={null}
        version={version}
        net={network(modules)}
        onName={onName}
      />
    )
  if (kind === 'card') return <CardPage id={id} version={version} onName={onName} />
  if (kind === 'agent' || kind === 'run' || kind === 'rule' || kind === 'permission')
    return (
      <ItemPage
        kind={kind === 'permission' ? 'rule' : kind}
        id={id}
        version={version}
        onName={onName}
      />
    )
  if (kind === 'activity') return <Activity version={version} />
  if (kind === 'intelligence' || kind === 'settings')
    return <Settings page={kind} tab={id || null} open={null} version={version} />
  if (kind === 'module' || (kind === 'table' && table)) {
    const tab: ModuleTab | null =
      kind === 'table'
        ? { kind: 'table' as const, id }
        : sub === 'overview' || sub === 'agents'
          ? { kind: sub as 'overview' | 'agents' }
          : sub === 'page' && path.split('/')[3]
            ? { kind: 'page' as const, name: path.split('/')[3] ?? '' }
            : null
    return (
      <ModuleScreen
        moduleId={kind === 'module' ? id : (table?.module.id ?? '')}
        tab={tab}
        version={version}
        cards={cards}
        table={table}
        renderTable={(t) => (
          // the rows a figure counted (?only=…&why=…), as the page shows them
          <TableView
            key={t.id}
            data={t}
            row={null}
            only={q.get('only')?.split(',').filter(Boolean) ?? null}
            why={q.get('why')}
            field={null}
            quiet
          />
        )}
        conversation={null}
      />
    )
  }
  return null
}
