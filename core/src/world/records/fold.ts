// One row per person, and folding rows. A table whose person field says `per: person` holds one row
// for each person: a second is refused, and a land finds the person's row. A merge of two people,
// on one "folded" line: every person field naming the merged-in person names the kept one; in each
// per-person table their rows fold into one, field by field (your value over one Alpha found, the
// newer of two Alpha found, both notes, every tag, and a card where two of yours differ); what
// pointed at the folded row points at the kept row; the folded row goes to the trash. Unmerge
// reverts that line with the undo in revert.ts. The fold is a general row merge, so it can later
// merge two duplicate deals.

import { seal } from '../audit.ts'
import type { Card } from '../cards.ts'
import { all, now, run } from '../db.ts'
import { junctionName, quote } from '../ddl.ts'
import { type Actor, append, lines } from '../journal.ts'
import { isPersonsOwn, type Provenance, Refused, valueWords } from '../kinds.ts'
import { actorName, type Field, type Table, type WriteCtx } from '../shape/index.ts'
import { perField } from '../shape/per.ts'
import type { Records } from './records.ts'
import { revert } from './revert.ts'
import { type Kept, putInTrash, tagVersions, takeOut } from './trash.ts'
import type { Snapshot } from './types.ts'
import { CHUNK } from './types.ts'

export const FOLD_PICK = 'fold_pick'
export { perField }

// The ids under one: itself, and every one merged into it, at any depth.
const partsOf = (records: Records, id: string) =>
  all<{ id: string }>(
    records.db,
    'WITH RECURSIVE s (id) AS (SELECT ? UNION SELECT p.id FROM people p JOIN s ON p.merged_into = s.id) SELECT id FROM s',
    id,
  ).map((r) => r.id)
// Every id that is the same person as this one, through any merge.
const personIds = (records: Records, id: string) => partsOf(records, records.peopleRoot?.(id) ?? id)
const marks = (xs: string[]) => xs.map(() => '?').join(', ')

// The rows of a per-person table naming one of these people, oldest first.
function rowsNaming(records: Records, table: Table, f: Field, ids: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK)
    out.push(
      ...all<{ id: string }>(
        records.db,
        `SELECT id FROM ${quote(table.slug)} WHERE ${quote(f.slug)} IN (${marks(part)}) ORDER BY created_at, rowid`,
        ...part,
      ).map((r) => r.id),
    )
  }
  return out
}

// A new or changed row of a per-person table names someone with no other row there.
export function checkPer(
  records: Records,
  table: Table,
  vals: Record<string, unknown>,
  self: string | null,
): void {
  const f = perField(table)
  if (!f || (self && !(f.id in vals))) return
  const who = vals[f.id]
  if (who == null)
    throw new Refused(`${table.name} holds one row per person, so a row needs its ${f.name}.`)
  const there = rowsNaming(records, table, f, personIds(records, String(who))).filter(
    (id) => id !== self,
  )
  if (there.length)
    throw new Refused(
      `${table.name} has a row for ${records.personName?.(String(who)) ?? 'them'} already; change that one.`,
    )
}

// The row of a per-person table a land item is about, by its person, when its key finds none.
export function perRow(records: Records, table: Table, vals: Record<string, unknown>) {
  const f = perField(table)
  const who = f ? vals[f.id] : null
  if (!f || who == null) return undefined
  const id = rowsNaming(records, table, f, personIds(records, String(who)))[0]
  return id ? records.readRow(table, id) : undefined
}

// The rows of a table whose relation points at this row.
function pointing(records: Records, t: Table, f: Field, id: string): string[] {
  return all<{ id: string }>(
    records.db,
    f.many
      ? `SELECT record_id AS id FROM ${quote(junctionName(t.slug, f.slug))} WHERE other_id = ?`
      : `SELECT id FROM ${quote(t.slug)} WHERE ${quote(f.slug)} = ?`,
    id,
  ).map((r) => r.id)
}

// What a fold does, gathered before anything is written, so each row changes once.
interface Work {
  at: string
  by: string
  pending: Map<
    string,
    { table: Table; vals: Record<string, unknown>; prov: Record<string, Provenance> }
  >
  versions: [string, number, Snapshot][]
  folded: { table: Table; keep: string; other: string; links: string[] }[]
  trash: { table: Table; id: string; kept: Kept }[]
  asks: { table: Table; row: string; field: Field; values: [unknown, unknown] }[]
  moved: { files: [string, string, string][]; tasks: [string, string, string][] }
}

const fresh = (by: string): Work => ({
  at: now(),
  by,
  pending: new Map(),
  versions: [],
  folded: [],
  trash: [],
  asks: [],
  moved: { files: [], tasks: [] },
})

// A value to write on a row, its provenance kept unless given.
function set(w: Work, table: Table, id: string, field: string, value: unknown, p?: Provenance) {
  const x = w.pending.get(id) ?? { table, vals: {}, prov: {} }
  x.vals[field] = value
  if (p) x.prov[field] = p
  w.pending.set(id, x)
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const own = (p: Provenance | undefined) => !!p && isPersonsOwn(p)

// One row folded into another: its values by the rules, what pointed at it moved to the kept row.
function foldRow(records: Records, w: Work, table: Table, keep: string, other: string) {
  const k = records.readRow(table, keep)
  const o = records.readRow(table, other)
  if (!k || !o) return
  const a = records.snapshot(table, k)
  const b = records.snapshot(table, o)
  const per = perField(table)
  for (const f of table.fields) {
    if (f.id === per?.id || f.kind === 'summary') continue
    const [va, vb, pa, pb] = [a.vals[f.id], b.vals[f.id], a.prov[f.id], b.prov[f.id]]
    if (vb == null || same(va, vb)) continue
    if (va == null) set(w, table, keep, f.id, vb, pb)
    else if (f.kind === 'notes') set(w, table, keep, f.id, `${va}\n\n---\n\n${vb}`)
    else if (Array.isArray(va) && Array.isArray(vb))
      set(w, table, keep, f.id, [...va, ...vb.filter((x) => !va.includes(x))])
    else if (own(pb) && !own(pa)) set(w, table, keep, f.id, vb, pb)
    else if (own(pa) && own(pb)) w.asks.push({ table, row: keep, field: f, values: [va, vb] })
    else if (!own(pa) && (pb?.at ?? '') > (pa?.at ?? '')) set(w, table, keep, f.id, vb, pb)
  }
  // the rows of every table pointing at it, its parts among them, point at the kept row
  const links: string[] = []
  for (const t of records.shape.tables())
    for (const f of t.fields) {
      if (f.kind !== 'relation' || f.relatesTo !== table.id) continue
      for (const id of pointing(records, t, f, other)) {
        links.push(id)
        const cur = w.pending.get(id)?.vals[f.id] ?? records.rawValues(id)?.vals[f.id]
        set(
          w,
          t,
          id,
          f.id,
          f.many && Array.isArray(cur)
            ? [...new Set(cur.map((x) => (x === other ? keep : x)))]
            : keep,
        )
      }
    }
  for (const r of all<{ file_hash: string }>(
    records.db,
    'SELECT file_hash FROM row_files WHERE record_id = ?',
    other,
  ))
    w.moved.files.push([r.file_hash, other, keep])
  for (const r of all<{ id: string }>(
    records.db,
    'SELECT id FROM tasks WHERE record_id = ?',
    other,
  ))
    w.moved.tasks.push([r.id, other, keep])
  w.folded.push({ table, keep, other, links })
}

// Every pending value written, one version per row, then the folded rows and what moved.
function write(records: Records, w: Work, ctx: WriteCtx) {
  for (const [id, x] of w.pending) {
    const row = records.readRow(x.table, id)
    if (!row) continue
    const was = records.snapshot(x.table, row)
    const prov: Record<string, Provenance> = {}
    for (const [f, v] of Object.entries(x.vals)) {
      const p = x.prov[f] ?? was.prov[f]
      if (p && v != null) prov[f] = p
    }
    records.keepVersion(row, was, w.at, w.by)
    w.versions.push([id, row.version, { vals: x.vals, prov }])
    records.update(x.table, id, x.vals, prov, w.at)
    records.index(x.table, id, { ...was.vals, ...x.vals })
  }
  for (const [hash, from, to] of w.moved.files)
    run(
      records.db,
      'UPDATE OR IGNORE row_files SET record_id = ? WHERE record_id = ? AND file_hash = ?',
      to,
      from,
      hash,
    )
  for (const [id, , to] of w.moved.tasks)
    run(records.db, 'UPDATE tasks SET record_id = ? WHERE id = ?', to, id)
  for (const f of w.folded)
    for (const [id, k] of takeOut(records, f.table, [f.other], ctx).kept)
      w.trash.push({ table: f.table, id, kept: k })
}

// The folded line: what changed and went, so unmerge can revert it; and the cards it asks.
function journal(records: Records, w: Work, ctx: WriteCtx, words: string, data: object) {
  const changed = [...w.pending.keys()].filter((id) => records.tableOf(id))
  if (!changed.length && !w.trash.length) return null
  const line = append(records.db, {
    actor: ctx.actor,
    kind: 'folded',
    words,
    data: {
      ...data,
      changed,
      gone: w.trash.map((t) => t.id),
      // each fold: an unmerge whose folded row is gone for good leaves its values where they went
      folds: w.folded.map((f) => ({ keep: f.keep, other: f.other, links: f.links })),
      ...(new Set(w.folded.map((f) => f.table.id)).size === 1
        ? { table: w.folded[0]?.table.id }
        : {}),
      moved: w.moved,
      ...seal(records.db, changed),
    },
    user: ctx.user ?? null,
    turn: ctx.turn ?? null,
    run: ctx.run ?? null,
  })
  for (const t of w.trash) putInTrash(records, t.table, t.id, t.kept, line)
  tagVersions(records, w.versions, line.id)
  for (const q of w.asks) {
    const shown = q.values.map((v) => valueWords(v) || 'empty')
    records.ask?.({
      kind: 'question',
      words: `${q.table.name}: ${records.personName?.(String(records.rawValues(q.row)?.vals[perField(q.table)?.id ?? ''] ?? '')) ?? 'this row'} had two ${q.field.name}s of yours. Which stays?`,
      options: shown,
      call: {
        tool: FOLD_PICK,
        input: { table: q.table.id, row: q.row, field: q.field.id, values: q.values },
      },
      actor: ctx.actor,
      user: ctx.user ?? null,
      module: q.table.module.id,
    })
  }
  return line
}

const n = (k: number, word: string) => `${k} ${word}${k === 1 ? '' : 's'}`

// The person's pick on a fold's card: the value they chose, as theirs, where the row still is.
export function pickFolded(records: Records, card: Card, answer: string, by: Actor): void {
  const i = card.options.indexOf(answer)
  const x = card.call?.input as { table: string; row: string; field: string; values: unknown[] }
  const table = records.shape.table(x.table)
  const f = table?.fields.find((y) => y.id === x.field)
  if (!table || !f || i < 0 || !records.readRow(table, x.row)) return
  records.change(
    table.id,
    [
      {
        id: x.row,
        values: { [f.name]: x.values[i] },
        provenance: { kind: 'stated', source: { card: card.id } },
      },
    ],
    { actor: by, user: by.id ?? null },
  )
}

// Two people merged (inside the merge's transaction): one line, or none when no row names the
// merged-in person.
export function foldPeople(
  records: Records,
  keepId: string,
  otherId: string,
  names: [string, string],
  ctx: WriteCtx,
): void {
  const w = fresh(actorName(ctx.actor))
  const other = partsOf(records, otherId)
  const keep = partsOf(records, keepId).filter((id) => !other.includes(id))
  const gone = new Set<string>()
  for (const table of records.shape.tables()) {
    const f = perField(table)
    if (!f) continue
    const mine = rowsNaming(records, table, f, keep)
    const theirs = rowsNaming(records, table, f, other)
    const first = mine[0] ?? theirs[0]
    if (!first) continue
    for (const id of [...mine, ...theirs].filter((id) => id !== first)) {
      foldRow(records, w, table, first, id)
      gone.add(id)
    }
  }
  // every person field naming the merged-in person names the kept one
  let named = 0
  for (const table of records.shape.tables())
    for (const f of table.fields) {
      if (f.kind !== 'person') continue
      for (const id of rowsNaming(records, table, f, other)) {
        if (gone.has(id)) continue
        set(w, table, id, f.id, keepId)
        named++
      }
    }
  write(records, w, ctx)
  const tables = [...new Set(w.folded.map((x) => x.table.name))]
  journal(
    records,
    w,
    ctx,
    [
      `${names[1]} is ${names[0]} now`,
      w.folded.length ? `: their rows in ${tables.join(' and ')} are one` : '',
      named
        ? `${w.folded.length ? ', and' : ':'} ${n(named, 'row')} ${named === 1 ? 'names' : 'name'} ${names[0]}`
        : '',
      w.asks.length
        ? `; ${n(w.asks.length, 'value')} of yours differed, so a card asks which stays`
        : '',
      '.',
    ].join(''),
    { merged: otherId, into: keepId },
  )
}

// Unmerge: the fold of that merge reverted, where nobody changed it since, its files and tasks
// moved back. Back come the words of what stays.
export function unfoldPeople(records: Records, otherId: string, ctx: WriteCtx): string {
  // the newest fold of their merge an unmerge has not reverted yet
  const reverted = new Set(
    lines(records.db, { kinds: ['reverted'] })
      .filter((l) => l.data.unfold)
      .map((l) => (l.data.target as { line: number }).line),
  )
  const line = lines(records.db, { kinds: ['folded'] })
    .filter((l) => l.data.merged === otherId && !reverted.has(l.id))
    .at(-1)
  if (!line) return ''
  const undone = revert(records, { line: line.id }, ctx, 'the merge', { unfold: true })
  const moved = (line.data.moved ?? { files: [], tasks: [] }) as Work['moved']
  for (const [hash, from, to] of moved.files)
    if (records.tableOf(from))
      run(
        records.db,
        'UPDATE OR IGNORE row_files SET record_id = ? WHERE record_id = ? AND file_hash = ?',
        from,
        to,
        hash,
      )
  for (const [id, from, to] of moved.tasks)
    if (records.tableOf(from))
      run(records.db, 'UPDATE tasks SET record_id = ? WHERE id = ? AND record_id = ?', from, id, to)
  return [undone.words, ...undone.left].join(' ')
}

// A table made one row per person: rows that share a person folded first, on one line.
export function setPer(records: Records, tableId: string, field: string, ctx: WriteCtx): Table {
  const table = records.mustTable(tableId)
  const f = table.fields.find((x) => x.id === field || x.name.toLowerCase() === field.toLowerCase())
  if (!f) throw new Refused(`${table.name} has no field called ${field}.`)
  if (f.kind !== 'person')
    throw new Refused(
      `${f.name} is not a person field: only a person field holds one row per person.`,
    )
  const w = fresh(actorName(ctx.actor))
  const byRoot = new Map<string, string[]>()
  for (const r of all<{ id: string; who: string | null }>(
    records.db,
    `SELECT id, ${quote(f.slug)} AS who FROM ${quote(table.slug)} WHERE ${quote(f.slug)} IS NOT NULL ORDER BY created_at, rowid`,
  )) {
    const root = records.peopleRoot?.(String(r.who)) ?? String(r.who)
    byRoot.set(root, [...(byRoot.get(root) ?? []), r.id])
  }
  for (const ids of byRoot.values())
    for (const id of ids.slice(1)) foldRow(records, w, table, ids[0] as string, id)
  write(records, w, ctx)
  if (w.folded.length)
    journal(
      records,
      w,
      ctx,
      `Folded ${n(w.folded.length, 'row')} of ${table.name} into the row of the person ${w.folded.length === 1 ? 'it' : 'each'} shares, to make it one row per person.`,
      { table: table.id },
    )
  return records.shape.setPer(table.id, f.id, true, ctx)
}
