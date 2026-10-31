// The pill switch in the bar (Vikas, 26 and 28 Oct): one per screen, for pages that each hold their
// own data (a module's tables and pages, Network's People and Organizations, Intelligence's parts).
// Cuts of one list are buttons under the toolbar (ui/cut.tsx), never pills.
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn.ts'

export type Tab = {
  key: string
  href: string
  label: string
  sel: boolean
  icon?: ReactNode | undefined
  count?: number | undefined
}

export function PillSwitch({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav
      aria-label={label}
      className="scroll-quiet flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-full bg-sunk p-0.75"
    >
      {children}
    </nav>
  )
}

export function SwitchPill({ tab: t, ...rest }: { tab: Tab } & HTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={t.href}
      aria-current={t.sel ? 'page' : undefined}
      {...rest}
      className={cn(
        'flex h-6.5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-ink-2 text-md hover:text-ink',
        t.sel && 'bg-surface font-medium text-ink shadow-btn',
      )}
    >
      {t.label}
      {t.count !== undefined && (
        <span className="font-normal text-ink-3 text-sm tabular-nums">
          {t.count.toLocaleString()}
        </span>
      )}
    </a>
  )
}
