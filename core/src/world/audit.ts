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
  agent_id: string | null
  hash: string | null
}

export const COLUMNS =
  'id, at, actor_kind, actor_id, source, kind, words, data, user_id, turn_id, module_id, run_id, card_id, agent_id, hash'

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
        l.agent_id,
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

// ---- what the tables hold (rules A4) ------------------------------------------------------

// A line that writes rows carries, for each row it left, a short hash of each value. The line is
// chained, so a value changed in the file no longer matches the newest line that wrote its row.
// Pointers between rows are left out: removing a row clears them in other rows, and they are kept
// whole by Alpha's own writes.
interface FieldRow {
  id: string
  slug: string
  kind: string
}

const WIDTH = 6
const chunks = (s: string) => s.match(new RegExp(`.{${WIDTH}}`, 'g')) ?? []

// A tag held alone reads the same as the single choice it was before it could hold several.
function plain(v: unknown): unknown {
  if (typeof v !== 'string' || !v.startsWith('[')) return v ?? null
  try {
    const a = JSON.parse(v) as unknown
    return Array.isArray(a) && a.length === 1 ? a[0] : v
  } catch {
    return v
  }
}

function rowHashes(fields: FieldRow[], row: Record<string, unknown>): string {
  const out: string[] = []
  for (const f of fields) {
    if (f.kind === 'relation') continue
    const values = (f.kind === 'money' ? [f.slug, `${f.slug}_currency`] : [f.slug]).map((c) =>
      plain(row[c]),
    )
    if (values.every((v) => v === null)) continue
    out.push(
      createHash('sha256')
        .update(JSON.stringify([f.id, values]))
        .digest('hex')
        .slice(0, WIDTH),
    )
  }
  return out.sort().join('')
}

// Reads rows as they stand, through one table's columns at a time, keeping what it learned.
function rowReader(db: Db) {
  const tables = new Map<string, { slug: string; fields: FieldRow[] }>()
  return (id: string): string | null => {
    const tableId = one<{ table_id: string }>(
      db,
      'SELECT table_id FROM records WHERE id = ?',
      id,
    )?.table_id
    if (!tableId) return null
    let t = tables.get(tableId)
    if (!t) {
      const slug = one<{ slug: string }>(db, 'SELECT slug FROM tables WHERE id = ?', tableId)?.slug
      if (!slug) return null
      t = {
        slug,
        fields: all<FieldRow>(db, 'SELECT id, slug, kind FROM fields WHERE table_id = ?', tableId),
      }
      tables.set(tableId, t)
    }
    const row = one<Record<string, unknown>>(
      db,
      `SELECT * FROM "${t.slug.replace(/"/g, '""')}" WHERE id = ?`,
      id,
    )
    return row ? rowHashes(t.fields, row) : null
  }
}

// What a line that wrote these rows carries about them.
export function seal(db: Db, ids: string[]): { digest?: string; digests?: Record<string, string> } {
  const read = rowReader(db)
  const digests: Record<string, string> = {}
  for (const id of new Set(ids)) {
    const hashes = read(id)
    if (hashes !== null) digests[id] = hashes
  }
  if (!Object.keys(digests).length) return {}
  return { digest: createHash('sha256').update(JSON.stringify(digests)).digest('hex'), digests }
}

// Each row against the newest line that wrote it. A value a later field took out is fine; one
// that is not among the hashes that line left was changed some other way.
function verifyValues(db: Db): { at: number; why: string } | null {
  const read = rowReader(db)
  const seen = new Set<string>()
  for (const l of all<{ id: number; data: string }>(
    db,
    `SELECT id, data FROM journal WHERE data LIKE '%"digests"%' ORDER BY id DESC`,
  )) {
    const digests = (JSON.parse(l.data) as { digests?: Record<string, string> }).digests
    for (const [id, left] of Object.entries(digests ?? {})) {
      if (seen.has(id)) continue
      seen.add(id)
      const now = read(id)
      if (now === null) continue
      const have = new Set(chunks(left))
      if (chunks(now).some((h) => !have.has(h)))
        return { at: l.id, why: `row ${id} no longer holds what this line left in it` }
    }
  }
  return null
}

// ---- the newest hash outside the world (rules A3) ------------------------------------------

// What a daily backup leaves beside it: where the chain had got to that day.
export interface Manifest {
  day: string
  line: number
  hash: string
}

export function manifestOf(db: Db, day: string): Manifest | null {
  const l = one<{ id: number; hash: string | null }>(
    db,
    'SELECT id, hash FROM journal ORDER BY id DESC LIMIT 1',
  )
  return l?.hash ? { day, line: l.id, hash: l.hash } : null
}

// Each manifest's line, as the journal holds it now. A fold may have taken a read line away, and
// its checkpoint vouches for the lines it stands for.
function verifyManifests(db: Db, manifests: Manifest[]): { at: number; why: string } | null {
  const folded: Run[] = []
  for (const cp of all<Chained>(db, `SELECT ${COLUMNS} FROM journal WHERE kind = 'journal_fold'`))
    folded.push(...((JSON.parse(cp.data).runs ?? []) as Run[]))
  for (const m of manifests) {
    const l = one<{ hash: string | null }>(db, 'SELECT hash FROM journal WHERE id = ?', m.line)
    if (l) {
      if (l.hash !== m.hash)
        return { at: m.line, why: `it is not the line the ${m.day} backup recorded` }
      continue
    }
    const run = folded.find((r) => r.from <= m.line && m.line <= r.to)
    if (!run) return { at: m.line, why: `it was there at the ${m.day} backup and is gone` }
    if (run.to === m.line && run.last !== m.hash)
      return { at: m.line, why: `it is not the line the ${m.day} backup recorded` }
  }
  return null
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
  manifests: Manifest[] = [],
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
  const broken = verifyManifests(db, manifests) ?? verifyValues(db)
  return broken ? { ok: false, ...broken } : { ok: true, lines: n }
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
