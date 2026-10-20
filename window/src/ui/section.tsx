// A section of a page: its title in serif, a line on what it is, then its rows.
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
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <h2 className="font-medium font-serif text-ink text-xl">{title}</h2>
        {about && <p className="text-ink-3 text-sm">{about}</p>}
      </div>
      {children}
    </section>
  )
}
