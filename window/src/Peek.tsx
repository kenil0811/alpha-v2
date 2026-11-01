// What a click opens first (Vikas, 26 and 28 Oct): the side panel, beside the screen and left of
// the assistant, editable there, with a large Open page at its foot to the page itself.
// - A link to a record (a row, a person, a task, an agent, a run or a rule) opens here wherever it is.
// - A link to the rows a figure counted (#/table/<id>?only=…) opens them here, never as a page.
// - What the panel opens from inside itself is a step further, and Back returns; a link from
//   outside starts afresh. A ⌘-click, Open page, or a link inside [data-page] goes to the page.
import type { ModuleSummary, TableView as TableData } from '@alpha/core/api'
import { useEffect, useState } from 'react'
import { api } from './api.ts'
import { ItemPage } from './Items.tsx'
import { ModuleScreen } from './Module.tsx'
import { People } from './People.tsx'
import { RowPage } from './RowPage.tsx'
import { BarMiddle, network } from './Shell.tsx'
import { TableView } from './TableView.tsx'
import { Tasks } from './Tasks.tsx'
import { Back } from './ui/back.tsx'
import { SidePanel } from './ui/side-panel.tsx'

const ELEMENT = /^#\/(row|agent|run|rule|permission|tasks|people)\/([\w-]+)$/
const COUNTED = /^#\/table\/[\w-]+\?(?:.*&)?only=/

export const opensBeside = (href: string) => ELEMENT.test(href) || COUNTED.test(href)

export function usePeek() {
  const [trail, setTrail] = useState<string[]>([])
  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]')
      const href = a?.getAttribute('href')
      if (!a || !href || a.closest('[data-page]') || !opensBeside(href)) return
      e.preventDefault()
      const inPanel = !!a.closest('[data-peek-panel]')
      setTrail((t) => (inPanel ? [...t, href] : [href]))
    }
    // the page it opens, or any other place, closes it
    const away = () => setTrail([])
    document.addEventListener('click', click)
    window.addEventListener('hashchange', away)
    return () => {
      document.removeEventListener('click', click)
      window.removeEventListener('hashchange', away)
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
}: {
  href: string
  canBack: boolean
  onBack: () => void
  onClose: () => void
  version: number
  modules: ModuleSummary[]
}) {
  const [name, setName] = useState('')
  // a record reads at 480px; counted rows want more of the window
  const [width, setWidth] = useState<number | null>(null)
  const [bar, setBar] = useState<HTMLElement | null>(null)
  const shown = width ?? (ELEMENT.test(href) ? 480 : Math.round(window.innerWidth * 0.42))
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
        {/* a screen's own switch draws here, not in the window's bar */}
        <div
          ref={setBar}
          className="flex shrink-0 justify-center border-hair border-b py-2 empty:hidden"
        />
        <BarMiddle value={bar}>
          <div key={href} className="min-h-0 flex-1 overflow-y-auto">
            <Screen href={href} version={version} modules={modules} onName={setName} />
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
  onName,
}: {
  href: string
  version: number
  modules: ModuleSummary[]
  onName: (name: string) => void
}) {
  const [path = '', query = ''] = href.slice(2).split('?')
  const [kind = '', id = ''] = path.split('/')
  const [table, setTable] = useState<TableData | null>(null)
  useEffect(() => {
    if (kind !== 'table') return
    api.get<TableData>(`/api/tables/${id}`).then(
      (t) => {
        setTable(t)
        onName(t.name)
      },
      () => setTable(null),
    )
  }, [kind, id, onName])

  if (kind === 'row')
    return <RowPage id={id} version={version} onPlace={(p) => onName(p?.title ?? '')} />
  if (kind === 'tasks') return <Tasks list="today" id={id} version={version} onName={onName} />
  if (kind === 'people')
    return <People kind="person" id={id} version={version} net={network(modules)} onName={onName} />
  if (kind === 'agent' || kind === 'run' || kind === 'rule' || kind === 'permission')
    return (
      <ItemPage
        kind={kind === 'permission' ? 'rule' : kind}
        id={id}
        version={version}
        onName={onName}
      />
    )
  if (kind === 'table' && table)
    return (
      <ModuleScreen
        moduleId={table.module.id}
        tab={{ kind: 'table', id }}
        version={version}
        table={table}
        renderTable={(t) => (
          <TableView
            key={t.id}
            data={t}
            row={null}
            only={new URLSearchParams(query).get('only')?.split(',').filter(Boolean) ?? null}
            field={null}
            quiet
          />
        )}
        conversation={null}
      />
    )
  return null
}
