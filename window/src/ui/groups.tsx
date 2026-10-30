// A titled group on Home and beside the conversation, its lines, and what it says when empty.
import type { ReactNode } from 'react'
import { cn } from './cn.ts'

export function Group({
  id,
  title,
  sub,
  count,
  action,
  children,
}: {
  id?: string
  title: string
  sub?: string | undefined
  count?: number | undefined
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} className="flex scroll-mt-4 flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-ink-2 text-sm">{title}</h2>
          {!!count && (
            <span className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-warn-soft px-1.5 font-semibold text-warn text-xs">
              {count}
            </span>
          )}
          <span className="flex-1" />
          {action}
        </div>
        {sub && <span className="text-ink-3 text-xs">{sub}</span>}
      </div>
      {children}
    </section>
  )
}

export function Line({
  icon,
  head,
  words,
  warn,
  href,
  onClick,
  boxed,
}: {
  icon: ReactNode
  head: string
  words: string
  warn?: boolean | undefined
  href?: string | undefined
  onClick?: (() => void) | undefined
  boxed?: boolean | undefined
}) {
  const className = cn(
    'flex items-start gap-2.5 text-left hover:bg-hover',
    boxed ? 'border-hair border-t px-4 py-2.5 first:border-t-0' : '-mx-2 rounded-md px-2 py-1.5',
  )
  const inside = (
    <>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-ink-3 text-sm">{head}</span>
        <span className={cn('line-clamp-2 text-md', warn ? 'text-warn' : 'text-ink')}>{words}</span>
      </span>
    </>
  )
  return href ? (
    <a href={href} className={className}>
      {inside}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {inside}
    </button>
  )
}

export function Quiet({ children }: { children: ReactNode }) {
  return <p className="text-ink-3 text-md">{children}</p>
}
