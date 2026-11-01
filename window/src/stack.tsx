// Needs you as stacks (Vikas, 29 Oct: "if all these are from a single agent, why don't we make it
// more like a slideshow, so each card is an aggregate of cards"): the cards of one kind in one
// module are one card, "1 of N" with previous and next, and one answer for all of them where the
// cards allow it: a question's shared answer, or a review's choice on every row not yet decided.
// A draft is never sent in bulk: each leaves the Mac on its own yes. A card does not say which
// agent opened it, so a stack is by module and kind.

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { api } from './api.ts'
import type { CardView } from './coming.ts'
import { Refusal, useAct } from './ui/act.tsx'
import { Button, IconButton } from './ui/button.tsx'
import { answerWords } from './vocabulary.ts'

export const kindOf = (c: CardView) =>
  c.draft
    ? 'draft'
    : c.review
      ? `review:${c.review.table}:${c.review.field}:${c.review.choices.join('/')}`
      : c.proposed
        ? 'proposed'
        : c.match
          ? 'match'
          : c.filing
            ? 'filing'
            : c.gate === 'sign_in' || c.site || c.connector
              ? `sign-in:${c.id}` // each sign-in is its own
              : `${c.kind}:${c.gate ?? ''}:${c.options.join('/')}`

// Cards in stacks, in the order the first of each came.
export function stacksOf(cards: CardView[]): CardView[][] {
  const by = new Map<string, CardView[]>()
  for (const c of cards) {
    const k = `${c.module ?? ''}|${kindOf(c)}`
    by.set(k, [...(by.get(k) ?? []), c])
  }
  return [...by.values()]
}

// The one answer a whole stack can take, as buttons: Approve all 4 (Needs you's agent headings
// use it too, Vikas, 30 Oct).
export function bulkOf(cards: CardView[]): { label: string; go: () => Promise<unknown> }[] {
  const first = cards[0]
  if (!first || cards.length < 2) return []
  if (first.review) {
    const open = cards.reduce((n, c) => n + (c.review?.open ?? 0), 0)
    return first.review.choices.map((v) => ({
      label: `${v} all ${open}`,
      go: () =>
        Promise.all(
          cards.map((c) => api.post(`/api/cards/${c.id}/rows`, { rows: 'rest', value: v })),
        ),
    }))
  }
  if (kindOf(first).startsWith(`${first.kind}:`) && first.options.length)
    return first.options.map((o) => ({
      label: `${answerWords(o)} all ${cards.length}`,
      go: () => Promise.all(cards.map((c) => api.post(`/api/cards/${c.id}`, { answer: o }))),
    }))
  return []
}

export function Stack({
  cards,
  render,
  onChange,
}: {
  cards: CardView[]
  render: (c: CardView, head: ReactNode) => ReactNode
  onChange: () => void
}) {
  const [at, setAt] = useState(0)
  const { busy, problem, act } = useAct(onChange)
  const i = Math.min(at, cards.length - 1)
  const card = cards[i]
  if (!card) return null
  const bulk = bulkOf(cards)
  const head =
    cards.length > 1 ? (
      <span className="flex items-center gap-1 text-ink-3 text-sm tabular-nums">
        <IconButton label="Previous" disabled={i === 0} onClick={() => setAt(i - 1)}>
          <ChevronLeft className="size-3.5" />
        </IconButton>
        {i + 1} of {cards.length}
        <IconButton label="Next" disabled={i === cards.length - 1} onClick={() => setAt(i + 1)}>
          <ChevronRight className="size-3.5" />
        </IconButton>
        {bulk.map((b) => (
          <Button
            key={b.label}
            size="sm"
            disabled={busy}
            onClick={() => act(b.go)}
            className="ml-1"
          >
            {b.label}
          </Button>
        ))}
        <Refusal words={problem} />
      </span>
    ) : null
  return render(card, head)
}
