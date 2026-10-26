// One row of tabs under the bar (design §14, Ledger): every label in full, a table's row count
// beside its name, the chosen tab underlined in the accent; a row too long for the window scrolls
// sideways, never folds a label to an icon or cuts it short.
import type { ReactNode } from 'react'
import { cn } from './cn.ts'

export type Tab = {
  key: string
  href: string
  label: string
  sel: boolean
  icon?: ReactNode | undefined
  count?: number | undefined
}

export function Tabs({ label, tabs }: { label: string; tabs: Tab[] }) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex shrink-0 gap-0.5 overflow-x-auto border-line border-b px-5 pt-1.5"
    >
      {tabs.map((t) => (
        <a
          key={t.key}
          role="tab"
          aria-selected={t.sel}
          href={t.href}
          className={cn(
            '-mb-px flex h-9 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 text-ink-2 text-md hover:text-ink',
            t.sel ? 'border-accent font-medium text-ink' : 'border-transparent',
          )}
        >
          {t.icon && <span className="text-ink-3">{t.icon}</span>}
          {t.label}
          {t.count !== undefined && (
            <span className="font-normal text-ink-3 text-xs tabular-nums">{t.count}</span>
          )}
        </a>
      ))}
    </div>
  )
}
