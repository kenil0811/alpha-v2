// A list: rows in one bordered box, each with what it is, a line under it, and its actions.
import type { ReactNode } from 'react'
import { cn } from './cn.ts'
import { Info } from './info.tsx'

export function List({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-line bg-surface', className)}>
      {children}
    </div>
  )
}

export function Row({
  title,
  about,
  sub,
  lead,
  actions,
  children,
  indent,
  wrap,
  className,
}: {
  title: ReactNode
  about?: string | undefined // what the row means, in an ⓘ beside its title
  sub?: ReactNode | undefined
  lead?: ReactNode | undefined // an icon tile or a time
  actions?: ReactNode | undefined
  children?: ReactNode | undefined // under the row: steps, a form
  indent?: boolean | undefined
  wrap?: boolean | undefined // a title that is a sentence: shown whole, never cut
  className?: string | undefined
}) {
  const name = cn('font-medium text-base text-ink', wrap ? 'break-words' : 'truncate')
  return (
    <div
      className={cn(
        'group/row border-hair border-t first:border-t-0',
        indent && 'bg-canvas',
        className,
      )}
    >
      <div className={cn('flex items-center gap-3 px-4 py-3', indent && 'pl-14')}>
        {lead}
        <div className="min-w-0 flex-1">
          {about ? (
            <div className="flex items-center gap-1.5">
              <div className={cn('min-w-0', name)}>{title}</div>
              <Info help={about} />
            </div>
          ) : (
            <div className={name}>{title}</div>
          )}
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
