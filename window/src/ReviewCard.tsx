// Rows a schedule puts to the person (D7): one card with each row, why it is there and
// the few choices it offers; a choice is theirs on that row, and one button takes the first choice
// for every row not yet decided. The card closes when each row has one. Where the card puts lines
// for How to work, each line can be reworded first (Edit), so what is kept is in their words.
// Each row is the tick, the cross and the chat icon: the chat opens a box whose words go to the
// agent the card is from, the row marked with the middle choice ("Needs edits"); six rows a page
// (Vikas, 23 Nov).
import type { CardView, ReviewView } from '@alpha/core/api'
import { MessageSquareText } from 'lucide-react'
import { useState } from 'react'
import { api, Problem } from './api.ts'
import { Pages } from './table/FootBar.tsx'
import { Button } from './ui/button.tsx'
import { Card } from './ui/card.tsx'
import { Field } from './ui/field.tsx'
import { YesNo } from './ui/yes-no.tsx'

export function ReviewCard({ card, review }: { card: CardView; review: ReviewView }) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [page, setPage] = useState(0)
  const [first, ...others] = review.choices
  // the tick is the first choice, the cross the last; a middle one is what the chat marks
  const no = others.at(-1)
  const middle = others.length > 1 ? others[0] : undefined
  const pages = Math.ceil(review.rows.length / PAGE)
  const at = Math.min(page, Math.max(pages - 1, 0))
  const shown = review.rows.slice(at * PAGE, at * PAGE + PAGE)
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
  // the person's words on a row, to the agent the card is from; the row marked for changes
  const tell = (r: { id: string; name: string }, text: string) =>
    send(async () => {
      await api.post('/api/say', {
        words: `About "${r.name}" (${card.words}): ${text}`,
        agent: card.agent,
      })
      if (middle) await api.post(`/api/cards/${card.id}/rows`, { rows: [r.id], value: middle })
    }).then((ok) => {
      if (!ok) return
      setEditing(null)
    })
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
        {shown.map((r) =>
          editing?.id === r.id ? (
            <form
              key={r.id}
              className="flex flex-col gap-1.5 border-hair border-t px-3 py-2 first:border-t-0"
              onSubmit={(e) => {
                e.preventDefault()
                const text = editing.text.trim()
                if (text) void (review.edits ? reword(r.id, text) : tell(r, text))
              }}
            >
              {!review.edits && (
                <span className="truncate font-medium text-base text-ink">{r.name}</span>
              )}
              <div className="flex items-center gap-2">
                <Field
                  className="min-w-0 flex-1"
                  aria-label={
                    review.edits ? 'The line in your words' : 'What to change, to the agent'
                  }
                  placeholder={
                    review.edits ? undefined : 'What should change? The agent reads this'
                  }
                  autoFocus
                  value={editing.text}
                  onChange={(e) => setEditing({ id: r.id, text: e.target.value })}
                />
                <Button size="sm" type="submit" disabled={busy || !editing.text.trim()}>
                  {review.edits ? 'Save' : 'Send'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
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
                <span className="flex shrink-0 items-center gap-1.5">
                  {first && no ? (
                    <YesNo
                      value={null}
                      yes={say(first)}
                      no={say(no)}
                      disabled={busy}
                      onChange={(a) => choose([r.id], a === 'yes' ? first : no)}
                    />
                  ) : (
                    first && (
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={busy}
                        onClick={() => choose([r.id], first)}
                      >
                        {say(first)}
                      </Button>
                    )
                  )}
                  <button
                    type="button"
                    aria-label={middle ?? 'Edit'}
                    data-tip={middle ?? 'Edit'}
                    disabled={busy}
                    onClick={() => setEditing({ id: r.id, text: review.edits ? r.name : '' })}
                    className="press swell grid size-7 place-items-center rounded-md border border-line bg-surface text-ink-3 hover:border-accent-line hover:bg-accent-soft hover:text-accent disabled:opacity-50"
                  >
                    <MessageSquareText className="size-3.5" />
                  </button>
                </span>
              )}
            </div>
          ),
        )}
      </div>
      {pages > 1 && (
        <div className="flex justify-center text-ink-3 text-xs">
          <Pages at={at} pages={pages} onPage={setPage} />
        </div>
      )}
      {problem && <p className="text-bad text-sm">{problem}</p>}
    </Card>
  )
}

const PAGE = 6 // rows a page (Vikas, 23 Nov)
