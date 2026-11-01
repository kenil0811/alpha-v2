// A row on its own (core step 3b, Kenil's yes 27 Oct): the row's view, in the side panel and as a
// page, reads it here with its table's fields, and what is around it: the rows that are part of
// it (step 3a), the rows of other tables that link to it, and the notes that mention it. Nothing
// here is stored: links are the relations the rows already hold, mentions are read from the
// notes themselves, so there is nothing to keep in step.
import { z } from 'zod'
import { config } from '../../config.ts'
import { all } from '../../world/db.ts'
import { junctionName, quote } from '../../world/ddl.ts'
import { Refused } from '../../world/kinds.ts'
import type { Field, Shape, Table } from '../../world/shape/index.ts'
import { summaryShows, summaryWords } from '../../world/shape/summary.ts'
import type { Ctx } from '../ctx.ts'
import type { FieldView, RowAround, RowPageView } from '../types.ts'

// A field as the window reads it: a summary as the kind it shows as, with what it is in words.
export const fieldViews =
  (shape: Shape) =>
  (f: Field): FieldView => ({
    id: f.id,
    name: f.name,
    slug: f.slug,
    kind: f.kind,
    choices: f.choices,
    tones: f.tones,
    ...(f.summary ? summaryShows(shape, f.summary) : {}),
    many: f.many || f.tags,
    relatesTo: f.kind === 'relation' ? (f.relatesTo ?? null) : null,
    summary: f.summary ? summaryWords(shape, f.summary) : null,
    about: f.about,
    aboutBy: f.aboutBy,
  })

export function registerRows(ctx: Ctx): void {
  const { app, world } = ctx
  const { sourceView } = ctx.views
  const fieldView = fieldViews(world.shape)

  const named = (t: Table, ids: string[]) =>
    ids.flatMap((id) => {
      const r = world.records.get(id)
      return r ? [{ id, name: world.rowName(t, r.record.values) || 'A row' }] : []
    })

  // The notes of every table that keeps them, searched for a mention: of a row, or of a person
  // (under any id merged into them).
  function mentioning(targets: string[]): RowAround['mentions'] {
    const out: RowAround['mentions'] = []
    for (const t of world.shape.tables()) {
      const f = t.fields.find((x) => x.kind === 'notes')
      if (!f || !targets.length) continue
      const ids = all<{ id: string }>(
        world.db,
        `SELECT id FROM ${quote(t.slug)} WHERE ${targets.map(() => `instr(${quote(f.slug)}, ?) > 0`).join(' OR ')}`,
        ...targets,
      ).map((r) => r.id)
      if (ids.length) out.push({ table: { id: t.id, name: t.name }, rows: named(t, ids) })
    }
    return out
  }

  app.get('/api/rows/:row', async (req): Promise<RowPageView> => {
    const { row } = z.object({ row: z.string() }).parse(req.params)
    const got = world.records.get(row)
    if (!got) throw new Refused('That row is not there.')
    const t = got.table
    const r = got.record
    const related = t.fields
      .filter((f) => f.kind === 'relation' && f.relatesTo)
      .flatMap((f) => {
        const v = r.values[f.slug]
        const other = world.shape.table(f.relatesTo as string)
        const ids = (Array.isArray(v) ? v : v ? [v] : []).map(String)
        return other ? named(other, ids).map((x) => [x.id, x.name] as const) : []
      })
    const people = t.fields
      .filter((f) => f.kind === 'person')
      .map((f) => r.values[f.slug])
      .filter((v): v is string => typeof v === 'string')
    return {
      table: { id: t.id, name: t.name, module: { id: t.module.id, name: t.module.name } },
      documents: t.documents,
      fields: t.fields.map(fieldView),
      row: {
        id: r.id,
        values: r.values,
        sources: Object.fromEntries(
          Object.entries(r.provenance).map(([k, p]) => [k, sourceView(p)]),
        ),
      },
      names: { ...Object.fromEntries(related), ...world.people.names(people) },
      title: world.rowName(t, r.values) || 'A row',
    }
  })

  app.get('/api/rows/:row/around', async (req): Promise<RowAround> => {
    const { row } = z.object({ row: z.string() }).parse(req.params)
    const t = world.records.tableOf(row)
    if (!t) throw new Refused('That row is not there.')
    const parts = world.shape.partsOf(t.id).map((p) => {
      const rel = p.table.fields.find((f) => f.id === p.field)
      const ids = rel ? world.records.idsWhere(p.table.id, rel.name, [row]) : []
      // the ones changed most lately, with how many in all: Open as a table shows the rest
      const rows = ids.slice(0, config.limits().parts_shown).flatMap((rid) => {
        const r = world.records.get(rid)
        return r ? [{ id: rid, values: r.record.values }] : []
      })
      // the people and rows its fields name, so the small table shows names, not ids
      const said = (kind: string) =>
        p.table.fields
          .filter((f) => f.kind === kind)
          .flatMap((f) => rows.map((r) => r.values[f.slug]))
          .flatMap((v) => (Array.isArray(v) ? v : v ? [v] : []))
          .map(String)
      const names: Record<string, string> = world.people.names(said('person'))
      for (const f of p.table.fields)
        if (f.kind === 'relation' && f.relatesTo && f.id !== p.field) {
          const other = world.shape.table(f.relatesTo)
          if (other)
            for (const x of named(
              other,
              rows.flatMap((r) => {
                const v = r.values[f.slug]
                return (Array.isArray(v) ? v : v ? [v] : []).map(String)
              }),
            ))
              names[x.id] = x.name
        }
      return {
        table: { id: p.table.id, name: p.table.name },
        relation: rel?.name ?? '',
        fields: p.table.fields.filter((f) => f.id !== p.field && f.kind !== 'notes').map(fieldView),
        rows,
        count: ids.length,
        names,
      }
    })
    // the rows of other tables that link here, not as their part
    const links: RowAround['links'] = []
    for (const other of world.shape.tables())
      for (const f of other.fields) {
        if (f.kind !== 'relation' || f.relatesTo !== t.id || f.partOf) continue
        const ids = f.many
          ? all<{ record_id: string }>(
              world.db,
              `SELECT record_id FROM ${quote(junctionName(other.slug, f.slug))} WHERE other_id = ?`,
              row,
            ).map((x) => x.record_id)
          : world.records.idsWhere(other.id, f.name, [row])
        if (ids.length)
          links.push({
            table: { id: other.id, name: other.name },
            field: f.name,
            rows: named(other, ids),
          })
      }
    return { parts, links, mentions: mentioning([`(row:${row})`]) }
  })

  // The notes that mention a person, under their id or any merged into them.
  app.get('/api/people/:id/mentions', async (req): Promise<RowAround['mentions']> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const ids = all<{ id: string }>(
      world.db,
      'SELECT id FROM people WHERE id = ? OR merged_into = ?',
      id,
      id,
    ).map((x) => x.id)
    return mentioning(ids.map((x) => `(person:${x})`))
  })
}
