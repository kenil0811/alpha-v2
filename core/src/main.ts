// The core: one process, listening on loopback (design §2, §3).
import { buildServer } from './api/server.ts'

const home = process.env.ALPHA_HOME
if (!home) {
  console.error('ALPHA_HOME is not set: say where Alpha keeps its data before starting the core.')
  process.exit(1)
}

const port = Number(process.env.ALPHA_PORT ?? 4700)
const app = buildServer()
await app.listen({ host: '127.0.0.1', port })
console.log(`Alpha's core is listening on http://127.0.0.1:${port}, data in ${home}`)
