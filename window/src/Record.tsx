// A record's page, the same for a person, an organization, a task, an agent, a run and a permission
// (Bridge and Alpha Brain): the bar holds the way back, and the page is one centred column, a small
// line naming what the record is, its serif title, then its sections as cards.
import type { ReactNode } from 'react'
import { InBar } from './Shell.tsx'

export function Record({ kind, children }: { kind: string; children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      {/* the title is on the page, so the bar does not repeat it */}
      <InBar>
        <span />
      </InBar>
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-8 pt-7 pb-12">
        <p className="-mb-4 text-ink-3 text-sm">{kind}</p>
        {children}
      </div>
    </div>
  )
}
