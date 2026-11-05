// A value beside the person's (docs/rules.md, D3, D6; step 4, Kenil's calls 5 Nov). The person's
// value stands; what a page, a connection or a script has since is kept beside it, with where it
// came from and when, so the cell is marked and Reset puts it back. A row the person removed
// stays removed: its item key is remembered, and Bring back forgets it (D4).
import { now } from '../db.ts'
import { isPersonsOwn, type Provenance } from '../kinds.ts'
import type { Table } from '../shape/index.ts'
import type { Records } from './records.ts'
import type { RecordCtx, Snapshot } from './types.ts'

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
  return c && !c.startsWith('agent:') ? `${c[0]?.toUpperCase() ?? ''}${c.slice(1)}` : 'the page'
}
export const resetWords = (b: Beside): string =>
  b.kind === 'looked_up' ? `what ${besideFrom(b)} says` : 'Alpha’s figure'
