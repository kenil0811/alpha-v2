// Cuts of one list: rounded buttons, each with its count, one
// picked: Activity's All and Failed first.
import type { ReactNode } from 'react'
import { cn } from './cn.ts'

export function Cuts({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 flex flex-wrap items-center gap-1.5 border-0 p-0">
      <legend className="sr-only">{label}</legend>
      {children}
    </fieldset>
  )
}

export function Cut({
  on,
  count,
  onClick,
  children,
}: {
  on: boolean
  count?: number | undefined
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'h-7 rounded-full border px-3 text-md transition-colors',
        on
          ? 'border-accent-line bg-accent-soft text-accent'
          : 'border-line bg-surface text-ink-2 hover:border-accent-line hover:text-ink',
      )}
    >
      {children}
      {count !== undefined && <span className="ml-1.5 text-ink-3 tabular-nums">{count}</span>}
    </button>
  )
}
