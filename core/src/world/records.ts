// Records: rows of the person's tables, a version per change and provenance on every value
// (design §4). Removing rows deletes them and their versions; the journal keeps what they were.
import { all, type Db, json, newId, now, one, parse, run, tx } from './db.ts'
import { append } from './journal.ts'
import {
  checkValue,
  isPersonsOwn,
  type Provenance,
  type ProvenanceInput,
  provenanceFor,
  Refused,
  type Said,
  valueWords,
} from './kinds.ts'
import { actorName, findField, type Shape, type Table, type WriteCtx } from './shape.ts'

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

export interface RecordCtx extends WriteCtx {
  said?: Said | null
}

interface RecordRow {
  id: string
  table_id: string
  version: number
  vals: string
  provenance: string
  created_at: string
  updated_at: string
}

export class Records {
  private db: Db
  private shape: Shape

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
        run(
          this.db,
          `INSERT INTO records (id, table_id, version, vals, provenance, made_by, created_at, updated_at)
           VALUES (?, ?, 1, ?, ?, ?, ?, ?)`,
          id,
          table.id,
          json(vals),
          json(prov),
          actorName(ctx.actor),
          at,
          at,
        )
        this.index(table, id, vals)
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
      return ids
    })
  }

  change(tableId: string, changes: ChangeInput[], ctx: RecordCtx): void {
    if (!changes.length) throw new Refused('There are no changes.')
    tx(this.db, () => {
      const table = this.mustTable(tableId)
      const at = now()
      for (const c of changes) {
        const r = one<RecordRow>(
          this.db,
          'SELECT * FROM records WHERE id = ? AND table_id = ?',
          c.id,
          table.id,
        )
        if (!r) throw new Refused(`${table.name} has no row ${c.id}.`)
        const { vals, prov } = this.prepare(
          table,
          c.values,
          c.provenance,
          c.per_field,
          ctx.said ?? null,
          at,
        )
        const merged = { ...parse<Record<string, unknown>>(r.vals, {}), ...vals }
        const mergedProv = { ...parse<Record<string, Provenance>>(r.provenance, {}), ...prov }
        run(
          this.db,
          'INSERT INTO record_versions (record_id, version, vals, provenance, replaced_at, replaced_by) VALUES (?, ?, ?, ?, ?, ?)',
          r.id,
          r.version,
          r.vals,
          r.provenance,
          at,
          actorName(ctx.actor),
        )
        run(
          this.db,
          'UPDATE records SET version = version + 1, vals = ?, provenance = ?, updated_at = ? WHERE id = ?',
          json(merged),
          json(mergedProv),
          at,
          r.id,
        )
        this.index(table, r.id, merged)
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
    })
  }

  // The journal keeps the removed rows' values, so Activity can say what was here.
  remove(tableId: string, ids: string[], ctx: WriteCtx): number {
    if (!ids.length) throw new Refused('There are no rows to remove.')
    return tx(this.db, () => {
      const table = this.mustTable(tableId)
      const gone: { id: string; values: Record<string, unknown> }[] = []
      for (const id of ids) {
        const r = one<RecordRow>(
          this.db,
          'SELECT * FROM records WHERE id = ? AND table_id = ?',
          id,
          table.id,
        )
        if (!r) throw new Refused(`${table.name} has no row ${id}.`)
        gone.push({ id, values: parse(r.vals, {}) })
        run(this.db, 'DELETE FROM record_versions WHERE record_id = ?', id)
        run(this.db, 'DELETE FROM records_fts WHERE record_id = ?', id)
        run(this.db, 'DELETE FROM records WHERE id = ?', id)
      }
      append(this.db, {
        actor: ctx.actor,
        kind: 'removed',
        words: `Removed ${gone.length === 1 ? `a row from ${table.name}: ${this.describeStored(table, gone[0]?.values ?? {})}` : `${gone.length} rows from ${table.name}`}.`,
        data: { table: table.id, records: gone },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        module: table.module.id,
        run: ctx.run ?? null,
      })
      return gone.length
    })
  }

  list(tableId: string): RecordOut[] {
    const table = this.mustTable(tableId)
    return all<RecordRow>(
      this.db,
      'SELECT * FROM records WHERE table_id = ? ORDER BY created_at, id',
      table.id,
    ).map((r) => this.out(table, r))
  }

  get(id: string): { table: Table; record: RecordOut } | undefined {
    const r = one<RecordRow>(this.db, 'SELECT * FROM records WHERE id = ?', id)
    if (!r) return undefined
    const table = this.mustTable(r.table_id)
    return { table, record: this.out(table, r) }
  }

  count(tableId: string): number {
    return Number(
      one<{ n: number }>(this.db, 'SELECT count(*) AS n FROM records WHERE table_id = ?', tableId)
        ?.n ?? 0,
    )
  }

  // Whether any of these rows holds a value that is the person's own (gate 2).
  personsOwn(ids: string[]): boolean {
    return ids.some((id) => {
      const r = one<{ provenance: string }>(
        this.db,
        'SELECT provenance FROM records WHERE id = ?',
        id,
      )
      return r
        ? Object.values(parse<Record<string, Provenance>>(r.provenance, {})).some(isPersonsOwn)
        : false
    })
  }

  private mustTable(id: string): Table {
    const t = this.shape.table(id)
    if (!t) throw new Refused('That table is not there.')
    return t
  }

  private prepare(
    table: Table,
    values: Record<string, unknown>,
    rowProv: ProvenanceInput,
    perField: Record<string, ProvenanceInput> | undefined,
    said: Said | null,
    at: string,
  ) {
    if (!values || typeof values !== 'object' || !Object.keys(values).length)
      throw new Refused('A row needs values.')
    const vals: Record<string, unknown> = {}
    const prov: Record<string, Provenance> = {}
    for (const [name, value] of Object.entries(values)) {
      const f = findField(table, name)
      vals[f.id] = checkValue(f.kind, f.name, value, f.choices)
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

  private index(table: Table, id: string, vals: Record<string, unknown>): void {
    run(this.db, 'DELETE FROM records_fts WHERE record_id = ?', id)
    const words = [table.name, ...Object.values(vals).map(valueWords)].filter(Boolean).join(' ')
    run(
      this.db,
      'INSERT INTO records_fts (record_id, table_id, words) VALUES (?, ?, ?)',
      id,
      table.id,
      words,
    )
  }

  // Stored by field id, so a rename keeps every value; read out by the fields' current names.
  private out(table: Table, r: RecordRow): RecordOut {
    const vals = parse<Record<string, unknown>>(r.vals, {})
    const prov = parse<Record<string, Provenance>>(r.provenance, {})
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
