// The stream as messages: the journal's lines grouped by turn (design §14). The person's sentence,
// then Alpha's one message for the turn: its reply, its steps for "Show the work", its cards and,
// once answered, each card's one line. A turn's module is the first one its steps touched, so a
// topic chip can name it and a lens can keep to it.
import type { AboutRows, StreamLine } from '@alpha/core/api'

export interface Step {
  id: number
  words: string
  ok: boolean | null // null while it runs
  results: string[] // what the step did in the world
}

export type Module = { id: string; name: string } | null

// A card's answer, as its closing line says it.
export interface Answered {
  words: string
  state: string
  at: string
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
      answered: Record<string, Answered>
      at: string
      module: Module
    }
  | { kind: 'note'; id: number; words: string; tone: 'plain' | 'warn'; at: string }
  | {
      kind: 'told'
      id: number
      agent: string | null
      words: string
      about: AboutRows | null
      at: string
      module: Module
    }
  // a card an agent's run opened, outside any turn
  | { kind: 'card'; id: string; at: string; module: Module; answered: Answered | null }

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
  const closed = new Map<string, Answered>()
  let open: Step | null = null

  const alpha = (turn: string, at: string) => {
    let a = turns.get(turn)
    if (!a) {
      a = {
        kind: 'alpha',
        turn,
        reply: null,
        error: null,
        steps: [],
        cards: [],
        answered: {},
        at,
        module: null,
      }
      turns.set(turn, a)
      items.push(a)
    }
    return a
  }

  for (const l of lines) {
    if (l.kind === 'said') {
      items.push({ kind: 'said', id: l.id, words: l.words, at: l.at })
      // asked from a module (Ask, ⌘J): the turn belongs to it
      alpha(String(l.id), l.at).module = l.module
      continue
    }
    if (l.kind === 'noticed') {
      items.push({ kind: 'note', id: l.id, words: l.words, tone: 'plain', at: l.at })
      alpha(`n${l.id}`, l.at)
      continue
    }
    if (l.kind === 'limit') {
      items.push({ kind: 'note', id: l.id, words: l.words, tone: 'warn', at: l.at })
      continue
    }
    if (l.kind === 'card_closed') {
      if (l.card)
        closed.set(l.card, { words: l.words, state: String(l.data.state ?? ''), at: l.at })
      else items.push({ kind: 'note', id: l.id, words: l.words, tone: 'plain', at: l.at })
      continue
    }
    if (!l.turn) {
      if (l.kind === 'told') {
        items.push({
          kind: 'told',
          id: l.id,
          agent: typeof l.data.agent === 'string' ? l.data.agent : null,
          words: l.words,
          about: (l.data.about as AboutRows | null | undefined) ?? null,
          at: l.at,
          module: l.module,
        })
      } else if (l.kind === 'card_opened' && l.card) {
        items.push({ kind: 'card', id: l.card, at: l.at, module: l.module, answered: null })
      } else if (l.kind === 'filed' || l.kind === 'card_opened' || l.kind === 'error')
        items.push({
          kind: 'note',
          id: l.id,
          words: l.words,
          tone: l.kind === 'error' ? 'warn' : 'plain',
          at: l.at,
        })
      continue
    }
    const a = alpha(l.turn, l.at)
    if (!a.module && l.module) a.module = l.module
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
  // each card's answer goes where the card was
  for (const i of items) {
    if (i.kind === 'alpha')
      for (const c of i.cards) {
        const done = closed.get(c)
        if (done) i.answered[c] = done
      }
    if (i.kind === 'card') i.answered = closed.get(i.id) ?? null
  }
  return items
}

// The module an item belongs to, for a lens.
export function moduleOfItem(i: Item): Module {
  return i.kind === 'alpha' || i.kind === 'told' || i.kind === 'card' ? i.module : null
}
