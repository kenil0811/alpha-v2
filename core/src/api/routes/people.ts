import { z } from 'zod'
import { Refused } from '../../world/kinds.ts'
import { phoneWords } from '../../world/phones.ts'
import type { Ctx } from '../ctx.ts'
import { keptEdit, keptField, keptTable } from '../kept.ts'
import type { CardView, KeptTable, PersonView } from '../types.ts'

export function registerPeople(ctx: Ctx): void {
  const { app, world, live, asPerson, user } = ctx
  const { cardOut } = ctx.views

  // People and Organizations as tables (UI batch 2, 26 Oct): the name changes in a cell; the rest
  // comes from where Alpha read them, so it changes there
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
    // a person's lists (Vikas, 27 Oct): the module tables whose rows are people (Clients,
    // Insurers, Team), and My contacts for everyone known any other way
    // ponytail: a connector's own contact card counts as My contacts by its table's name
    // A table naming people only by a role's address (Deals' Broker email) puts them in that
    // role's list, Brokers, not the table's (Vikas, 29 Oct)
    const listOf = (t: string | null) => {
      const table = t ? world.shape.table(t) : null
      const map = table?.people
      if (!table || map?.each !== 'person' || table.name === 'Contacts') return 'My contacts'
      const role = !map.name && /^(.+?)\s+e-?mails?$/i.exec(map.emails ?? '')?.[1]
      return role ? `${role[0]?.toUpperCase()}${role.slice(1)}s` : table.name
    }
    const lists = lines.map((p) => [...new Set(p.tables.map(listOf))])
    const names = [...new Set(lists.flat())].sort((a, b) =>
      a === 'My contacts' ? -1 : b === 'My contacts' ? 1 : a.localeCompare(b),
    )
    return keptTable(
      'people',
      'People',
      [
        keptField('Name', 'text'),
        { ...keptField('Lists', 'choice'), choices: names, many: true },
        keptField('Organization', 'text'),
        keptField('Email', 'email'),
        keptField('Phone', 'phone'),
        keptField('Last', 'date'),
        keptField('Talks', 'number'),
      ],
      lines.map((p, i) => ({
        id: p.id,
        values: {
          name: p.name,
          lists: lists[i],
          organization: p.companies.join(', '),
          email: p.emails[0] ?? null,
          phone: p.phones[0] ? phoneWords(p.phones[0]) : null,
          last: p.last,
          talks: p.count,
        },
      })),
      { editable: ['Name'], why: WHY },
    )
  }
  // The workspace's own name and picture (Vikas, 29 Oct): a double-click in the rail's head
  // changes either. ponytail: kept with the install's one person; per tenant when one has many
  const workspaceOut = () => ({
    name:
      world.preference(user.id, 'workspace_name') ??
      (user.name ? `${user.name}'s workspace` : 'Your workspace'),
    image: world.preference(user.id, 'workspace_image'),
    person: user.name,
  })
  app.get('/api/workspace', async () => workspaceOut())
  app.post('/api/workspace', async (req) => {
    const given = z
      .object({
        name: z.string().trim().min(1).max(80).optional(),
        image: z
          .string()
          .max(300_000)
          .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
          .nullable()
          .optional(),
      })
      .parse(req.body)
    if (given.name !== undefined) world.setPreference(user.id, 'workspace_name', given.name)
    if (given.image !== undefined) world.setPreference(user.id, 'workspace_image', given.image)
    return workspaceOut()
  })

  app.get('/api/kept/people', async () => keptPeople('person'))
  app.get('/api/kept/organizations', async () => keptPeople('company'))
  for (const list of ['people', 'organizations'])
    app.post(`/api/kept/${list}/rows/:id`, async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.params)
      const { value } = keptEdit(req.body, ['Name'], WHY)
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
