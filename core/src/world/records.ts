// Records: rows of the person's tables, a version per change and provenance on every value
// (design §4). Since 22 Oct (Kenil: real tables) a table's rows live in a SQLite table of their
// own (ddl.ts), one typed column per field, a junction table per list relation; their
// provenance sits in `provenance`, their earlier versions in `versions`, and `records` is the
// registry that says which table a row is in. Removing rows deletes them, their versions and
// what pointed at them; the journal keeps what they were.
import { all, type Db, json, newId, now, one, parse, run, tx } from './db.ts'
import { columnsOf, junctionName, lit, quote } from './ddl.ts'
import { append } from './journal.ts'
import {
  checkValue,
  isPersonsOwn,
  type Provenance,
  type ProvenanceInput,
  type ProvenanceKind,
  provenanceFor,
  Refused,
  type Said,
  valueWords,
} from './kinds.ts'
import {
  actorName,
  type Field,
  findField,
  type Shape,
  spec,
  type Table,
  type WriteCtx,
} from './shape.ts'

export interface RowInput {
  values: Record<string, unknown> // by field name
  provenance: ProvenanceInput // for every value in the row...
  per_field?: Record<string, ProvenanceInput> // ...unless a field has its own
}

export interface ChangeInput {
  id: string
  values: Record<string, unknown>
  provenance: ProvenanceInput
  per_field?: Record<string, ProvenanceInput>
}

export interface RecordOut {
  id: string
  version: number
  values: Record<string, unknown> // by the field's current slug
  provenance: Record<string, Provenance> // by the field's current slug
  createdAt: string
  updatedAt: string
}

export interface LandInput {
  key: string // the item's own id at its source: a message id, an event id
  row?: string // or a row already in the table, by its id: what a document says about it
  values: Record<string, unknown> // by field name
  url?: string // the page it was read from, when there is one
  // by field name, the place in a document a value was read from (its file, sheet and cell, or
  // page and line), so the value opens there
  places?: Record<
    string,
    {
      file: string
      sheet?: string
      cell?: string
      page?: number
      line?: number
      box?: [number, number, number, number]
    }
  >
}

export interface LandSource {
  connector: string
  account?: string
  url?: string
}

export interface Landed {
  added: number
  changed: number
  same: number
}

// The values that are there: a null is no value.
function present(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined))
}

// Each valued field's provenance: its own row, else the row's.
function resolve(
  stored: Stored | undefined,
  vals: Record<string, unknown>,
): Record<string, Provenance> {
  const out: Record<string, Provenance> = {}
  if (!stored) return out
  for (const field of Object.keys(vals)) {
    const p = stored.own[field] ?? stored.all
    if (p) out[field] = p
  }
  return out
}

function sortKeys(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)))
}

export interface RecordCtx extends WriteCtx {
  said?: Said | null
}

// A row of a real table: the columns every table has, then the fields' columns by name.
interface Row extends Record<string, unknown> {
  id: string
  version: number
  made_by: string
  created_at: string
  updated_at: string
  item_key: string | null
}

interface ProvRow {
  record_id: string
  field_id: string
  kind: ProvenanceKind
  source: string
  basis: string | null
  at: string
  beside: string | null
}

// Values and provenance of one row, keyed by field id: the shape a version keeps.
interface Snapshot {
  vals: Record<string, unknown>
  prov: Record<string, Provenance>
}

// How a row's provenance is kept (Kenil, 22 Oct: most rows carry one provenance on every
// field): one row for every field not listed (field id '') and a row per field that differs.
// A field's provenance is its own row, else the row's; only fields holding a value have one.
interface Stored {
  all: Provenance | null
  own: Record<string, Provenance>
}

const same = (a: Provenance, b: Provenance) => JSON.stringify(a) === JSON.stringify(b)

// SQLite takes so many bound values in one statement.
const CHUNK = 500

// Who hears about rows written and removed, in the same transaction: the people they name.
export interface RowWatch {
  rows(table: Table, ids: string[], ctx: WriteCtx): void
  gone(ids: string[]): void
}

export class Records {
  private db: Db
  private shape: Shape
  watch: RowWatch | null = null
  // A person field holds one of the person's people: their id, an address or a name only one has.
  personOf: ((said: string) => string) | null = null

  // A looked-up value's file must be one the world holds: named, it becomes its hash.
  private fileOf: (nameOrHash: string) => string | undefined

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
        const was = this.snapshot(table, row)
        this.keepVersion(row, was, at, actorName(ctx.actor))
        this.update(table, row.id, vals, prov, at)
        this.index(table, row.id, { ...was.vals, ...vals })
      }
      append(this.db, {
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
      this.watch?.rows(
        table,
        changes.map((c) => c.id),
        ctx,
      )
    })
  }

  // The journal keeps the removed rows' values, so Activity can say what was here. Rows pointing
  // at a removed one let go of it in the same transaction, and the words say how many did.
  remove(tableId: string, ids: string[], ctx: WriteCtx): number {
    if (!ids.length) throw new Refused('There are no rows to remove.')
    return tx(this.db, () => {
      const table = this.mustTable(tableId)
      const gone: { id: string; values: Record<string, unknown> }[] = []
      let cleared = 0
      for (let i = 0; i < ids.length; i += CHUNK)
        cleared += this.shape.clearPointers(
          table.id,
          `(${ids
            .slice(i, i + CHUNK)
            .map(lit)
            .join(', ')})`,
        )
      for (const id of ids) {
        const row = this.readRow(table, id)
        if (!row) throw new Refused(`${table.name} has no row ${id}.`)
        gone.push({ id, values: this.snapshot(table, row).vals })
        this.watch?.gone([id])
        // a kit's setup row the person removes stays removed through the kit's updates
        if (row.item_key && one(this.db, 'SELECT 1 FROM kit_rows WHERE record_id = ?', id))
          this.shape.tombstone(table.module.id, 'row', row.item_key, ctx)
        for (const f of table.fields)
          if (f.kind === 'relation' && f.many)
            run(
              this.db,
              `DELETE FROM ${quote(junctionName(table.slug, f.slug))} WHERE record_id = ?`,
              id,
            )
        this.unindex(id)
        for (const side of ['versions', 'provenance', 'row_files', 'kit_rows'])
          run(this.db, `DELETE FROM ${side} WHERE record_id = ?`, id)
        run(this.db, `DELETE FROM ${quote(table.slug)} WHERE id = ?`, id)
        run(this.db, 'DELETE FROM records WHERE id = ?', id)
      }
      append(this.db, {
        actor: ctx.actor,
        kind: 'removed',
        words: `Removed ${gone.length === 1 ? `a row from ${table.name}: ${this.describeStored(table, gone[0]?.values ?? {})}` : `${gone.length} rows from ${table.name}`}${
          cleared
            ? `, cleared from ${cleared} row${cleared === 1 ? '' : 's'} pointing at ${gone.length === 1 ? 'it' : 'them'}`
            : ''
        }.`,
        data: { table: table.id, records: gone, cleared },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        module: table.module.id,
        run: ctx.run ?? null,
      })
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
        const r = item.row
          ? this.readRow(table, item.row)
          : one<Row>(this.db, `SELECT * FROM ${quote(table.slug)} WHERE item_key = ?`, item.key)
        if (!r && item.row) throw new Refused(`${table.name} has no row ${item.row}.`)
        if (!r && options.existing) continue
        if (!r) {
          const id = newId('r')
          this.insert(table, id, vals, prov, at, actorName(ctx.actor), item.key)
          touched.push(id)
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
        this.update(table, r.id, vals, prov, at)
        this.index(table, r.id, merged)
        touched.push(r.id)
        out.changed++
      }
      if (out.added || out.changed)
        append(this.db, {
          actor: ctx.actor,
          kind: 'landed',
          words: `${[
            out.added ? `${out.added} new` : '',
            out.changed ? `${out.changed} changed` : '',
          ]
            .filter(Boolean)
            .join(' and ')} in ${table.name} from ${source.account ?? source.connector}.`,
          data: { table: table.id, ...out, connector: source.connector, account: source.account },
          user: ctx.user ?? null,
          run: ctx.run ?? null,
          module: table.module.id,
        })
      this.watch?.rows(table, touched, ctx)
      return out
    })
  }

  list(tableId: string): RecordOut[] {
    const table = this.mustTable(tableId)
    const rows = all<Row>(this.db, `SELECT * FROM ${quote(table.slug)} ORDER BY created_at, rowid`)
    const lists = this.lists(table, null)
    const prov = this.provenanceOfTable(table)
    return rows.map((r) => {
      const vals = this.rowVals(table, r, lists.get(r.id))
      return this.out(table, r, vals, resolve(prov.get(r.id), vals))
    })
  }

  get(id: string): { table: Table; record: RecordOut } | undefined {
    const table = this.tableOf(id)
    if (!table) return undefined
    const r = this.readRow(table, id)
    if (!r) return undefined
    const s = this.snapshot(table, r)
    return { table, record: this.out(table, r, s.vals, s.prov) }
  }

  // The table a row is in, by the registry.
  tableOf(id: string): Table | undefined {
    const r = one<{ table_id: string }>(this.db, 'SELECT table_id FROM records WHERE id = ?', id)
    return r ? this.shape.table(r.table_id) : undefined
  }

  // A row's values keyed by field id, for the readers that derive from them (people).
  rawValues(id: string): { table: Table; vals: Record<string, unknown> } | undefined {
    const table = this.tableOf(id)
    if (!table) return undefined
    const r = this.readRow(table, id)
    return r ? { table, vals: this.rowVals(table, r, undefined) } : undefined
  }

  // A table's row ids, oldest first.
  ids(tableId: string): string[] {
    const table = this.mustTable(tableId)
    return all<{ id: string }>(
      this.db,
      `SELECT id FROM ${quote(table.slug)} ORDER BY created_at, rowid`,
    ).map((r) => r.id)
  }

  // One field's value on every row of a table (a column, read whole).
  column(tableId: string, field: string): { id: string; value: unknown }[] {
    const table = this.mustTable(tableId)
    const f = findField(table, field)
    if (f.kind === 'relation' && f.many)
      return [...this.lists(table, null)].map(([id, by]) => ({ id, value: by[f.id] ?? [] }))
    return all<Row>(
      this.db,
      `SELECT id, ${columnsOf(spec(f))
        .map((c) => quote(c.name))
        .join(', ')} FROM ${quote(table.slug)}`,
    ).map((r) => ({ id: r.id, value: this.rowVals(table, r, {})[f.id] }))
  }

  // One field's value on these rows, in their order.
  valuesOf(ids: string[], field: string): unknown[] {
    const out: unknown[] = []
    for (const id of ids) {
      const r = this.rawValues(id)
      const f = r ? r.table.fields.find((x) => x.id === field || x.slug === field) : undefined
      out.push(r && f ? r.vals[f.id] : undefined)
    }
    return out
  }

  // The rows whose field holds one of these values, newest change first (case apart).
  idsWhere(tableId: string, field: string, values: string[]): string[] {
    if (!values.length) return []
    const table = this.mustTable(tableId)
    const f = findField(table, field)
    if (f.kind === 'money' || (f.kind === 'relation' && f.many)) return []
    const out: string[] = []
    for (let i = 0; i < values.length; i += CHUNK) {
      const part = values.slice(i, i + CHUNK)
      out.push(
        ...all<{ id: string }>(
          this.db,
          `SELECT id FROM ${quote(table.slug)} WHERE lower(${quote(f.slug)}) IN (${part.map(() => '?').join(', ')}) ORDER BY updated_at DESC`,
          ...part.map((v) => v.toLowerCase()),
        ).map((r) => r.id),
      )
    }
    return out
  }

  // The row a connection's item landed as, by the item's own id.
  byKey(tableId: string, key: string): string | undefined {
    const table = this.mustTable(tableId)
    return one<{ id: string }>(
      this.db,
      `SELECT id FROM ${quote(table.slug)} WHERE item_key = ?`,
      key,
    )?.id
  }

  // The rows a connection landed since a time, oldest first, with their values by field id.
  landed(
    tableId: string,
    since: string,
  ): { id: string; key: string; createdAt: string; vals: Record<string, unknown> }[] {
    const table = this.mustTable(tableId)
    const rows = all<Row>(
      this.db,
      `SELECT * FROM ${quote(table.slug)} WHERE item_key IS NOT NULL AND created_at >= ? ORDER BY created_at, rowid`,
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
    }))
  }

  // Each row's item key (none for a row a person or a script added), by row id.
  itemKeys(tableId: string): Map<string, string | null> {
    const table = this.mustTable(tableId)
    return new Map(
      all<{ id: string; item_key: string | null }>(
        this.db,
        `SELECT id, item_key FROM ${quote(table.slug)}`,
      ).map((x) => [x.id, x.item_key]),
    )
  }

  // Every item key a table holds.
  keys(tableId: string): string[] {
    const table = this.mustTable(tableId)
    return all<{ item_key: string }>(
      this.db,
      `SELECT item_key FROM ${quote(table.slug)} WHERE item_key IS NOT NULL`,
    ).map((r) => r.item_key)
  }

  // One value's history, newest first: each value it held, with where it came from. A value
  // that stayed the same across versions shows once, at the first time it was there.
  history(id: string, slug: string): { value: unknown; provenance: Provenance | null }[] {
    const table = this.tableOf(id)
    const r = table ? this.readRow(table, id) : undefined
    if (!table || !r) return []
    const field = table.fields.find((f) => f.slug === slug)?.id
    if (!field) return []
    const current = this.snapshot(table, r)
    const states = [
      ...all<{ vals: string; provenance: string }>(
        this.db,
        'SELECT vals, provenance FROM versions WHERE record_id = ? ORDER BY version',
        id,
      ).map((v) => ({
        value: parse<Record<string, unknown>>(v.vals, {})[field],
        provenance: parse<Record<string, Provenance>>(v.provenance, {})[field] ?? null,
      })),
      { value: current.vals[field], provenance: current.prov[field] ?? null },
    ]
    const out: typeof states = []
    for (const s of states) {
      if (s.value === undefined) continue
      const last = out.at(-1)
      if (last && JSON.stringify(last.value) === JSON.stringify(s.value)) continue
      out.push(s)
    }
    return out.reverse()
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

  count(tableId: string): number {
    const table = this.mustTable(tableId)
    return Number(
      one<{ n: number }>(this.db, `SELECT count(*) AS n FROM ${quote(table.slug)}`)?.n ?? 0,
    )
  }

  // Whether any of these rows holds a value that is the person's own (gate 2).
  personsOwn(ids: string[]): boolean {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const part = ids.slice(i, i + CHUNK)
      const rows = all<ProvRow>(
        this.db,
        `SELECT * FROM provenance WHERE record_id IN (${part.map(() => '?').join(', ')})`,
        ...part,
      )
      if (rows.some((p) => isPersonsOwn(this.toProvenance(p)))) return true
    }
    return false
  }

  private mustTable(id: string): Table {
    const t = this.shape.table(id)
    if (!t) throw new Refused('That table is not there.')
    return t
  }

  private readRow(table: Table, id: string): Row | undefined {
    return one<Row>(this.db, `SELECT * FROM ${quote(table.slug)} WHERE id = ?`, id)
  }

  // A row's values by field id, from its columns and its junction rows. Nothing is a value
  // that is not there: a NULL column is left out, as a missing key was in the JSON.
  private rowVals(
    table: Table,
    row: Row,
    lists: Record<string, string[]> | undefined,
  ): Record<string, unknown> {
    const vals: Record<string, unknown> = {}
    for (const f of table.fields) {
      if (f.kind === 'relation' && f.many) {
        const l = lists === undefined ? this.lists(table, [row.id]).get(row.id) : lists
        if (l?.[f.id]?.length) vals[f.id] = l[f.id]
      } else if (f.kind === 'money') {
        const amount = row[f.slug]
        if (amount !== null && amount !== undefined)
          vals[f.id] = { amount, currency: row[`${f.slug}_currency`] ?? '' }
      } else if (row[f.slug] !== null && row[f.slug] !== undefined) vals[f.id] = row[f.slug]
    }
    return vals
  }

  // The list relations of a table's rows (all of them, or these), by row then field id.
  private lists(table: Table, ids: string[] | null): Map<string, Record<string, string[]>> {
    const out = new Map<string, Record<string, string[]>>()
    for (const f of table.fields) {
      if (!(f.kind === 'relation' && f.many)) continue
      const j = quote(junctionName(table.slug, f.slug))
      const parts: (string[] | null)[] = ids === null ? [null] : []
      if (ids !== null)
        for (let i = 0; i < ids.length; i += CHUNK) parts.push(ids.slice(i, i + CHUNK))
      for (const part of parts) {
        const rows = part
          ? all<{ record_id: string; other_id: string }>(
              this.db,
              `SELECT record_id, other_id FROM ${j} WHERE record_id IN (${part.map(() => '?').join(', ')}) ORDER BY record_id, position`,
              ...part,
            )
          : all<{ record_id: string; other_id: string }>(
              this.db,
              `SELECT record_id, other_id FROM ${j} ORDER BY record_id, position`,
            )
        for (const r of rows) {
          const by = out.get(r.record_id) ?? {}
          const l = by[f.id] ?? []
          l.push(r.other_id)
          by[f.id] = l
          out.set(r.record_id, by)
        }
      }
    }
    return out
  }

  private toProvenance(p: ProvRow): Provenance {
    const beside = parse<Provenance['beside']>(p.beside, undefined)
    return {
      kind: p.kind,
      source: parse(p.source, {}),
      ...(p.basis ? { basis: p.basis } : {}),
      at: p.at,
      ...(beside ? { beside } : {}),
    }
  }

  private keep(out: Map<string, Stored>, p: ProvRow): void {
    const s = out.get(p.record_id) ?? { all: null, own: {} }
    if (p.field_id === '') s.all = this.toProvenance(p)
    else s.own[p.field_id] = this.toProvenance(p)
    out.set(p.record_id, s)
  }

  private provenanceOf(ids: string[]): Map<string, Stored> {
    const out = new Map<string, Stored>()
    for (let i = 0; i < ids.length; i += CHUNK) {
      const part = ids.slice(i, i + CHUNK)
      for (const p of all<ProvRow>(
        this.db,
        `SELECT * FROM provenance WHERE record_id IN (${part.map(() => '?').join(', ')})`,
        ...part,
      ))
        this.keep(out, p)
    }
    return out
  }

  private provenanceOfTable(table: Table): Map<string, Stored> {
    const out = new Map<string, Stored>()
    for (const p of all<ProvRow>(
      this.db,
      'SELECT p.* FROM provenance p JOIN records r ON r.id = p.record_id WHERE r.table_id = ?',
      table.id,
    ))
      this.keep(out, p)
    return out
  }

  private snapshot(table: Table, row: Row): Snapshot {
    const vals = this.rowVals(table, row, undefined)
    return { vals, prov: resolve(this.provenanceOf([row.id]).get(row.id), vals) }
  }

  private keepVersion(row: Row, was: Snapshot, at: string, by: string): void {
    run(
      this.db,
      'INSERT INTO versions (record_id, version, vals, provenance, replaced_at, replaced_by) VALUES (?, ?, ?, ?, ?, ?)',
      row.id,
      row.version,
      json(was.vals),
      json(was.prov),
      at,
      by,
    )
  }

  // A field's value as its columns hold it.
  private columnValues(f: Field, value: unknown): [string, unknown][] {
    if (f.kind === 'money') {
      const m = value as { amount: number; currency: string } | null
      return [
        [f.slug, m ? m.amount : null],
        [`${f.slug}_currency`, m ? m.currency : null],
      ]
    }
    return [[f.slug, value ?? null]]
  }

  private setLists(table: Table, id: string, vals: Record<string, unknown>): void {
    for (const f of table.fields) {
      if (!(f.kind === 'relation' && f.many) || !(f.id in vals)) continue
      const j = quote(junctionName(table.slug, f.slug))
      run(this.db, `DELETE FROM ${j} WHERE record_id = ?`, id)
      const others = (vals[f.id] as string[] | null) ?? []
      others.forEach((other, i) => {
        run(
          this.db,
          `INSERT OR IGNORE INTO ${j} (record_id, other_id, position) VALUES (?, ?, ?)`,
          id,
          other,
          i,
        )
      })
    }
  }

  private putProvenance(id: string, field: string, p: Provenance): void {
    run(
      this.db,
      `INSERT INTO provenance (record_id, field_id, kind, source, basis, at, beside)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (record_id, field_id) DO UPDATE SET kind = excluded.kind, source = excluded.source,
         basis = excluded.basis, at = excluded.at, beside = excluded.beside`,
      id,
      field,
      p.kind,
      json(p.source),
      p.basis ?? null,
      p.at,
      p.beside ? json(p.beside) : null,
    )
  }

  // A fresh row whose values all came the same way keeps one provenance for all of them; on a
  // row already there, a field's provenance is written only where it differs from the row's.
  private setProvenance(id: string, prov: Record<string, Provenance>, fresh: boolean): void {
    const entries = Object.entries(prov)
    if (!entries.length) return
    if (fresh) {
      const first = entries[0]?.[1] as Provenance
      if (entries.every(([, p]) => same(p, first))) {
        this.putProvenance(id, '', first)
        return
      }
      for (const [field, p] of entries) this.putProvenance(id, field, p)
      return
    }
    const stored = this.provenanceOf([id]).get(id) ?? { all: null, own: {} }
    for (const [field, p] of entries) {
      if (stored.all && same(p, stored.all))
        run(this.db, 'DELETE FROM provenance WHERE record_id = ? AND field_id = ?', id, field)
      else this.putProvenance(id, field, p)
    }
  }

  private insert(
    table: Table,
    id: string,
    vals: Record<string, unknown>,
    prov: Record<string, Provenance>,
    at: string,
    by: string,
    itemKey: string | null,
  ): void {
    // its place in the registry: a number that never changes, under which its words are indexed
    run(
      this.db,
      'INSERT INTO records (id, table_id, created_at, seq) VALUES (?, ?, ?, (SELECT coalesce(max(seq), 0) + 1 FROM records))',
      id,
      table.id,
      at,
    )
    const cols: string[] = ['id', 'version', 'made_by', 'created_at', 'updated_at', 'item_key']
    const args: unknown[] = [id, 1, by, at, at, itemKey]
    for (const f of table.fields) {
      if (!(f.id in vals) || (f.kind === 'relation' && f.many)) continue
      for (const [col, v] of this.columnValues(f, vals[f.id])) {
        cols.push(quote(col))
        args.push(v)
      }
    }
    run(
      this.db,
      `INSERT INTO ${quote(table.slug)} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      ...(args as (string | number | null)[]),
    )
    this.setLists(table, id, vals)
    this.setProvenance(id, prov, true)
    this.index(table, id, vals, true)
  }

  // Columns given in `vals` change; the version goes up; the row's time is now.
  private update(
    table: Table,
    id: string,
    vals: Record<string, unknown>,
    prov: Record<string, Provenance>,
    at: string,
  ): void {
    const sets: string[] = ['version = version + 1', 'updated_at = ?']
    const args: unknown[] = [at]
    for (const f of table.fields) {
      if (!(f.id in vals) || (f.kind === 'relation' && f.many)) continue
      for (const [col, v] of this.columnValues(f, vals[f.id])) {
        sets.push(`${quote(col)} = ?`)
        args.push(v)
      }
    }
    args.push(id)
    run(
      this.db,
      `UPDATE ${quote(table.slug)} SET ${sets.join(', ')} WHERE id = ?`,
      ...(args as (string | number | null)[]),
    )
    this.setLists(table, id, vals)
    this.setProvenance(id, prov, false)
    for (const [field, v] of Object.entries(vals))
      if (v === null)
        run(this.db, 'DELETE FROM provenance WHERE record_id = ? AND field_id = ?', id, field)
  }

  private prepare(
    table: Table,
    values: Record<string, unknown>,
    rowProv: ProvenanceInput,
    perField: Record<string, ProvenanceInput> | undefined,
    said: Said | null,
    at: string,
  ): Snapshot {
    if (!values || typeof values !== 'object' || !Object.keys(values).length)
      throw new Refused('A row needs values.')
    const vals: Record<string, unknown> = {}
    const prov: Record<string, Provenance> = {}
    for (const [name, value] of Object.entries(values)) {
      const f = findField(table, name)
      let v = checkValue(f.kind, f.name, value, f.choices)
      if (f.kind === 'relation' && v !== null) {
        // a list relation takes a list; one row's relation takes one row
        if (f.many) v = Array.isArray(v) ? v : [v]
        else if (Array.isArray(v)) {
          if (v.length > 1) throw new Refused(`${f.name} holds one row, not ${v.length}.`)
          v = v[0] ?? null
        }
      }
      if (f.kind === 'person' && typeof v === 'string' && this.personOf) v = this.personOf(v)
      vals[f.id] = v
      // nothing is a value that is not there: a null clears the column and carries no provenance
      if (v === null) continue
      const own = perField
        ? Object.entries(perField).find(([k]) => findField(table, k).id === f.id)?.[1]
        : undefined
      const p = own ?? rowProv
      if (!p)
        throw new Refused(
          `${f.name} needs its provenance: stated, looked up, estimated, assumed or computed.`,
        )
      const made = provenanceFor(p, said, at)
      if (made.source.file !== undefined) {
        const hash = this.fileOf(made.source.file)
        if (!hash) throw new Refused(`There is no file called ${made.source.file}.`)
        made.source.file = hash
      }
      prov[f.id] = made
    }
    return { vals, prov }
  }

  // A row's words in full-text search, under the registry row's sequence number (not its rowid,
  // which a VACUUM may renumber), so a change or a removal finds the one entry at once (a search
  // by record_id reads the whole index: 200,000 rows took over an hour to add that way).
  private index(table: Table, id: string, vals: Record<string, unknown>, fresh = false): void {
    if (!fresh) this.unindex(id)
    const words = [table.name, ...Object.values(vals).map(valueWords)].filter(Boolean).join(' ')
    run(
      this.db,
      'INSERT INTO records_fts (rowid, record_id, table_id, words) VALUES ((SELECT seq FROM records WHERE id = ?), ?, ?, ?)',
      id,
      id,
      table.id,
      words,
    )
  }

  private unindex(id: string): void {
    run(this.db, 'DELETE FROM records_fts WHERE rowid = (SELECT seq FROM records WHERE id = ?)', id)
  }

  // Stored by field id, so a rename keeps every value; read out by the fields' current names.
  private out(
    table: Table,
    r: Row,
    vals: Record<string, unknown>,
    prov: Record<string, Provenance>,
  ): RecordOut {
    const values: Record<string, unknown> = {}
    const provenance: Record<string, Provenance> = {}
    for (const f of table.fields) {
      if (f.id in vals) values[f.slug] = vals[f.id]
      if (f.id in prov) provenance[f.slug] = prov[f.id] as Provenance
    }
    return {
      id: r.id,
      version: r.version,
      values,
      provenance,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  }

  private describe(table: Table, values: Record<string, unknown>): string {
    return Object.entries(values)
      .map(([k, v]) => `${findField(table, k).name} ${valueWords(v)}`)
      .join(', ')
  }

  private describeStored(table: Table, vals: Record<string, unknown>): string {
    return Object.entries(vals)
      .map(([id, v]) => `${table.fields.find((f) => f.id === id)?.name ?? id} ${valueWords(v)}`)
      .join(', ')
  }
}
