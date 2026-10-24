import { all, json, now, one, parse, run, tx } from '../db.ts'
import { dropFieldSql, dropTableSql, junctionName, lit, quote } from '../ddl.ts'
import { append } from '../journal.ts'
import { type FieldKind, Refused } from '../kinds.ts'
import { ViewConfig } from '../views.ts'
import { writeManifest } from './manifest.ts'
import type { Shape } from './shape.ts'
import type { Field, Table, WriteCtx } from './types.ts'
import { actorName, findField, spec } from './types.ts'

// Removing a table removes its rows and their versions; the journal keeps that they were here.
export function removeTable(shape: Shape, tableId: string, ctx: WriteCtx): void {
  tx(shape.db, () => {
    const table = shape.table(tableId)
    if (!table) throw new Refused('That table is not there.')
    const count = Number(
      one<{ n: number }>(shape.db, 'SELECT count(*) AS n FROM records WHERE table_id = ?', table.id)
        ?.n ?? 0,
    )
    shape.onGone?.(
      all<{ id: string }>(shape.db, 'SELECT id FROM records WHERE table_id = ?', table.id).map(
        (r) => r.id,
      ),
    )
    clearPointers(shape, table.id, `(SELECT id FROM records WHERE table_id = ${lit(table.id)})`)
    for (const side of ['versions', 'provenance', 'row_files', 'kit_rows'])
      run(
        shape.db,
        `DELETE FROM ${side} WHERE record_id IN (SELECT id FROM records WHERE table_id = ?)`,
        table.id,
      )
    run(shape.db, 'DELETE FROM records_fts WHERE table_id = ?', table.id)
    for (const sql of dropTableSql(table.slug, table.fields.map(spec))) shape.db.exec(sql)
    run(shape.db, 'DELETE FROM records WHERE table_id = ?', table.id)
    run(shape.db, 'DELETE FROM views WHERE table_id = ?', table.id)
    run(shape.db, 'DELETE FROM fields WHERE table_id = ?', table.id)
    run(shape.db, 'DELETE FROM tables WHERE id = ?', table.id)
    tombstone(shape, table.module.id, 'table', table.name, ctx)
    append(shape.db, {
      actor: ctx.actor,
      kind: 'removed',
      words: `Removed the table ${table.name}${count ? ` and its ${count} row${count === 1 ? '' : 's'}` : ''}.`,
      data: { table: table.id, name: table.name, rows: count },
      user: ctx.user ?? null,
      turn: ctx.turn ?? null,
      module: table.module.id,
      run: ctx.run ?? null,
    })
    writeManifest(shape, table.module)
  })
}

// Removing a field drops its column (or its junction table) and its provenance; the versions
// keep what the rows held under it, and the saved views forget it.
export function removeField(shape: Shape, tableId: string, field: string, ctx: WriteCtx): Table {
  return tx(shape.db, () => {
    const table = shape.table(tableId)
    if (!table) throw new Refused('That table is not there.')
    const f = findField(table, field)
    dropField(shape, table, f, ctx)
    append(shape.db, {
      actor: ctx.actor,
      kind: 'removed',
      words: `Removed the field ${f.name} from ${table.name}.`,
      data: { table: table.id, field: f.id, name: f.name, kind: f.kind },
      user: ctx.user ?? null,
      turn: ctx.turn ?? null,
      module: table.module.id,
      run: ctx.run ?? null,
    })
    writeManifest(shape, table.module)
    return shape.table(table.id) as Table
  })
}

export function dropField(shape: Shape, table: Table, f: Field, ctx: WriteCtx): void {
  for (const sql of dropFieldSql(table.slug, table.id, spec(f))) shape.db.exec(sql)
  run(shape.db, 'DELETE FROM provenance WHERE field_id = ?', f.id)
  run(shape.db, 'DELETE FROM fields WHERE id = ?', f.id)
  dropFieldFromViews(shape, table.id, f.id)
  tombstone(shape, table.module.id, 'field', f.key ?? f.name, ctx)
}

// A field a kit no longer uses (decision 4): hidden, its column and rows kept, so the person
// can still remove its rows, or not.
export function hideField(shape: Shape, tableId: string, field: string, ctx: WriteCtx): Table {
  return tx(shape.db, () => {
    const table = shape.table(tableId)
    if (!table) throw new Refused('That table is not there.')
    const f = findField(table, field)
    run(shape.db, 'UPDATE fields SET hidden = 1 WHERE id = ?', f.id)
    append(shape.db, {
      actor: ctx.actor,
      kind: 'shaped',
      words: `${table.name} no longer uses ${f.name}; its values are kept.`,
      data: { table: table.id, field: f.id, name: f.name, hidden: true },
      user: ctx.user ?? null,
      turn: ctx.turn ?? null,
      module: table.module.id,
      run: ctx.run ?? null,
    })
    writeManifest(shape, table.module)
    return shape.table(table.id) as Table
  })
}

// The fields a table no longer uses, each with how many rows still hold a value under it.
export function hiddenFields(shape: Shape, tableId: string): (Field & { rows: number })[] {
  const t = shape.table(tableId)
  if (!t) return []
  return all<{
    id: string
    name: string
    slug: string
    kind: FieldKind
    options: string
    key: string | null
  }>(
    shape.db,
    'SELECT id, name, slug, kind, options, key FROM fields WHERE table_id = ? AND hidden = 1 ORDER BY position',
    t.id,
  ).map((f) => {
    const o = parse<{ many?: boolean; indexed?: boolean; relatesTo?: string }>(f.options, {})
    const field: Field = {
      id: f.id,
      name: f.name,
      slug: f.slug,
      kind: f.kind,
      choices: [],
      tones: {},
      about: null,
      aboutBy: null,
      relatesTo: o.relatesTo ?? null,
      many: f.kind === 'relation' && !!o.many,
      indexed: !!o.indexed,
      key: f.key,
    }
    const rows = field.many
      ? Number(
          one<{ n: number }>(
            shape.db,
            `SELECT count(DISTINCT record_id) AS n FROM ${quote(junctionName(t.slug, f.slug))}`,
          )?.n ?? 0,
        )
      : Number(
          one<{ n: number }>(
            shape.db,
            `SELECT count(*) AS n FROM ${quote(t.slug)} WHERE ${quote(f.slug)} IS NOT NULL`,
          )?.n ?? 0,
        )
    return { ...field, rows }
  })
}

// A hidden field removed for good, with its values: through the deletes-own gate's words in
// the window, by the person.
export function removeHiddenField(
  shape: Shape,
  tableId: string,
  fieldId: string,
  ctx: WriteCtx,
): void {
  tx(shape.db, () => {
    const table = shape.table(tableId)
    const f = hiddenFields(shape, tableId).find((x) => x.id === fieldId)
    if (!table || !f) throw new Refused('That field is not there.')
    dropField(shape, table, f, ctx)
    append(shape.db, {
      actor: ctx.actor,
      kind: 'removed',
      words: `Removed the field ${f.name} from ${table.name}, with its ${f.rows} value${f.rows === 1 ? '' : 's'}.`,
      data: { table: table.id, field: f.id, name: f.name, rows: f.rows },
      user: ctx.user ?? null,
      turn: ctx.turn ?? null,
      module: table.module.id,
      run: ctx.run ?? null,
    })
    writeManifest(shape, table.module)
  })
}

// What the person removed on purpose, so a kit's update does not bring it back.
export function tombstone(
  shape: Shape,
  moduleId: string,
  kind: 'field' | 'table' | 'row' | 'view',
  key: string,
  ctx: WriteCtx,
): void {
  run(
    shape.db,
    'INSERT OR REPLACE INTO tombstones (module_id, kind, key, removed_at, removed_by) VALUES (?, ?, ?, ?, ?)',
    moduleId,
    kind,
    key.toLowerCase(),
    now(),
    actorName(ctx.actor),
  )
}

export function tombstoned(
  shape: Shape,
  moduleId: string,
  kind: 'field' | 'table' | 'row' | 'view',
  key: string,
): boolean {
  return !!one(
    shape.db,
    'SELECT 1 FROM tombstones WHERE module_id = ? AND kind = ? AND key = ?',
    moduleId,
    kind,
    key.toLowerCase(),
  )
}

// The rows pointing at these rows let go of them: a relation column set to nothing, a
// junction row gone. `ids` is a SQL list or subquery of the rows going; back comes how many
// rows let go.
export function clearPointers(shape: Shape, tableId: string, ids: string): number {
  const rows = new Set<string>()
  for (const t of shape.tables())
    for (const f of t.fields) {
      if (f.kind !== 'relation' || f.relatesTo !== tableId) continue
      if (f.many) {
        const j = quote(junctionName(t.slug, f.slug))
        const was = all<{ record_id: string }>(
          shape.db,
          `SELECT DISTINCT record_id FROM ${j} WHERE other_id IN ${ids}`,
        ).map((r) => r.record_id)
        for (const id of was) rows.add(id)
        run(shape.db, `DELETE FROM ${j} WHERE other_id IN ${ids}`)
        // a list left empty has no value there any more, so no provenance either
        for (const id of was)
          run(
            shape.db,
            `DELETE FROM provenance WHERE record_id = ? AND field_id = ? AND NOT EXISTS (SELECT 1 FROM ${j} WHERE record_id = ?)`,
            id,
            f.id,
            id,
          )
      } else {
        const was = all<{ id: string }>(
          shape.db,
          `SELECT id FROM ${quote(t.slug)} WHERE ${quote(f.slug)} IN ${ids}`,
        ).map((r) => r.id)
        for (const id of was) rows.add(id)
        run(
          shape.db,
          `UPDATE ${quote(t.slug)} SET ${quote(f.slug)} = NULL WHERE ${quote(f.slug)} IN ${ids}`,
        )
        for (const id of was)
          run(shape.db, 'DELETE FROM provenance WHERE record_id = ? AND field_id = ?', id, f.id)
      }
    }
  return rows.size
}

// How many rows point at these rows, for the words before a removal.
export function pointersAt(shape: Shape, tableId: string, ids: string[]): number {
  if (!ids.length) return 0
  const marks = ids.map(() => '?').join(', ')
  const rows = new Set<string>()
  for (const t of shape.tables())
    for (const f of t.fields) {
      if (f.kind !== 'relation' || f.relatesTo !== tableId) continue
      for (const r of all<{ id: string }>(
        shape.db,
        f.many
          ? `SELECT DISTINCT record_id AS id FROM ${quote(junctionName(t.slug, f.slug))} WHERE other_id IN (${marks})`
          : `SELECT id FROM ${quote(t.slug)} WHERE ${quote(f.slug)} IN (${marks})`,
        ...ids,
      ))
        rows.add(r.id)
    }
  return rows.size
}

export function dropFieldFromViews(shape: Shape, tableId: string, fieldId: string): void {
  for (const v of all<{ id: string; config: string }>(
    shape.db,
    'SELECT id, config FROM views WHERE table_id = ?',
    tableId,
  )) {
    const c = ViewConfig.parse(parse(v.config, {}))
    const not = (id: string | null) => (id === fieldId ? null : id)
    const kept: ViewConfig = {
      ...c,
      filters: { ...c.filters, rules: c.filters.rules.filter((r) => r.field !== fieldId) },
      sorts: c.sorts.filter((x) => x.field !== fieldId),
      group: not(c.group),
      by: not(c.by),
      measure: not(c.measure),
      hidden: c.hidden.filter((x) => x !== fieldId),
      order: c.order.filter((x) => x !== fieldId),
      widths: Object.fromEntries(Object.entries(c.widths).filter(([k]) => k !== fieldId)),
      totals: Object.fromEntries(Object.entries(c.totals).filter(([k]) => k !== fieldId)),
      colours: {
        tint: not(c.colours.tint),
        when: c.colours.when.filter((w) => w.field !== fieldId),
      },
    }
    if (JSON.stringify(kept) !== JSON.stringify(c))
      run(shape.db, 'UPDATE views SET config = ? WHERE id = ?', json(kept), v.id)
  }
}
