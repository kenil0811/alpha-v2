// The core: one process, listening on loopback (design §2, §3).
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BrowserEngine, MacKeychain, NoSecrets, type SecretStore } from '@alpha/connector-sdk'
import { buildServer } from './api/server.ts'
import { config } from './config.ts'
import { ConnectorService } from './connectors/service.ts'
import { Engine } from './engine/engine.ts'
import { ModelRoute } from './engine/route.ts'
import { Intake } from './files/intake.ts'
import { askModel } from './files/reading.ts'
import { logToFile } from './log.ts'
import { agents } from './modules/agents.ts'
import { keepDefaults } from './modules/defaults.ts'
import { Drafts } from './modules/drafts.ts'
import { installInbox } from './modules/packs.ts'
import { AgentRunner } from './modules/runs.ts'
import { Scheduler } from './scheduler/scheduler.ts'
import { Setup } from './setup.ts'
import { backupDaily } from './world/backups.ts'
import { tenantDir, World } from './world/world.ts'

if (process.env.ALPHA_LOG_DIR) logToFile(process.env.ALPHA_LOG_DIR)

const home = process.env.ALPHA_HOME
if (!home) {
  console.error('ALPHA_HOME is not set: say where Alpha keeps its data before starting the core.')
  process.exit(1)
}
mkdirSync(home, { recursive: true })

// One core per data folder: a second one is refused in a sentence, and a lock left by one that
// stopped without saying so is taken over.
const lock = join(home, 'core.lock')
if (existsSync(lock)) {
  const pid = Number(readFileSync(lock, 'utf8').trim())
  let alive = false
  try {
    if (pid && pid !== process.pid) {
      process.kill(pid, 0)
      alive = true
    }
  } catch {}
  if (alive) {
    console.error(
      `Alpha is already running on this Mac with its data in ${home} (process ${pid}). Open it, or stop it first.`,
    )
    process.exit(1)
  }
}
writeFileSync(lock, String(process.pid))
process.on('exit', () => {
  try {
    if (readFileSync(lock, 'utf8').trim() === String(process.pid)) rmSync(lock)
  } catch {}
})

// The per-install token: the shell passes it to the window; until the shell exists, the address
// printed below carries it.
const tokenFile = join(home, 'token')
if (!existsSync(tokenFile))
  writeFileSync(tokenFile, randomBytes(24).toString('hex'), { mode: 0o600 })
const token = readFileSync(tokenFile, 'utf8').trim()

const port = Number(process.env.ALPHA_PORT ?? 4700)
const windowPort = port + 1
const world = await World.open(tenantDir(home))
const user = world.owner(process.env.ALPHA_OWNER)
// kit packs dropped in Alpha's kits/inbox (the install puts a client's there) go in at start
for (const said of await installInbox(world, join(home, 'kits'), {
  actor: { kind: 'system' },
  user: user.id,
}))
  console.log(said)
// Alpha's own modules (Network), installed or brought up to date at every start
for (const said of await keepDefaults(world, { actor: { kind: 'system' }, user: user.id }))
  console.log(said)
// Alpha's helper on the Mac (the Keychain, Calendar, Contacts). The shipped app carries it built
// and signed (ALPHA_HELPER_APP); in development it is built when its source changed. Without it no
// password is kept, and connecting an account says why, rather than keeping it in memory only.
const sdk = join(import.meta.dirname, '..', '..', 'connector-sdk', 'helper')
let secrets: SecretStore = new NoSecrets(
  "Alpha's helper is not running on this Mac, so Alpha cannot keep a password safely. Reinstall Alpha, or send Kenil a report.",
)
if (process.platform === 'darwin') {
  const shipped = process.env.ALPHA_HELPER_APP
  if (shipped && existsSync(join(shipped, 'Contents', 'MacOS', 'alpha-helper')))
    secrets = new MacKeychain(shipped)
  else
    try {
      execFileSync('/bin/sh', [join(sdk, 'build.sh')], { stdio: 'inherit' })
      const built = join(sdk, 'build', 'Alpha Helper.app')
      process.env.ALPHA_HELPER_APP = built
      secrets = new MacKeychain(built)
    } catch {
      console.error(
        "Alpha's helper is not there and did not build: no password can be kept until it is.",
      )
    }
}
// the browser is made on first use (below): LinkedIn reads with it, as the person
const connectors = new ConnectorService(world, { secrets, browser: () => browserEngine() })
// How this install reaches Claude: the person's subscription, or a key kept in the Keychain.
const route = new ModelRoute(world, secrets, home)
await route.load()
const ask = askModel(world.paths.dir, () => route.env())
// The browser starts on first use: its own copy is set up in Alpha's folder then.
let browser: BrowserEngine | null = null
const browserEngine = () => {
  if (!browser) {
    const limits = config.limits()
    browser = new BrowserEngine({
      browsers: join(home, 'browsers'),
      profiles: join(home, 'browser-profiles'),
      pace: { minMs: limits.browser_pace_min_ms, maxMs: limits.browser_pace_max_ms },
    })
  }
  return browser
}
const runner = new AgentRunner(world, browserEngine, {
  owner: user.id,
  ask,
  judge: askModel(
    world.paths.dir,
    () => route.env(),
    () => config.judging(),
  ),
  notify: () => engine.events.emit('event', { type: 'lines', user: user.id }),
})
// Files that come by mail, proposed for filing on a card each.
const intake = new Intake(
  world,
  { sources: () => connectors.fileSources(), fetch: (c, item) => connectors.fetchFiles(c, item) },
  ask,
  user,
)
// Agents' drafts, sent from the person's own mail on their yes.
const drafts = new Drafts(
  world,
  { send: (connector, message) => connectors.runTool(connector, 'send', { ...message }) },
  user,
  (agent, module) => {
    const a = agents(world, module).find((x) => x.name === agent)
    if (a) void runner.runAgent(a).catch(() => undefined)
  },
)
runner.drafts = drafts
const engine = new Engine(world, {
  connectors,
  route,
  hands: { browser: browserEngine, runner, browsers: join(home, 'browsers'), intake, drafts },
})
const scheduler = new Scheduler(world, [
  { run: (now) => connectors.syncDue(now) },
  {
    run: async () => {
      if (await intake.due()) engine.events.emit('event', { type: 'lines', user: user.id })
    },
  },
  { run: (now) => runner.runDue(now) },
  // the world backed up once a day, the last 7 days and 4 weeks kept
  {
    run: async () => {
      const made = await backupDaily(world.db, world.paths.backups)
      if (made) console.log(`Backed up the world: ${made}`)
    },
  },
])
scheduler.start()
// A change runs the agents waiting on it soon after, not at the next minute's tick.
let kick: ReturnType<typeof setTimeout> | null = null
engine.events.on('event', (e: { type: string }) => {
  if (e.type !== 'lines' || kick) return
  kick = setTimeout(() => {
    kick = null
    void runner.runDue().catch(() => undefined)
  }, 1500)
  kick.unref()
})
// The built window is served by the core itself; in development Vite serves it on the next port.
const windowDir = join(import.meta.dirname, '..', '..', 'window', 'dist')
const served = process.env.ALPHA_DEV_WINDOW !== '1' && existsSync(join(windowDir, 'index.html'))
// What this Mac still needs; the installed app's login item starts the readers' downloads.
const setup = new Setup(home, world, route)
if (process.env.ALPHA_PREPARE_READERS === '1') setup.prepare()
setup.holdAwake()
const app = buildServer({
  engine,
  user,
  token,
  setup,
  ports: [port, windowPort],
  browsers: join(home, 'browsers'),
  ...(served ? { windowDir } : {}),
})
try {
  await app.listen({ host: '127.0.0.1', port })
} catch (err) {
  console.error(
    (err as { code?: string }).code === 'EADDRINUSE'
      ? `Port ${port} on this Mac is taken by another program, so Alpha cannot start there. Quit that program, or start Alpha with ALPHA_PORT set to another port.`
      : `Alpha could not listen on port ${port}: ${err instanceof Error ? err.message : String(err)}`,
  )
  process.exit(1)
}
console.log(`Alpha's core is listening on 127.0.0.1:${port}, data in ${home}`)
console.log(`Open Alpha: http://127.0.0.1:${served ? port : windowPort}/?t=${token}`)

const shutdown = async () => {
  scheduler.stop()
  engine.close()
  await browser?.close()
  await app.close()
  world.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
