// What the Interviewer keeps of one person in Your work, and what their lines may rest on now:
// the sources they allowed and skipped, their answers on its cards, and what they dropped or
// declined. The person's answers on its cards are copied onto its rows as they come.
import type { PluginHost, Row, Turn } from '@alpha/plugin-sdk'
import { config } from './config.ts'
import { SOURCES } from './sources.ts'
import { type Readable, sameAs } from './walls.ts'

export const ofPerson = (host: PluginHost, table: string, turn: Turn): Row[] =>
  host.own.rows(table).filter((r) => r.values.Person === turn.name)

// A card's answer as a playback answer, or a source's.
const playback = (a: string) =>
  /^yes,?\s*that/i.test(a) ? 'Yes' : /^yes/i.test(a) ? 'Yes and also' : 'Not this'

// Their answers on its cards, onto the rows the cards were about.
export function sync(host: PluginHost, turn: Turn): void {
  for (const s of ofPerson(host, 'Interview sources', turn)) {
    if (s.values.State !== 'Asked' || !s.values.Card) continue
    const a = host.answer(String(s.values.Card))
    if (a !== null)
      host.own.change(
        'Interview sources',
        s.id,
        { State: /^allow/i.test(a) ? 'Allowed' : 'Skipped' },
        `their answer on card ${s.values.Card}`,
      )
  }
  const flows = new Map(ofPerson(host, 'Workflows', turn).map((w) => [w.id, w]))
  for (const p of host.own.rows('Proposals')) {
    if (p.values.Answer !== 'Waiting' || !p.values.Card) continue
    const flow = flows.get(String(p.values.Workflow ?? ''))
    if (!flow) continue
    const a = host.answer(String(p.values.Card))
    if (a === null) continue
    const answer = playback(a)
    host.own.change('Proposals', p.id, { Answer: answer }, `their answer on card ${p.values.Card}`)
    host.own.change(
      'Workflows',
      flow.id,
      { Status: answer === 'Not this' ? 'Asking' : 'Agreed' },
      `their answer on card ${p.values.Card}`,
    )
  }
}

// What their lines may rest on now.
export function readable(host: PluginHost, turn: Turn, answered: string[]): Readable {
  const days = config.lookback_days
  const r: Readable = {
    cites: new Set(),
    skipped: new Set(),
    answers: new Map(),
    text: '',
    declined: new Set(),
  }
  const texts: string[] = []
  const states = new Map(
    ofPerson(host, 'Interview sources', turn).map((s) => [s.values.Source, s.values.State]),
  )
  for (const s of SOURCES) {
    const state = states.get(s.name)
    if (state !== 'Allowed' && state !== 'Skipped') continue
    const found = s.read(host, turn.person, days)
    for (const c of found.cites) (state === 'Allowed' ? r.cites : r.skipped).add(c)
    if (state === 'Allowed') texts.push(found.text)
  }
  for (const id of answered) {
    const a = host.answer(id)
    if (a !== null) {
      r.answers.set(id, a)
      texts.push(a)
    }
  }
  r.text = texts.join('\n').toLowerCase()
  for (const l of ofPerson(host, 'About you', turn))
    if (l.values.State === 'Dropped') r.declined.add(sameAs(String(l.values.Line ?? '')))
  const flows = new Set(ofPerson(host, 'Workflows', turn).map((w) => w.id))
  for (const p of host.own.rows('Proposals'))
    if (p.values.Answer === 'Not this' && flows.has(String(p.values.Workflow ?? '')))
      r.declined.add(sameAs(String(p.values['What it does'] ?? '')))
  return r
}

// A workflow of theirs, by its row's id or its name.
export function flowOf(host: PluginHost, turn: Turn, ref: string): Row | undefined {
  const flows = ofPerson(host, 'Workflows', turn)
  return (
    flows.find((w) => w.id === ref) ??
    flows.find((w) => sameAs(String(w.values.Name)) === sameAs(ref))
  )
}
