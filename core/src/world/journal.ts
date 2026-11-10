// The journal: append-only lines, each with an actor, a kind and plain words.
import { hashOf, lastHash } from './audit.ts'
import { all, type Db, json, now, one, parse, run } from './db.ts'
import { Refused } from './kinds.ts'

export type ActorKind = 'person' | 'alpha' | 'schedule' | 'connector' | 'system'

export interface Actor {
  kind: ActorKind
  id?: string
}

export interface LineInput {
  actor: Actor
  kind: string
  words: string
  data?: Record<string, unknown>
  source?: string
  user?: string | null
  turn?: string | null
  module?: string | null
  run?: string | null
  card?: string | null
  agent?: string | null // whose conversation it is in; Alpha's own lines take it from the actor
}

export interface Line {
  id: number
  at: string
  actor: Actor
  source: string | null
  kind: string
  words: string
  data: Record<string, unknown>
  user: string | null
  turn: string | null
  module: string | null
  run: string | null
  card: string | null
  agent: string | null
}

interface LineRow {
  id: number
  at: string
  actor_kind: ActorKind
  actor_id: string | null
  source: string | null
  kind: string
  words: string
  data: string
  user_id: string | null
  turn_id: string | null
  module_id: string | null
  run_id: string | null
  card_id: string | null
  agent_id: string | null
}

function toLine(r: LineRow): Line {
  return {
    id: r.id,
    at: r.at,
    actor: r.actor_id ? { kind: r.actor_kind, id: r.actor_id } : { kind: r.actor_kind },
    source: r.source,
    kind: r.kind,
    words: r.words,
    data: parse(r.data, {}),
    user: r.user_id,
    turn: r.turn_id,
    module: r.module_id,
    run: r.run_id,
    card: r.card_id,
    agent: r.agent_id,
  }
}

// Append a line; call it inside the transaction of the write it records.
// A secret the person signed in with never reaches a line (step 2, part 3): each is kept here
// for the life of the core, and a line that would carry one is refused.
const secrets = new Set<string>()
export function keepOut(secret: string): void {
  if (secret.trim().length >= 4) secrets.add(secret)
}
// one that no longer works (a short-lived token renewed): no longer looked for
export function letGo(secret: string): void {
  secrets.delete(secret)
}

export function append(db: Db, line: LineInput): Line {
  const at = now()
  const data = json(line.data ?? {})
  for (const s of secrets)
    if (line.words.includes(s) || data.includes(s))
      throw new Refused('That line would carry a secret, which the journal never does.')
  const id =
    Number(one<{ id: number | null }>(db, 'SELECT max(id) AS id FROM journal')?.id ?? 0) + 1
  const row = {
    id,
    at,
    actor_kind: line.actor.kind,
    actor_id: line.actor.id ?? null,
    source: line.source ?? null,
    kind: line.kind,
    words: line.words,
    data,
    user_id: line.user ?? null,
    turn_id: line.turn ?? null,
    module_id: line.module ?? null,
    run_id: line.run ?? null,
    card_id: line.card ?? null,
    agent_id:
      line.agent !== undefined
        ? line.agent
        : line.actor.kind === 'alpha'
          ? (line.actor.id ?? null)
          : null,
  }
  // chained to the line before (step 2, part 3)
  const hash = hashOf(lastHash(db), row)
  const res = run(
    db,
    `INSERT INTO journal (id, at, actor_kind, actor_id, source, kind, words, data, user_id, turn_id,
       module_id, run_id, card_id, agent_id, hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.at,
    row.actor_kind,
    row.actor_id,
    row.source,
    row.kind,
    row.words,
    row.data,
    row.user_id,
    row.turn_id,
    row.module_id,
    row.run_id,
    row.card_id,
    row.agent_id,
    hash,
  )
  return read(db, Number(res.lastInsertRowid)) as Line
}

export function read(db: Db, id: number): Line | undefined {
  const r = one<LineRow>(db, 'SELECT * FROM journal WHERE id = ?', id)
  return r ? toLine(r) : undefined
}

export function lines(
  db: Db,
  where: {
    user?: string
    turn?: string
    turnPrefix?: string // every turn of one task's thread
    run?: string
    agent?: string | null // whose conversation: null is the Chief of staff's
    kinds?: string[]
    after?: number
    before?: number
    limit?: number
  },
): Line[] {
  const conds: string[] = []
  const params: (string | number)[] = []
  if (where.user !== undefined) {
    conds.push('user_id = ?')
    params.push(where.user)
  }
  if (where.turn !== undefined) {
    conds.push('turn_id = ?')
    params.push(where.turn)
  }
  if (where.turnPrefix !== undefined) {
    conds.push('turn_id LIKE ?')
    params.push(`${where.turnPrefix}%`)
  }
  if (where.run !== undefined) {
    conds.push('run_id = ?')
    params.push(where.run)
  }
  if (where.agent !== undefined) {
    if (where.agent === null) conds.push('agent_id IS NULL')
    else {
      conds.push('agent_id = ?')
      params.push(where.agent)
    }
  }
  if (where.kinds?.length) {
    conds.push(`kind IN (${where.kinds.map(() => '?').join(', ')})`)
    params.push(...where.kinds)
  }
  if (where.after !== undefined) {
    conds.push('id > ?')
    params.push(where.after)
  }
  if (where.before !== undefined) {
    conds.push('id < ?')
    params.push(where.before)
  }
  const sql = `SELECT * FROM (SELECT * FROM journal ${conds.length ? `WHERE ${conds.join(' AND ')}` : ''}
    ORDER BY id DESC ${where.limit ? `LIMIT ${Math.trunc(where.limit)}` : ''}) ORDER BY id`
  return all<LineRow>(db, sql, ...params).map(toLine)
}

export function lastId(db: Db): number {
  return Number(one<{ id: number | null }>(db, 'SELECT max(id) AS id FROM journal')?.id ?? 0)
}
