// Cards: every question, permission and review as a durable row with one state (design §4, §7).
// A permission card holds the exact call it is for; a yes lets that call through once.
import { createHash } from 'node:crypto'
import { all, type Db, json, newId, now, one, parse, run, tx } from './db.ts'
import { type Actor, append } from './journal.ts'
import { Refused } from './kinds.ts'

export type CardKind = 'permission' | 'question' | 'review' | 'match' | 'suggestion'
export type CardState = 'waiting' | 'yes' | 'no' | 'answered' | 'withdrawn' | 'allowed'

export interface Call {
  tool: string
  input: unknown
}

export interface CardInput {
  kind: CardKind
  words: string
  detail?: string | null // what the card shows in full: the message to be sent
  restsOn?: string[]
  cannotUndo?: string | null
  options?: string[]
  gate?: string | null
  call?: Call | null
  user?: string | null
  turn?: string | null
  module?: string | null
  run?: string | null
  actor: Actor
}

export interface Card {
  id: string
  kind: CardKind
  state: CardState
  user: string | null
  words: string
  detail: string | null
  restsOn: string[]
  cannotUndo: string | null
  options: string[]
  gate: string | null
  call: Call | null
  answer: string | null
  decidedBy: string | null
  decidedAt: string | null
  usedAt: string | null
  module: string | null
  turn: string | null
  createdAt: string
}

interface CardRow {
  id: string
  kind: CardKind
  state: CardState
  user_id: string | null
  words: string
  detail: string | null
  rests_on: string
  cannot_undo: string | null
  options: string
  gate: string | null
  call: string | null
  answer: string | null
  decided_by: string | null
  decided_at: string | null
  used_at: string | null
  module_id: string | null
  turn_id: string | null
  created_at: string
}

function toCard(r: CardRow): Card {
  return {
    id: r.id,
    kind: r.kind,
    state: r.state,
    user: r.user_id,
    words: r.words,
    detail: r.detail,
    restsOn: parse(r.rests_on, []),
    cannotUndo: r.cannot_undo,
    options: parse(r.options, []),
    gate: r.gate,
    call: parse(r.call, null),
    answer: r.answer,
    decidedBy: r.decided_by,
    decidedAt: r.decided_at,
    usedAt: r.used_at,
    module: r.module_id,
    turn: r.turn_id,
    createdAt: r.created_at,
  }
}

// The same call, whatever order its input's keys came in.
export function callKey(call: Call): string {
  const sorted = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sorted)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v as Record<string, unknown>)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, sorted(x)]),
          )
        : v
  return createHash('sha256')
    .update(JSON.stringify([call.tool, sorted(call.input)]))
    .digest('hex')
}

export class Cards {
  private db: Db

  constructor(db: Db) {
    this.db = db
  }

  // One waiting card per identical call: a newer twin withdraws the older.
  open(input: CardInput): Card {
    return tx(this.db, () => {
      const key = input.call ? callKey(input.call) : null
      if (key) {
        for (const twin of all<{ id: string }>(
          this.db,
          "SELECT id FROM cards WHERE call_key = ? AND state = 'waiting'",
          key,
        ))
          this.close(twin.id, 'withdrawn', null, input.actor, 'A newer card asks the same.')
      }
      const id = newId('c')
      run(
        this.db,
        `INSERT INTO cards (id, kind, state, user_id, words, detail, rests_on, cannot_undo, options,
           gate, call_key, call, module_id, run_id, turn_id, created_at)
         VALUES (?, ?, 'waiting', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        input.kind,
        input.user ?? null,
        input.words,
        input.detail ?? null,
        json(input.restsOn ?? []),
        input.cannotUndo ?? null,
        json(input.options ?? (input.kind === 'permission' ? ['Yes', 'No'] : [])),
        input.gate ?? null,
        key,
        input.call ? json(input.call) : null,
        input.module ?? null,
        input.run ?? null,
        input.turn ?? null,
        now(),
      )
      append(this.db, {
        actor: input.actor,
        kind: 'card_opened',
        words: input.words,
        data: { card: id, kind: input.kind, gate: input.gate ?? null },
        user: input.user ?? null,
        turn: input.turn ?? null,
        module: input.module ?? null,
        run: input.run ?? null,
        card: id,
      })
      return this.get(id) as Card
    })
  }

  get(id: string): Card | undefined {
    const r = one<CardRow>(this.db, 'SELECT * FROM cards WHERE id = ?', id)
    return r ? toCard(r) : undefined
  }

  waiting(user?: string): Card[] {
    return all<CardRow>(
      this.db,
      `SELECT * FROM cards WHERE state = 'waiting' ${user ? 'AND (user_id = ? OR user_id IS NULL)' : ''} ORDER BY created_at`,
      ...(user ? [user] : []),
    ).map(toCard)
  }

  // A person's answer. Only a person answers a card: an agent never can (design §7, a wall).
  answer(id: string, answer: string, by: Actor): Card {
    if (by.kind !== 'person') throw new Refused('Only the person can answer a card.')
    return tx(this.db, () => {
      const card = this.get(id)
      if (!card) throw new Refused('That card is not there.')
      if (card.state !== 'waiting') throw new Refused('That card has already been answered.')
      const yesNo = card.kind === 'permission' || card.options.length === 2
      const state: CardState = yesNo
        ? answer === (card.options[0] ?? 'Yes')
          ? 'yes'
          : answer === (card.options[1] ?? 'No')
            ? 'no'
            : 'answered'
        : 'answered'
      this.close(id, state, answer, by, null)
      return this.get(id) as Card
    })
  }

  withdraw(id: string, by: Actor, why: string): void {
    tx(this.db, () => {
      const card = this.get(id)
      if (card?.state === 'waiting') this.close(id, 'withdrawn', null, by, why)
    })
  }

  // The yes that lets one call through: found by the call itself, used once.
  useYes(call: Call): Card | undefined {
    return tx(this.db, () => {
      const r = one<CardRow>(
        this.db,
        "SELECT * FROM cards WHERE call_key = ? AND state = 'yes' AND used_at IS NULL ORDER BY decided_at DESC",
        callKey(call),
      )
      if (!r) return undefined
      run(this.db, 'UPDATE cards SET used_at = ? WHERE id = ?', now(), r.id)
      return toCard({ ...r, used_at: now() })
    })
  }

  private close(
    id: string,
    state: CardState,
    answer: string | null,
    by: Actor,
    why: string | null,
  ): void {
    const card = this.get(id) as Card
    run(
      this.db,
      'UPDATE cards SET state = ?, answer = ?, decided_by = ?, decided_at = ? WHERE id = ?',
      state,
      answer,
      by.id ? `${by.kind}:${by.id}` : by.kind,
      now(),
      id,
    )
    const said =
      state === 'yes'
        ? 'Yes'
        : state === 'no'
          ? 'No'
          : state === 'withdrawn'
            ? 'Withdrawn'
            : `Answered "${answer}"`
    append(this.db, {
      actor: by,
      kind: 'card_closed',
      words: `${said}: ${card.words}${why ? ` (${why})` : ''}`,
      data: { card: id, state, answer },
      user: card.user,
      turn: card.turn,
      module: card.module,
      card: id,
    })
  }
}
