import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import { exportsDir } from '../../data.ts'
import {
  install,
  installedKits,
  takeBack,
  unseenChanges,
  update,
  yours,
} from '../../modules/kits/index.ts'
import { makeKit } from '../../modules/makekit.ts'
import { installPack } from '../../modules/packs.ts'
import { schedules, setScheduleState, whenWords } from '../../modules/schedules.ts'
import { FOLDERS } from '../../signing.ts'
import { Refused } from '../../world/kinds.ts'
import type { Ctx } from '../ctx.ts'
import { keptEdit, keptField, keptTable } from '../kept.ts'
import type { KeptTable, WorkingModuleView, YoursView } from '../types.ts'

export function registerKits(ctx: Ctx): void {
  const { app, world, engine, user, person, live, options } = ctx
  const developer = () => options.data?.install().developer ?? false
  // installing a pack is the owner's (rule M7), until rule M6's setting is built
  const owner = () => {
    if (user.role !== 'owner') throw new Refused('Only the owner can install a module.')
  }
  const { needsOf } = ctx.views

  // Kits and schedules (design §10, §11): what each module does on its own.
  app.get('/api/working', async (): Promise<WorkingModuleView[]> => working())
  // Every module's schedules as one table (UI batch 2, 26 Oct): each turned On or Paused in a cell
  const WHY = 'A schedule is turned on or paused here; the rest is in its file.'
  app.get(
    '/api/kept/schedules',
    async (): Promise<KeptTable> =>
      keptTable(
        'schedules',
        'Schedules',
        [
          keptField('Schedule', 'text'),
          keptField('Module', 'text'),
          keptField('State', 'choice', { On: 'good', Paused: 'warn' }),
          keptField('Runs', 'text'),
          keptField('Last ran', 'date'),
          keptField('Needs', 'text'),
        ],
        working().flatMap((m) =>
          m.schedules.map((a) => ({
            id: a.id,
            values: {
              schedule: a.name,
              module: m.name,
              state: a.state === 'on' ? 'On' : 'Paused',
              runs: a.running ? `${a.when}, running now` : a.when,
              'last ran': a.lastRunAt,
              needs: a.needs,
            },
          })),
        ),
        { editable: ['State'], why: WHY },
      ),
  )
  app.post('/api/kept/schedules/rows/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { value } = keptEdit(req.body, ['State'], WHY)
    if (value !== 'On' && value !== 'Paused') throw new Refused('A schedule is On or Paused.')
    setScheduleState(world, id, value === 'On' ? 'on' : 'paused', user.id)
    live()
    return { ok: true }
  })
  function working(): WorkingModuleView[] {
    const kits = new Map(installedKits(world).map((k) => [k.module, k]))
    const running = new Set(
      (engine.hands?.runner.runs(200) ?? [])
        .filter((r) => r.state === 'running')
        .map((r) => r.schedule),
    )
    return world.shape.modules().map((m) => {
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
      }
    })
  }

  // A kit is installed from a folder on this Mac, or updated from one by the ownership rule.
  app.post('/api/kits', async (req) => {
    owner()
    const { folder } = z.object({ folder: z.string().trim().min(1) }).parse(req.body)
    if (!developer()) throw new Refused(FOLDERS)
    const m = await install(world, folder, {
      actor: { kind: 'person', id: user.id },
      user: user.id,
    })
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { module: m.id }
  })

  // A kit pack sent as a file: kept unpacked in Alpha's folder, then installed, or its kit updated.
  app.post('/api/kits/pack', async (req) => {
    owner()
    const name = decodeURIComponent(String(req.headers['x-file-name'] ?? 'kit.alphakit'))
    const dir = mkdtempSync(join(tmpdir(), 'alpha-kit-'))
    try {
      const file = join(dir, name.replace(/[^\w.-]/g, '_'))
      writeFileSync(file, req.body as Buffer)
      const words = await installPack(
        world,
        file,
        join(world.paths.dir, '..', '..', 'kits'),
        { actor: person, user: user.id },
        { developer: developer() },
      )
      live()
      return { words }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  app.post('/api/kits/:module/update', async (req) => {
    owner()
    const { module } = z.object({ module: z.string() }).parse(req.params)
    const { folder } = z.object({ folder: z.string().trim().optional() }).parse(req.body ?? {})
    const m = world.shape.module(module)
    const k = installedKits(world).find((x) => x.module === m?.id)
    if (!m || !k) throw new Refused('That module did not come from a kit.')
    // an update from a folder is the developer's: a pack updates through installing it
    if (!developer()) throw new Refused(FOLDERS)
    const report = await update(world, m.name, folder || k.source, {
      actor: { kind: 'person', id: user.id },
      user: user.id,
    })
    engine.events.emit('event', { type: 'lines', user: user.id })
    return report
  })

  // A module made in a conversation leaves as a kit (design §10): packed onto the Desktop, its
  // rows never; a module from a kit is packed as it is now.
  app.post('/api/kits/:module/make', async (req) => {
    const { module } = z.object({ module: z.string() }).parse(req.params)
    const made = makeKit(world, module, exportsDir(), {
      actor: { kind: 'person', id: user.id },
      user: user.id,
    })
    return { file: made.file, words: made.words }
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

  app.post('/api/schedules/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { state } = z.object({ state: z.enum(['on', 'paused']) }).parse(req.body)
    setScheduleState(world, id, state, user.id)
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { ok: true }
  })

  // Every schedule of a module on, or paused, at once (a kit's readers start paused).
  app.post('/api/modules/:id/schedules', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { state } = z.object({ state: z.enum(['on', 'paused']) }).parse(req.body)
    const m = world.shape.module(id)
    if (!m) throw new Refused('That module is not there.')
    const list = schedules(world, m.id)
    for (const a of list) setScheduleState(world, a.id, state, user.id)
    engine.events.emit('event', { type: 'lines', user: user.id })
    return { changed: list.length }
  })

  // Run a schedule now; its outcome reaches Activity, not this answer.
  app.post('/api/schedules/:id/run', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const runner = engine.hands?.runner
    const a = schedules(world).find((x) => x.id === id)
    if (!runner || !a) throw new Refused('That schedule is not there.')
    // the person asked for it now: a paused schedule runs this once; a busy one says so at once,
    // beside the button (item 29, 25 Oct), and the run goes on behind
    runner.refuseRun(a, { asked: true })
    void runner
      .runSchedule(a, { user: user.id, turn: null }, {}, { asked: true })
      .catch(() => undefined)
    return { ok: true }
  })
}
