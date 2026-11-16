// The Bridge's files on an Alpha: the installer for each computer, and the update its app asks
// for, each handed out only when its signature holds, the update reachable without a session.
import { generateKeyPairSync } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Engine } from '../engine/engine.ts'
import { signManifest } from '../signing.ts'
import { World } from '../world/world.ts'
import { buildServer } from './server.ts'

let home: string
let world: World
let engine: Engine
const key = generateKeyPairSync('ed25519')
const publicPem = key.publicKey.export({ type: 'spki', format: 'pem' }).toString()
const privatePem = key.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const HOST = { host: '127.0.0.1:4700' }

// a file of the Bridge's, signed with the test's key (or not), and Tauri's signature beside it
function put(dir: string, name: string, signed = true, updater = false) {
  const bytes = Buffer.from(`the bytes of ${name}`)
  writeFileSync(join(dir, name), bytes)
  writeFileSync(join(dir, `${name}.sig`), signed ? signManifest(bytes, privatePem) : 'not it')
  if (updater) writeFileSync(join(dir, `${name}.updater.sig`), `tauri signature of ${name}`)
}

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-bridge-files-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  engine = new Engine(world)
})

afterEach(() => {
  engine.close()
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('the Bridge’s files', () => {
  it('hands out the newest signed installer, and its update only to an older app', async () => {
    const dir = join(home, 'bridge')
    mkdirSync(dir)
    put(dir, 'alpha-bridge-0.1.0-darwin-arm64.zip')
    put(dir, 'alpha-bridge-0.2.0-darwin-arm64.dmg')
    put(dir, 'alpha-bridge-0.2.0-darwin-arm64.app.tar.gz', true, true)
    put(dir, 'alpha-bridge-0.3.0-darwin-arm64.dmg', false) // not signed by the key: never handed out
    const app = buildServer({
      engine,
      user: world.owner('Kenil'),
      ports: [4700],
      signIn: { days: 30 },
      bridgeDir: dir,
      bridgeKey: publicPem,
    })
    await app.ready()
    // the update, without a session
    const older = await app.inject({ url: '/api/bridge/update/darwin-arm64/0.1.0', headers: HOST })
    expect(older.statusCode).toBe(200)
    expect(older.json()).toMatchObject({
      version: '0.2.0',
      url: 'http://127.0.0.1:4700/api/bridge/app/alpha-bridge-0.2.0-darwin-arm64.app.tar.gz',
      signature: 'tauri signature of alpha-bridge-0.2.0-darwin-arm64.app.tar.gz',
    })
    const same = await app.inject({ url: '/api/bridge/update/darwin-arm64/0.2.0', headers: HOST })
    expect(same.statusCode).toBe(204)
    const file = await app.inject({
      url: '/api/bridge/app/alpha-bridge-0.2.0-darwin-arm64.app.tar.gz',
      headers: HOST,
    })
    expect(file.body).toBe('the bytes of alpha-bridge-0.2.0-darwin-arm64.app.tar.gz')
    const unsigned = await app.inject({
      url: '/api/bridge/app/alpha-bridge-0.3.0-darwin-arm64.dmg',
      headers: HOST,
    })
    expect(unsigned.statusCode).toBe(404)
    // the installer is for a signed-in person only
    const download = await app.inject({ url: '/api/bridge/download/darwin-arm64', headers: HOST })
    expect(download.statusCode).toBe(401)
    await app.close()
  })
})
