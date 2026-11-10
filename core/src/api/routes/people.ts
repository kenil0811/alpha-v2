import { z } from 'zod'
import { Refused } from '../../world/kinds.ts'
import { phoneWords } from '../../world/phones.ts'
import { peopleTables, perField } from '../../world/shape/per.ts'
import type { Ctx } from '../ctx.ts'
import { keptEdit, keptField, keptTable } from '../kept.ts'
import { perColumns, perRows, setForPerson, typed } from '../per.ts'
import type { CardView, KeptTable, PersonView, Pick } from '../types.ts'
import { fieldViews } from './rows.ts'

export function registerPeople(ctx: Ctx): void {
  const { app, world, live, asPerson, user } = ctx
  const { cardOut, sourceView } = ctx.views

  // People and Organizations as tables: the name changes in a cell; the rest comes from where Alpha
  // read them, so it changes there
  const WHY =
    'Only the name changes here; the rest comes from where Alpha read it, so change it there.'
  const keptPeople = (kind: 'person' | 'company'): KeptTable => {
    const lines = world.people.list(kind, '')
    if (kind === 'company')
      return keptTable(
        'organizations',
        'Organizations',
        [keptField('Name', 'text'), keptField('Domain', 'text'), keptField('People', 'number')],
        lines.map((p) => ({
          id: p.id,
          values: { name: p.name, domain: p.domains.join(', '), people: p.people },
        })),
        { editable: ['Name'], why: WHY },
      )
    // after its own columns, the fields of the one-row-per-person tables
    const cols = perColumns(world)
    const rows = perRows(world, [...new Set(cols.map((c) => c.table))])
    return keptTable(
      'people',
      'People',
      [
        keptField('Name', 'text'),
        keptField('Organization', 'text'),
        keptField('Email', 'email'),
        keptField('Phone', 'phone'),
        keptField('Last', 'date'),
        keptField('Talks', 'number'),
        ...cols.map((c) => c.view),
      ],
      lines.map((p) => ({
        id: p.id,
        values: {
          name: p.name,
          organization: p.companies.join(', '),
          email: p.emails[0] ?? null,
          phone: p.phones[0] ? phoneWords(p.phones[0]) : null,
          last: p.last,
          talks: p.count,
          ...Object.fromEntries(
            cols.map((c) => [
              c.view.slug,
              rows.get(c.table.id)?.get(p.id)?.values[c.field.slug] ?? null,
            ]),
          ),
        },
      })),
      {
        editable: ['Name', ...cols.filter((c) => typed(c.field)).map((c) => c.view.name)],
        why: WHY,
      },
    )
  }
  app.get('/api/kept/people', async () => keptPeople('person'))
  // What a person field's picker offers: each person by name, with where they work
  app.get(
    '/api/people/names',
    async (): Promise<Pick[]> =>
      world.people
        .list('person')
        .map((p) => ({ id: p.id, name: p.name, hint: p.companies[0] ?? p.emails[0] ?? null }))
        .sort((a, b) => a.name.localeCompare(b.name)),
  )
  app.get('/api/kept/organizations', async () => keptPeople('company'))
  for (const list of ['people', 'organizations'])
    app.post(`/api/kept/${list}/rows/:id`, async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.params)
      const cols = list === 'people' ? perColumns(world).filter((c) => typed(c.field)) : []
      const { field, value } = keptEdit(req.body, ['Name', ...cols.map((c) => c.view.name)], WHY)
      const col = cols.find((c) => c.view.name === field)
      if (col) {
        setForPerson(world, user, col.table, id, col.field, value)
        live()
        return { ok: true }
      }
      const name = String(value ?? '').trim()
      if (!name) throw new Refused('A name is needed.')
      world.people.name(id, name, asPerson)
      live()
      return { ok: true }
    })

  const personOut = (id: string): PersonView | undefined => {
    const p = world.people.get(id)
    if (!p) return undefined
    const from = new Map<string, { table: string | null; name: string; count: number }>()
    for (const s of p.sources) {
      const name = s.table ? (world.shape.table(s.table)?.name ?? 'A table') : 'You'
      const seen = from.get(name) ?? { table: s.table, name, count: 0 }
      seen.count++
      from.set(name, seen)
    }
    return {
      id: p.id,
      kind: p.kind,
      name: p.name,
      emails: p.keys.email ?? [],
      phones: (p.keys.phone ?? []).map(phoneWords),
      profile: p.keys.profile?.[0] ?? null,
      domains: p.keys.domain ?? [],
      merged: p.merged,
      companies: p.companies,
      people: p.people,
      from: [...from.values()],
      contact: p.contact,
      // their row in each one-row-per-person table of People's module, or none yet
      per: perOf(p.id),
      rows: world.people.rowsNaming(p.id).flatMap((r) => {
        const rec = world.records.get(r.record)
        return rec
          ? [
              {
                table: rec.table.name,
                module: rec.table.module.name,
                name: world.rowName(rec.table, rec.record.values),
                field: r.field,
                href: `#/table/${r.table}/${r.record}`,
                record: r.record,
              },
            ]
          : []
      }),
      history: world.people.history(p.id).map((h) => ({
        at: h.at,
        channel: h.channel,
        by: h.by,
        about: h.about,
        href: `#/table/${h.table}/${h.record}`,
      })),
      createdAt: p.createdAt,
    }
  }

  const perOf = (id: string): PersonView['per'] => {
    const tables = peopleTables(world.shape)
    const rows = perRows(world, tables)
    const view = fieldViews(world.shape)
    return tables.map((t) => {
      const r = rows.get(t.id)?.get(world.people.root(id))
      return {
        table: { id: t.id, name: t.name },
        fields: t.fields.filter((f) => f.id !== perField(t)?.id).map(view),
        row: r
          ? {
              id: r.id,
              values: r.values,
              sources: Object.fromEntries(
                Object.entries(r.provenance).map(([k, pv]) => [k, sourceView(pv)]),
              ),
            }
          : null,
      }
    })
  }
  // a value typed on a person's page for one of those tables: on their row, made if need be
  app.post('/api/people/:id/per/:table', async (req) => {
    const { id, table } = z.object({ id: z.string(), table: z.string() }).parse(req.params)
    const { field, value } = z.object({ field: z.string(), value: z.unknown() }).parse(req.body)
    const t = peopleTables(world.shape).find((x) => x.id === table)
    const f = t?.fields.find((x) => x.name === field)
    if (!t || !f) throw new Refused('That field is not there.')
    setForPerson(world, user, t, id, f, value)
    live()
    return { ok: true }
  })

  app.get('/api/people/:id', async (req, reply): Promise<PersonView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const p = personOut(id)
    if (!p) return reply.code(404).send({ problem: 'That one is not there.' })
    return p
  })

  app.post('/api/people/:id/name', async (req): Promise<PersonView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { name } = z.object({ name: z.string().trim().min(1) }).parse(req.body)
    world.people.name(id, name, asPerson)
    live()
    return personOut(id)
  })

  app.post('/api/people/:id/unmerge', async (req): Promise<PersonView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const alone = world.people.unmerge(id, asPerson)
    live()
    return personOut(alone.id)
  })

  // a row that is not this person: it leaves with what it alone brought, as someone of its own
  app.post('/api/people/:id/not', async (req): Promise<PersonView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { record } = z.object({ record: z.string().min(1) }).parse(req.body)
    world.people.notThis(id, record, asPerson)
    live()
    return personOut(id)
  })

  app.post('/api/people/:id/you', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const emails = world.people.isYou(id, asPerson)
    live()
    return { emails }
  })

  app.post('/api/people/pairs/:id', async (req): Promise<CardView | null> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { merge } = z.object({ merge: z.boolean() }).parse(req.body)
    world.people.decidePair(id, merge, asPerson)
    live()
    const card = world.people.pairs().find((p) => p.id === id)?.card
    const c = card ? world.cards.get(card) : undefined
    return c ? cardOut(c) : null
  })
}
