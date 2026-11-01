// People or companies that may be one (design §4): found by their names, never merged by code.
// One card per batch, each pair side by side with why Alpha thinks so, Merge or Keep apart; the
// pairs with the same name at the same company can be merged at once. A pair decided never comes
// back, and a merge can be undone from the person's page.
import type { CardView, MatchView, SideView } from '@alpha/core/api'
import { useState } from 'react'
import { api, Problem } from './api.ts'
import { Button } from './ui/button.tsx'
import { Actions, Card } from './ui/card.tsx'

const date = (at: string) =>
  new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

function Side({ s }: { s: SideView }) {
  const reach = [...s.emails, ...s.phones, ...(s.profile ? [s.profile] : [])]
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-md border border-line bg-canvas px-3 py-2">
      <a
        href={`#/people/${s.id}`}
        className="truncate font-medium text-base text-ink hover:underline"
      >
        {s.name}
      </a>
      {s.companies.length > 0 && (
        <span className="truncate text-ink-2 text-sm">{s.companies.join(' · ')}</span>
      )}
      {reach.map((r) => (
        <span key={r} className="truncate text-ink-2 text-sm">
          {r}
        </span>
      ))}
      <span className="truncate text-ink-3 text-sm">
        From {s.from.join(', ') || 'your rows'}
        {s.last ? ` · last ${date(s.last)}` : ''}
      </span>
    </div>
  )
}

const DECIDED: Record<string, string> = {
  merged: 'Merged',
  apart: 'Kept apart',
  withdrawn: 'Settled another way',
}

export function MatchCard({ card, match }: { card: CardView; match: MatchView }) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const act = async (path: string, body?: unknown) => {
    setBusy(true)
    setProblem(null)
    try {
      await api.post(path, body)
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That did not go through.')
    } finally {
      setBusy(false)
    }
  }
  const open = match.pairs.filter((p) => p.state === 'proposed')
  const done = match.pairs.filter((p) => p.state !== 'proposed')
  return (
    <Card label="Maybe the same" waits="Waits for you">
      <div className="font-medium text-ink text-lg">{card.words}</div>
      <div className="text-ink-3 text-sm">
        {open.length} {open.length === 1 ? 'pair' : 'pairs'} to decide. Alpha never merges on a
        guess; a merge can be undone on the person's page.
      </div>
      {match.samePlace > 1 && (
        <div>
          <Button size="sm" disabled={busy} onClick={() => act(`/api/cards/${card.id}/merge-same`)}>
            Merge all {match.samePlace} with the same name and company
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-3">
        {open.map((p) => (
          <div
            key={p.id}
            className="flex flex-col gap-2 border-hair border-t pt-3 first:border-t-0 first:pt-0"
          >
            <div className="text-ink-3 text-sm">They have {p.why}.</div>
            <div className="grid grid-cols-2 gap-2">
              <Side s={p.a} />
              <Side s={p.b} />
            </div>
            <Actions>
              <Button
                size="sm"
                variant="primary"
                disabled={busy}
                onClick={() => act(`/api/people/pairs/${p.id}`, { merge: true })}
              >
                Merge
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => act(`/api/people/pairs/${p.id}`, { merge: false })}
              >
                Keep apart
              </Button>
            </Actions>
          </div>
        ))}
      </div>
      {done.length > 0 && (
        <div className="flex flex-col gap-0.5 text-ink-3 text-sm">
          {done.map((p) => (
            <span key={p.id}>
              {DECIDED[p.state] ?? p.state}: {p.a.name} and {p.b.name}
            </span>
          ))}
        </div>
      )}
      {problem && <p className="text-bad text-sm">{problem}</p>}
    </Card>
  )
}
