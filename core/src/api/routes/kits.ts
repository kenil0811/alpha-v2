import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import { agents, setAgentState, whenWords } from '../../modules/agents.ts'
import {
  install,
  installedKits,
  takeBack,
  unseenChanges,
  update,
  yours,
} from '../../modules/kits.ts'
import { installPack } from '../../modules/packs.ts'
import { Refused } from '../../world/kinds.ts'
import type { Ctx } from '../ctx.ts'
import type { WorkingModuleView, YoursView } from '../types.ts'

export function registerKits(ctx: Ctx): void {
  const { app, world, engine, user, person, live } = ctx
  const { needsOf } = ctx.views

  // Kits and agents (design §10, §11): what each module does on its own.
  app.get('/api/working', async (): Promise<WorkingModuleView[]> => {
    const kits = new Map(installedKits(world).map((k) => [k.module, k]))
    const running = new Set(
      (engine.hands?.runner.runs(200) ?? [])
        .filter((r) => r.state === 'running')
        .map((r) => r.agent),
    )
    return world.shape
      .modules()
      .map((m) => {
        const k = kits.get(m.id)
        return {
          id: m.id,
          name: m.name,
          kit: k
            ? {
                name: k.kit,
                version: k.version,
                source: k.source,
                api: k.api,
                maintainer: k.maintainer,
                core: k.core,
                changes: k.maintainer ? unseenChanges(world, m.id) : 0,
              }
            : null,
          agents: agents(world, m.id).map((a) => ({
            id: a.id,
            name: a.name,
            state: a.state,
            description: a.description,
            needs: needsOf(m, a),
            when: whenWords(a.trigger),
            lastRunAt: a.lastRunAt,
            running: running.has(a.id),
          })),
        }
      })
      .filter((m) => m.kit || m.agents.length)
  })

  // A kit is installed from a folder on this Mac, or updated from one by the ownership rule.
  app.post('/api/kits', async (req) => {
    const { folder } = z.object({ folder: z.string().trim().min(1) }).parse(req.body)
    const m = await install(world, folder, {
      actor: { kind: 'person', id: user.id },
      user: user.id,
    })
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { module: m.id }
  })

  // A kit pack sent as a file: kept unpacked in Alpha's folder, then installed, or its kit updated.
  app.post('/api/kits/pack', async (req) => {
    const name = decodeURIComponent(String(req.headers['x-file-name'] ?? 'kit.alphakit'))
    const dir = mkdtempSync(join(tmpdir(), 'alpha-kit-'))
    try {
      const file = join(dir, name.replace(/[^\w.-]/g, '_'))
      writeFileSync(file, req.body as Buffer)
      const words = await installPack(world, file, join(world.paths.dir, '..', '..', 'kits'), {
        actor: person,
        user: user.id,
      })
      live()
      return { words }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  app.post('/api/kits/:module/update', async (req) => {
    const { module } = z.object({ module: z.string() }).parse(req.params)
    const { folder } = z.object({ folder: z.string().trim().optional() }).parse(req.body ?? {})
    const m = world.shape.module(module)
    const k = installedKits(world).find((x) => x.module === m?.id)
    if (!m || !k) throw new Refused('That module did not come from a kit.')
    const report = await update(world, m.name, folder || k.source, {
      actor: { kind: 'person', id: user.id },
      user: user.id,
    })
    engine.events.emit('event', { type: 'lines', user: user.id })
    return report
  })

  // What of a kit is the person's now (decision 3), and the kit's version of one thing back.
  app.get('/api/kits/:module/yours', async (req): Promise<YoursView> => {
    const { module } = z.object({ module: z.string() }).parse(req.params)
    return yours(world, module)
  })
  app.post('/api/kits/:module/yours/back', async (req) => {
    const { module } = z.object({ module: z.string() }).parse(req.params)
    const what = z
      .union([
        z.object({ kind: z.literal('file'), path: z.string() }),
        z.object({ kind: z.literal('row'), table: z.string(), key: z.string() }),
        z.object({ kind: z.literal('view'), table: z.string(), name: z.string() }),
      ])
      .parse(req.body)
    const words = await takeBack(world, module, what, { actor: person, user: user.id })
    live()
    return { words }
  })
  // a field the kit no longer uses, removed with its values, by the person
  app.post('/api/kits/:module/fields/remove', async (req) => {
    const { module } = z.object({ module: z.string() }).parse(req.params)
    const { table, field } = z.object({ table: z.string(), field: z.string() }).parse(req.body)
    const t = world.shape.table(table)
    if (!t || t.module.id !== module) throw new Refused('That table is not there.')
    world.shape.removeHiddenField(t.id, field, { actor: person, user: user.id })
    live()
    return { ok: true }
  })

  app.post('/api/agents/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { state } = z.object({ state: z.enum(['on', 'paused']) }).parse(req.body)
    setAgentState(world, id, state, user.id)
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { ok: true }
  })

  // Every agent of a module on, or paused, at once (a kit's readers start paused).
  app.post('/api/modules/:id/agents', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { state } = z.object({ state: z.enum(['on', 'paused']) }).parse(req.body)
    const m = world.shape.module(id)
    if (!m) throw new Refused('That module is not there.')
    const list = agents(world, m.id)
    for (const a of list) setAgentState(world, a.id, state, user.id)
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { changed: list.length }
  })

  // Run an agent now; its outcome reaches Activity, not this answer.
  app.post('/api/agents/:id/run', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const runner = engine.hands?.runner
    const a = agents(world).find((x) => x.id === id)
    if (!runner || !a) throw new Refused('That agent is not there.')
    void runner.runAgent(a, { user: user.id, turn: null }).catch(() => undefined)
    return { ok: true }
  })
}
