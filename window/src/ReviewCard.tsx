// Rows an agent puts to the person (design §12, D7): one card with each row, why it is there and
// the few choices it offers; a choice is theirs on that row, and one button takes the first choice
// for every row not yet decided. The card closes when each row has one.
import type { CardView, ReviewView } from '@alpha/core/api'
import { useState } from 'react'
import { api, Problem } from './api.ts'
import { Button } from './ui/button.tsx'
import { Card } from './ui/card.tsx'
import { cn } from './ui/cn.ts'

export function ReviewCard({ card, review }: { card: CardView; review: ReviewView }) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [first, ...others] = review.choices
  const choose = async (rows: string[] | 'rest', value: string) => {
    setBusy(true)
    setProblem(null)
    try {
      await api.post(`/api/cards/${card.id}/rows`, { rows, value })
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That did not go through.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card label="For you to decide" waits="Needs approval">
      <a href={`#/card/${card.id}`} className="font-medium text-ink text-lg hover:underline">
        {card.words}
      </a>
      <div className="flex flex-wrap items-center gap-2 text-ink-3 text-sm">
        <span>
          {review.open} of {review.rows.length} to decide
        </span>
        {first && review.open > 1 && (
          <Button size="sm" disabled={busy} onClick={() => choose('rest', first)}>
            {first}: all {review.open}
          </Button>
        )}
      </div>
      <div className="overflow-hidden rounded-md border border-line">
        {review.rows.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-3 border-hair border-t px-3 py-2 first:border-t-0"
          >
            <span className="min-w-0 flex-1">
              <a
                href={`#/row/${r.id}`}
                className="block truncate font-medium text-base text-ink hover:underline"
              >
                {r.name}
              </a>
              {r.note && <span className="block truncate text-ink-3 text-sm">{r.note}</span>}
              {r.also && <span className="block truncate text-ink-3 text-xs">{r.also}</span>}
            </span>
            {r.value ? (
              <span className="shrink-0 text-ink-2 text-sm">{r.value}</span>
            ) : (
              <span className="flex shrink-0 gap-1.5">
                {[first, ...others].filter(Boolean).map((c, i) => (
                  <Button
                    key={c}
                    size="sm"
                    variant={i === 0 ? 'primary' : 'default'}
                    disabled={busy}
                    className={cn(i > 0 && 'text-ink-2')}
                    onClick={() => choose([r.id], c as string)}
                  >
                    {c}
                  </Button>
                ))}
              </span>
            )}
          </div>
        ))}
      </div>
      {problem && <p className="text-bad text-sm">{problem}</p>}
    </Card>
  )
}
