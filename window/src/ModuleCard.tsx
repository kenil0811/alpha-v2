// A module as a card (Home's Your modules, a parent module's Overview): its name and where it came
// from, its pages and tables to open, and the modules inside it under it.
import type { PageSummary, TableSummary } from '@alpha/core/api'
import { Briefcase, ChevronRight, LayoutDashboard } from 'lucide-react'
import type { ReactNode } from 'react'

export function ModuleCard({
  id,
  name,
  sub,
  pages = [],
  tables,
  children,
}: {
  id: string
  name: string
  sub: string
  pages?: PageSummary[]
  tables: TableSummary[]
  children?: ReactNode // the modules inside it, as cards
}) {
  const chip =
    'inline-flex h-6.5 items-center gap-1.5 rounded-md border border-line px-2 text-ink-2 text-sm hover:border-accent-line hover:text-ink'
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <a href={`#/module/${id}`} className="flex items-center gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
          <Briefcase className="size-3.75" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-base text-ink">{name}</span>
          <span className="block text-ink-3 text-sm">{sub}</span>
        </span>
        <ChevronRight className="size-4 text-ink-3" />
      </a>
      {pages.length + tables.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 pl-9.5">
          {pages.map((p) => (
            <a key={p.name} href={`#/module/${id}/page/${p.name}`} className={chip}>
              <LayoutDashboard className="size-3.25 text-ink-3" />
              {p.title}
            </a>
          ))}
          {tables.map((t) => (
            <a key={t.id} href={`#/table/${t.id}`} className={chip}>
              {t.name}
              <span className="text-ink-3 tabular-nums">{t.rows}</span>
            </a>
          ))}
        </div>
      )}
      {children && <div className="mt-3 flex flex-col gap-2 pl-9.5">{children}</div>}
    </div>
  )
}
