// A section of a page, as a card: its title, an (i) holding what it is on hover, then its rows. The
// same card on Intelligence, Settings and every record's page. Serif is kept for page and record
// titles, so a section's title is plain.
import { Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn.ts'

export function Section({
  title,
  about,
  children,
}: {
  title: string
  about?: string
  children: ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-surface p-5">
      <Heading title={title} about={about} className="text-lg" />
      {children}
    </section>
  )
}

// A section's title, with its phrase behind an (i) rather than a line under it.
export function Heading({
  title,
  about,
  className,
}: {
  title: string
  about?: string | undefined
  className?: string | undefined
}) {
  return (
    <h2 className={cn('flex items-center gap-1.5 font-medium text-ink', className)}>
      {title}
      {about && (
        <span role="img" title={about} aria-label={about} className="text-ink-3">
          <Info size={14} aria-hidden />
        </span>
      )}
    </h2>
  )
}

// What an empty section shows: a dashed card saying what would be here and how it comes.
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-line border-dashed px-4 py-5 text-center text-ink-3 text-md">
      {children}
    </div>
  )
}
