// A site's sign-in in a live picture: the picture arrives, what is typed reaches the page, and the
// moment the walled page opens without a sign-in is noticed. A made-up site on this computer.
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BrowserContext } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BrowserEngine } from './browser.ts'

const FORM = `<!doctype html><title>Sign in</title><form method="post" action="/in">
  <input id="who" name="who" style="position:absolute;left:20px;top:20px;width:300px;height:40px">
  <input id="pw" name="pw" type="password" style="position:absolute;left:20px;top:80px;width:300px;height:40px">
  <button style="position:absolute;left:20px;top:140px;width:120px;height:40px">Go</button>
</form>`

let site: Server
let base: string
let home: string
let engine: BrowserEngine
const browsers = join(import.meta.dirname, '..', '..', '.data', 'browsers')

beforeAll(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-live-'))
  site = createServer((req, res) => {
    const signed = (req.headers.cookie ?? '').includes('in=1')
    if (req.url === '/in' && req.method === 'POST') {
      res.writeHead(302, { location: '/deals', 'set-cookie': 'in=1; Path=/' })
      res.end()
    } else if (req.url === '/') {
      // a home page open to anyone, with a sign-in that goes on to a code
      res.setHeader('content-type', 'text/html')
      res.end(
        '<title>Home</title><a href="/login" style="position:absolute;left:20px;top:20px;width:120px;height:40px">Sign in</a>',
      )
    } else if (req.url === '/login') {
      res.setHeader('content-type', 'text/html')
      res.end(FORM.replace('/in', '/code'))
    } else if (req.url === '/code') {
      res.setHeader('content-type', 'text/html')
      res.end('<title>Check</title><h1>Enter the code we sent you</h1><input name="otp">')
    } else if (req.url === '/deals') {
      res.setHeader('content-type', 'text/html')
      res.end(signed ? '<title>Deals</title><h1>Your deals</h1>' : FORM)
    } else {
      res.writeHead(404)
      res.end()
    }
  }).listen(0, '127.0.0.1')
  await new Promise((ok) => site.once('listening', ok))
  base = `http://127.0.0.1:${(site.address() as AddressInfo).port}`
  engine = new BrowserEngine({
    browsers,
    profiles: join(home, 'profiles'),
    pace: { minMs: 0, maxMs: 0 },
  })
}, 180_000)

afterAll(async () => {
  await engine.close()
  site.close()
  rmSync(home, { recursive: true, force: true })
})

const until = async (ok: () => boolean, ms = 20_000) => {
  const start = Date.now()
  while (!ok() && Date.now() - start < ms) await new Promise((r) => setTimeout(r, 100))
  return ok()
}

describe('a live sign-in', () => {
  it('shows the page, takes what is typed, and notices when they are in', async () => {
    const url = `${base}/deals`
    expect(engine.signedIn(url)).toBe(false)
    const live = await engine.openLive(url)
    let frames = 0
    let done = false
    await live.start(
      () => {
        frames++
      },
      () => {
        done = true
      },
    )
    expect(await until(() => frames > 0)).toBe(true)
    // the page is still walled, so nothing is noticed yet
    await new Promise((r) => setTimeout(r, 1500))
    expect(done).toBe(false)
    await live.input({ kind: 'down', x: 100, y: 40 })
    await live.input({ kind: 'up', x: 100, y: 40 })
    for (const key of 'ann') await live.input({ kind: 'keydown', key })
    await live.input({ kind: 'keydown', key: 'Tab' })
    await live.input({ kind: 'paste', text: 'a pasted password' })
    await live.input({ kind: 'keydown', key: 'Enter' })
    expect(await until(() => done)).toBe(true)
    // a reader's page in the same browser is not this sign-in's own, and outlives it
    const reading = await (live as unknown as { context: BrowserContext }).context.newPage()
    await new Promise((r) => setTimeout(r, 300))
    await live.close()
    expect(reading.isClosed()).toBe(false)
    await reading.close()
    engine.markSignedIn(url)
    expect(engine.signedIn(url)).toBe(true)
    // the reader carries on in the same profile, past the wall
    const page = await engine.open(url, { asPerson: true })
    expect(page.title).toBe('Deals')
  }, 120_000)

  it('never closes by itself on a site whose page is open to anyone: a code step is not being in', async () => {
    const live = await engine.openLive(`${base}/`)
    let done = false
    await live.start(
      () => undefined,
      () => {
        done = true
      },
    )
    expect(live.tells).toBe(false)
    const click = async (x: number, y: number) => {
      await live.input({ kind: 'down', x, y })
      await live.input({ kind: 'up', x, y })
    }
    // to the sign-in, long enough there for it to be seen, then past the password to the code
    await click(60, 40)
    await new Promise((r) => setTimeout(r, 2500))
    await click(100, 40)
    for (const key of 'ann') await live.input({ kind: 'keydown', key })
    await live.input({ kind: 'keydown', key: 'Tab' })
    await live.input({ kind: 'paste', text: 'a pasted password' })
    await live.input({ kind: 'keydown', key: 'Enter' })
    await new Promise((r) => setTimeout(r, 7000))
    expect(done).toBe(false)
    await live.close()
  }, 120_000)
})
