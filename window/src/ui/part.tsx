// A part of a page like a module's Setup: its title in serif, an ⓘ where that needs saying, a
// button on the title's line, its content; no card around it.
import type { ReactNode } from 'react'
import { Info } from './info.tsx'

// a part's place on the page, for a link to it (a notice's Find it in Setup › Tables)
export const partId = (title: string) => `setup-${title.toLowerCase().replaceAll(' ', '-')}`

// A part of Setup: its title in serif, an ⓘ saying what it is where that needs saying, a button
// at the right of the title's line where the part adds something, its content; no card around it.
export function Part({
  title,
  about,
  action,
  children,
}: {
  title: string
  about?: string
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <section id={partId(title)} className="flex scroll-mt-4 flex-col">
      <div className="mb-2.5 flex items-center gap-1.5">
        <h2 className="font-medium font-serif text-ink text-xl">{title}</h2>
        {about && <Info help={about} />}
        {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
      </div>
      {children}
    </section>
  )
}
