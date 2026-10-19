// The core: one process, listening on loopback (design §2, §3).
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildServer } from './api/server.ts'
import { Engine } from './engine/engine.ts'
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
const engine = new Engine(world)
// The built window is served by the core itself; in development Vite serves it on the next port.
const windowDir = join(import.meta.dirname, '..', '..', 'window', 'dist')
const served = process.env.ALPHA_DEV_WINDOW !== '1' && existsSync(join(windowDir, 'index.html'))
const app = buildServer({
  engine,
  user,
  token,
  ports: [port, windowPort],
  ...(served ? { windowDir } : {}),
})
await app.listen({ host: '127.0.0.1', port })
console.log(`Alpha's core is listening on 127.0.0.1:${port}, data in ${home}`)
console.log(`Open Alpha: http://127.0.0.1:${served ? port : windowPort}/?t=${token}`)

const shutdown = async () => {
  engine.close()
  await app.close()
  world.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
