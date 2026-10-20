// A list: rows in one bordered box, each with what it is, a line under it, and its actions.
import type { ReactNode } from 'react'
import { cn } from './cn.ts'

export function List({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-line bg-surface', className)}>
      {children}
    </div>
  )
}

export function Row({
  title,
  sub,
  lead,
  actions,
  children,
  indent,
  className,
}: {
  title: ReactNode
  sub?: ReactNode | undefined
  lead?: ReactNode | undefined // an icon tile or a time
  actions?: ReactNode | undefined
  children?: ReactNode | undefined // under the row: steps, a form
  indent?: boolean | undefined
  className?: string | undefined
}) {
  return (
    <div className={cn('border-hair border-t first:border-t-0', indent && 'bg-canvas', className)}>
      <div className={cn('flex items-center gap-3 px-4 py-3', indent && 'pl-14')}>
        {lead}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-base text-ink">{title}</div>
          {sub && <div className="text-ink-3 text-sm">{sub}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

// A square tile for a row's icon.
export function Tile({ children }: { children: ReactNode }) {
  return (
    <div className="grid size-8 shrink-0 place-items-center rounded-md bg-sunk text-ink-2">
      {children}
    </div>
  )
}
