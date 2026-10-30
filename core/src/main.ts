// The core: one process, listening on loopback (design §2, §3).
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { BrowserEngine } from '@alpha/connector-sdk'
import { buildServer } from './api/server.ts'
import { config } from './config.ts'
import { loadSet, STANDARD_DIR, updateOwn } from './connectors/discover.ts'
import { ConnectorService } from './connectors/service.ts'
import { copyNewestBackup, takeRestartNote } from './data.ts'
import { ClaudeApiProvider } from './engine/claudeapi.ts'
import { ClaudeCodeProvider } from './engine/claudecode.ts'
import { Engine } from './engine/engine.ts'
import { ModelRoute } from './engine/route.ts'
import { Intake } from './files/intake.ts'
import type { Ask } from './files/reading.ts'
import { readInstall, writeInstall } from './install.ts'
import { logToFile } from './log.ts'
import { agents } from './modules/agents.ts'
import { keepDefaults } from './modules/defaults.ts'
import { Drafts } from './modules/drafts.ts'
import { installInbox } from './modules/packs.ts'
import { AgentRunner } from './modules/runs/index.ts'
import { platformHere } from './platform/index.ts'
import { Scheduler } from './scheduler/scheduler.ts'
import { Setup } from './setup.ts'
import { isDeveloper, type Trust } from './signing.ts'
import { fold, verify } from './world/audit.ts'
import { backupDaily } from './world/backups.ts'
import { setHomeRegion } from './world/phones.ts'
import { expire } from './world/records/index.ts'
import { tenantDir, World } from './world/world.ts'

const home = process.env.ALPHA_HOME
if (!home) {
  console.error('ALPHA_HOME is not set: say where Alpha keeps its data before starting the core.')
  process.exit(1)
}
mkdirSync(home, { recursive: true })
// What the installer knows about this Alpha (alpha.yaml), the environment overriding it.
const install = readInstall(home)
if (install.logs) logToFile(install.logs)

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

// The core started again: under the login item (install.sh says so in its plist) an
// unsuccessful exit brings it back; started by hand, it starts itself again, the lock handed
// over first. After a restore, a removal, or a failure nothing caught.
function restartSelf(): void {
  if (process.env.ALPHA_LOGIN_ITEM === '1') process.exit(3)
  rmSync(lock, { force: true })
  spawn(process.execPath, process.argv.slice(1), {
    detached: true,
    stdio: 'inherit',
    env: process.env,
    cwd: process.cwd(),
  }).unref()
  process.exit(0)
}

// A failure nothing caught (a pipe closed under a write, a library's own error) is said in the
// log with its stack and the core comes back, rather than staying down until someone looks.
let restarting = false
const lastResort = (what: string) => (err: unknown) => {
  if (restarting) return
  restarting = true
  const words = err instanceof Error ? (err.stack ?? err.message) : String(err)
  console.error(`The core stopped on ${what} nothing caught: ${words}\nStarting again.`)
  setTimeout(restartSelf, 200)
}
process.on('uncaughtException', lastResort('an error'))
process.on('unhandledRejection', lastResort('a rejected promise'))

// The per-install token: the shell passes it to the window; until the shell exists, the address
// printed below carries it.
const tokenFile = join(home, 'token')
if (!existsSync(tokenFile))
  writeFileSync(tokenFile, randomBytes(24).toString('hex'), { mode: 0o600 })
const token = readFileSync(tokenFile, 'utf8').trim()

// The computer's own pieces (secrets, notifications, keeping awake, settings, the person's
// name, the region): the Mac's here, the plain ones elsewhere.
const platform = platformHere()
setHomeRegion(platform.region())
const port = install.port
const windowPort = port + 1
const tenant = tenantDir(home, install.tenant)
const world = await World.open(tenant)
// the journal's chain, checked at every start (step 2, part 3): a break is said, never hidden
const chainCheck = verify(world.db)
if (!chainCheck.ok) {
  const words = `The journal's chain is broken at line ${chainCheck.at}: ${chainCheck.why}. A line was changed or removed outside Alpha.`
  console.error(words)
  world.line({ actor: { kind: 'system' }, kind: 'journal_check', words, data: chainCheck })
}
const user = world.owner(install.owner ?? platform.personName())
// what the last start was told to say (a backup put back, data brought in)
const note = takeRestartNote(tenant)
if (note)
  world.line({ actor: { kind: 'person', id: user.id }, kind: 'data', words: note, user: user.id })
// what was learned at first start goes back in the file, so the next start finds it there
if (!install.tenant || !install.owner)
  writeInstall(home, { tenant: basename(tenant), owner: user.name })
// what the core is still setting up once it listens: the window says so meanwhile
const kitsNow = { now: null as string | null }
// The secret store: the Mac's Keychain through Alpha's helper (named in alpha.yaml, or built in
// development); the helper and uv are handed on to the packages that read them.
const { store: secrets, helper } = platform.secrets(install.helper)
if (helper) process.env.ALPHA_HELPER_APP = helper
if (install.uv) process.env.ALPHA_UV = install.uv
// The connectors: the standard set the release ships, then every folder under Alpha's own
// connectors/ (added from Settings); a folder that does not load is said on Home and left out.
const connectorsDir = join(home, 'connectors')
// what an install trusts: Kenil's signature, or everything while the developer switch is on
const trust = (): Trust => ({ developer: isDeveloper(world, user.id) })
for (const u of updateOwn(connectorsDir, trust())) {
  const words = u.refused
    ? `The connector ${u.title} ${u.version} was not taken: ${u.refused}`
    : `Updated the connector ${u.title} to ${u.version}, Alpha's own.`
  console.log(words)
  world.line({
    actor: { kind: 'system' },
    kind: 'connector_updated',
    words,
    data: { name: u.name, version: u.version },
  })
}
const standard = await loadSet(STANDARD_DIR)
const added = await loadSet(
  connectorsDir,
  standard.connectors.map((c) => c.manifest.name),
  trust(),
)
// the browser is made on first use (below): a site read as the person is read with it
const connectors = new ConnectorService(world, {
  secrets,
  browser: () => browserEngine(),
  known: [...standard.connectors, ...added.connectors],
})
for (const f of [...standard.failed, ...added.failed]) {
  const words = `The connector in ${f.folder} did not load: ${f.why}`
  console.error(words)
  world.line({
    actor: { kind: 'system' },
    kind: 'connector_load',
    words,
    data: { folder: f.folder },
  })
}
// How this install reaches Claude: the person's subscription, or a key kept in the Keychain.
const route = new ModelRoute(world, secrets, home)
await route.load()
// The model as a provider (decision 11): Claude Code through the Agent SDK on the person's
// subscription or with the key, or the key through Anthropic's SDK and Alpha's own loop; the
// route chosen in Settings picks one when a session opens, and for each one-question ask.
const claudeCode = new ClaudeCodeProvider({ route, askDir: world.paths.dir })
const claudeApi = new ClaudeApiProvider(world, { key: () => route.apiKey, userId: user.id })
const provider = () => (route.name === 'api' ? claudeApi : claudeCode)
const providers = [
  {
    route: 'subscription' as const,
    title: 'Claude Code on your subscription',
    provider: claudeCode,
  },
  { route: 'key' as const, title: 'Claude Code with an API key', provider: claudeCode },
  {
    route: 'api' as const,
    title: "Claude with an API key, on Alpha's own loop",
    provider: claudeApi,
  },
]
const ask: Ask = (prompt, schema) => provider().ask(config.reading(), prompt, schema)
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
// The runner ends the runs a crashed core left running as it is made, and tells the window; the
// engine is made after it, so until then there is no window to tell (a start with orphans
// crashed on this, 24 Oct).
let started: Engine | null = null
const runner = new AgentRunner(world, browserEngine, {
  owner: user.id,
  ask,
  judge: (prompt, schema) => provider().ask(config.judging(), prompt, schema),
  notify: () => started?.events.emit('event', { type: 'lines', user: user.id }),
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
  provider,
  providers,
  hands: { browser: browserEngine, runner, browsers: join(home, 'browsers'), intake, drafts },
})
started = engine
// when Alpha's Mac app last asked for notices
const shell = { seen: 0 }
const scheduler = new Scheduler(world, [
  { run: (now) => connectors.syncDue(now) },
  {
    run: async () => {
      if (await intake.due()) engine.events.emit('event', { type: 'lines', user: user.id })
    },
  },
  // agents in their own lane: the tick goes on while they run (item 15 of the problems list)
  { run: async (now) => runner.startDue(now) },
  // tasks' reminders as they come due (a Mac notification and a line on Home), and repeats made
  {
    run: async (now) => {
      let said = false
      world.tasks.tick(now, { actor: { kind: 'system' }, user: user.id }, (t) => {
        said = true
        // Alpha's Mac app shows it when it is running (it asked for notices lately); else the
        // computer's own notifications do
        if (Date.now() - shell.seen < 30_000) return
        platform.notify('Reminder', t.title)
      })
      if (said) engine.events.emit('event', { type: 'lines', user: user.id })
    },
  },
  // removed rows kept past keep_removed_days deleted for good (core step 1)
  { run: async () => void expire(world.records, config.limits().keep_removed_days) },
  // read lines older than journal_fold_days folded into a checkpoint a day (step 2, part 3)
  {
    run: async () => {
      const done = fold(world.db, config.limits().journal_fold_days, { actor: { kind: 'system' } })
      if (done.folded) console.log(`Folded ${done.folded} read lines of the journal.`)
    },
  },
  // the world backed up once a day, the last 7 days and 4 weeks kept
  {
    run: async () => {
      const made = await backupDaily(world.db, world.paths.backups, new Date(), {
        files: world.paths.files,
        modules: world.paths.modules,
      })
      if (made) console.log(`Backed up the world: ${made}`)
      // and a copy of the newest to the person's folder, where they named one
      const copyTo = readInstall(home).backupsCopy
      if (copyTo) {
        const copied = copyNewestBackup(world.paths.backups, copyTo, {
          files: world.paths.files,
          modules: world.paths.modules,
        })
        if (copied) console.log(`Copied the newest backup to ${copied}`)
      }
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
const setup = new Setup(home, world, route, connectors, install, platform)
if (install.prepareReaders) setup.prepare()
setup.holdAwake()
const app = buildServer({
  shell,
  kits: kitsNow,
  engine,
  user,
  token,
  setup,
  ports: [port, windowPort],
  browsers: join(home, 'browsers'),
  connectorsDir,
  platform,
  data: {
    home,
    install: () => readInstall(home),
    setCopy: (folder) => writeInstall(home, { backupsCopy: folder }),
    secrets,
    // the world closed, the change applied, the process gone: the login item starts it again
    // (an unsuccessful exit, as its plist asks); a development run is started again by hand
    restart: async (words, apply) => {
      console.log(`${words} Restarting.`)
      scheduler.stop()
      engine.rerouted()
      world.close()
      try {
        await apply()
      } catch (err) {
        console.error(`That did not go through: ${err instanceof Error ? err.message : err}`)
      }
      setTimeout(restartSelf, 300)
    },
  },
  failedConnectors: [...standard.failed, ...added.failed],
  ...(served ? { windowDir } : {}),
})
try {
  await app.listen({ host: '127.0.0.1', port })
  // the kits go in once the core answers, not before (a first start on a slow Mac took minutes):
  // kit packs dropped in kits/inbox (the install puts a client's there), then Alpha's own modules
  // (Network), installed or brought up to date at every start
  void (async () => {
    const ctx = { actor: { kind: 'system' as const }, user: user.id }
    kitsNow.now = 'your kits'
    engine.events.emit('event', { type: 'lines', user: user.id })
    try {
      for (const said of await installInbox(world, join(home, 'kits'), ctx, trust()))
        console.log(said)
      kitsNow.now = "Alpha's own modules"
      for (const said of await keepDefaults(world, ctx)) console.log(said)
    } catch (err) {
      console.error(
        `Setting up the kits did not finish: ${err instanceof Error ? err.message : err}`,
      )
    }
    kitsNow.now = null
    engine.events.emit('event', { type: 'lines', user: user.id })
  })()
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
