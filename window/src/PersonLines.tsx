// A person's page's lines: a detail (Email, Phone) and their mail and meetings, newest first,
// each opening its row (out of People.tsx, so it stays under its wall).
import type { PersonView } from '@alpha/core/api'
import { CalendarDays, Mail } from 'lucide-react'
import type { ReactNode } from 'react'

export const date = (at: string) =>
  new Date(at).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(new Date(at).getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  })

export function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-hair border-t px-4 py-2.5 text-md first:border-t-0">
      <span className="w-16 shrink-0 text-ink-3 text-sm">{label}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </div>
  )
}

export function History({ lines }: { lines: PersonView['history'] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      {lines.map((h) => (
        <a
          key={h.href}
          href={h.href}
          className="flex items-center gap-3 border-hair border-t px-4 py-2.5 first:border-t-0 hover:bg-hover"
        >
          <span className="w-16 shrink-0 text-ink-3 text-sm tabular-nums">{date(h.at)}</span>
          {h.channel === 'meeting' ? (
            <CalendarDays className="size-3.5 shrink-0 text-ink-3" />
          ) : (
            <Mail className="size-3.5 shrink-0 text-ink-3" />
          )}
          <span className="min-w-0 flex-1 truncate text-base text-ink">
            {h.about ?? (h.channel === 'meeting' ? 'A meeting' : 'A message')}
          </span>
          {h.by && (
            <span className="shrink-0 text-ink-3 text-sm">
              {h.channel === 'meeting'
                ? h.by === 'you'
                  ? 'You asked'
                  : 'They asked'
                : h.by === 'you'
                  ? 'You wrote'
                  : 'They wrote'}
            </span>
          )}
        </a>
      ))}
    </div>
  )
}
