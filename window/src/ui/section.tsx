// A section of a page: its title in serif, an ⓘ with what it is, then its rows.
import type { ReactNode } from 'react'
import { Info } from './info.tsx'

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
      <div className="flex items-center gap-1.5">
        <h2 className="font-medium font-serif text-ink text-xl">{title}</h2>
        {about && <Info help={about} />}
      </div>
      {children}
    </section>
  )
}
