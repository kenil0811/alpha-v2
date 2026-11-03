// A square icon tile (Vikas, 28 Oct): the places pinned atop the rail, and a module's actions atop
// its Overview's standard column (Interview me, Add files, Add a rule). Its name is its tooltip,
// or, pinned atop the rail, under its icon (Vikas, 2 Nov); four to a row unless said.
import type { MouseEvent, ReactNode } from 'react'
import { cn } from './cn.ts'

const TILE =
  'relative grid aspect-square place-items-center rounded-lg transition-colors [&_svg]:size-5'

export function IconTiles({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-4 gap-1.5', className)}>{children}</div>
}

export function IconTile({
  label,
  href,
  onClick,
  onContextMenu,
  current = false,
  rail = false,
  named = false,
  badge,
  children,
}: {
  label: string
  href?: string
  onClick?: () => void
  onContextMenu?: (e: MouseEvent) => void
  current?: boolean
  rail?: boolean // on the rail's own colours
  named?: boolean // its name under its icon, in place of only its tooltip
  badge?: ReactNode
  children: ReactNode
}) {
  const look = cn(
    TILE,
    named && 'flex aspect-auto flex-col items-center justify-center gap-1 px-1 py-2',
    rail
      ? 'bg-rail-hover text-rail-ink-3 hover:text-rail-ink'
      : 'border border-line bg-surface text-ink-2 shadow-btn hover:border-accent-line hover:text-accent',
    current && 'bg-accent-soft text-accent ring-2 ring-accent-line',
  )
  const inner = (
    <>
      {children}
      {named && <span className="w-full truncate text-center text-xs leading-none">{label}</span>}
      {badge && <span className="absolute -top-1 -right-1">{badge}</span>}
    </>
  )
  return href ? (
    <a
      href={href}
      aria-label={label}
      data-tip={label}
      aria-current={current ? 'page' : undefined}
      onContextMenu={onContextMenu}
      className={look}
    >
      {inner}
    </a>
  ) : (
    <button
      type="button"
      aria-label={label}
      data-tip={label}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={look}
    >
      {inner}
    </button>
  )
}
