// A card in full, in the side panel (#/card/<id>; Vikas, 30 Oct: a question clicked showed
// nothing more): who asked and in which module, the card itself with its actions while it waits,
// the runs it rests on, each opening, and its history in the journal.
import type { CardAbout } from '@alpha/core/api'
import { useEffect, useState } from 'react'
import { api, Problem } from './api.ts'
import { CardBox } from './Conversation.tsx'
import { Record } from './Record.tsx'
import { dayWords } from './time.ts'
import { List, Row } from './ui/list.tsx'
import { Section } from './ui/section.tsx'

const RAN: Record<string, string> = {
  running: 'Running',
  ok: 'Done',
  failed: 'Failed',
  stopped: 'Stopped',
}
const DECIDED: Record<string, string> = {
  yes: 'Approved',
  no: 'Declined',
  answered: 'Answered',
  withdrawn: 'Withdrawn',
  allowed: 'Allowed',
}

export function CardPage({
  id,
  version,
  onName,
}: {
  id: string
  version: number
  onName: (name: string) => void
}) {
  const [about, setAbout] = useState<CardAbout | null | undefined>(undefined)
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    if (version >= 0)
      api.get<CardAbout>(`/api/cards/${id}/about`).then(setAbout, (err: unknown) => {
        setProblem(err instanceof Problem ? err.message : 'That card did not load.')
        setAbout(null)
      })
  }, [id, version])
  const who = about ? (about.agent?.name ?? 'Alpha') : ''
  useEffect(() => {
    onName(who ? `${who} asks` : '')
  }, [who, onName])
  if (about === undefined) return <p className="p-6 text-ink-3">Loading…</p>
  if (!about) return <p className="p-6 text-ink-2">{problem}</p>
  const { card, agent, runs, history } = about
  return (
    <Record
      kind={card.state === 'waiting' ? 'Waiting on you' : (DECIDED[card.state] ?? card.state)}
    >
      <p className="text-ink-2 text-md">
        Asked by{' '}
        {agent ? (
          <a href={`#/agent/${agent.id}`} className="text-ink hover:underline">
            {agent.name}
          </a>
        ) : (
          'Alpha'
        )}
        {history[0] ? `, ${dayWords(history[0].at)}` : ''}
      </p>
      {card.state === 'waiting' ? (
        <CardBox id={card.id} card={card} onChange={() => undefined} />
      ) : (
        <h1 className="font-serif text-2xl text-ink">{card.words}</h1>
      )}
      {runs.length > 0 && (
        <Section
          title="Rests on"
          about={card.run ? 'The run that asked.' : `${agent?.name ?? 'Its agent'}'s latest runs.`}
        >
          <List>
            {runs.map((r) => (
              <Row
                key={r.id}
                title={
                  <a href={`#/run/${r.id}`} className="hover:underline">
                    {r.words ?? RAN[r.state] ?? r.state}
                  </a>
                }
                sub={`${RAN[r.state] ?? r.state} · ${dayWords(r.startedAt)}`}
              />
            ))}
          </List>
        </Section>
      )}
      <Section title="History">
        <List>
          {history.map((h) => (
            <Row key={h.id} title={h.words} sub={dayWords(h.at)} />
          ))}
        </List>
      </Section>
    </Record>
  )
}
