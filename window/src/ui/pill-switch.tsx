// The pill switch in the bar (Batch E, 66.17, Kenil's look 2 Nov): a screen's own pages (a module's
// tables and pages, Network's People and Organizations, Intelligence's parts, Tasks' lists) as
// pills, every label in full, the chosen one raised; a row too long scrolls sideways. Cuts of one
// list are cut buttons (ui/cut.tsx), never pills. With onPick it switches a card's parts in place
// (a module's Agents, Governance and Tables, Vikas 3 Nov): buttons, no address.
import type { ReactNode } from 'react'
import { cn } from './cn.ts'
import type { Tab } from './tabs.tsx'

type Pill = Omit<Tab, 'href'> & { href?: string }

export function PillSwitch({
  label,
  tabs,
  onPick,
}: {
  label: string
  tabs: Pill[]
  onPick?: (key: string) => void
}) {
  return (
    <nav
      aria-label={label}
      className="scroll-quiet flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-full bg-sunk p-0.75"
    >
      {tabs.map((t) => (
        <SwitchPill key={t.key} tab={t} onPick={onPick} />
      ))}
    </nav>
  )
}

function SwitchPill({
  tab: t,
  onPick,
}: {
  tab: Pill
  onPick: ((key: string) => void) | undefined
}): ReactNode {
  const className = cn(
    'flex h-6.5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-ink-2 text-md hover:text-ink',
    t.sel && 'bg-surface font-medium text-ink shadow-btn',
  )
  const inside = (
    <>
      {t.icon && <span className="text-ink-3">{t.icon}</span>}
      {t.label}
      {t.count !== undefined && (
        <span className="font-normal text-ink-3 text-sm tabular-nums">
          {t.count.toLocaleString()}
        </span>
      )}
    </>
  )
  return onPick ? (
    <button type="button" aria-pressed={t.sel} onClick={() => onPick(t.key)} className={className}>
      {inside}
    </button>
  ) : (
    <a href={t.href} aria-current={t.sel ? 'page' : undefined} className={className}>
      {inside}
    </a>
  )
}
