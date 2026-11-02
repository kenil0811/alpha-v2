// The pill switch in the bar (Batch E, 66.17, Kenil's look 2 Nov): a screen's own pages (a module's
// tables and pages, Network's People and Organizations, Intelligence's parts, Tasks' lists) as
// pills, every label in full, the chosen one raised; a row too long scrolls sideways. Cuts of one
// list are cut buttons (ui/cut.tsx), never pills.
import type { ReactNode } from 'react'
import { cn } from './cn.ts'
import type { Tab } from './tabs.tsx'

export function PillSwitch({ label, tabs }: { label: string; tabs: Tab[] }) {
  return (
    <nav
      aria-label={label}
      className="scroll-quiet flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-full bg-sunk p-0.75"
    >
      {tabs.map((t) => (
        <SwitchPill key={t.key} tab={t} />
      ))}
    </nav>
  )
}

function SwitchPill({ tab: t }: { tab: Tab }): ReactNode {
  return (
    <a
      href={t.href}
      aria-current={t.sel ? 'page' : undefined}
      className={cn(
        'flex h-6.5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-ink-2 text-md hover:text-ink',
        t.sel && 'bg-surface font-medium text-ink shadow-btn',
      )}
    >
      {t.icon && <span className="text-ink-3">{t.icon}</span>}
      {t.label}
      {t.count !== undefined && (
        <span className="font-normal text-ink-3 text-sm tabular-nums">
          {t.count.toLocaleString()}
        </span>
      )}
    </a>
  )
}
