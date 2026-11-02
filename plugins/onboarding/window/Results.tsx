// What a look found, each item the person's to decide (Kenil's yes 2 Nov): About you lines to keep,
// change or drop; questions to answer, each answer their own line; routines and suggestions to add
// or decline, a declined one never offered again; then everything that was sent, and Forget.
import {
  Button,
  Card,
  Field,
  List,
  openConnection,
  openModule,
  Pill,
  Question,
  Refusal,
  Row,
  Section,
  startAsk,
  useAct,
} from '@alpha/window/kit'
import { useState } from 'react'
import type { Run } from '../src/run.ts'
import type { AboutRow } from './Page.tsx'
import { onboarding } from './routes.ts'
import { Work } from './Work.tsx'

const KIND: Record<string, string> = {
  kit: 'A module',
  connector: 'A connection',
  build: 'Something to build',
  reminder: 'A reminder',
}

export function Results({
  run,
  about,
  onChange,
}: {
  run: Run
  about: AboutRow[]
  onChange: () => void
}) {
  const c = run.checked
  const act = useAct(onChange)
  if (!c) return null
  const lines = about.filter((r) => r.values.State !== 'Dropped')
  const decide = (kind: 'suggestion' | 'routine', at: number, decision: 'added' | 'declined') =>
    onboarding.post('/decide', { run: run.id, kind, at, decision })
  const routines = c.routines
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) => r.alpha !== 'no' && !(`routine:${i}` in run.decided))
  const suggestions = c.suggestions
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => !(`suggestion:${i}` in run.decided))
  const questions = c.questions
    .map((q, i) => ({ q, i }))
    .filter(({ i }) => !(String(i) in run.answered))

  return (
    <>
      <Section
        title="About you"
        about="What Alpha learned, each line for you to keep, change or drop. What you keep starts every conversation."
      >
        <List>
          {lines.map((r) => (
            <AboutLine key={r.id} row={r} onChange={onChange} />
          ))}
        </List>
      </Section>

      {questions.length > 0 && (
        <Section
          title="Questions"
          about="What Alpha could not settle. Your answer becomes one of your own lines."
        >
          {questions.map(({ q, i }) => (
            <Question
              key={q.question}
              words={q.question}
              detail={q.why}
              busy={act.busy}
              problem={act.problem}
              onAnswer={(answer) =>
                void act.act(() => onboarding.post('/answer', { run: run.id, question: i, answer }))
              }
            />
          ))}
        </Section>
      )}

      {routines.length > 0 && (
        <Section
          title="Routines"
          about="Work you do by hand often, as your Mac shows it, and what Alpha could take over."
        >
          {routines.map(({ r, i }) => (
            <Card
              key={r.what}
              label={
                r.alpha === 'yes' ? 'Alpha could take this over' : 'Alpha could help with this'
              }
            >
              <div className="font-medium text-ink text-lg">{r.what}</div>
              <div className="text-ink-2 text-md">{r.evidence}</div>
              <div className="text-ink text-md">{r.how}</div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  disabled={act.busy}
                  onClick={() =>
                    void act.act(async () => {
                      await decide('routine', i, 'added')
                      startAsk(`Take this over for me: ${r.what} ${r.how}`)
                    })
                  }
                >
                  Set it up
                </Button>
                <Button
                  disabled={act.busy}
                  onClick={() => void act.act(() => decide('routine', i, 'declined'))}
                >
                  Decline
                </Button>
              </div>
            </Card>
          ))}
        </Section>
      )}

      {suggestions.length > 0 && (
        <Section
          title="Suggestions"
          about="What Alpha could set up for you now. A declined one is never offered again."
        >
          {suggestions.map(({ s, i }) => (
            <Card key={s.words} label={KIND[s.kind] ?? 'A suggestion'}>
              <div className="font-medium text-ink text-lg">{s.words}</div>
              <div className="text-ink-2 text-md">{s.why}</div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  disabled={act.busy}
                  onClick={() =>
                    void act.act(async () => {
                      await decide('suggestion', i, 'added')
                      if (s.kind === 'kit' && s.name) await openModule(s.name)
                      else if (s.kind === 'connector' && s.name) openConnection(s.name)
                      else startAsk(s.words)
                    })
                  }
                >
                  Add
                </Button>
                <Button
                  disabled={act.busy}
                  onClick={() => void act.act(() => decide('suggestion', i, 'declined'))}
                >
                  Decline
                </Button>
              </div>
            </Card>
          ))}
        </Section>
      )}
      <Refusal words={act.problem} />

      <Work run={run} onForgot={onChange} />
    </>
  )
}

// One line of About you: Keep, Edit (their words, kept) or Drop while proposed; Drop once kept.
export function AboutLine({ row, onChange }: { row: AboutRow; onChange: () => void }) {
  const act = useAct(onChange)
  const [editing, setEditing] = useState<string | null>(null)
  const v = row.values
  const go = (what: 'keep' | 'drop' | 'edit', body: unknown = {}) =>
    void act.act(() => onboarding.post(`/about/${row.id}/${what}`, body))
  return (
    <Row
      wrap
      title={v.Line ?? ''}
      sub={[v.From, v.Sure].filter(Boolean).join(' · ')}
      actions={
        v.State === 'Kept' ? (
          <>
            <Pill tone="good">Kept</Pill>
            <Button size="sm" variant="ghost" disabled={act.busy} onClick={() => go('drop')}>
              Drop
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="primary" disabled={act.busy} onClick={() => go('keep')}>
              Keep
            </Button>
            <Button size="sm" disabled={act.busy} onClick={() => setEditing(v.Line ?? '')}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" disabled={act.busy} onClick={() => go('drop')}>
              Drop
            </Button>
          </>
        )
      }
    >
      {editing !== null && (
        <form
          className="flex gap-2 px-4 pb-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (editing.trim()) go('edit', { line: editing.trim() })
            setEditing(null)
          }}
        >
          <Field className="flex-1" value={editing} onChange={(e) => setEditing(e.target.value)} />
          <Button type="submit" size="sm" variant="primary" disabled={!editing.trim()}>
            Keep
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </form>
      )}
      {act.problem && (
        <div className="px-4 pb-3">
          <Refusal words={act.problem} />
        </div>
      )}
    </Row>
  )
}
