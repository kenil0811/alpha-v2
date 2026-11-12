// The browse tool's pages against a site served on this machine: never a real one. A tab per piece
// of work, the page as numbered elements, a click by its number, find by words, a small picture.
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { compact, element, press, see } from './browse.ts'
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
}
let server: Server
let base: string
let profiles: string

beforeAll(async () => {
  await ensureBrowser(BROWSERS)
  server = createServer((req, res) => {
    const body = PAGES[req.url ?? '']
    res.writeHead(body ? 200 : 404, { 'content-type': 'text/html' }).end(body ?? 'Not found')
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const a = server.address()
  base = `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}`
  profiles = mkdtempSync(join(tmpdir(), 'alpha-browse-'))
}, 120_000)

afterAll(async () => {
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
      await element(page, n).click()
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
})
