// An agent's draft on its card (design §7, §12): the whole email, which the person can change
// before Send it; Not now asks why, from a few reasons the agent sees on its next run. After three
// unchanged sends of its kind the card offers Always, confirmed in a second step here.
import type { CardView, DraftView } from '@alpha/core/api'
import { TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { api, Problem } from './api.ts'
import { Button } from './ui/button.tsx'
import { Card } from './ui/card.tsx'
import { Field } from './ui/field.tsx'

export function DraftCard({ card, draft }: { card: CardView; draft: DraftView }) {
  const [to, setTo] = useState(draft.message.to)
  const [subject, setSubject] = useState(draft.message.subject)
  const [body, setBody] = useState(draft.message.body)
  const [holding, setHolding] = useState(false)
  const [reason, setReason] = useState('')
  const [words, setWords] = useState('')
  const [always, setAlways] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const changed =
    to.trim() !== draft.message.to.trim() ||
    subject.trim() !== draft.message.subject.trim() ||
    body.trim() !== draft.message.body.trim()

  const act = async (path: string, payload: unknown) => {
    setBusy(true)
    try {
      await api.post(`/api/cards/${card.id}/${path}`, payload)
    } catch (err) {
      setProblem(err instanceof Problem ? err.message : 'That did not go through.')
      setBusy(false)
    }
  }
  const message = changed
    ? { to, subject, body, ...(draft.message.cc ? { cc: draft.message.cc } : {}) }
    : null

  return (
    <Card label="Leaves your world" waits="Waits for you">
      <div className="font-medium text-ink text-lg">{card.words}</div>
      <div className="text-ink-3 text-sm">
        {draft.agent}'s {draft.kind}
        {draft.about && (
          <>
            {' for '}
            <a
              className="text-ink-2 hover:underline"
              href={`#/table/${draft.about.table}?only=${draft.about.row}`}
            >
              {draft.about.name}
            </a>
          </>
        )}
        {draft.note ? ` · ${draft.note}` : ''}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-ink-3 text-sm">
          <span className="w-14 shrink-0">To</span>
          <Field
            aria-label="To"
            className="flex-1"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        {draft.message.cc && (
          <div className="flex items-center gap-2 text-ink-3 text-sm">
            <span className="w-14 shrink-0">Cc</span>
            <span className="text-ink-2">{draft.message.cc}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-ink-3 text-sm">
          <span className="w-14 shrink-0">Subject</span>
          <Field
            aria-label="Subject"
            className="flex-1"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <textarea
          aria-label="The email"
          className="min-h-36 w-full rounded-md border border-line bg-surface px-2.5 py-2 text-ink text-md outline-none focus:border-accent-line focus:ring-3 focus:ring-accent-soft"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      {card.cannotUndo && (
        <div className="flex items-center gap-1.5 text-sm text-warn">
          <TriangleAlert className="size-3.5 shrink-0" />
          {card.cannotUndo}
        </div>
      )}
      {always && draft.always ? (
        <div className="flex flex-col gap-2 rounded-md border border-accent-line bg-accent-soft/40 p-3">
          <div className="text-ink text-md">{draft.always}?</div>
          <div className="text-ink-3 text-sm">
            This one goes now, and the next ones without a card, each shown on Home. Revoke it any
            time in Settings › Permissions.
          </div>
          <div className="flex gap-2">
            <Button variant="primary" disabled={busy} onClick={() => act('send', { always: true })}>
              Send it, and always
            </Button>
            <Button variant="ghost" onClick={() => setAlways(false)}>
              Back
            </Button>
          </div>
        </div>
      ) : holding ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (reason) void act('hold', { reason, words })
          }}
        >
          <div className="flex flex-wrap gap-1.5">
            {draft.reasons.map((r) => (
              <Button
                key={r}
                size="sm"
                variant={reason === r ? 'primary' : 'default'}
                onClick={() => setReason(r)}
              >
                {r}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Field
              className="flex-1"
              value={words}
              onChange={(e) => setWords(e.target.value)}
              placeholder="Anything to add, for the agent"
            />
            <Button type="submit" disabled={busy || !reason}>
              Decline
            </Button>
            <Button variant="ghost" onClick={() => setHolding(false)}>
              Back
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled={busy} onClick={() => act('send', { message })}>
            {changed ? 'Send it as changed' : 'Send it'}
          </Button>
          <Button disabled={busy} onClick={() => setHolding(true)}>
            Decline
          </Button>
          {draft.always && !changed && (
            <Button variant="ghost" disabled={busy} onClick={() => setAlways(true)}>
              Always…
            </Button>
          )}
        </div>
      )}
      {problem && <div className="text-bad text-sm">{problem}</div>}
    </Card>
  )
}
