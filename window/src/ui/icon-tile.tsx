// A square icon tile (Vikas, 28 Oct): the places pinned atop the rail, and a module's actions atop
// its Overview's standard column (Interview me, Add files, Add a rule). Its name is its tooltip;
// four to a row.
import type { MouseEvent, ReactNode } from 'react'
import { cn } from './cn.ts'

const TILE =
  'relative grid aspect-square place-items-center rounded-lg transition-colors [&_svg]:size-5'

export function IconTiles({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-4 gap-1.5">{children}</div>
}

export function IconTile({
  label,
  href,
  onClick,
  onContextMenu,
  current = false,
  rail = false,
  badge,
  children,
}: {
  label: string
  href?: string
  onClick?: () => void
  onContextMenu?: (e: MouseEvent) => void
  current?: boolean
  rail?: boolean // on the rail's own colours
  badge?: ReactNode
  children: ReactNode
}) {
  const look = cn(
    TILE,
    rail
      ? 'bg-rail-hover text-rail-ink-3 hover:text-rail-ink'
      : 'border border-line bg-surface text-ink-2 shadow-btn hover:border-accent-line hover:text-accent',
    current && 'bg-accent-soft text-accent ring-2 ring-accent-line',
  )
  const inner = (
    <>
      {children}
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
