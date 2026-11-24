// A table's tab in the header, and its name in Setup › Tables, share one menu: a right-click gives
// Rename, Pin to header and Hide from header; a double-click renames in place. Pin and Hide are the
// person's own for any table, kept by the core per person and module (layout.tabs), so one person's
// click never changes a colleague's header; Keep as a tab, in the table's ⋮, stays what a part or
// setup table shows for everyone.
import type { TableSummary } from '@alpha/core/api'
import { PanelTop, PanelTopClose, PencilLine } from 'lucide-react'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { api } from './api.ts'
import { useLayout } from './layout.ts'
import { partId } from './ModuleSetup.tsx'
import { notify } from './ui/notice.tsx'
import { MenuItem, Popover, useContextMenu } from './ui/popover.tsx'
import { Renamable } from './ui/rename.tsx'
import { inBar, NO_TABS, pinTab } from './ui/tab-order.ts'

type On = {
  onContextMenu: (e: MouseEvent) => void
  onKeyDown: (e: KeyboardEvent) => void
  onDoubleClick: () => void
}

export function TableTab({
  table: t,
  module,
  extra,
  children,
}: {
  table: TableSummary
  module: string // the module whose header it is
  extra?: ((close: () => void) => ReactNode) | undefined // more lines for the header's own tabs
  children: (on: On) => ReactNode
}) {
  const menu = useContextMenu()
  const { layout, change } = useLayout()
  const kept = layout.tabs[module] ?? NO_TABS
  const shown = inBar(t, kept)
  const toggle = () => {
    change({ tabs: { [module]: pinTab(t, kept, !shown) } })
    // a hidden table is not lost: the notice says where it is
    if (shown)
      notify({
        words: `${t.name} is hidden from the header. Find it in`,
        where: {
          label: 'Setup › Tables',
          href: `#/module/${module}/setup`,
          part: partId('Tables'),
        },
      })
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
            {/* People's own columns (one row per person) are never a tab */}
            {t.place !== 'people' && (
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
            )}
            {extra?.(menu.close)}
          </Popover>
        </>
      )}
    </Renamable>
  )
}
