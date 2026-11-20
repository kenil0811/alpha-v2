// A screen's own pages: a pill switch in the bar, or, where the screen has no bar of its own (a
// page opened beside), one row of tabs under it as before: every label in full, a table's row
// count beside its name, the chosen tab underlined in the accent; a row too long scrolls sideways,
// never folds a label to an icon or cuts it short.
import type { TableSummary } from '@alpha/core/api'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { TableTab } from '../TableTab.tsx'
import { useBarSlot } from './bar-slot.tsx'
import { cn } from './cn.ts'
import { PillSwitch } from './pill-switch.tsx'

export type Tab = {
  key: string
  href: string
  label: string
  sel: boolean
  icon?: ReactNode | undefined
  count?: number | undefined
  table?: TableSummary | undefined // a table's tab: right-click and double-click rename and arrange it
}

export function Tabs({ label, tabs }: { label: string; tabs: Tab[] }) {
  const bar = useBarSlot()
  if (bar) return createPortal(<PillSwitch label={label} tabs={tabs} />, bar)
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
              className={cn(
                'flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 text-ink-2 text-md hover:text-ink',
                t.sel ? 'border-accent font-medium text-ink' : 'border-transparent',
              )}
            >
              {t.icon && <span className="text-ink-3">{t.icon}</span>}
              {t.label}
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

// A tab that is a table takes its menu and rename; any other is its link as it was.
export function Maybe({ tab, children }: { tab: Tab; children: (on: object) => ReactNode }) {
  return tab.table ? <TableTab table={tab.table}>{children}</TableTab> : <>{children({})}</>
}
