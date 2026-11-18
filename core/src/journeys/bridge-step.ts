// A journey's stand-in Bridge (docs/design.md, the Bridge): a person's computer on this Mac,
// paired with the journey's core through its own link and door, lending a folder of the journey's
// own. Its key is held in memory; its connector process is the core's child, as the zip carries it.
// The step puts a file in the folder, sends the computer away, or brings it back, lends the
// Mac's Calendar or Contacts or the browsing history, then reads. What its readers answer is
// replayed from the journey's recorded answers, never this Mac's own.
import { mkdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { Bridge, pair } from '@alpha/bridge'
import type { Config } from '@alpha/bridge/config'
import { inMemory } from '@alpha/bridge/keys'
import { buildServer } from '../api/server.ts'
import { bridges } from '../bridge/hub.ts'
import { handsFor } from '../connectors/computers.ts'
import type { ConnectorService } from '../connectors/service.ts'
import type { Engine } from '../engine/engine.ts'
import type { User, World } from '../world/world.ts'

const CHILD = join(import.meta.dirname, '..', 'connectors', 'child.ts')
const MAC = join(import.meta.dirname, '..', '..', '..', 'connectors', 'mac', 'src', 'index.ts')
const FOLDER = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'connectors',
  'files',
  'src',
  'folder.ts',
)

export interface BridgeStep {
  lend?: string | undefined // the folder it lends, under the journey's own ({tmp})
  put?: { name: string; text: string } | undefined // a file put in the folder
  away?: boolean | undefined // the Bridge stopped
  back?: boolean | undefined // the Bridge started again
  pause?: boolean | undefined // paused by its person there (true), or resumed (false)
  calendar?: boolean | undefined // its Calendar lent, through a stand-in for Alpha's helper
  contacts?: boolean | undefined // its Contacts lent, the same way
  browsing?: boolean | undefined // its browsing history lent, to the Bridge's browsing reader
}

// What the stand-in for Alpha's helper answers, where answers are not replayed: one event, never
// the Mac's own Calendar. A journey replays the calendar's recorded answer before it is asked.
const HELPER_EVENTS = {
  events: [
    {
      id: 'j1',
      title: 'Harbor call',
      start: '2026-11-17T15:00:00Z',
      end: '2026-11-17T15:30:00Z',
      allDay: false,
      location: '',
      calendar: 'Work',
      attendees: [{ name: 'Priya', email: 'priya@harbor.example' }],
      organizer: { name: 'Kenil', email: 'kenil@example.com', me: true },
    },
  ],
}

interface StandIn {
  bridge: Bridge
  config: Config
  close(): Promise<void>
}

const freePort = () =>
  new Promise<number>((ok) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const a = s.address()
      s.close(() => ok(typeof a === 'object' && a ? a.port : 0))
    })
  })

const until = async (check: () => boolean, words: string) => {
  const by = Date.now() + 30_000
  while (!check()) {
    if (Date.now() > by) throw new Error(`${words} did not happen in time.`)
    await new Promise((r) => setTimeout(r, 100))
  }
}

// The journey's computer, made on its first bridge step.
async function standIn(
  world: World,
  engine: Engine,
  user: User,
  connectors: ConnectorService,
  folder: string,
): Promise<StandIn> {
  bridges.use(
    world,
    handsFor(connectors, world, () => undefined),
  )
  const port = await freePort()
  const app = buildServer({ engine, user, token: 'journey', ports: [port] })
  await app.listen({ host: '127.0.0.1', port })
  const made = await app.inject({
    method: 'POST',
    url: '/api/computers/link',
    headers: { host: `127.0.0.1:${port}`, 'x-alpha-token': 'journey' },
  })
  const keys = inMemory()
  const paired = await pair(made.json().link as string, keys, 'The journey’s Mac')
  const config: Config = { ...paired, lends: [{ connector: 'folder', account: folder }] }
  const bridge = new Bridge({
    config: () => config,
    keys,
    start: async (connector) => ({
      command: process.execPath,
      args: [CHILD, connector === 'folder' ? FOLDER : MAC],
      shell: false,
    }),
    helper: async () => HELPER_EVENTS,
  })
  return {
    bridge,
    config,
    close: async () => {
      bridge.stop()
      await until(() => !bridges.online(config.computer), 'The Bridge going')
      await app.close()
    },
  }
}

// One step: what it did, in words, and whether it could be done.
export async function bridgeStep(
  step: BridgeStep,
  held: { standIn: StandIn | null },
  world: World,
  engine: Engine,
  user: User,
  connectors: ConnectorService,
  tmp: string,
): Promise<{ ok: boolean; what: string }> {
  const said: string[] = []
  if (step.lend) {
    const folder = step.lend.replaceAll('{tmp}', tmp)
    mkdirSync(folder, { recursive: true })
    held.standIn = await standIn(world, engine, user, connectors, folder)
    said.push(`Paired a computer with a link and lent ${folder} from it`)
  }
  const s = held.standIn
  if (!s) throw new Error('A bridge step lends a folder first.')
  const folder = s.config.lends[0]?.account ?? ''
  if (step.put) {
    writeFileSync(join(folder, step.put.name), step.put.text)
    said.push(`put ${step.put.name} in it`)
  }
  if (step.away) {
    s.bridge.stop()
    await until(() => !bridges.online(s.config.computer), 'The computer going away')
    said.push('stopped its Bridge')
  }
  if (step.pause === true) {
    s.bridge.pauseFor(null)
    await until(() => !!bridges.pausedOf(s.config.computer), 'The pause')
    said.push('paused it there')
  }
  if (step.pause === false) {
    s.bridge.resume()
    await until(() => !bridges.pausedOf(s.config.computer), 'The resume')
    said.push('resumed it')
  }
  if (step.lend || step.back) {
    s.bridge.run()
    await until(() => bridges.online(s.config.computer), 'The computer connecting')
    if (step.back) said.push('started its Bridge again')
  }
  if (step.lend)
    await until(() => world.connections.find('folder', folder)?.state === 'connected', 'The lend')
  // its readers lent once it is running; one the Bridge does not have yet cannot be lent, which
  // is said, and the journey fails
  if (step.browsing && !connectors.known().some((c) => c.manifest.name === 'browsing'))
    return {
      ok: false,
      what: '**The stand-in computer cannot lend its browsing history: the Bridge has no browsing reader yet.**',
    }
  const lent = (['calendar', 'contacts', 'browsing'] as const).filter((r) => step[r])
  for (const r of lent) {
    s.config.lends.push({ connector: r, account: s.config.name })
    s.bridge.changed()
    await until(
      () => world.connections.find(r, s.config.name)?.state === 'connected',
      `The ${r} lent`,
    )
    said.push(
      `lent its ${r === 'browsing' ? 'browsing history' : r.replace(/^./, (c) => c.toUpperCase())}`,
    )
  }
  const read = [
    ...(step.lend || !lent.length ? [world.connections.find('folder', folder)] : []),
    ...lent.map((r) => world.connections.find(r, s.config.name)),
  ]
  for (const k of read) if (k) await connectors.sync(k.id)
  const words = `${said.join(', ')}, then read it`
  return { ok: true, what: words.charAt(0).toUpperCase() + words.slice(1) }
}
