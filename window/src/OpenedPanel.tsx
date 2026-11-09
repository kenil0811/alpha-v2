// A task, a run, a person or a row open beside the page (Batch A, pick 2, Kenil's yes 1 Nov), and
// a schedule, a rule and the rows a figure counted (Batch D, 79.6, 79.7): its own page, narrow, in
// the side panel, with Open page to the page itself at the panel's foot (79.10). A link to one of
// them opens it here when the window has room beside the page (room.ts); a ⌘-click, Open page, or
// no room goes to the page, as before. A link inside the panel replaces what it shows (clean base
// step 6); what was clicked to open it stays in sight to its left (79.9).
import type { TableView as TableData } from '@alpha/core/api'
import { useEffect, useState } from 'react'
import { api } from './api.ts'
import { ItemPage } from './Items.tsx'
import { linkBeside, type Opened, pageOf, splitBeside, withBeside } from './opened.ts'
import { People } from './People.tsx'
import { RowPage } from './RowPage.tsx'
import { BarMiddle } from './Shell.tsx'
import { TableView } from './TableView.tsx'
import { Tasks } from './Tasks.tsx'
import { SidePanel } from './ui/side-panel.tsx'

// A click on a link to one of these kinds opens it beside the page, in the address.
export function useOpenBeside(room: boolean): void {
  useEffect(() => {
    if (!room) return
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]')
      const href = a?.getAttribute('href')
      if (!a || !href) return
      const { base } = splitBeside(window.location.hash)
      const opened = linkBeside(href, base)
      if (!opened) return
      e.preventDefault()
      const inside = !!a.closest('[data-beside]')
      window.location.hash = withBeside(base, opened)
      // what was clicked stays in sight, to the left of the panel it opened
      if (!inside) setTimeout(() => a.scrollIntoView({ block: 'nearest', inline: 'nearest' }), 120)
    }
    document.addEventListener('click', click)
    return () => document.removeEventListener('click', click)
  }, [room])
}

export function OpenedPanel({
  opened,
  version,
  width: start,
  onClose,
}: {
  opened: Opened
  version: number
  width: number // where it starts (room.ts besideWidth); the person may drag it
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [width, setWidth] = useState<number | null>(start)
  useEffect(() => setName(''), [opened.kind, opened.id])
  const page =
    opened.kind === 'row' ? (
      <RowPage id={opened.id} version={version} onPlace={(p) => setName(p?.title ?? '')} />
    ) : opened.kind === 'task' ? (
      <Tasks list="open" id={opened.id} version={version} onName={setName} />
    ) : opened.kind === 'run' || opened.kind === 'schedule' || opened.kind === 'rule' ? (
      <ItemPage kind={opened.kind} id={opened.id} version={version} onName={setName} />
    ) : opened.kind === 'rows' ? (
      <RowsBeside id={opened.id} version={version} onName={setName} />
    ) : (
      <People kind="person" id={opened.id} version={version} net={null} onName={setName} />
    )
  return (
    <SidePanel
      title={name || '…'}
      onClose={onClose}
      full={pageOf(opened)}
      width={width}
      onWidth={setWidth}
    >
      {/* the page's switch stays in the window's bar: nothing here reaches it */}
      <BarMiddle value={null}>
        <div key={`${opened.kind}/${opened.id}`} data-beside className="h-full">
          {page}
        </div>
      </BarMiddle>
    </SidePanel>
  )
}

// The rows a figure counted, beside the page: their table, only those rows, with the line that
// says so and Show all (79.7).
function RowsBeside({
  id,
  version,
  onName,
}: {
  id: string // <table>:<row>,<row>
  version: number
  onName: (name: string) => void
}) {
  const [table, rows = ''] = id.split(':')
  const [data, setData] = useState<TableData | null>(null)
  useEffect(() => {
    if (version < 0) return
    api.get<TableData>(`/api/tables/${table}`).then(
      (d) => {
        setData(d)
        onName(d.name)
      },
      () => setData(null),
    )
  }, [table, version, onName])
  if (!data) return null
  return <TableView data={data} only={rows.split(',').filter(Boolean)} />
}
