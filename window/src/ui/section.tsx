// A section of a page: its title in serif, an ⓘ with what it is, then its rows; no card around it,
// so what it holds (a list, a table) is the only frame (Kenil, 26 Oct: no card inside a card).
import type { ReactNode } from 'react'
import { cn } from './cn.ts'
import { Info } from './info.tsx'

export function Section({
  title,
  about,
  action,
  sticky,
  children,
}: {
  title: string
  about?: string
  action?: ReactNode // on the heading's right: a short list's Add (Batch A, pick 6)
  sticky?: boolean | undefined // a long body: the heading stays in view while it scrolls
  children: ReactNode
}) {
  const head = (
    <div className="flex items-center gap-1.5">
      <h2 className="font-medium font-serif text-ink text-xl">{title}</h2>
      {about && <Info help={about} />}
      {action && <span className="ml-auto">{action}</span>}
    </div>
  )
  return (
    <section className="flex min-w-0 flex-col gap-2.5">
      {sticky ? <StickyHead className="-my-1.5">{head}</StickyHead> : head}
      {children}
    </section>
  )
}

// A heading that stays at the top of the page while the body under it scrolls past (Vikas, 31 Oct),
// on the page's own colour so the rows slip under it; a section's, or a day's in Activity.
export function StickyHead({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('sticky top-0 z-2 bg-canvas py-1.5', className)}>{children}</div>
}

// What an empty section shows: a dashed card saying what would be here and how it comes.
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-line border-dashed px-4 py-5 text-center text-ink-3 text-md">
      {children}
    </div>
  )
}
