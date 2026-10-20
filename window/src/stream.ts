// The stream as messages: the journal's lines grouped by turn (design §14). The person's sentence,
// then Alpha's one message for the turn: its reply, its steps for "Show the work", its cards.
import type { AboutRows, StreamLine } from '@alpha/core/api'

export interface Step {
  id: number
  words: string
  ok: boolean | null // null while it runs
  results: string[] // what the step did in the world
}

export type Item =
  | { kind: 'said'; id: number; words: string; at: string }
  | {
      kind: 'alpha'
      turn: string
      reply: string | null
      error: string | null
      steps: Step[]
      cards: string[]
      at: string
    }
  | { kind: 'note'; id: number; words: string; tone: 'plain' | 'warn' }
  | { kind: 'told'; id: number; words: string; about: AboutRows | null; at: string }

const RESULTS = new Set([
  'made',
  'shaped',
  'wrote',
  'changed',
  'removed',
  'remembered',
  'filed',
  'kept',
])

export function group(lines: StreamLine[]): Item[] {
  const items: Item[] = []
  const turns = new Map<string, Extract<Item, { kind: 'alpha' }>>()
  const calls = new Map<string, Step>()
  let open: Step | null = null

  const alpha = (turn: string, at: string) => {
    let a = turns.get(turn)
    if (!a) {
      a = { kind: 'alpha', turn, reply: null, error: null, steps: [], cards: [], at }
      turns.set(turn, a)
      items.push(a)
    }
    return a
  }

  for (const l of lines) {
    if (l.kind === 'said') {
      items.push({ kind: 'said', id: l.id, words: l.words, at: l.at })
      alpha(String(l.id), l.at)
      continue
    }
    if (l.kind === 'noticed') {
      items.push({ kind: 'note', id: l.id, words: l.words, tone: 'plain' })
      alpha(`n${l.id}`, l.at)
      continue
    }
    if (l.kind === 'limit') {
      items.push({ kind: 'note', id: l.id, words: l.words, tone: 'warn' })
      continue
    }
    if (l.kind === 'card_closed') {
      items.push({ kind: 'note', id: l.id, words: l.words, tone: 'plain' })
      continue
    }
    if (!l.turn) {
      if (l.kind === 'told') {
        const about = (l.data.about as AboutRows | null | undefined) ?? null
        items.push({ kind: 'told', id: l.id, words: l.words, about, at: l.at })
        continue
      }
      if (l.kind === 'filed' || l.kind === 'card_opened' || l.kind === 'error')
        items.push({
          kind: 'note',
          id: l.id,
          words: l.words,
          tone: l.kind === 'error' ? 'warn' : 'plain',
        })
      continue
    }
    const a = alpha(l.turn, l.at)
    if (l.kind === 'call') {
      const step: Step = { id: l.id, words: l.words, ok: null, results: [] }
      a.steps.push(step)
      calls.set(String(l.data.call), step)
      open = step
    } else if (l.kind === 'called') {
      const step = calls.get(String(l.data.call))
      if (step) step.ok = l.data.ok === true
      if (step === open) open = null
    } else if (RESULTS.has(l.kind)) {
      if (open) open.results.push(l.words)
      else a.steps.push({ id: l.id, words: l.words, ok: true, results: [] })
    } else if (l.kind === 'card_opened' && l.card) {
      a.cards.push(l.card)
    } else if (l.kind === 'replied') {
      a.reply = l.words
    } else if (l.kind === 'error') {
      a.error = l.words
    }
  }
  return items
}
