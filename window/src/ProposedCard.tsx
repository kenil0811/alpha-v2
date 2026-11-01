// Tasks an agent proposes (Kenil's plan, 21 Oct): one card with each task as it would be added,
// where it would sit and for whom, each ticked; Add them keeps the ticked ones, Not now none.
// Nothing is kept before the person's yes.
import type { CardView, ProposedView } from '@alpha/core/api'
import { useState } from 'react'
import { api, Problem } from './api.ts'
import { dueWords } from './time.ts'
import { Button } from './ui/button.tsx'
import { Actions, Card } from './ui/card.tsx'
import { cn } from './ui/cn.ts'

export function ProposedCard({ card, proposed }: { card: CardView; proposed: ProposedView }) {
  const [kept, setKept] = useState<Set<number>>(() => new Set(proposed.tasks.map((_, i) => i)))
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const take = async (picked: number[]) => {
    setBusy(true)
    setProblem(null)
    try {
      await api.post(`/api/cards/${card.id}/tasks`, { take: picked })
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That did not go through.')
    } finally {
      setBusy(false)
    }
  }
  const flip = (i: number) =>
    setKept((k) => {
      const next = new Set(k)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  const n = kept.size
  return (
    <Card label={`${proposed.agent} proposes`} waits="Waits for you">
      <div className="font-medium text-ink text-lg">{card.words}</div>
      <div className="overflow-hidden rounded-md border border-line">
        {proposed.tasks.map((t, i) => (
          <label
            key={i}
            className="flex cursor-pointer items-start gap-3 border-hair border-t px-3 py-2 first:border-t-0 hover:bg-hover"
          >
            <input
              type="checkbox"
              checked={kept.has(i)}
              onChange={() => flip(i)}
              className="mt-1 accent-accent"
            />
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  'block font-medium text-base',
                  kept.has(i) ? 'text-ink' : 'text-ink-3 line-through',
                )}
              >
                {t.priority === 'high' && <span className="mr-1.5 text-warn">●</span>}
                {t.title}
              </span>
              <span className="flex flex-wrap gap-x-2 text-ink-3 text-sm">
                <span>{t.place}</span>
                {t.owner !== 'You' && <span>for {t.owner}</span>}
                {t.due && <span>{dueWords(t.due)}</span>}
              </span>
              {t.notes && <span className="block text-ink-2 text-sm">{t.notes}</span>}
            </span>
          </label>
        ))}
      </div>
      {problem && <p className="text-bad text-sm">{problem}</p>}
      <Actions>
        <Button variant="primary" disabled={busy || n === 0} onClick={() => take([...kept])}>
          {n === proposed.tasks.length ? 'Add them' : `Add ${n === 1 ? 'this one' : `these ${n}`}`}
        </Button>
        <Button disabled={busy} onClick={() => take([])}>
          Decline
        </Button>
      </Actions>
    </Card>
  )
}
