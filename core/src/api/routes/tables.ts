import { type Cell, sheetBytes } from '@alpha/connector-files'
import { z } from 'zod'
import { config } from '../../config.ts'
import { FIELD_KINDS, Refused } from '../../world/kinds.ts'
import { findField } from '../../world/shape/index.ts'
import { namedConfig } from '../../world/views.ts'
import type { Ctx } from '../ctx.ts'
import type { HistoryView, SavedView, TableView } from '../types.ts'
import { fieldViews } from './rows.ts'

export function registerTables(ctx: Ctx): void {
  const { app, world, engine, user, asPerson, live } = ctx
  const { sourceView, savedView } = ctx.views

  // In the sidebar or out of it (Settings › Connections).
  // What a table, a field or a view means, in the person's own sentence (the semantic layer):
  // theirs from then on, so a kit's update or Alpha's guess never writes over it.
  app.post('/api/tables/:id/about', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { field, view, about } = z
      .object({
        field: z.string().optional(),
        view: z.string().optional(),
        about: z.string().max(300).nullable(),
      })
      .parse(req.body)
    const t = world.shape.table(id)
    if (!t) throw new Refused('That table is not there.')
    if (view) {
      const v = world.views.get(view)
      if (!v || v.table !== t.id) throw new Refused('That view is not there.')
      world.views.save(
        { table: t.id, id: v.id, name: v.name, config: namedConfig(t, v.config), about },
        asPerson,
      )
    } else
      world.shape.describe(
        field ? { table: t.id, field } : { table: t.id },
        about,
        'person',
        asPerson,
      )
    live()
    return { ok: true }
  })

  // The person renames a table (a double-click on its pill): its rows and links stay.
  app.post('/api/tables/:id/name', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { name } = z.object({ name: z.string().trim().min(1).max(80) }).parse(req.body)
    if (!world.shape.table(id)) throw new Refused('That table is not there.')
    const t = world.shape.rename({ table: id }, name, asPerson)
    live()
    return { id: t.id, name: t.name }
  })

  app.post('/api/tables/:id/sidebar', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { shown } = z.object({ shown: z.boolean() }).parse(req.body)
    const t = world.shape.setHidden(id, !shown, {
      actor: { kind: 'person', id: user.id },
      user: user.id,
    })
    return { id: t.id, hidden: t.hidden }
  })

  // The person sets a value in the window (a board's column, a Home line's Pass, Correct it in the
  // source panel): their own word, journaled, and the value's source. The world checks its kind.
  app.post('/api/tables/:id/rows/:row', async (req) => {
    const { id, row } = z.object({ id: z.string(), row: z.string() }).parse(req.params)
    const { field, value } = z.object({ field: z.string(), value: z.unknown() }).parse(req.body)
    const t = world.shape.table(id)
    const f = t?.fields.find((x) => x.name === field)
    if (!t || !f) throw new Refused('That field is not there.')
    if (f.kind === 'relation' || f.kind === 'file' || f.kind === 'person')
      throw new Refused(`${f.name} is set by asking Alpha, not from here.`)
    const r = world.records.list(t.id).find((x) => x.id === row)
    if (!r) throw new Refused(`${t.name} has no such row.`)
    const said =
      value && typeof value === 'object' && 'amount' in value
        ? String((value as { amount: unknown }).amount)
        : String(value)
    const line = world.line({
      actor: { kind: 'person', id: user.id },
      kind: 'set',
      words:
        f.kind === 'notes'
          ? `Wrote the notes on ${world.rowName(t, r.values)}`
          : `Set ${field} to ${said} on ${world.rowName(t, r.values)}`,
      data: { table: t.id, row, field, value },
      user: user.id,
      module: t.module.id,
    })
    // typing over a figure a script worked out keeps that figure beside theirs, with Reset
    const was = r.provenance[f.slug]
    world.records.change(
      t.id,
      [
        {
          id: row,
          values: { [field]: value },
          provenance: { kind: 'stated', source: { message: line.id } },
        },
      ],
      { actor: { kind: 'person', id: user.id }, user: user.id },
    )
    if (was?.kind === 'computed' && r.values[f.slug] !== undefined)
      world.records.keepBeside(t.id, row, {
        [f.name]: {
          value: r.values[f.slug],
          ...(was.source.formula ? { formula: was.source.formula } : {}),
          ...(was.source.note ? { note: was.source.note } : {}),
        },
      })
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { ok: true }
  })

  // The person adds a row in the window: each value theirs, the line saying so its source.
  app.post('/api/tables/:id/rows', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { values } = z.object({ values: z.record(z.string(), z.unknown()) }).parse(req.body)
    const t = world.shape.table(id)
    if (!t) throw new Refused('That table is not there.')
    const given = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v !== '' && v !== null && v !== undefined),
    )
    if (!Object.keys(given).length) throw new Refused('Give the row at least one value.')
    const line = world.line({
      actor: { kind: 'person', id: user.id },
      kind: 'set',
      words: `Added a row to ${t.name}`,
      data: { table: t.id, values: given },
      user: user.id,
      module: t.module.id,
    })
    const [row] = world.records.add(
      t.id,
      [{ values: given, provenance: { kind: 'stated', source: { message: line.id } } }],
      { actor: { kind: 'person', id: user.id }, user: user.id },
    )
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { id: row }
  })

  // Many rows at once from the window: a paste, or a field set on ticked rows. Each value is the
  // person's word, with one line as its source; what is set by asking Alpha is refused.
  app.post('/api/tables/:id/rows/many', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const Values = z.record(z.string(), z.unknown())
    const body = z
      .object({
        set: z.array(z.object({ row: z.string(), values: Values })).default([]),
        add: z.array(z.object({ values: Values })).default([]),
      })
      .parse(req.body)
    const t = world.shape.table(id)
    if (!t) throw new Refused('That table is not there.')
    if (!body.set.length && !body.add.length) throw new Refused('There is nothing to put in.')
    for (const v of [...body.set, ...body.add])
      for (const name of Object.keys(v.values)) {
        const f = findField(t, name)
        if (f.kind === 'relation' || f.kind === 'file' || f.kind === 'person')
          throw new Refused(`${f.name} is set by asking Alpha, not from here.`)
      }
    const words = [
      body.set.length
        ? `set values on ${body.set.length} row${body.set.length === 1 ? '' : 's'}`
        : '',
      body.add.length ? `added ${body.add.length} row${body.add.length === 1 ? '' : 's'}` : '',
    ]
      .filter(Boolean)
      .join(' and ')
    const line = world.line({
      actor: { kind: 'person', id: user.id },
      kind: 'set',
      words: `In ${t.name}, ${words}`,
      data: { table: t.id, set: body.set, add: body.add },
      user: user.id,
      module: t.module.id,
    })
    const ctx = { actor: { kind: 'person' as const, id: user.id }, user: user.id }
    const provenance = { kind: 'stated' as const, source: { message: line.id } }
    if (body.set.length)
      world.records.change(
        t.id,
        body.set.map((s) => ({ id: s.row, values: s.values, provenance })),
        ctx,
      )
    const added = body.add.length
      ? world.records.add(
          t.id,
          body.add.map((a) => ({ values: a.values, provenance })),
          ctx,
        )
      : []
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { changed: body.set.length, added: added.length }
  })

  // What a removal of these rows takes with it, said in the pop-up before it happens: the rows
  // that are part of them (core step 3a), and how long Bring back can return them (step 1).
  app.post('/api/tables/:id/rows/goes', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { rows } = z.object({ rows: z.array(z.string()).min(1) }).parse(req.body)
    const parts = world.shape.partRows(id, rows)
    const n = rows.length
    const list = parts.map(
      (p) => `${p.ids.length} row${p.ids.length === 1 ? '' : 's'} of ${p.table.name}`,
    )
    const and =
      list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`
    return {
      words: `${parts.length ? `${n === 1 ? 'Its' : 'Their'} ${and} go with ${n === 1 ? 'it' : 'them'}. ` : ''}Bring back, in Activity, returns ${n === 1 && !parts.length ? 'it' : 'them all'} for ${config.limits().keep_removed_days} days.`,
    }
  })

  // The person keeps a part or a setup table as a tab of its module, or takes it away (28 Oct).
  app.post('/api/tables/:id/tab', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { tab } = z.object({ tab: z.boolean() }).parse(req.body)
    const t = world.shape.setTab(id, tab, { actor: { kind: 'person', id: user.id }, user: user.id })
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { tab: t.tab }
  })

  // The person removes rows they ticked, having said yes in the window; the journal keeps them.
  app.post('/api/tables/:id/rows/remove', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { rows } = z.object({ rows: z.array(z.string()).min(1) }).parse(req.body)
    const removed = world.records.remove(id, rows, {
      actor: { kind: 'person', id: user.id },
      user: user.id,
    })
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { removed }
  })

  // The person adds a field from the table's header.
  app.post('/api/tables/:id/fields', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const f = z
      .object({
        name: z.string().trim().min(1),
        kind: z.enum(FIELD_KINDS),
        choices: z.array(z.string().trim().min(1)).optional(),
        relatesTo: z.string().optional(),
        many: z.boolean().optional(), // a choice holding several: tags (core step 3c)
      })
      .parse(req.body)
    world.shape.addFields(
      id,
      [
        {
          name: f.name,
          kind: f.kind,
          ...(f.choices ? { choices: f.choices } : {}),
          ...(f.relatesTo ? { relatesTo: f.relatesTo } : {}),
          ...(f.many ? { many: true } : {}),
        },
      ],
      { actor: { kind: 'person', id: user.id }, user: user.id },
    )
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { ok: true }
  })

  // Export: exactly the rows and columns the person was looking at, as CSV or Excel.
  app.post('/api/tables/:id/export', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const body = z
      .object({
        rows: z.array(z.string()),
        fields: z.array(z.string()),
        as: z.enum(['csv', 'xlsx']),
      })
      .parse(req.body)
    const t = world.shape.table(id)
    if (!t) throw new Refused('That table is not there.')
    const fields = body.fields.map((f) => findField(t, f))
    const byId = new Map(world.records.list(t.id).map((r) => [r.id, r]))
    const names = new Map<string, string>()
    for (const f of fields)
      if (f.kind === 'relation' && f.relatesTo) {
        const other = world.shape.table(f.relatesTo)
        if (other)
          for (const r of world.records.list(other.id))
            names.set(r.id, world.rowName(other, r.values))
      }
    const people = world.people.names(
      fields
        .filter((f) => f.kind === 'person')
        .flatMap((f) => [...byId.values()].map((r) => r.values[f.slug]))
        .filter((v): v is string => typeof v === 'string'),
    )
    const cell = (kind: string, v: unknown): Cell => {
      if (v === null || v === undefined) return null
      if (kind === 'person') return people[String(v)] ?? String(v)
      // money, and a summary of money (core step 3c), by its amount
      if (typeof v === 'object' && !Array.isArray(v)) return (v as { amount: number }).amount
      if (kind === 'number' || typeof v === 'number') return Number(v)
      if (kind === 'relation')
        return (Array.isArray(v) ? v : [v]).map((x) => names.get(String(x)) ?? '').join(', ')
      if (Array.isArray(v)) return v.join(', ')
      return String(v)
    }
    const rows = body.rows
      .map((r) => byId.get(r))
      .filter((r) => !!r)
      .map((r) => fields.map((f) => cell(f.kind, r.values[f.slug])))
    const bytes = sheetBytes(
      t.name,
      fields.map((f) => f.name),
      rows,
      body.as,
    )
    return reply
      .header(
        'content-type',
        body.as === 'csv'
          ? 'text/csv; charset=utf-8'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      .header(
        'content-disposition',
        `attachment; filename="${encodeURIComponent(t.name)}.${body.as}"`,
      )
      .send(Buffer.from(bytes))
  })

  app.get('/api/tables/:id/rows/:row/history', async (req): Promise<HistoryView[]> => {
    const { row } = z.object({ id: z.string(), row: z.string() }).parse(req.params)
    const { field } = z.object({ field: z.string() }).parse(req.query)
    return world.records
      .history(row, field)
      .map((h) => ({ value: h.value, source: h.provenance ? sourceView(h.provenance) : null }))
  })

  app.get('/api/tables/:id', async (req, reply): Promise<TableView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const t = world.shape.table(id)
    if (!t) return reply.code(404).send({ problem: 'That table is not there.' })
    return {
      id: t.id,
      name: t.name,
      about: t.about,
      aboutBy: t.aboutBy,
      module: { id: t.module.id, name: t.module.name },
      documents: t.documents,
      fields: t.fields.map(fieldViews(world.shape)),
      views: world.views.list(t.id).map(savedView),
      rows: world.records.list(t.id).map((r) => ({
        id: r.id,
        values: r.values,
        sources: Object.fromEntries(
          Object.entries(r.provenance).map(([k, p]) => [k, sourceView(p)]),
        ),
      })),
      names: {
        ...Object.fromEntries(
          t.fields
            .filter((f) => f.kind === 'relation' && f.relatesTo)
            .flatMap((f) => {
              const other = world.shape.table(f.relatesTo as string)
              return other
                ? world.records.list(other.id).map((r) => [r.id, world.rowName(other, r.values)])
                : []
            }),
        ),
        // the people its person fields hold, by name
        ...world.people.names(
          t.fields
            .filter((f) => f.kind === 'person')
            .flatMap((f) => world.records.list(t.id).map((r) => r.values[f.slug]))
            .filter((v): v is string => typeof v === 'string'),
        ),
      },
    }
  })

  // Reset: a value the person typed over goes back to what Alpha works it out as, kept beside it.
  app.post('/api/tables/:id/rows/:row/reset', async (req) => {
    const { id, row } = z.object({ id: z.string(), row: z.string() }).parse(req.params)
    const { field } = z.object({ field: z.string() }).parse(req.body)
    const t = world.shape.table(id)
    const f = t?.fields.find((x) => x.name === field || x.slug === field)
    if (!t || !f) throw new Refused('That field is not there.')
    const r = world.records.list(t.id).find((x) => x.id === row)
    const beside = r?.provenance[f.slug]?.beside
    if (!r || !beside) throw new Refused(`${f.name} has no figure of Alpha's to go back to.`)
    world.line({
      actor: { kind: 'person', id: user.id },
      kind: 'set',
      words: `Reset ${f.name} to Alpha's figure on ${world.rowName(t, r.values)}`,
      data: { table: t.id, row, field: f.name },
      user: user.id,
      module: t.module.id,
    })
    world.records.change(
      t.id,
      [
        {
          id: row,
          values: { [f.name]: beside.value },
          provenance: {
            kind: 'computed',
            source: {
              formula: beside.formula ?? 'Alpha’s figure',
              ...(beside.note ? { note: beside.note } : {}),
            },
          },
        },
      ],
      { actor: { kind: 'person', id: user.id }, user: user.id },
    )
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { ok: true }
  })

  // Saved views: the person makes, saves, renames, makes default and removes them.
  const ViewBody = z.object({
    name: z.string(),
    config: z.unknown(),
    isDefault: z.boolean().optional(),
  })
  app.post('/api/tables/:id/views', async (req): Promise<SavedView> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const body = ViewBody.parse(req.body)
    return savedView(
      world.views.save(
        { table: id, ...body },
        { actor: { kind: 'person', id: user.id }, user: user.id },
      ),
    )
  })
  app.put('/api/views/:id', async (req, reply): Promise<SavedView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const v = world.views.get(id)
    if (!v) return reply.code(404).send({ problem: 'That view is not there.' })
    const body = ViewBody.partial().parse(req.body)
    return savedView(
      world.views.save(
        {
          table: v.table,
          id,
          name: body.name ?? v.name,
          config: body.config ?? v.config,
          ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
        },
        { actor: { kind: 'person', id: user.id }, user: user.id },
      ),
    )
  })
  app.delete('/api/views/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    world.views.remove(id, { actor: { kind: 'person', id: user.id }, user: user.id })
    return { ok: true }
  })
}
