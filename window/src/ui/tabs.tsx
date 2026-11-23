// A screen's own pages: a pill switch in the bar, or, where the screen has no bar of its own (a
// page opened beside) or the tabs belong under a record's head, one row of tabs: each label 15
// characters at most, the rest sliding into view under the pointer (ui/fit.tsx), a table's row
// count beside its name, the chosen tab underlined in the accent; a row too long scrolls sideways.
import type { TableSummary } from '@alpha/core/api'
import { type DragEvent, type MouseEvent, type ReactNode, useRef } from 'react'
import { createPortal } from 'react-dom'
import { TableTab } from '../TableTab.tsx'
import { useBarSlot } from './bar-slot.tsx'
import { cn } from './cn.ts'
import { Fit } from './fit.tsx'
import { PillSwitch } from './pill-switch.tsx'
import { Renamable } from './rename.tsx'
import type { TabKeeping } from './tab-order.ts'

export type Tab = {
  key: string
  href: string
  label: string
  sel: boolean
  icon?: ReactNode | undefined
  count?: number | undefined
  table?: TableSummary | undefined // a table's tab: right-click and double-click rename and arrange it
  module?: string | undefined // the module whose header a table's tab is in
  onPick?: (() => void) | undefined // a tab kept on the page, not in the address
  onMenu?: ((at: { x: number; y: number }) => void) | undefined // its right-click: Pin, Unpin
  drag?: boolean // dragged to a new place among the others that drag (onMove)
  rename?: ((to: string) => Promise<unknown>) | undefined // a page's tab: a double-click renames it
}

export function Tabs({
  label,
  tabs,
  keeping,
  under = false,
  onMove,
}: {
  label: string
  tabs: Tab[]
  keeping?: TabKeeping | undefined // a module's own: tabs dragged, hidden, shown again
  under?: boolean // the row under a record's head, even where the screen has a bar
  onMove?: (from: string, to: string) => void // a tab dropped on another's place
}) {
  const bar = useBarSlot()
  const dragged = useRef<string | null>(null)
  if (bar && !under)
    return createPortal(<PillSwitch label={label} tabs={tabs} keeping={keeping} />, bar)
  return (
    <div
      role="tablist"
      aria-label={label}
      className="scroll-quiet flex shrink-0 gap-0.5 overflow-x-auto overflow-y-hidden border-line border-b px-5 pt-1.5"
    >
      {tabs.map((t) => (
        <Maybe key={t.key} tab={t}>
          {(on) => (
            <a
              {...on}
              role="tab"
              aria-selected={t.sel}
              href={t.href}
              {...(onMove && t.drag
                ? {
                    draggable: true,
                    onDragStart: () => {
                      dragged.current = t.key
                    },
                    onDragOver: (e: DragEvent) => {
                      if (dragged.current) e.preventDefault()
                    },
                    onDrop: (e: DragEvent) => {
                      e.preventDefault()
                      const from = dragged.current
                      dragged.current = null
                      if (from && from !== t.key) onMove(from, t.key)
                    },
                  }
                : {})}
              onClick={
                t.onPick
                  ? (e) => {
                      e.preventDefault()
                      t.onPick?.()
                    }
                  : undefined
              }
              {...(t.onMenu
                ? {
                    onContextMenu: (e: MouseEvent) => {
                      e.preventDefault()
                      t.onMenu?.({ x: e.clientX, y: e.clientY })
                    },
                  }
                : {})}
              className={cn(
                'group/fit flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 text-ink-2 text-md hover:text-ink',
                t.sel ? 'border-accent font-medium text-ink' : 'border-transparent',
              )}
            >
              {t.icon && <span className="text-ink-3">{t.icon}</span>}
              <Fit>{t.label}</Fit>
              {t.count !== undefined && (
                <span className="font-normal text-ink-3 text-xs tabular-nums">{t.count}</span>
              )}
            </a>
          )}
        </Maybe>
      ))}
    </div>
  )
}

// A tab that is a table takes its menu and rename; a page's renames by a double-click, as a
// table's does (Vikas, 23 Nov); any other is its link as it was.
export function Maybe({
  tab,
  extra,
  children,
}: {
  tab: Tab
  extra?: ((close: () => void) => ReactNode) | undefined
  children: (on: object) => ReactNode
}) {
  // a fixed tab (People, Setup, a page, Settings' parts) has no menu; the browser's is not offered
  const none = (e: MouseEvent) => e.preventDefault()
  if (tab.table)
    return (
      <TableTab table={tab.table} module={tab.module ?? ''} extra={extra}>
        {children}
      </TableTab>
    )
  if (tab.rename)
    return (
      <Renamable name={tab.label} rename={tab.rename}>
        {(start) => children({ onContextMenu: none, onDoubleClick: () => start?.() })}
      </Renamable>
    )
  return children({ onContextMenu: none })
}
