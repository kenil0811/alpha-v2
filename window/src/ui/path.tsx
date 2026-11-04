// The whole path to a page, in the bar (Vikas, 2–3 Nov: one path, in one place): each step small
// and opening its place, then where it ends, larger, in serif.
import { ChevronRight } from 'lucide-react'
import { Fragment } from 'react'

export function Path({ parts }: { parts: { label: string; href?: string }[] }) {
  const last = parts.at(-1)?.label ?? ''
  return (
    <nav aria-label="Path" className="flex min-w-0 items-center gap-1.5">
      {parts.slice(0, -1).map((p) => (
        <Fragment key={p.href ?? p.label}>
          {p.href ? (
            <a
              href={p.href}
              className="max-w-48 shrink-0 truncate text-ink-3 text-sm hover:text-ink"
            >
              {p.label}
            </a>
          ) : (
            <span className="max-w-48 shrink-0 truncate text-ink-3 text-sm">{p.label}</span>
          )}
          <ChevronRight className="size-3.25 shrink-0 text-ink-3" />
        </Fragment>
      ))}
      <h1 aria-current="page" className="min-w-0 truncate font-serif text-ink text-xl">
        {last}
      </h1>
    </nav>
  )
}
