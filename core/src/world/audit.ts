// The audit journal (step 2, part 3, Kenil's yes 30 Oct): every line's hash covers its content and
// the hash of the line before, so a line changed with another tool breaks the chain at itself.
// Read lines older than the fold's days fold into one checkpoint line a day, which keeps the
// hash of the last line of each run it stands for, so the chain verifies across the gap. The
// fold is the one thing that deletes journal lines, and it journals itself.
import { createHash } from 'node:crypto'
import { all, type Db, one, run } from './db.ts'
import { type Actor, append } from './journal.ts'

export interface Chained {
  id: number
  at: string
  actor_kind: string
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
  hash: string | null
}

const COLUMNS =
  'id, at, actor_kind, actor_id, source, kind, words, data, user_id, turn_id, module_id, run_id, card_id, hash'

// A line's hash: over the line before's, then every field of its own, in one order.
export function hashOf(prev: string | null, l: Omit<Chained, 'hash'>): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        prev,
        l.id,
        l.at,
        l.actor_kind,
        l.actor_id,
        l.source,
        l.kind,
        l.words,
        l.data,
        l.user_id,
        l.turn_id,
        l.module_id,
        l.run_id,
        l.card_id,
      ]),
    )
    .digest('hex')
}

// The hash of the newest line, for the next one to chain to.
export function lastHash(db: Db): string | null {
  return (
    one<{ hash: string | null }>(db, 'SELECT hash FROM journal ORDER BY id DESC LIMIT 1')?.hash ??
    null
  )
}

// A journal from before the chain, chained once, oldest line first (the migration, under the
// append-only trigger dropped for it).
export function chain(db: Db): void {
  let prev: string | null = null
  for (const l of all<Chained>(db, `SELECT ${COLUMNS} FROM journal ORDER BY id`)) {
    prev = hashOf(prev, l)
    run(db, 'UPDATE journal SET hash = ? WHERE id = ?', prev, l.id)
  }
}

// Migration 28: the hash column, and the lines there already chained, the append-only trigger
// dropped for it and put back.
export function chainJournal(db: Db): void {
  db.exec('ALTER TABLE journal ADD COLUMN hash TEXT')
  db.exec('DROP TRIGGER journal_unchanged')
  chain(db)
  db.exec(
    "CREATE TRIGGER journal_unchanged BEFORE UPDATE ON journal BEGIN SELECT RAISE(ABORT, 'the journal is append-only'); END",
  )
}

// A fold's checkpoint: the runs of lines it stands for, each with the hash of its last line.
interface Run {
  from: number
  to: number
  last: string
}

// Whether every line's hash is what its content and the line before give. A gap whose run a
// checkpoint vouches for (the hash of the run's last line) is a fold, not a break.
export function verify(
  db: Db,
): { ok: true; lines: number } | { ok: false; at: number; why: string } {
  const runs = new Map<number, Run>() // by the id the run ends at
  for (const cp of all<Chained>(db, `SELECT ${COLUMNS} FROM journal WHERE kind = 'journal_fold'`))
    for (const r of (JSON.parse(cp.data).runs ?? []) as Run[]) runs.set(r.to, r)
  let prev: { id: number; hash: string } | null = null
  let n = 0
  for (const l of all<Chained>(db, `SELECT ${COLUMNS} FROM journal ORDER BY id`)) {
    n++
    if (!l.hash) return { ok: false, at: l.id, why: 'it has no hash' }
    let before = prev?.hash ?? null
    if (prev && prev.id !== l.id - 1) {
      // lines are missing between: a fold's run, ending just before this one, vouches for them
      const r = runs.get(l.id - 1)
      if (!r || r.from !== prev.id + 1)
        return { ok: false, at: l.id, why: 'lines before it are missing' }
      before = r.last
    }
    if (hashOf(before, l) !== l.hash)
      return { ok: false, at: l.id, why: 'its hash is not what its content gives' }
    prev = { id: l.id, hash: l.hash }
  }
  return { ok: true, lines: n }
}

// The tools whose call lines only say something was read, and the connector calls that are reads.
const READ_TOOLS = new Set([
  'query',
  'search',
  'look',
  'guide',
  'Read',
  'Glob',
  'Grep',
  'ToolSearch',
  'WebFetch',
  'WebSearch',
])
const READ_CALLS = new Set(['sync', 'check', 'search', 'read', 'files', 'events', 'contacts'])

function onlyRead(l: Chained, readCalls: Set<string>): boolean {
  const d = JSON.parse(l.data) as Record<string, unknown>
  if (l.kind === 'call') {
    const read = READ_TOOLS.has(String(d.tool)) || d.effect === 'read'
    if (read) readCalls.add(String(d.call))
    return read
  }
  if (l.kind === 'called') return d.ok === true && readCalls.has(String(d.call))
  if (l.kind === 'connector_call') return d.ok === true && READ_CALLS.has(String(d.call))
  if (l.kind === 'connection_read') return d.state === 'ok' && d.quiet === true
  return false
}

// Lines older than `days` that only said something was read, folded: contiguous runs of them,
// each run's last hash kept, one checkpoint line a day, the lines deleted (the never-deleted
// trigger dropped for it, in the same transaction).
export function fold(
  db: Db,
  days: number,
  ctx: { actor: Actor },
): { folded: number; checkpoints: number } {
  const edge = new Date(Date.now() - days * 86_400_000).toISOString()
  const readCalls = new Set<string>()
  const old = all<Chained>(db, `SELECT ${COLUMNS} FROM journal WHERE at < ? ORDER BY id`, edge)
  const byDay = new Map<string, Chained[]>()
  for (const l of old)
    if (l.kind !== 'journal_fold' && onlyRead(l, readCalls))
      byDay.set(l.at.slice(0, 10), [...(byDay.get(l.at.slice(0, 10)) ?? []), l])
  if (!byDay.size) return { folded: 0, checkpoints: 0 }
  let folded = 0
  let checkpoints = 0
  db.exec('BEGIN IMMEDIATE')
  try {
    db.exec('DROP TRIGGER journal_kept')
    for (const [day, ls] of byDay) {
      const runs: Run[] = []
      for (const l of ls) {
        const last = runs.at(-1)
        if (last && last.to === l.id - 1) {
          last.to = l.id
          last.last = l.hash as string
        } else runs.push({ from: l.id, to: l.id, last: l.hash as string })
      }
      for (const l of ls) {
        run(
          db,
          "INSERT INTO journal_fts (journal_fts, rowid, words) VALUES ('delete', ?, ?)",
          l.id,
          l.words,
        )
        run(db, 'DELETE FROM journal WHERE id = ?', l.id)
      }
      const when = new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
      append(db, {
        actor: ctx.actor,
        kind: 'journal_fold',
        words: `Folded ${ls.length} lines of ${when} that only said something was read; the chain keeps their place.`,
        data: { day, count: ls.length, runs },
      })
      folded += ls.length
      checkpoints++
    }
    db.exec(
      "CREATE TRIGGER journal_kept BEFORE DELETE ON journal BEGIN SELECT RAISE(ABORT, 'the journal is never deleted'); END",
    )
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return { folded, checkpoints }
}

// The chain as an export carries it: one JSON line per journal line with its hash, so
// `pnpm journal verify` can check it on another Mac, with no Alpha.
export function exportLines(db: Db): string {
  const out = all<Chained>(db, `SELECT ${COLUMNS} FROM journal ORDER BY id`).map((l) =>
    JSON.stringify(l),
  )
  out.push(JSON.stringify({ last: lastHash(db), lines: out.length }))
  return `${out.join('\n')}\n`
}

// An exported chain verified: every line's hash from its content and the line before, folds
// vouching for gaps, and the closing line's `last` the newest hash.
export function verifyExport(
  text: string,
): { ok: true; lines: number } | { ok: false; at: number; why: string } {
  const rows = text
    .split('\n')
    .filter(Boolean)
    .map((t) => JSON.parse(t) as Chained & { last?: string | null; lines?: number })
  const close = rows.at(-1)
  const ls = rows.slice(0, -1) as Chained[]
  const runs = new Map<number, Run>()
  for (const cp of ls.filter((l) => l.kind === 'journal_fold'))
    for (const r of (JSON.parse(cp.data).runs ?? []) as Run[]) runs.set(r.to, r)
  let prev: { id: number; hash: string } | null = null
  for (const l of ls) {
    let before = prev?.hash ?? null
    if (prev && prev.id !== l.id - 1) {
      const r = runs.get(l.id - 1)
      if (!r || r.from !== prev.id + 1)
        return { ok: false, at: l.id, why: 'lines before it are missing' }
      before = r.last
    }
    if (!l.hash || hashOf(before, l) !== l.hash)
      return { ok: false, at: l.id, why: 'its hash is not what its content gives' }
    prev = { id: l.id, hash: l.hash }
  }
  if (!close || close.last !== (prev?.hash ?? null))
    return { ok: false, at: prev?.id ?? 0, why: 'the closing line names another last hash' }
  return { ok: true, lines: ls.length }
}
