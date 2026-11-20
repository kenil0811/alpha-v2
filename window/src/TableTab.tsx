// A table's tab in the header, and its row in Setup › Tables, share one menu: a right-click gives
// Rename, Pin to header and Hide from header; a double-click renames in place. A main table's
// place in the bar is the person's own (layout.barHidden, kept by the core per person); a part's or
// a setup table's is the module's own tab flag, the call the table's menu used to make.
import type { TableSummary } from '@alpha/core/api'
import { PanelTop, PanelTopClose, PencilLine } from 'lucide-react'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { api } from './api.ts'
import { useLayout } from './layout.ts'
import { MenuItem, Popover, useContextMenu } from './ui/popover.tsx'
import { Renamable } from './ui/rename.tsx'

// Whether the table is among the header's tabs now.
export const inBar = (t: Pick<TableSummary, 'id' | 'place' | 'tab'>, barHidden: string[]) =>
  t.place === 'main' ? !barHidden.includes(t.id) : t.tab

type On = {
  onContextMenu: (e: MouseEvent) => void
  onKeyDown: (e: KeyboardEvent) => void
  onDoubleClick: () => void
}

export function TableTab({
  table: t,
  extra,
  children,
}: {
  table: TableSummary
  extra?: ((close: () => void) => ReactNode) | undefined // more lines for the header's own tabs
  children: (on: On) => ReactNode
}) {
  const menu = useContextMenu()
  const { layout, change } = useLayout()
  const shown = inBar(t, layout.barHidden)
  const toggle = () => {
    if (t.place === 'main')
      change({
        barHidden: shown ? [...layout.barHidden, t.id] : layout.barHidden.filter((x) => x !== t.id),
      })
    else api.post(`/api/tables/${t.id}/tab`, { tab: !shown }).catch(() => undefined)
  }
  return (
    <Renamable name={t.name} rename={(to) => api.post(`/api/tables/${t.id}/name`, { name: to })}>
      {(start) => (
        <>
          {children({
            ...menu.on,
            onDoubleClick: () => start?.(),
          })}
          <Popover point={menu.point} open={menu.open} onClose={menu.close}>
            <MenuItem
              onClick={() => {
                menu.close()
                start?.()
              }}
            >
              <PencilLine className="size-3.5 text-ink-3" />
              Rename
            </MenuItem>
            <MenuItem
              onClick={() => {
                menu.close()
                toggle()
              }}
            >
              {shown ? (
                <PanelTopClose className="size-3.5 text-ink-3" />
              ) : (
                <PanelTop className="size-3.5 text-ink-3" />
              )}
              {shown ? 'Hide from header' : 'Pin to header'}
            </MenuItem>
            {extra?.(menu.close)}
          </Popover>
        </>
      )}
    </Renamable>
  )
}
