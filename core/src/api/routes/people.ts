import { z } from 'zod'
import { config } from '../../config.ts'
import { phoneWords } from '../../world/phones.ts'
import type { Ctx } from '../ctx.ts'
import type { CardView, PeopleView, PersonView } from '../types.ts'

export function registerPeople(ctx: Ctx): void {
  const { app, world, live, asPerson } = ctx
  const { cardOut } = ctx.views

  app.get('/api/people', async (req): Promise<PeopleView> => {
    const { kind, words } = z
      .object({
        kind: z.enum(['person', 'company']).default('person'),
        words: z.string().default(''),
      })
      .parse(req.query)
    return {
      kind,
      days: config.people().contact_days,
      lines: world.people
        .list(kind, words)
        .map((p) => ({ ...p, phones: p.phones.map(phoneWords) })),
      people: world.people.count('person'),
      companies: world.people.count('company'),
      sources: world.shape
        .tables()
        .filter((t) => t.people)
        .map((t) => t.name),
    }
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
