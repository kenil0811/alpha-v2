// A section of a page, as a card: its title, a line on what it is, then its rows. The same card on
// Intelligence, Settings and every record's page (Bridge and Alpha Brain). Serif is kept for page
// and record titles, so a section's title is plain.
import type { ReactNode } from 'react'

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
      <div className="flex flex-col gap-0.5">
        <h2 className="font-medium text-ink text-lg">{title}</h2>
        {about && <p className="text-ink-3 text-sm">{about}</p>}
      </div>
      {children}
    </section>
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
