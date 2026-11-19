// Rows a schedule puts to the person (D7): one card with each row, why it is there and
// the few choices it offers; a choice is theirs on that row, and one button takes the first choice
// for every row not yet decided. The card closes when each row has one. Where the card puts lines
// for How to work, each line can be reworded first (Edit), so what is kept is in their words.
import type { CardView, ReviewView } from '@alpha/core/api'
import { useState } from 'react'
import { api, Problem } from './api.ts'
import { Button } from './ui/button.tsx'
import { Card } from './ui/card.tsx'
import { cn } from './ui/cn.ts'
import { Field } from './ui/field.tsx'

export function ReviewCard({ card, review }: { card: CardView; review: ReviewView }) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [first, ...others] = review.choices
  // a line for How to work is decided in verbs: Keep, Edit, Drop (its row keeps Kept or Dropped)
  const say = (c: string) =>
    review.edits ? (c === first ? 'Keep' : c === others[0] ? 'Drop' : c) : c
  const send = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setProblem(null)
    try {
      await fn()
      return true
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That did not go through.')
      return false
    } finally {
      setBusy(false)
    }
  }
  const choose = (rows: string[] | 'rest', value: string) =>
    send(() => api.post(`/api/cards/${card.id}/rows`, { rows, value }))
  // the person's own wording of a line, kept on its row before they decide it
  const reword = (id: string, text: string) =>
    send(() =>
      api.post(`/api/tables/${review.table}/rows/${id}`, { field: review.edits, value: text }),
    ).then((ok) => ok && setEditing(null))
  return (
    <Card label="For you to decide" waits="Waits for you">
      <div className="font-medium text-ink text-lg">{card.words}</div>
      <div className="flex flex-wrap items-center gap-2 text-ink-3 text-sm">
        <span>
          {review.open} of {review.rows.length} to decide
        </span>
        {first && review.open > 1 && (
          <Button size="sm" disabled={busy} onClick={() => choose('rest', first)}>
            {say(first)}: all {review.open}
          </Button>
        )}
      </div>
      <div className="overflow-hidden rounded-md border border-line">
        {review.rows.map((r) =>
          editing?.id === r.id ? (
            <form
              key={r.id}
              className="flex items-center gap-2 border-hair border-t px-3 py-2 first:border-t-0"
              onSubmit={(e) => {
                e.preventDefault()
                if (editing.text.trim()) void reword(r.id, editing.text.trim())
              }}
            >
              <Field
                className="min-w-0 flex-1"
                aria-label="The line in your words"
                value={editing.text}
                onChange={(e) => setEditing({ id: r.id, text: e.target.value })}
              />
              <Button size="sm" type="submit" disabled={busy || !editing.text.trim()}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </form>
          ) : (
            <div
              key={r.id}
              className="flex items-center gap-3 border-hair border-t px-3 py-2 first:border-t-0"
            >
              <span className="min-w-0 flex-1">
                <a
                  href={`#/table/${review.table}/${r.id}`}
                  className="block truncate font-medium text-base text-ink hover:underline"
                >
                  {r.name}
                </a>
                {r.note && <span className="block truncate text-ink-3 text-sm">{r.note}</span>}
              </span>
              {r.value ? (
                <span className="shrink-0 text-ink-2 text-sm">{r.value}</span>
              ) : (
                <span className="flex shrink-0 gap-1.5">
                  {first && (
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={busy}
                      onClick={() => choose([r.id], first)}
                    >
                      {say(first)}
                    </Button>
                  )}
                  {review.edits && (
                    <Button
                      size="sm"
                      disabled={busy}
                      className="text-ink-2"
                      onClick={() => setEditing({ id: r.id, text: r.name })}
                    >
                      Edit
                    </Button>
                  )}
                  {others.filter(Boolean).map((c) => (
                    <Button
                      key={c}
                      size="sm"
                      disabled={busy}
                      className={cn('text-ink-2')}
                      onClick={() => choose([r.id], c as string)}
                    >
                      {say(c as string)}
                    </Button>
                  ))}
                </span>
              )}
            </div>
          ),
        )}
      </div>
      {problem && <p className="text-bad text-sm">{problem}</p>}
    </Card>
  )
}
