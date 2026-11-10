// A value beside the person's (docs/rules.md, D3, D6). The person's value stands; what a page, a
// connection or a script has since is kept beside it, with where it came from and when, so the cell
// is marked and Reset puts it back. A row the person removed stays removed: its item key is
// remembered, and Bring back forgets it (D4).
import { now, one, run } from '../db.ts'
import { append } from '../journal.ts'
import { isPersonsOwn, type Provenance, Refused } from '../kinds.ts'
import type { Table, WriteCtx } from '../shape/index.ts'
import type { Records } from './records.ts'
import type { LandSource, RecordCtx, Snapshot } from './types.ts'

type Beside = NonNullable<Provenance['beside']>

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// A landing meets the person's values: theirs stay, the newer read is kept beside each (or let go
// when the page agrees with them again), and a script's figure stands as before.
export function landBeside(
  records: Records,
  rowId: string,
  was: Snapshot,
  vals: Record<string, unknown>,
  prov: Record<string, Provenance>,
): void {
  for (const k of Object.keys(vals)) {
    const p = was.prov[k]
    if (p?.kind !== 'stated' && p?.kind !== 'computed') continue
    const read = prov[k]
    if (p.kind === 'stated' && read) {
      const agrees = same(vals[k], was.vals[k])
      const beside: Beside | undefined = agrees
        ? p.beside?.kind === 'looked_up'
          ? undefined
          : p.beside
        : { value: vals[k], kind: 'looked_up', source: read.source, at: read.at }
      if (!same(beside, p.beside)) {
        const { beside: _, ...rest } = p
        records.putProvenance(rowId, k, beside ? { ...rest, beside } : rest)
      }
    }
    delete vals[k]
    delete prov[k]
  }
}

// The person types over a value a page, a connection or a script gave: it is kept beside theirs.
// Typed over their own again, what was beside it stays.
export function typedOver(was: Snapshot, prov: Record<string, Provenance>, ctx: RecordCtx): void {
  if (!ctx.byHand) return
  for (const [k, p] of Object.entries(prov)) {
    const old = was.prov[k]
    if (p.kind !== 'stated' || !old || was.vals[k] == null) continue
    if (old.kind === 'stated' && isPersonsOwn(old)) {
      if (old.beside) p.beside = old.beside
      continue
    }
    if (old.kind === 'looked_up')
      p.beside = { value: was.vals[k], kind: 'looked_up', source: old.source, at: old.at }
    else if (old.kind === 'computed')
      p.beside = {
        value: was.vals[k],
        kind: 'computed',
        ...(old.source.formula ? { formula: old.source.formula } : {}),
        ...(old.source.note ? { note: old.source.note } : {}),
        at: now(),
      }
  }
}

// A removed row's item key, per table (a kit's setup row keeps its own mark, kits/shape.ts).
export const removedKey = (table: Table, key: string) => `${table.id}/${key}`

export function removedBefore(records: Records, table: Table, key: string): boolean {
  return records.shape.tombstoned(table.module.id, 'row', removedKey(table, key))
}

// Who a value beside the person's is from, in words: a connection by its name, a reader's page, or
// Alpha's figure; and what Reset puts back.
export function besideFrom(b: Beside): string {
  if (b.kind !== 'looked_up') return 'Alpha'
  const c = b.source?.connector
  return c && !c.startsWith('schedule:') ? `${c[0]?.toUpperCase() ?? ''}${c.slice(1)}` : 'the page'
}
export const resetWords = (b: Beside): string =>
  b.kind === 'looked_up' ? `what ${besideFrom(b)} says` : 'Alpha’s figure'

// A mirror's rows come and go only with its source (rules D8): none is removed in Alpha.
export function mirrorKeeps(table: Table): void {
  if (table.mirror)
    throw new Refused(
      `${table.name} is a mirror of ${table.mirror}: its rows come and go with ${table.mirror}, so none is removed in Alpha. A field of yours on it can be cleared.`,
    )
}

// The rows a read met, each marked with when (rules D12); one the source has again is not gone.
export function readNow(records: Records, ids: string[], at: string): void {
  for (const id of ids)
    run(records.db, 'UPDATE records SET read_at = ?, gone_at = NULL WHERE id = ?', at, id)
}

// Items a connection says are gone at its source (rules D8): their rows are kept, marked gone, out
// of the default lists, so the notes, tasks and links on them stay findable. One line says how many.
export function markGone(
  records: Records,
  table: Table,
  keys: string[],
  source: LandSource,
  ctx: WriteCtx,
): number {
  const at = now()
  const ids = keys.flatMap((k) => {
    const id = records.byKey(table.id, k)
    return id && one(records.db, 'SELECT 1 FROM records WHERE id = ? AND gone_at IS NULL', id)
      ? [id]
      : []
  })
  for (const id of ids) run(records.db, 'UPDATE records SET gone_at = ? WHERE id = ?', at, id)
  if (ids.length)
    append(records.db, {
      actor: ctx.actor,
      kind: 'gone',
      words: `${ids.length} gone from ${source.account ?? source.connector} in ${table.name}; kept here.`,
      data: { table: table.id, records: ids, connector: source.connector },
      user: ctx.user ?? null,
      module: table.module.id,
      run: ctx.run ?? null,
    })
  return ids.length
}
