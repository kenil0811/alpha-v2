import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { installedKits } from '../../modules/kits/index.ts'
import { moduleNetwork } from '../../modules/runs/index.ts'
import { schedules, whenWords } from '../../modules/schedules.ts'
import { pageAnswer, pageDocument, pagesOf, printPage } from '../../pages/pages.ts'
import { Refused } from '../../world/kinds.ts'
import { businessCase, setBusinessCase } from '../../world/shape/manifest.ts'
import type { Ctx } from '../ctx.ts'
import type { ModuleSummary, ModuleView } from '../types.ts'
import { livesPeople, tableSummary } from '../views.ts'

export function registerModules(ctx: Ctx): void {
  const { app, world, engine, user, options } = ctx
  const { needsOf, summaries } = ctx.views

  app.get('/api/modules', async (): Promise<ModuleSummary[]> => summaries())

  // A module inside another, or at the top level: the person's word, kept over a kit's.
  app.post('/api/modules/:id/place', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { within } = z.object({ within: z.string().nullable() }).parse(req.body)
    const m = world.shape.place(id, within, {
      actor: { kind: 'person', id: user.id },
      user: user.id,
    })
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { id: m.id, parent: m.parent }
  })

  // The person renames a module by double-clicking its name in the rail (Batch B, pick 14a): its
  // name alone; its id, key and folder stay.
  app.post('/api/modules/:id/name', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { name } = z.object({ name: z.string().max(80) }).parse(req.body)
    const m = world.shape.renameModule(id, name, {
      actor: { kind: 'person', id: user.id },
      user: user.id,
    })
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { id: m.id, name: m.name }
  })

  // the person's own business case for a module (core step 3e): theirs from then on
  app.post('/api/modules/:id/case', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const c = z
      .object({
        for: z.string().trim().min(1),
        keeps: z.string().trim().min(1),
        decides: z.string().trim().min(1),
      })
      .parse(req.body)
    const m = world.shape.module(id)
    if (!m) throw new Refused('That module is not there.')
    setBusinessCase(world.shape, m, c, 'person', {
      actor: { kind: 'person', id: user.id },
      user: user.id,
    })
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { ok: true }
  })

  app.get('/api/modules/:id', async (req, reply): Promise<ModuleView | undefined> => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const m = world.shape.module(id)
    if (!m) return reply.code(404).send({ problem: 'That module is not there.' })
    const k = installedKits(world).find((x) => x.module === m.id)
    const running = new Set(
      (engine.hands?.runner.runs(200) ?? [])
        .filter((r) => r.state === 'running')
        .map((r) => r.schedule),
    )
    const notes = join(m.dir, 'NOTES.md')
    const everyModule = world.shape.modules()
    const everySchedule = schedules(world)
    const waiting = world.cards.waiting(user.id)
    const openTasks = world.tasks.list({ open: true })
    return {
      id: m.id,
      name: m.name,
      people: livesPeople(m),
      kit: k ? { name: k.kit, version: k.version } : null,
      schedules: schedules(world, m.id).map((a) => ({
        id: a.id,
        name: a.name,
        state: a.state,
        description: a.description,
        needs: needsOf(m, a),
        when: whenWords(a.trigger),
        lastRunAt: a.lastRunAt,
        running: running.has(a.id),
      })),
      sites: moduleNetwork(m).length,
      notes: existsSync(notes) ? readFileSync(notes, 'utf8') : '',
      businessCase: businessCase(m),
      parent: m.parent,
      pages: pagesOf(m),
      tables: world.shape
        .tables(m.id)
        .filter((t) => !t.hidden)
        .map((t) => tableSummary(world, t)),
      modules: summaries()
        .filter((c) => c.parent === m.id)
        .map((c) => {
          // what goes on in it counts what sits inside it too
          const within = new Set([c.id])
          for (let grew = true; grew; ) {
            grew = false
            for (const x of everyModule)
              if (x.parent && within.has(x.parent) && !within.has(x.id)) {
                within.add(x.id)
                grew = true
              }
          }
          const its = everySchedule.filter((a) => within.has(a.module))
          return {
            ...c,
            kit: installedKits(world).find((x) => x.module === c.id)?.kit ?? null,
            schedules: its.filter((a) => a.state === 'on').length,
            running: its.filter((a) => running.has(a.id)).length,
            needs: waiting.filter((x) => x.module && within.has(x.module)).length,
            tasks: openTasks.filter((t) => t.place.module && within.has(t.place.module)).length,
          }
        }),
    }
  })

  // A module's page (design §13): the document its frame shows, the answers to what it asks (its
  // module's rows, read-only), and the page printed to a PDF with the choices the window had.
  const pageModule = (id: string) => {
    const m = world.shape.module(id)
    if (!m) throw new Refused('That module is not there.')
    return m
  }
  app.get('/api/modules/:id/pages/:name', async (req) => {
    const { id, name } = z.object({ id: z.string(), name: z.string() }).parse(req.params)
    const m = pageModule(id)
    const page = pagesOf(m).find((p) => p.name === name)
    if (!page) throw new Refused(`${m.name} has no page called ${name}.`)
    return { ...page, html: pageDocument(m, name) }
  })
  app.post('/api/modules/:id/pages/:name/ask', async (req) => {
    const { id } = z.object({ id: z.string(), name: z.string() }).parse(req.params)
    const { op, args } = z
      .object({ op: z.string(), args: z.record(z.string(), z.unknown()).default({}) })
      .parse(req.body)
    return { value: pageAnswer(world, pageModule(id), op, args) }
  })
  app.post('/api/modules/:id/pages/:name/pdf', async (req, reply) => {
    const { id, name } = z.object({ id: z.string(), name: z.string() }).parse(req.params)
    const { inputs } = z
      .object({ inputs: z.record(z.string(), z.string()).default({}) })
      .parse(req.body ?? {})
    if (!options.browsers) throw new Refused('Alpha has no browser here to print with.')
    const pdf = await printPage(world, pageModule(id), name, {
      browsers: options.browsers,
      inputs,
      as: 'pdf',
    })
    return reply.type('application/pdf').send(pdf)
  })
}
