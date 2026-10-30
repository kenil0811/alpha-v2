// Records: rows of the person's tables, a version per change and provenance on every value
// (design §4). Since 22 Oct (Kenil: real tables) a table's rows live in a SQLite table of their
// own (ddl.ts), one typed column per field, a junction table per list relation; their
// provenance sits in `provenance`, their earlier versions in `versions`, and `records` is the
// registry that says which table a row is in. The store: rows added, changed, removed and landed;
// reading them is in reading.ts, storing them in storing.ts, as functions of the store.

import type { CardInput } from '../cards.ts'
import { all, type Db, newId, now, one, tx } from '../db.ts'
import { quote } from '../ddl.ts'
import { append } from '../journal.ts'
import { checkValue, type Provenance, type ProvenanceInput, Refused, type Said } from '../kinds.ts'
import { actorName, findField, type Shape, type Table, type WriteCtx } from '../shape/index.ts'
import { checkPer, perRow } from './fold.ts'
import {
  byKey,
  column,
  count,
  get,
  history,
  ids,
  idsWhere,
  itemKeys,
  keys,
  list,
  listsOf,
  personsOwn,
  provenanceOf,
  rawValues,
  readRow,
  rowVals,
  tableOf,
  valuesOf,
} from './reading.ts'
import {
  describe,
  describeStored,
  index,
  insert,
  keepVersion,
  prepare,
  putProvenance,
  snapshot,
  unindex,
  update,
} from './storing.ts'
import { putInTrash, tagVersions, takeOutAll } from './trash.ts'
import type {
  ChangeInput,
  Landed,
  LandInput,
  LandSource,
  RecordCtx,
  RecordOut,
  Row,
  RowInput,
  RowWatch,
  Snapshot,
  Stored,
} from './types.ts'
import { present, sortKeys } from './types.ts'

// A part is never on its own (core step 3a): a new row gives the row it is part of, and a change
// never clears it.
function partOfGiven(table: Table, vals: Record<string, unknown>, fresh: boolean): void {
  for (const f of table.fields)
    if (f.partOf && (fresh ? vals[f.id] == null : f.id in vals && vals[f.id] == null))
      throw new Refused(
        `A row of ${table.name} is part of the row its ${f.name} names, so it needs one.`,
      )
}

export class Records {
  db: Db
  shape: Shape
  watch: RowWatch | null = null
  // A person field holds one of the person's people: their id, an address or a name only one has.
  personOf: ((said: string) => string) | null = null
  // One person through merges (core step 3d): the one they are now, their name; and a question
  // put to the person, where a fold finds two values of theirs
  peopleRoot: ((id: string) => string) | null = null
  personName: ((id: string) => string) | null = null
  ask: ((card: CardInput) => void) | null = null

  // A looked-up value's file must be one the world holds: named, it becomes its hash.
  fileOf: (nameOrHash: string) => string | undefined

  constructor(
    db: Db,
    shape: Shape,
    fileOf: (nameOrHash: string) => string | undefined = () => undefined,
  ) {
    this.db = db
    this.shape = shape
    this.fileOf = fileOf
  }

  add(tableId: string, rows: RowInput[], ctx: RecordCtx): string[] {
    if (!rows.length) throw new Refused('There are no rows to add.')
    return tx(this.db, () => {
      const table = this.mustTable(tableId)
      const at = now()
      const ids: string[] = []
      for (const row of rows) {
        const { vals, prov } = this.prepare(
          table,
          row.values,
          row.provenance,
          row.per_field,
          ctx.said ?? null,
          at,
        )
        partOfGiven(table, vals, true)
        checkPer(this, table, vals, null)
        const id = newId('r')
        this.insert(table, id, vals, prov, at, actorName(ctx.actor), null)
        ids.push(id)
      }
      append(this.db, {
        actor: ctx.actor,
        kind: 'wrote',
        words: `Added ${rows.length === 1 ? `a row to ${table.name}: ${this.describe(table, rows[0]?.values ?? {})}` : `${rows.length} rows to ${table.name}`}.`,
        data: { table: table.id, records: ids },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        module: table.module.id,
        run: ctx.run ?? null,
      })
      this.watch?.rows(table, ids, ctx)
      return ids
    })
  }

  change(tableId: string, changes: ChangeInput[], ctx: RecordCtx): void {
    if (!changes.length) throw new Refused('There are no changes.')
    tx(this.db, () => {
      const table = this.mustTable(tableId)
      const at = now()
      const versions: [string, number, Snapshot][] = []
      for (const c of changes) {
        const row = this.readRow(table, c.id)
        if (!row) throw new Refused(`${table.name} has no row ${c.id}.`)
        const { vals, prov } = this.prepare(
          table,
          c.values,
          c.provenance,
          c.per_field,
          ctx.said ?? null,
          at,
        )
        partOfGiven(table, vals, false)
        checkPer(this, table, vals, row.id)
        const was = this.snapshot(table, row)
        this.keepVersion(row, was, at, actorName(ctx.actor))
        versions.push([row.id, row.version, { vals, prov }])
        this.update(table, row.id, vals, prov, at)
        this.index(table, row.id, { ...was.vals, ...vals })
      }
      const line = append(this.db, {
        actor: ctx.actor,
        kind: 'changed',
        words: `Changed ${changes.length === 1 ? 'a row' : `${changes.length} rows`} in ${table.name}.`,
        data: {
          table: table.id,
          records: changes.map((c) => c.id),
          values: changes.map((c) => c.values),
        },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        module: table.module.id,
        run: ctx.run ?? null,
      })
      tagVersions(this, versions, line.id)
      this.watch?.rows(
        table,
        changes.map((c) => c.id),
        ctx,
      )
    })
  }

  // A removed row leaves its table and waits in the trash, whole, for keep_removed_days (core
  // step 1); the journal keeps its values, so Activity can say what was here. Rows pointing at a
  // removed one let go of it in the same transaction, and the words say how many did.
  remove(tableId: string, ids: string[], ctx: WriteCtx): number {
    if (!ids.length) throw new Refused('There are no rows to remove.')
    return tx(this.db, () => {
      const table = this.mustTable(tableId)
      const { gone, cleared, kept, parts } = takeOutAll(this, table, ids, ctx)
      // the rows that were part of them went with them (core step 3a)
      const with_ = parts.length
        ? `, with ${parts.map((p) => `${p.ids.length} row${p.ids.length === 1 ? '' : 's'} of ${p.table.name}`).join(' and ')}`
        : ''
      const line = append(this.db, {
        actor: ctx.actor,
        kind: 'removed',
        words: `Removed ${gone.length === 1 ? `a row from ${table.name}: ${this.describeStored(table, gone[0]?.values ?? {})}` : `${gone.length} rows from ${table.name}`}${with_}${
          cleared
            ? `, cleared from ${cleared} row${cleared === 1 ? '' : 's'} pointing at ${gone.length === 1 ? 'it' : 'them'}`
            : ''
        }.`,
        data: {
          table: table.id,
          records: gone,
          cleared,
          ...(parts.length
            ? { parts: parts.map((p) => ({ table: p.table.id, records: p.ids })) }
            : {}),
        },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        module: table.module.id,
        run: ctx.run ?? null,
      })
      for (const k of kept) putInTrash(this, k.table, k.id, k.kept, line)
      return gone.length
    })
  }

  // What a connection brings in, by each item's own id: new items are added, changed ones change
  // in place (their old values kept as a version), the same ones are left. One journal line.
  land(
    tableId: string,
    items: LandInput[],
    source: LandSource,
    ctx: WriteCtx,
    options: { existing?: boolean } = {},
  ): Landed {
    return tx(this.db, () => {
      const table = this.mustTable(tableId)
      const at = now()
      const out: Landed = { added: 0, changed: 0, same: 0 }
      const touched: string[] = []
      const ids = { added: [] as string[], changed: [] as string[] }
      const versions: [string, number, Snapshot][] = []
      for (const item of items) {
        const row = {
          kind: 'looked_up' as const,
          source: { ...source, item: item.key, ...(item.url ? { url: item.url } : {}) },
        }
        const perField = item.places
          ? Object.fromEntries(
              Object.entries(item.places).map(([name, place]) => [
                name,
                { ...row, source: { ...row.source, ...place } },
              ]),
            )
          : undefined
        const { vals, prov } = this.prepare(table, item.values, row, perField, null, at)
        // in a table of one row per person, the person's row when the key finds none (step 3d)
        const r = item.row
          ? this.readRow(table, item.row)
          : (one<Row>(this.db, `SELECT * FROM ${quote(table.slug)} WHERE item_key = ?`, item.key) ??
            perRow(this, table, vals))
        if (!r && item.row) throw new Refused(`${table.name} has no row ${item.row}.`)
        if (!r && options.existing) continue
        if (!r) {
          partOfGiven(table, vals, true)
          checkPer(this, table, vals, null)
          const id = newId('r')
          this.insert(table, id, vals, prov, at, actorName(ctx.actor), item.key)
          touched.push(id)
          ids.added.push(id)
          out.added++
          continue
        }
        const was = this.snapshot(table, r)
        // What the person said stands: a connection or a reader never writes over it. Nor over a
        // figure a script worked out (a deal's staff counted from its census): what the
        // documents give stands over what a page says.
        for (const k of Object.keys(vals))
          if (was.prov[k]?.kind === 'stated' || was.prov[k]?.kind === 'computed') {
            delete vals[k]
            delete prov[k]
          }
        const merged = { ...was.vals, ...vals }
        if (JSON.stringify(sortKeys(present(merged))) === JSON.stringify(sortKeys(was.vals))) {
          out.same++
          continue
        }
        this.keepVersion(r, was, at, actorName(ctx.actor))
        versions.push([r.id, r.version, { vals, prov }])
        this.update(table, r.id, vals, prov, at)
        this.index(table, r.id, merged)
        touched.push(r.id)
        ids.changed.push(r.id)
        out.changed++
      }
      if (out.added || out.changed) {
        const line = append(this.db, {
          actor: ctx.actor,
          kind: 'landed',
          words: `${[
            out.added ? `${out.added} new` : '',
            out.changed ? `${out.changed} changed` : '',
          ]
            .filter(Boolean)
            .join(' and ')} in ${table.name} from ${source.account ?? source.connector}.`,
          // the rows by id, so the run that landed them can be reverted
          data: {
            table: table.id,
            ...out,
            connector: source.connector,
            account: source.account,
            ids,
          },
          user: ctx.user ?? null,
          run: ctx.run ?? null,
          module: table.module.id,
        })
        tagVersions(this, versions, line.id)
      }
      this.watch?.rows(table, touched, ctx)
      return out
    })
  }

  // The rows a connection landed since a time, oldest first, with their values by field id.
  landed(
    tableId: string,
    since: string,
  ): {
    id: string
    key: string
    createdAt: string
    vals: Record<string, unknown>
    from: { connector: string; account: string } | null // the connection that landed it
  }[] {
    const table = this.mustTable(tableId)
    const rows = all<Row>(
      this.db,
      `SELECT t.*, (SELECT p.source FROM provenance p WHERE p.record_id = t.id ORDER BY p.field_id LIMIT 1) AS landed_from
       FROM ${quote(table.slug)} t WHERE t.item_key IS NOT NULL AND t.created_at >= ? ORDER BY t.created_at, t.rowid`,
      since,
    )
    const lists = this.lists(
      table,
      rows.map((x) => x.id),
    )
    return rows.map((x) => ({
      id: x.id,
      key: x.item_key as string,
      createdAt: x.created_at,
      vals: this.rowVals(table, x, lists.get(x.id)),
      from: landedFrom(x.landed_from),
    }))
  }

  // What a script works a value out as, kept beside the person's own (design §12: an overridden
  // value keeps the computed one, with Reset). Only beside a value the person stated; it changes
  // neither the value nor its version.
  keepBeside(
    tableId: string,
    id: string,
    beside: Record<string, { value: unknown; formula?: string; note?: string }>,
  ): void {
    const table = this.mustTable(tableId)
    if (!this.readRow(table, id)) return
    for (const [name, b] of Object.entries(beside)) {
      const f = findField(table, name)
      const stored = this.provenanceOf([id]).get(id)
      const p = stored?.own[f.id] ?? stored?.all
      if (p?.kind !== 'stated') continue
      const value = checkValue(f.kind, f.name, b.value, f.choices)
      if (JSON.stringify(p.beside?.value) === JSON.stringify(value) && p.beside?.note === b.note)
        continue
      this.putProvenance(id, f.id, {
        ...p,
        beside: {
          value,
          ...(b.formula ? { formula: b.formula } : {}),
          ...(b.note ? { note: b.note } : {}),
          at: now(),
        },
      })
    }
  }

  mustTable(id: string): Table {
    const t = this.shape.table(id)
    if (!t) throw new Refused('That table is not there.')
    return t
  }

  list(tableId: string): RecordOut[] {
    return list(this, tableId)
  }
  get(id: string): { table: Table; record: RecordOut } | undefined {
    return get(this, id)
  }
  tableOf(id: string): Table | undefined {
    return tableOf(this, id)
  }
  rawValues(id: string): { table: Table; vals: Record<string, unknown> } | undefined {
    return rawValues(this, id)
  }
  ids(tableId: string): string[] {
    return ids(this, tableId)
  }
  column(tableId: string, field: string): { id: string; value: unknown }[] {
    return column(this, tableId, field)
  }
  valuesOf(ids: string[], field: string): unknown[] {
    return valuesOf(this, ids, field)
  }
  idsWhere(tableId: string, field: string, values: string[]): string[] {
    return idsWhere(this, tableId, field, values)
  }
  byKey(tableId: string, key: string): string | undefined {
    return byKey(this, tableId, key)
  }
  itemKeys(tableId: string): Map<string, string | null> {
    return itemKeys(this, tableId)
  }
  keys(tableId: string): string[] {
    return keys(this, tableId)
  }
  history(id: string, slug: string): { value: unknown; provenance: Provenance | null }[] {
    return history(this, id, slug)
  }
  count(tableId: string): number {
    return count(this, tableId)
  }
  personsOwn(ids: string[]): boolean {
    return personsOwn(this, ids)
  }
  readRow(table: Table, id: string): Row | undefined {
    return readRow(this, table, id)
  }
  rowVals(
    table: Table,
    row: Row,
    lists: Record<string, string[]> | undefined,
  ): Record<string, unknown> {
    return rowVals(this, table, row, lists)
  }
  lists(table: Table, ids: string[] | null): Map<string, Record<string, string[]>> {
    return listsOf(this, table, ids)
  }
  provenanceOf(ids: string[]): Map<string, Stored> {
    return provenanceOf(this, ids)
  }
  snapshot(table: Table, row: Row): Snapshot {
    return snapshot(this, table, row)
  }
  keepVersion(row: Row, was: Snapshot, at: string, by: string): void {
    keepVersion(this, row, was, at, by)
  }
  putProvenance(id: string, field: string, p: Provenance): void {
    putProvenance(this, id, field, p)
  }
  insert(
    table: Table,
    id: string,
    vals: Record<string, unknown>,
    prov: Record<string, Provenance>,
    at: string,
    by: string,
    itemKey: string | null,
  ): void {
    insert(this, table, id, vals, prov, at, by, itemKey)
  }
  update(
    table: Table,
    id: string,
    vals: Record<string, unknown>,
    prov: Record<string, Provenance>,
    at: string,
  ): void {
    update(this, table, id, vals, prov, at)
  }
  prepare(
    table: Table,
    values: Record<string, unknown>,
    rowProv: ProvenanceInput,
    perField: Record<string, ProvenanceInput> | undefined,
    said: Said | null,
    at: string,
  ): Snapshot {
    return prepare(this, table, values, rowProv, perField, said, at)
  }
  index(table: Table, id: string, vals: Record<string, unknown>, fresh = false): void {
    index(this, table, id, vals, fresh)
  }
  unindex(id: string): void {
    unindex(this, id)
  }
  describe(table: Table, values: Record<string, unknown>): string {
    return describe(this, table, values)
  }
  describeStored(table: Table, vals: Record<string, unknown>): string {
    return describeStored(this, table, vals)
  }
}

// A landed row's connection, from its provenance's source ({connector, account, item}).
function landedFrom(source: unknown): { connector: string; account: string } | null {
  if (typeof source !== 'string') return null
  try {
    const s = JSON.parse(source) as { connector?: unknown; account?: unknown }
    return typeof s.connector === 'string' && typeof s.account === 'string'
      ? { connector: s.connector, account: s.account }
      : null
  } catch {
    return null
  }
}
