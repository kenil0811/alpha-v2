// The journal: append-only lines, each with an actor, a kind and plain words (design §4).
import { all, type Db, json, now, one, parse, run } from './db.ts'

export type ActorKind = 'person' | 'alpha' | 'agent' | 'connector' | 'system'

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
  }
}

// Append a line; call it inside the transaction of the write it records.
export function append(db: Db, line: LineInput): Line {
  const at = now()
  const res = run(
    db,
    `INSERT INTO journal (at, actor_kind, actor_id, source, kind, words, data, user_id, turn_id,
       module_id, run_id, card_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    at,
    line.actor.kind,
    line.actor.id ?? null,
    line.source ?? null,
    line.kind,
    line.words,
    json(line.data ?? {}),
    line.user ?? null,
    line.turn ?? null,
    line.module ?? null,
    line.run ?? null,
    line.card ?? null,
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
    run?: string
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
  if (where.run !== undefined) {
    conds.push('run_id = ?')
    params.push(where.run)
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
