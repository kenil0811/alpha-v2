// A cut of one list (Vikas, 28 Oct): Today, This week, a saved list, 30 days. Buttons with counts
// under the toolbar, one picked; a module's own pages take the pill switch instead.
import type { ReactNode } from 'react'
import { cn } from './cn.ts'

export const cutClass = (sel: boolean) =>
  cn(
    'h-7 rounded-full border px-3 text-md',
    sel
      ? 'border-accent-line bg-accent-soft text-accent'
      : 'border-line bg-surface text-ink-2 hover:border-accent-line hover:text-ink',
  )

export function Cut({
  sel,
  count,
  onClick,
  children,
}: {
  sel: boolean
  count?: number | undefined
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" aria-pressed={sel} className={cutClass(sel)} onClick={onClick}>
      {children}
      {count !== undefined && <span className="ml-1 text-ink-3 tabular-nums">{count}</span>}
    </button>
  )
}
