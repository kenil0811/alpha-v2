// The side list (Batch D, 66.23, Kenil's yes 2 Nov): a list on the left, the chosen one's page on
// the right. Settings' sections first.
import type { ReactNode } from 'react'
import { cn } from './cn.ts'

export function SideList({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <nav aria-label={label} className={cn('flex flex-col gap-px self-start', className)}>
      {children}
    </nav>
  )
}

// One line of it, the chosen one in the accent with its dot.
export function SideItem({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-current={on ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'flex h-7 items-center gap-2 truncate whitespace-nowrap rounded-md px-2.5 text-left text-ink-2 text-md hover:bg-hover hover:text-ink',
        on && 'bg-accent-soft font-medium text-accent hover:bg-accent-soft hover:text-accent',
      )}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', on ? 'bg-accent' : 'bg-transparent')} />
      {children}
    </button>
  )
}
