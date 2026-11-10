// The stream as messages: the journal's lines grouped by turn. The person's sentence,
// then Alpha's one message for the turn: its reply, its steps for "Show the work", its cards and,
// once answered, each card's one line. A turn's module is the first one its steps touched, so a
// topic chip can name it and a lens can keep to it.
import type { StreamLine } from '@alpha/core/api'

export interface Step {
  id: number
  words: string
  ok: boolean | null // null while it runs
  results: string[] // what the step did in the world
}

// ids: the modules a lens takes in, the module and those inside it (none: only the module)
export type Module = { id: string; name: string; ids?: string[] } | null

// A card's answer, as its closing line says it.
export interface Answered {
  words: string
  state: string
  at: string
  done: string | null // when the yes went ahead
}

export interface AgentChange {
  words: string
  agent: string | null
  commit: string | null
  path: string | null
}

// One teammate asked, and what it answered once it has.
export interface Asked {
  id: string
  words: string
  direct: boolean // the person named this agent: its answer is the reply
  answer: { words: string; status: string; evidence: string | null; unblock: string | null } | null
}

// A turn in the order it happened: what the model wrote, and the steps between.
export type Part = { kind: 'text'; text: string } | { kind: 'steps'; steps: Step[] }

export type Item =
  | { kind: 'said'; id: number; words: string; at: string }
  | {
      kind: 'alpha'
      turn: string
      reply: string | null
      error: string | null
      steps: Step[]
      parts: Part[]
      cards: string[]
      answered: Record<string, Answered>
      at: string
      module: Module
      asks: Asked[] // who it asked, each with its answer
      notes: string[] // what it noted to remember
      changes: AgentChange[] // changes to an agent, each one that can be undone
    }
  // a failure said in the chat: a limit reached, an error or a refusal outside a turn
  | { kind: 'note'; id: number; words: string; at: string }
  // a card a schedule's run opened, outside any turn
  | { kind: 'card'; id: string; at: string; module: Module; answered: Answered | null }

const RESULTS = new Set([
  'made',
  'shaped',
  'wrote',
  'changed',
  'removed',
  'refused',
  'rule_saved',
  'rule_noticed',
  'remembered',
  'filed',
  'kept',
])

export function group(lines: StreamLine[]): Item[] {
  const items: Item[] = []
  const turns = new Map<string, Extract<Item, { kind: 'alpha' }>>()
  const calls = new Map<string, Step>()
  const closed = new Map<string, Answered>()
  const asked = new Map<string, Asked>()
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
        parts: [],
        cards: [],
        answered: {},
        at,
        module: null,
        asks: [],
        notes: [],
        changes: [],
      }
      turns.set(turn, a)
      items.push(a)
    }
    return a
  }

  const addStep = (a: Extract<Item, { kind: 'alpha' }>, step: Step) => {
    a.steps.push(step)
    const last = a.parts.at(-1)
    if (last?.kind === 'steps') last.steps.push(step)
    else a.parts.push({ kind: 'steps', steps: [step] })
  }

  for (const l of lines) {
    if (l.kind === 'said') {
      items.push({ kind: 'said', id: l.id, words: l.words, at: l.at })
      // asked from a module (Ask, ⌘J): the turn belongs to it
      alpha(l.turn ?? String(l.id), l.at).module = l.module
      continue
    }
    // Alpha carrying on by itself after a yes: its turn, with nothing said for it
    if (l.kind === 'noticed') {
      alpha(l.turn ?? `n${l.id}`, l.at)
      continue
    }
    if (l.kind === 'limit') {
      items.push({ kind: 'note', id: l.id, words: l.words, at: l.at })
      continue
    }
    // a teammate's answer sits on the line that asked it
    if (l.kind === 'answered') {
      const one = asked.get(String(l.data.ask))
      if (one)
        one.answer = {
          // one agent named by the person may say more after a card is answered
          words: one.direct && one.answer ? `${one.answer.words}\n\n${l.words}` : l.words,
          status: String(l.data.status ?? ''),
          evidence: (l.data.evidence as string | null) ?? null,
          unblock: (l.data.unblock as string | null) ?? null,
        }
      continue
    }
    if (l.kind === 'card_closed') {
      if (l.card)
        closed.set(l.card, {
          words: l.words,
          state: String(l.data.state ?? ''),
          at: l.at,
          done: closed.get(l.card)?.done ?? null,
        })
      continue
    }
    if (l.kind === 'card_used') {
      const c = l.card ? closed.get(l.card) : undefined
      if (c && l.card) closed.set(l.card, { ...c, done: l.at })
      continue
    }
    if (!l.turn) {
      if (l.kind === 'card_opened' && l.card)
        items.push({ kind: 'card', id: l.card, at: l.at, module: l.module, answered: null })
      else if (l.kind === 'error' || l.kind === 'refused')
        items.push({ kind: 'note', id: l.id, words: l.words, at: l.at })
      continue
    }
    const a = alpha(l.turn, l.at)
    if (!a.module && l.module) a.module = l.module
    if (l.kind === 'call') {
      const step: Step = { id: l.id, words: l.words, ok: null, results: [] }
      addStep(a, step)
      calls.set(String(l.data.call), step)
      open = step
    } else if (l.kind === 'called') {
      const step = calls.get(String(l.data.call))
      if (step) step.ok = l.data.ok === true
      if (step === open) open = null
    } else if (RESULTS.has(l.kind)) {
      if (open) open.results.push(l.words)
      else addStep(a, { id: l.id, words: l.words, ok: true, results: [] })
    } else if (l.kind === 'asking') {
      const one: Asked = {
        id: String(l.data.ask),
        words: l.words,
        direct: l.data.direct === true,
        answer: null,
      }
      asked.set(one.id, one)
      a.asks.push(one)
    } else if (l.kind === 'noted') {
      a.notes.push(l.words)
    } else if (l.kind === 'agent_made' || l.kind === 'agent_changed') {
      a.changes.push({
        words: l.words,
        agent: (l.data.changed as string | undefined) ?? null,
        commit: (l.data.commit as string | undefined) ?? null,
        path: (l.data.path as string | undefined) ?? null,
      })
    } else if (l.kind === 'card_opened' && l.card) {
      a.cards.push(l.card)
    } else if (l.kind === 'along') {
      a.parts.push({ kind: 'text', text: l.words })
    } else if (l.kind === 'replied') {
      a.reply = l.words
      a.parts.push({ kind: 'text', text: l.words })
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
