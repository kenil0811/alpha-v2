// The list view (Vikas, 28 Oct): a list on the left, the chosen thing's page on the right, as
// Settings has it. Settings, Conversation, Governance and a table's List view all draw it here.
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
    <nav aria-label={label} className={cn('flex flex-col gap-px', className)}>
      {children}
    </nav>
  )
}

// One line, or two when it has a second (the smaller one under it, as on Overview).
export function SideItem({
  sel,
  onClick,
  sub,
  id,
  children,
}: {
  sel: boolean
  onClick: () => void
  sub?: ReactNode
  id?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      id={id}
      aria-current={sel ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'flex min-h-7 shrink-0 items-center gap-2 rounded-md px-2.5 text-left text-ink-2 text-md hover:bg-hover hover:text-ink',
        sub !== undefined && 'py-1.5',
        sel && 'bg-accent-soft font-medium text-accent hover:bg-accent-soft hover:text-accent',
      )}
    >
      <span
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          sub !== undefined && 'mt-2 self-start',
          sel ? 'bg-accent' : 'bg-transparent',
        )}
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate">{children}</span>
        {sub !== undefined && (
          <span className="flex min-w-0 items-center gap-3 font-normal text-ink-3 text-sm">
            {sub}
          </span>
        )}
      </span>
    </button>
  )
}

export function SideHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-2.5 pt-3 pb-1 font-medium text-ink-3 text-sm">
      {children}
    </div>
  )
}
