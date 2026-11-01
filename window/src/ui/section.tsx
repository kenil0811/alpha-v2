// A section of a page: its title in serif, one size below the page's title (Vikas, 1 Nov: the
// section heading was as big as the page's), an ⓘ with what it is, then its rows; no card around it,
// so what it holds (a list, a table) is the only frame (Kenil, 26 Oct: no card inside a card).
import type { ReactNode } from 'react'
import { Info } from './info.tsx'

export function Section({
  title,
  about,
  small,
  children,
}: {
  title: string
  about?: string
  small?: boolean | undefined // inside a card: its head the size of the card's (Agents)
  children: ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col gap-2.5">
      <div data-head className="flex items-center gap-1.5">
        <h2
          className={
            small ? 'font-semibold text-base text-ink' : 'font-medium font-serif text-ink text-xl'
          }
        >
          {title}
        </h2>
        {about && <Info help={about} />}
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
