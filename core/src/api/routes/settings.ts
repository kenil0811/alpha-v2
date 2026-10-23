import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { config } from '../../config.ts'
import {
  applyBring,
  backupNow,
  copyNewestBackup,
  dataView,
  markRestart,
  prepareBring,
  removeData,
  restoreWorld,
  takeData,
} from '../../data.ts'
import type { Capabilities } from '../../engine/provider.ts'
import { instructionsFile } from '../../engine/tools.ts'
import { PlainPlatform } from '../../platform/index.ts'
import { Refused } from '../../world/kinds.ts'
import type { Ctx } from '../ctx.ts'
import type { DataPageView, InstructionView, ModelView, SetupView } from '../types.ts'

export function registerSettings(ctx: Ctx): void {
  const { app, world, engine, user, options, person, live } = ctx

  // What Alpha remembers, each line removable by the person (the instructions files, design §6).
  const instructionLines = (who: 'me' | 'everyone') => {
    const file = instructionsFile(world, who === 'me' ? user.id : null)
    return existsSync(file)
      ? readFileSync(file, 'utf8')
          .split('\n')
          .filter((l) => l.startsWith('- '))
          .map((l) => l.slice(2).trim())
      : []
  }

  app.get(
    '/api/instructions',
    async (): Promise<InstructionView[]> => [
      ...instructionLines('me').map((words) => ({ for: 'me' as const, words })),
      ...instructionLines('everyone').map((words) => ({ for: 'everyone' as const, words })),
    ],
  )

  app.post('/api/instructions/remove', async (req) => {
    const b = z.object({ for: z.enum(['me', 'everyone']), words: z.string() }).parse(req.body)
    const file = instructionsFile(world, b.for === 'me' ? user.id : null)
    if (!existsSync(file)) throw new Refused('There is nothing remembered there.')
    const lines = readFileSync(file, 'utf8').split('\n')
    const at = lines.findIndex((l) => l.startsWith('- ') && l.slice(2).trim() === b.words)
    if (at < 0) throw new Refused('That is not remembered.')
    lines.splice(at, 1)
    writeFileSync(file, lines.join('\n'))
    world.line({
      actor: { kind: 'person', id: user.id },
      kind: 'forgot',
      words: `Will no longer remember: ${b.words}`,
      data: { for: b.for },
      user: user.id,
    })
    return { ok: true }
  })

  // What each provider can do, in a line, and what it cannot that another can.
  const canWords = (can: Capabilities) =>
    [
      'the world, your connections and documents',
      can.shell ? 'a shell on this Mac' : '',
      can.files ? 'files in its own folder and the modules' : '',
      can.web ? 'the web' : '',
      can.subagents ? 'background work' : '',
    ]
      .filter(Boolean)
      .join('; ')
  const cannotWords = (can: Capabilities, others: Capabilities[]) => {
    const missing = (['shell', 'files', 'web', 'subagents'] as const)
      .filter((k) => !can[k] && others.some((o) => o[k]))
      .map((k) =>
        k === 'shell'
          ? 'no shell'
          : k === 'files'
            ? 'no files beyond the world'
            : k === 'web'
              ? 'no web'
              : 'no background work',
      )
    if (!missing.length) return null
    const words = missing.join(', ')
    return `${words[0]?.toUpperCase()}${words.slice(1)}: the others have them.`
  }
  const modelView = (): ModelView => {
    const route = engine.route?.name ?? 'subscription'
    const all = engine.providers
    return {
      desk: config.models().desk,
      route,
      hasKey: engine.route?.hasKey ?? false,
      providers: all.map((p) => ({
        route: p.route,
        title: p.title,
        can: canWords(p.provider.can),
        cannot: cannotWords(
          p.provider.can,
          all.filter((o) => o !== p).map((o) => o.provider.can),
        ),
        needsKey: p.route !== 'subscription',
        chosen: p.route === route,
      })),
    }
  }
  app.get('/api/model', async (): Promise<ModelView> => modelView())
  // This Mac's setup, for the first open and Settings, and the readers' downloads started on asking.
  app.get(
    '/api/setup',
    async (): Promise<SetupView | null> => (options.setup ? options.setup.view() : null),
  )
  app.post('/api/setup/signin', async () => ({ started: options.setup?.signIn() ?? false }))
  // System Settings opened at the pane where the person turns Alpha on (Contacts, Calendars: a
  // connector names its pane): the one switch macOS keeps outside Alpha after a no.
  app.post('/api/setup/settings', async (req) => {
    const { pane } = z.object({ pane: z.string() }).parse(req.body)
    const known = (engine.connectors?.known() ?? []).some((c) => c.manifest.system?.pane === pane)
    if (!known) throw new Refused('No connection needs that pane of System Settings.')
    ;(options.platform ?? new PlainPlatform()).openSettings(pane)
    return { ok: true }
  })
  app.post('/api/setup/prepare', async () => {
    options.setup?.prepare()
    return { ok: true }
  })
  app.post('/api/setup/awake', async (req) => {
    const { on } = z.object({ on: z.boolean() }).parse(req.body)
    options.setup?.setKeepAwake(on)
    return { ok: true }
  })
  // The person's own data, from within Alpha (decision 12): what it holds, a backup now, going
  // back, taking it, bringing it in, a copy in a folder, removing it all on their word.
  const data = () => {
    if (!options.data) throw new Refused('The data page is not set up in this core.')
    return options.data
  }
  app.get('/api/data', async (): Promise<DataPageView> => dataView(world, data().install()))
  app.post('/api/data/backup', async () => backupNow(world, { user: user.id }))
  app.post('/api/data/restore', async (req) => {
    const { name } = z.object({ name: z.string().regex(/^world-[\w.-]+\.sqlite$/) }).parse(req.body)
    const file = join(world.paths.backups, name)
    if (!existsSync(file)) throw new Refused('That backup is not there.')
    const d = data()
    await backupNow(world, { user: user.id }, 'before')
    const paths = world.paths
    void d.restart(`Went back to the backup ${name}.`, async () => {
      await restoreWorld(paths, file)
      markRestart(
        paths,
        `Went back to the backup ${name}; the backup taken just before is in the list.`,
      )
    })
    return { restarting: true }
  })
  app.post('/api/data/export', async () => ({ file: await takeData(world, data().home) }))
  app.post('/api/data/import', async (req) => {
    const { archive } = z.object({ archive: z.string().trim().min(1) }).parse(req.body)
    const d = data()
    const staged = prepareBring(world, archive)
    const paths = world.paths
    void d.restart(`Brought the data in from ${archive}.`, async () => {
      await applyBring(paths, d.home, staged)
      markRestart(paths, `Brought the data in from ${archive}.`)
    })
    return { restarting: true }
  })
  app.post('/api/data/copy', async (req) => {
    const { folder } = z.object({ folder: z.string().trim() }).parse(req.body)
    if (folder && !existsSync(folder)) throw new Refused('That folder is not there.')
    data().setCopy(folder || null)
    if (folder) copyNewestBackup(world.paths.backups, folder)
    world.line({
      actor: person,
      kind: 'data',
      words: folder
        ? `A copy of the newest backup goes to ${folder} each day.`
        : 'No copy of the backups goes anywhere now.',
      user: user.id,
    })
    return { copyTo: folder || null }
  })
  app.post('/api/data/remove', async (req) => {
    const { name } = z.object({ name: z.string() }).parse(req.body)
    if (name.trim() !== user.name.trim())
      throw new Refused(`Type ${user.name} to remove everything; nothing was removed.`)
    const d = data()
    const refs = world.connections.list().flatMap((k) => (k.secretRef ? [k.secretRef] : []))
    void d.restart('Removed all of the person’s data on their word.', async () => {
      const gone = await removeData(
        d.home,
        refs,
        d.secrets,
        options.platform ?? new PlainPlatform(),
      )
      console.log(`Removed the person's data on their word: ${gone.join(', ')}.`)
    })
    return { restarting: true }
  })

  // The route, the person's choice: their own subscription, or an API key kept in the Keychain.
  app.post('/api/model', async (req): Promise<ModelView> => {
    const { route, key } = z
      .object({
        route: z.enum(['subscription', 'key', 'api']),
        key: z.string().max(400).optional(),
      })
      .parse(req.body)
    if (!engine.route) throw new Refused('The route is not set up in this core.')
    await engine.route.set(route, key ?? null, user.id)
    engine.rerouted()
    live()
    return modelView()
  })
}
