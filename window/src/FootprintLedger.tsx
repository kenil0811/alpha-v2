// What Alpha read of the owner's footprint (onboarding step 9), in Settings › Governance: per
// source what was read, what was skipped and why, a few of the items, and Forget this source,
// asked first (nothing undoes it).
import type { FootprintSource, FootprintView } from '@alpha/core/api'
import { useState } from 'react'
import { api } from './api.ts'
import { useFootprint } from './Footprint.tsx'
import { Refusal, useAct } from './ui/act.tsx'
import { Button } from './ui/button.tsx'
import { Confirm } from './ui/dialog.tsx'
import { Empty, Section } from './ui/section.tsx'
import { updatedWords } from './ui/update-now.tsx'

const MEMORY = 'Your AI’s memory'

export function FootprintLedger() {
  const { view, setView } = useFootprint()
  const { busy, problem, act } = useAct()
  const [asking, setAsking] = useState<FootprintSource | null>(null)
  if (!view) return null
  const read: FootprintSource[] = [
    ...view.sources.filter((s) => s.read),
    ...(view.memory
      ? [
          {
            id: 'memory',
            title: MEMORY,
            unit: 'facts',
            sub: '',
            count: null,
            needs: null,
            ticked: true,
            read: view.memory,
          },
        ]
      : []),
  ]
  const forget = (s: FootprintSource) =>
    act(() =>
      api.post<FootprintView>('/api/footprint/forget', { source: s.id }).then(setView),
    ).then(() => setAsking(null))
  return (
    <Section
      title="What Alpha read"
      about="What Alpha read of your Mac and accounts while learning your business, only from what you ticked: what it read, what it skipped under your rules, and Forget for each."
    >
      {read.length ? (
        <div className="overflow-hidden rounded-md border border-line">
          {read.map((s) => {
            const r = s.read
            if (!r) return null
            return (
              <div
                key={s.id}
                className="flex items-start gap-3 border-hair border-t px-3 py-2.5 first:border-t-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-base text-ink">{s.title}</span>
                  <span className="block text-ink-2 text-sm">
                    Read {r.read.toLocaleString()} {s.unit}, {updatedWords(r.at)}
                    {r.why ? `; ${r.why}` : ''}
                  </span>
                  {r.items.length > 0 && (
                    <span className="block truncate text-ink-3 text-sm">
                      {r.items.slice(0, 6).join(' · ')}
                    </span>
                  )}
                </span>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setAsking(s)}>
                  Forget this source
                </Button>
              </div>
            )
          })}
        </div>
      ) : (
        <Empty>
          Nothing yet. Alpha reads only what you tick in the Interviewer’s first sitting.
        </Empty>
      )}
      <Refusal words={problem} />
      <Confirm
        open={!!asking}
        title={`Forget ${asking?.title.toLowerCase() ?? ''}?`}
        yes="Forget"
        busy={busy}
        onYes={() => asking && forget(asking)}
        onClose={() => setAsking(null)}
      >
        What Alpha read from it goes, and so do the facts drawn from it you have not confirmed.
        Facts you confirmed are yours and stay. Nothing brings it back but reading it again.
      </Confirm>
    </Section>
  )
}
