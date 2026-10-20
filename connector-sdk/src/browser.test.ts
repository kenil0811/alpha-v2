// The browser engine against pages served on this machine: never a real site.
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BrowserEngine, ensureBrowser, robotsAllow } from './browser.ts'

const BROWSERS = join(import.meta.dirname, '..', '..', '.data', 'browsers')

const list = (page: number) => `<html><head><title>Firms for sale</title></head><body>
  <div class="listing"><a class="t" href="/firm/IL${page}01">Tax practice ${page}01</a><span class="p">$${page}00,000</span></div>
  <div class="listing"><a class="t" href="/firm/CA${page}02">Bookkeeping firm ${page}02</a><span class="p">Not listed</span></div>
  ${page === 1 ? '<a class="next" href="/list?page=2">Next</a>' : ''}
</body></html>`

const PAGES: Record<string, [number, string]> = {
  '/robots.txt': [200, 'User-agent: *\nDisallow: /private\n'],
  '/list': [200, list(1)],
  '/list?page=2': [200, list(2)],
  '/check': [
    200,
    '<html><head><title>Just a moment</title></head><body>Verify you are human</body></html>',
  ],
  '/portal': [
    200,
    '<html><body><form><input type="email"><input type="password"></form></body></html>',
  ],
  '/busy': [429, '<html><body>Slow down</body></html>'],
}

let server: Server
let base: string
let profiles: string
const waits: number[] = []

beforeAll(async () => {
  await ensureBrowser(BROWSERS)
  server = createServer((req, res) => {
    const [status, body] = PAGES[req.url ?? ''] ?? [404, 'Not found']
    res.writeHead(status, {
      'content-type': req.url === '/robots.txt' ? 'text/plain' : 'text/html',
    })
    res.end(body)
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const address = server.address()
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
  profiles = mkdtempSync(join(tmpdir(), 'alpha-browser-'))
}, 120_000)

afterAll(async () => {
  await new Promise((r) => server.close(r))
  rmSync(profiles, { recursive: true, force: true })
})

function engine() {
  return new BrowserEngine({
    browsers: BROWSERS,
    profiles,
    pace: { minMs: 5000, maxMs: 5000 },
    sleep: async (ms) => {
      waits.push(Math.round(ms / 1000))
    },
  })
}

describe('the browser engine', () => {
  it('reads every page of a list at a person’s pace, with each listing’s own id', async () => {
    const e = engine()
    waits.length = 0
    const out = await e.extract(`${base}/list`, {
      list: '.listing',
      fields: { title: { css: '.t' }, link: { css: '.t', attr: 'href' }, price: { css: '.p' } },
      next: 'a.next',
      id: { field: 'link', pattern: '/firm/([A-Z]{2}\\d+)' },
    })
    await e.close()
    expect(out.pages).toBe(2)
    expect(out.items.map((i) => [i._id, i.title, i.price])).toEqual([
      ['IL101', 'Tax practice 101', '$100,000'],
      ['CA102', 'Bookkeeping firm 102', 'Not listed'],
      ['IL201', 'Tax practice 201', '$200,000'],
      ['CA202', 'Bookkeeping firm 202', 'Not listed'],
    ])
    expect(out.items[0]?._url).toBe(`${base}/firm/IL101`)
    expect(waits).toHaveLength(1) // the second page waited its turn
  }, 60_000)

  it('stops at a bot check, a sign-in and a rate limit, and keeps to robots rules', async () => {
    const e = engine()
    await expect(e.open(`${base}/check`)).rejects.toThrow(/asked whether a person is reading/)
    await expect(e.open(`${base}/portal`)).rejects.toThrow(/wants you to sign in/)
    await expect(e.open(`${base}/busy`)).rejects.toThrow(/429/)
    await expect(e.open(`${base}/private/deals`)).rejects.toThrow(/robots rules/)
    await e.close()
  }, 60_000)

  it('reads only the hosts it is given, when it is given some', async () => {
    const only = new BrowserEngine({
      browsers: BROWSERS,
      profiles,
      pace: { minMs: 0, maxMs: 0 },
      only: ['127.0.0.1'],
    })
    await expect(only.open('https://example.com/listings')).rejects.toThrow(/may read/)
    await only.close()
  })

  it('reads robots rules for every reader, the longest rule winning', () => {
    const robots =
      'User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /listings/\nAllow: /listings/public\n'
    expect(robotsAllow(robots, '/about')).toBe(true)
    expect(robotsAllow(robots, '/listings/42')).toBe(false)
    expect(robotsAllow(robots, '/listings/public/42')).toBe(true)
    expect(robotsAllow('', '/anything')).toBe(true)
  })

  it('reads a wildcard and an end in robots rules as patterns, not as cut-off paths', () => {
    const robots =
      'User-agent: *\nAllow: /\nDisallow: /*_rsc=\nDisallow: *?lightbox=\nDisallow: /*.pdf$\n'
    expect(robotsAllow(robots, '/listings')).toBe(true)
    expect(robotsAllow(robots, '/listings?_rsc=1a2b')).toBe(false)
    expect(robotsAllow(robots, '/gallery?lightbox=3')).toBe(false)
    expect(robotsAllow(robots, '/brochure.pdf')).toBe(false)
    expect(robotsAllow(robots, '/brochure.pdf?v=2')).toBe(true)
  })

  it('reads a group of several User-agent lines, and the groups after it apart', () => {
    const robots =
      'User-agent: Bingbot\nUser-agent: *\nDisallow: /private\n\nUser-agent: PetalBot\nDisallow: /\n'
    expect(robotsAllow(robots, '/private/1')).toBe(false)
    expect(robotsAllow(robots, '/listings')).toBe(true)
  })
})
