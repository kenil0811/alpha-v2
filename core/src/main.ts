// The core: one process, listening on loopback (design §2, §3).
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BrowserEngine, MacKeychain, MemorySecrets, type SecretStore } from '@alpha/connector-sdk'
import { buildServer } from './api/server.ts'
import { config } from './config.ts'
import { ConnectorService } from './connectors/service.ts'
import { Engine } from './engine/engine.ts'
import { AgentRunner } from './modules/runs.ts'
import { Scheduler } from './scheduler/scheduler.ts'
import { tenantDir, World } from './world/world.ts'

const home = process.env.ALPHA_HOME
if (!home) {
  console.error('ALPHA_HOME is not set: say where Alpha keeps its data before starting the core.')
  process.exit(1)
}
mkdirSync(home, { recursive: true })

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
// Alpha's helper on the Mac (the Keychain, Calendar, Contacts), built when its source changed;
// the shipped app carries it signed.
const sdk = join(import.meta.dirname, '..', '..', 'connector-sdk', 'helper')
const helperApp = join(sdk, 'build', 'Alpha Helper.app')
let secrets: SecretStore = new MemorySecrets()
if (process.platform === 'darwin') {
  try {
    execFileSync('/bin/sh', [join(sdk, 'build.sh')], { stdio: 'inherit' })
    process.env.ALPHA_HELPER_APP = helperApp
    secrets = new MacKeychain(helperApp)
  } catch {
    console.error("Alpha's helper did not build: connections that need the Keychain wait for it.")
  }
}
const connectors = new ConnectorService(world, { secrets })
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
  notify: () => engine.events.emit('event', { type: 'lines', user: user.id }),
})
const engine = new Engine(world, {
  connectors,
  hands: { browser: browserEngine, runner, browsers: join(home, 'browsers') },
})
const scheduler = new Scheduler(world, [
  { run: (now) => connectors.syncDue(now) },
  { run: (now) => runner.runDue(now) },
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
const app = buildServer({
  engine,
  user,
  token,
  ports: [port, windowPort],
  browsers: join(home, 'browsers'),
  ...(served ? { windowDir } : {}),
})
await app.listen({ host: '127.0.0.1', port })
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
