// A record's page, the same for a person, an organization, a task, an agent, a run and a permission
// (Vikas, 25 Oct): the bar holds the way back, and the page is one centred column, a small
// line naming what the record is, its serif title, then its sections as cards. A row's page puts
// its whole path in the bar instead, and has no line of its own (Vikas, 2–3 Nov).
import type { ReactNode } from 'react'
import { InBar } from './Shell.tsx'

export function Record({
  kind,
  bar,
  children,
}: {
  kind?: string | undefined
  bar?: ReactNode // what the bar shows in its middle; nothing, as the title is on the page
  children: ReactNode
}) {
  return (
    <div className="h-full overflow-y-auto">
      <InBar>{bar ?? <span />}</InBar>
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-8 pt-7 pb-12">
        {kind && <p className="-mb-4 text-ink-3 text-sm">{kind}</p>}
        {children}
      </div>
    </div>
  )
}
