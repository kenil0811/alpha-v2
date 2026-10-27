// Field kinds, values and provenance (design §4). Every value written carries its provenance:
// kind, source and time. A value without them is refused here, where the write happens.

// The kinds are part of the kit API (kit-sdk): a kit cannot add one, and a change is an API change.
import { FIELD_KINDS, type FieldKind, PROVENANCE_KINDS, type ProvenanceKind } from '@alpha/kit-sdk'

export type { FieldKind, ProvenanceKind }
export { FIELD_KINDS, PROVENANCE_KINDS }

// Where a value came from. One of these, depending on its kind.
export interface Source {
  message?: number // the journal line of the person's own words
  user?: string
  card?: string // accepted on a card
  url?: string
  fetched_at?: string
  document?: string
  page?: number
  box?: [number, number, number, number]
  file?: string
  sheet?: string
  cell?: string
  line?: number
  record?: string
  inputs?: string[]
  formula?: string
  note?: string // for a computed value: the sum with its numbers, or each check it made
  connector?: string // a connection's item: the connector, the account, the item's own id
  account?: string
  item?: string
}

export interface Provenance {
  kind: ProvenanceKind
  source: Source
  basis?: string // the words behind an estimate or an assumption
  at: string
  // a value the person typed over a computed one: what the script works it out as now, kept
  // beside theirs, so they can see it and go back to it
  beside?: { value: unknown; formula?: string; note?: string; at: string }
}

export interface ProvenanceInput {
  kind: ProvenanceKind
  source?: Source
  basis?: string
}

export class Refused extends Error {}

// The person's own words, the turn a write is made in: a stated value points at them.
export interface Said {
  message: number
  user: string
}

export function provenanceFor(input: ProvenanceInput, said: Said | null, at: string): Provenance {
  const source: Source = { ...(input.source ?? {}) }
  switch (input.kind) {
    case 'stated':
      if (said && source.message === undefined && source.card === undefined) {
        source.message = said.message
        source.user = said.user
      }
      if (source.message === undefined && source.card === undefined)
        throw new Refused(
          'A stated value needs the person’s words it came from, or the card they accepted.',
        )
      break
    case 'looked_up':
      if (!source.url && !source.document && !source.file && !source.record && !source.item)
        throw new Refused(
          'A looked-up value needs where it was looked up: a link, a document, a file, a record or a connection’s item.',
        )
      if ((source.url || source.item) && !source.fetched_at) source.fetched_at = at
      break
    case 'computed':
      if (!source.inputs?.length && !source.formula)
        throw new Refused('A computed value needs its inputs or its formula.')
      break
    case 'estimated':
    case 'assumed':
      if (!input.basis?.trim())
        throw new Refused(`An ${input.kind} value needs a few words on what it rests on.`)
      break
    default:
      throw new Refused(`"${String(input.kind)}" is not a kind of provenance.`)
  }
  return { kind: input.kind, source, ...(input.basis ? { basis: input.basis } : {}), at }
}

// Whether a provenance makes a value the person's own entry (design §7, gate 2).
export function isPersonsOwn(p: Provenance): boolean {
  return (
    p.source.message !== undefined || p.source.card !== undefined || p.source.user !== undefined
  )
}

export interface Money {
  amount: number
  currency: string
}

// A value checked against its field's kind; what can't be one is refused in words.
export function checkValue(
  kind: FieldKind,
  name: string,
  value: unknown,
  choices: string[],
): unknown {
  if (value === null) return null
  const fail = (what: string): never => {
    throw new Refused(`${name} takes ${what}; got ${JSON.stringify(value)}.`)
  }
  switch (kind) {
    case 'text':
    case 'person':
    case 'phone':
    case 'notes':
      if (typeof value !== 'string') fail('words')
      return value
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) fail('a number')
      return value
    case 'money': {
      const m = value as Money
      if (
        typeof m !== 'object' ||
        typeof m.amount !== 'number' ||
        !Number.isFinite(m.amount) ||
        typeof m.currency !== 'string' ||
        !/^[A-Z]{3}$/.test(m.currency)
      )
        fail('an amount with a three-letter currency, like {"amount": 12.5, "currency": "USD"}')
      return { amount: m.amount, currency: m.currency }
    }
    case 'date':
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value)))
        fail('a date like 2026-10-19')
      return value
    case 'choice':
      if (typeof value !== 'string') fail('one of its choices')
      if (choices.length && !choices.includes(value as string))
        fail(`one of ${choices.map((c) => `"${c}"`).join(', ')}`)
      return value
    case 'relation':
      if (
        typeof value !== 'string' &&
        !(Array.isArray(value) && value.every((v) => typeof v === 'string'))
      )
        fail('a record or a list of records')
      return value
    case 'file':
      if (typeof value !== 'string') fail('a file')
      return value
    case 'link':
      if (typeof value !== 'string' || !URL.canParse(value)) fail('a link')
      return value
    case 'email':
      if (typeof value !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value))
        fail('an email address')
      return value
    case 'summary':
      throw new Refused(`${name} is worked out from the rows that point here; it is not written.`)
  }
}

// A tags value (a choice holding several, core step 3c): one choice or a list of them, each one
// of its choices, kept once each in the order given; none is empty.
export function checkTags(name: string, value: unknown, choices: string[]): string[] | null {
  if (value === null) return null
  const list = Array.isArray(value) ? value : [value]
  const out: string[] = []
  for (const v of list) {
    const c = checkValue('choice', name, v, choices) as string
    if (!out.includes(c)) out.push(c)
  }
  return out.length ? out : null
}

// Words for full-text search over a record.
export function valueWords(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    const m = value as Partial<Money>
    if (typeof m.amount === 'number') return `${m.amount} ${m.currency ?? ''}`
    return Array.isArray(value) ? value.join(' ') : ''
  }
  return String(value)
}
