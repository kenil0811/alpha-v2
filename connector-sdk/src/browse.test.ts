// The browse tool's pages against a site served on this machine: never a real one. A tab per piece
// of work, the page as numbered elements, a click by its number, find by words, a small picture.
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { compact, element, press, pressAt, said, see, whatAt } from './browse.ts'
import { BrowserEngine, ensureBrowser } from './browser.ts'

const BROWSERS = join(import.meta.dirname, '..', '..', '.data', 'browsers')
const PAGES: Record<string, string> = {
  '/plans': `<html><head><title>Plans</title></head><body><h1>Plans</h1><ul>
    <li><a href="/plans/basic">Basic</a></li><li><a href="/plans/team">Team</a></li>
    <li><a href="/plans/team" target="_blank">Price sheet</a></li></ul>
    <form><label>Name <input name="n"></label><button>Send</button></form></body></html>`,
  '/plans/team':
    '<html><head><title>Team</title></head><body><h1>Team</h1><p>$49 a month</p></body></html>',
  '/plans/basic': '<html><head><title>Basic</title></head><body><h1>Basic</h1></body></html>',
  // an app page that keeps a line open to its server, as Drive does: its network never goes idle
  // a page drawn on a canvas, with one real button beside it
  '/draw': `<html><head><title>Draw</title></head><body style="margin:0">
    <canvas id="c" width="1000" height="500" style="display:block"></canvas>
    <dialog open aria-label="Delete forever?" style="position:fixed;left:20px;top:520px;margin:0">
      <button type="button">OK</button></dialog>
    <script>document.getElementById('c').onclick = (e) => { document.title = 'at ' + e.clientX + ',' + e.clientY }</script>
    </body></html>`,
  '/plan.txt': 'Boxes arrive on 3 June.',
  '/plan.pdf': '%PDF-1.7',
  '/app': `<html><head><title>App</title></head><body><h1>Files</h1>
    <script>fetch('/open-line')</script></body></html>`,
}
let server: Server
let base: string
let profiles: string

beforeAll(async () => {
  await ensureBrowser(BROWSERS)
  server = createServer((req, res) => {
    if (req.url === '/open-line') return // never answered
    const body = PAGES[req.url ?? '']
    const type = req.url?.endsWith('.txt')
      ? 'text/plain; charset=utf-8'
      : req.url?.endsWith('.pdf')
        ? 'application/pdf'
        : 'text/html'
    res.writeHead(body ? 200 : 404, { 'content-type': type }).end(body ?? 'Not found')
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const a = server.address()
  base = `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}`
  profiles = mkdtempSync(join(tmpdir(), 'alpha-browse-'))
}, 120_000)

afterAll(async () => {
  server.closeAllConnections()
  await new Promise((r) => server.close(r))
  rmSync(profiles, { recursive: true, force: true })
})

describe('browsing a site', () => {
  it('tidies a snapshot: numbers in front, nameless boxes left out', () => {
    expect(
      compact(
        '- generic [ref=e1]:\n  - heading "Plans" [level=1] [ref=e2]\n  - link "Team" [ref=e9] [cursor=pointer]:',
      ),
    ).toEqual(['  [2] heading "Plans" [level=1]', '  [9] link "Team":'])
    // an element inside a frame keeps its frame in its number
    expect(compact('- iframe [ref=e5]:\n  - textbox "Document content" [ref=f1e1]:')).toEqual([
      '[5] iframe:',
      '  [f1e1] textbox "Document content":',
    ])
  })

  it('opens a page in the work’s own tab, as numbered elements, and clicks one by its number', async () => {
    const engine = new BrowserEngine({ browsers: BROWSERS, profiles, pace: { minMs: 0, maxMs: 0 } })
    const me = engine.as('u_ann')
    try {
      const page = await me.tab('work-1', `${base}/plans`)
      const seen = await see(page, 250)
      expect(seen.title).toBe('Plans')
      expect(seen.elements).toMatch(/\[\d+\] link "Team"/)
      expect(seen.picture.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]))
      // find by words, then the number it gave
      const found = await see(page, 250, 'team')
      const n = Number(/\[(\d+)\] link "Team"/.exec(found.elements)?.[1])
      // what it is comes from that view: a fresh snapshot would number the page again
      expect(said(page, n)).toBe('link "Team"')
      expect(said(page, 9999)).toBe('')
      await element(page, n).click({ timeout: 5_000 })
      await page.waitForURL(/\/plans\/team$/)
      expect((await see(await me.tab('work-1'), 250)).elements).toMatch(/\$49 a month/)
      // another piece of work has a tab of its own
      await expect(me.tab('work-2')).rejects.toThrow(/open one first/)
      // a click that opens a new tab: the work goes on there, in one tab
      const list = await me.tab('work-1', `${base}/plans`)
      const sheet = await see(list, 250, 'price sheet')
      // a page opened again in the same tab may number its elements with its frame (f2e9)
      const m = /\[((?:f\d+e)?\d+)\] link "Price sheet"/.exec(sheet.elements)?.[1] ?? ''
      const opened = await press(list, m, false, 300)
      expect(opened).not.toBeNull()
      if (opened) await me.follow('work-1', opened)
      expect(list.isClosed()).toBe(true)
      expect((await see(await me.tab('work-1'), 250)).elements).toMatch(/\$49 a month/)
      await me.closeTab('work-1')
      await expect(me.tab('work-1')).rejects.toThrow(/open one first/)
    } finally {
      await engine.close()
    }
  }, 60_000)

  it('does not wait on a page whose network never goes idle: it is shown once it stops changing', async () => {
    const engine = new BrowserEngine({ browsers: BROWSERS, profiles, pace: { minMs: 0, maxMs: 0 } })
    try {
      const started = Date.now()
      const page = await engine.as('u_ann').tab('work-3', `${base}/app`)
      expect(Date.now() - started).toBeLessThan(5_000)
      expect((await see(page, 250)).elements).toMatch(/heading "Files"/)
    } finally {
      await engine.close()
    }
  }, 60_000)

  it('clicks a place on a page drawn on a canvas, and says what is at a place', async () => {
    const engine = new BrowserEngine({ browsers: BROWSERS, profiles, pace: { minMs: 0, maxMs: 0 } })
    try {
      const page = await engine.as('u_ann').tab('work-4', `${base}/draw`)
      expect((await see(page, 250)).drawn).toBe(true)
      expect(await whatAt(page, { x: 200, y: 100 })).toEqual({ what: 'canvas ""', dialog: '' })
      await pressAt(page, { x: 200, y: 100 }, false, 100)
      expect(await page.title()).toBe('at 200,100')
      // a button at a place is judged as a button, with the dialog it is in
      const box = await page.getByRole('button', { name: 'OK' }).boundingBox()
      const there = await whatAt(page, { x: (box?.x ?? 0) + 5, y: (box?.y ?? 0) + 5 })
      expect(there).toEqual({ what: 'button "OK"', dialog: 'Delete forever?' })
    } finally {
      await engine.close()
    }
  }, 60_000)

  it('reads an address that gives text as the person, and names a file it does not keep', async () => {
    const engine = new BrowserEngine({ browsers: BROWSERS, profiles, pace: { minMs: 0, maxMs: 0 } })
    try {
      const me = engine.as('u_ann')
      expect(await me.read(`${base}/plan.txt`, 1000)).toEqual({
        type: 'text/plain',
        text: 'Boxes arrive on 3 June.',
        more: 0,
      })
      expect((await me.read(`${base}/plan.txt`, 5)).more).toBe(18)
      await expect(me.read(`${base}/plan.pdf`, 1000)).rejects.toThrow(
        /gives a file \(application\/pdf/,
      )
      await expect(me.read(`${base}/nothing.txt`, 1000)).rejects.toThrow(/answered 404/)
    } finally {
      await engine.close()
    }
  }, 60_000)

  it('shows a work’s tab live to the person it works as, and to nobody else; a held page is theirs until handed back', async () => {
    const engine = new BrowserEngine({ browsers: BROWSERS, profiles, pace: { minMs: 0, maxMs: 0 } })
    try {
      const me = engine.as('u_ann')
      const page = await me.tab('chief.t1', `${base}/plans`)
      expect(me.openTabs().map((t) => [t.work, t.held])).toEqual([['chief.t1', false]])
      // another person has no such tab: not to list, not to watch
      expect(engine.as('u_bob').openTabs()).toEqual([])
      expect(() => engine.as('u_bob').watch('chief.t1')).toThrow(/not open any more/)
      const live = me.watch('chief.t1')
      const frames: string[] = []
      await live.start((f) => frames.push(f))
      await page.evaluate(() => {
        document.body.style.background = 'teal'
      })
      await expect.poll(() => frames.length, { timeout: 5_000 }).toBeGreaterThan(0)
      // taken over: what they click reaches the page; then handed back
      expect(me.holding('chief.t1')).toBe(false)
      me.hold('chief.t1')
      expect(me.holding('chief.t1', true)).toBe(true)
      expect(engine.as('u_bob').holding('chief.t1')).toBe(false)
      // two quick presses in one place are a double click on the page, as a folder's opening needs
      await page.evaluate(() => {
        document.querySelector('h1')?.addEventListener('dblclick', () => {
          document.title = 'Opened'
        })
      })
      const head = await page.getByRole('heading').boundingBox()
      const on = { x: (head?.x ?? 0) + 4, y: (head?.y ?? 0) + 4 }
      for (const count of [1, 2]) {
        await live.input({ kind: 'down', ...on, count })
        await live.input({ kind: 'up', ...on, count })
      }
      expect(await page.title()).toBe('Opened')
      const team = await page.getByRole('link', { name: 'Team', exact: true }).boundingBox()
      const at = { x: (team?.x ?? 0) + 4, y: (team?.y ?? 0) + 4 }
      // a Control whose release never came would make this a right click: the press says what
      // is really held, and the page lets go of the rest
      await live.input({ kind: 'keydown', key: 'Control' })
      await live.input({ kind: 'down', ...at, held: [] })
      await live.input({ kind: 'up', ...at })
      await page.waitForURL(/\/plans\/team$/)
      expect(me.release('chief.t1')).toMatchObject({ waited: true })
      expect(me.release('chief.t1')).toBeNull()
      await me.unwatch('chief.t1', live)
    } finally {
      await engine.close()
    }
  }, 60_000)
})
