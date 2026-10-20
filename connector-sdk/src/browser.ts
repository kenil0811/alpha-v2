// The human-pace browser engine (design §8): pages read the way a person would see them, at a
// person's pace, one profile per site. It stops at any login wall, CAPTCHA or rate-limit page and
// says so; it never tries to get around one, and it reads only what a site's robots rules allow.
// Readers (skills) call it through the core, so pacing and health come from here and a reader
// writes only its extraction.
import { execFile, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { type BrowserContext, chromium, type Page } from 'playwright'
import { Problem } from './connector.ts'

export interface Pace {
  minMs: number // the least time between two pages of one site
  maxMs: number
}

export interface Snapshot {
  url: string
  status: number
  title: string
  text: string
  links: { text: string; href: string }[]
  html: string
}

// A declarative reader: the list's items, each field by a CSS selector (and an attribute, else
// its text), the next page's link, and where the listing's own id comes from.
export interface ExtractSpec {
  list: string
  fields: Record<string, { css: string; attr?: string }>
  next?: string // the next page's link, or a button the reader clicks to turn the page
  id?: { field: string; pattern?: string } // the id is in this field (a link, say), matched by pattern
  // a listing whose own address shows only once it is clicked (an app's list): the reader clicks
  // it (or `css` inside it), keeps the address it lands on as `field`, and comes back to the list
  open?: { field: string; css?: string }
  known?: string[] // ids of listings already known, which need not be opened again
  pages?: number // read at most this many pages (a preview reads one)
  // a site that lists its sold listings after the open ones: a page where every listing's field is
  // one of these words is the last one read
  stop?: { field: string; words: string[] }
}

export interface Extracted {
  url: string
  pages: number
  items: (Record<string, string> & { _id?: string; _url?: string })[]
}

const FRICTION =
  /captcha|verify (that )?you are (a )?human|are you a robot|unusual traffic|access denied|request blocked|too many requests|cf-chl|attention required/i

function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase()
  } catch {
    throw new Problem(`That is not a link: ${url}`)
  }
}

// Where Playwright's own browser is kept: Alpha's folder, not the Mac's caches. Reading needs only
// the headless shell (about 200 MB).
export async function ensureBrowser(browsersDir: string): Promise<void> {
  const name = 'chromium-headless-shell'
  const marker = join(browsersDir, `.${name}-ready`)
  if (existsSync(marker)) return
  mkdirSync(browsersDir, { recursive: true })
  const cli = join(
    createRequire(import.meta.url).resolve('playwright/package.json'),
    '..',
    'cli.js',
  )
  await new Promise<void>((resolve, reject) =>
    execFile(
      process.execPath,
      [cli, 'install', name],
      { env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsersDir } },
      (err) =>
        err
          ? reject(new Problem(`The browser Alpha reads with could not be set up: ${err.message}`))
          : resolve(),
    ),
  )
  writeFileSync(marker, name)
}

// The browser's own program inside Alpha's folder, found by name: Playwright reads its folder
// only when it is first loaded, so the path is given each time instead.
export function browserPath(browsersDir: string): string {
  const prefix = 'chromium_headless_shell-'
  const program = /^chrome-headless-shell(\.exe)?$/
  const found: string[] = []
  const walk = (dir: string, depth: number) => {
    if (depth > 6 || !existsSync(dir)) return
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isFile() && program.test(e.name)) found.push(p)
      else if (e.isDirectory() && !e.name.endsWith('.framework')) walk(p, depth + 1)
    }
  }
  for (const d of existsSync(browsersDir) ? readdirSync(browsersDir) : [])
    if (d.startsWith(prefix)) walk(join(browsersDir, d), 0)
  const path = found.sort().at(-1)
  if (!path) throw new Problem('The browser Alpha reads with is not set up yet.')
  return path
}

// The person's own Google Chrome. A site they sign in to opens there, with nothing driving it, so
// sites that turn automated browsers away from their sign-in (Google's, say) let them in; that
// site is read with Chrome afterwards, on the same profile, since only Chrome can open what Chrome
// saved there.
export function chromePath(): string | null {
  const app = join('Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome')
  return [join('/Applications', app), join(homedir(), 'Applications', app)].find(existsSync) ?? null
}
const SIGNED_IN = '.signed-in-with-chrome'

// What a site's robots rules say about a path, for every reader (User-agent *), as RFC 9309 reads
// them: a group is one or more User-agent lines and the rules after them; a rule matches from the
// path's start, `*` standing for anything and a closing `$` for the end; the longest matching rule
// wins, and Allow wins a tie.
export function robotsAllow(robots: string, path: string): boolean {
  const disallow: string[] = []
  const allow: string[] = []
  let agents: string[] = []
  let inRules = false
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line)
    if (!m) continue
    const key = (m[1] as string).toLowerCase()
    const value = (m[2] as string).trim()
    if (key === 'user-agent') {
      // a User-agent line after rules starts the next group
      if (inRules) agents = []
      inRules = false
      agents.push(value)
    } else if (key !== 'sitemap') {
      inRules = true
      if (!value || !agents.includes('*')) continue
      if (key === 'disallow') disallow.push(value)
      else if (key === 'allow') allow.push(value)
    }
  }
  const matches = (rule: string) => {
    const end = rule.endsWith('$')
    const body = (end ? rule.slice(0, -1) : rule)
      .split('*')
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*')
    return new RegExp(`^${body}${end ? '$' : ''}`).test(path)
  }
  const longest = (rules: string[]) => Math.max(-1, ...rules.filter(matches).map((r) => r.length))
  return longest(allow) >= longest(disallow)
}

export class BrowserEngine {
  private profiles: string
  private pace: Pace
  private contexts = new Map<string, BrowserContext>()
  private lastLoad = new Map<string, number>()
  private robots = new Map<string, string>()
  private sleep: (ms: number) => Promise<void>
  private only: string[] | null

  private browsers: string

  constructor(options: {
    browsers: string
    profiles: string
    pace: Pace
    sleep?: (ms: number) => Promise<void>
    only?: string[] // the only hosts it may read (a journey's made-up sites on this Mac)
  }) {
    this.browsers = options.browsers
    this.profiles = options.profiles
    this.pace = options.pace
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
    this.only = options.only ?? null
  }

  // One profile per site: what the person signs in to stays with that site.
  private async context(host: string): Promise<BrowserContext> {
    let c = this.contexts.get(host)
    if (!c) {
      const dir = this.profileOf(host)
      mkdirSync(dir, { recursive: true })
      if (existsSync(join(dir, SIGNED_IN))) {
        if (!chromePath())
          throw new Problem(
            `${host} was signed in to in Google Chrome, which is not on this Mac any more.`,
            'sign_in',
          )
        // Chrome keeps its saved sign-ins locked with the Mac's keychain; Playwright's stand-in
        // keychain would leave them unreadable
        c = await chromium.launchPersistentContext(dir, {
          channel: 'chrome',
          headless: true,
          ignoreDefaultArgs: ['--use-mock-keychain', '--password-store=basic'],
        })
      } else {
        await ensureBrowser(this.browsers)
        c = await chromium.launchPersistentContext(dir, {
          headless: true,
          executablePath: browserPath(this.browsers),
        })
      }
      this.contexts.set(host, c)
    }
    return c
  }

  private profileOf(host: string): string {
    return join(this.profiles, host.replace(/[^a-z0-9.-]/gi, '_'))
  }

  private async waitTurn(host: string): Promise<void> {
    const last = this.lastLoad.get(host)
    if (last !== undefined) {
      const gap = this.pace.minMs + Math.random() * (this.pace.maxMs - this.pace.minMs)
      const wait = last + gap - Date.now()
      if (wait > 0) await this.sleep(wait)
    }
    this.lastLoad.set(host, Date.now())
  }

  private async allowed(page: Page, url: string): Promise<void> {
    const u = new URL(url)
    let robots = this.robots.get(u.host)
    if (robots === undefined) {
      const res = await page.request.get(`${u.protocol}//${u.host}/robots.txt`).catch(() => null)
      robots = res?.ok() ? await res.text() : ''
      this.robots.set(u.host, robots)
    }
    if (!robotsAllow(robots, u.pathname + u.search))
      throw new Problem(
        `${u.host}'s robots rules ask readers not to read ${u.pathname}.`,
        'blocked',
      )
  }

  private async load(url: string): Promise<{ page: Page; status: number }> {
    const host = hostOf(url)
    if (this.only && !this.only.includes(new URL(url).hostname))
      throw new Problem(`${host} is not one of the sites this browser may read.`)
    const context = await this.context(host)
    const page = await context.newPage()
    await this.allowed(page, url)
    await this.waitTurn(host)
    const res = await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined)
    const status = res?.status() ?? 0
    const text = await page
      .locator('body')
      .innerText()
      .catch(() => '')
    if (
      status === 429 ||
      status === 403 ||
      status === 503 ||
      FRICTION.test(`${await page.title()} ${text.slice(0, 3000)}`)
    ) {
      await page.close()
      throw new Problem(
        `${host} asked whether a person is reading (${status || 'a check page'}); Alpha stopped there.`,
        'blocked',
      )
    }
    // a sign-in form the page hides (a header's, say) is not a wall in front of it
    const passwords = await page.locator('input[type="password"]:visible').count()
    if (passwords > 0 && text.length < 4000) {
      await page.close()
      throw new Problem(`${host} wants you to sign in before it shows this page.`, 'sign_in')
    }
    return { page, status }
  }

  async open(url: string): Promise<Snapshot> {
    const { page, status } = await this.load(url)
    try {
      const links = await page.$$eval('a[href]', (as) =>
        as.map((a) => ({
          text: (a.textContent ?? '').trim().replace(/\s+/g, ' '),
          href: (a as HTMLAnchorElement).href,
        })),
      )
      return {
        url: page.url(),
        status,
        title: await page.title(),
        text: (await page.locator('body').innerText()).slice(0, 60_000),
        links: links.filter((l) => l.href.startsWith('http')).slice(0, 500),
        html: (await page.content()).slice(0, 400_000),
      }
    } finally {
      await page.close()
    }
  }

  // Every page of a list, by its next link or button, until there is none (or a page repeats).
  async extract(url: string, spec: ExtractSpec): Promise<Extracted> {
    const items: Extracted['items'] = []
    const host = hostOf(url)
    const seen = new Set<string>([url])
    let pages = 0
    let { page } = await this.load(url)
    seen.add(await this.firstOf(page, spec.list))
    try {
      for (;;) {
        pages++
        const found = await this.listed(page, spec)
        if (spec.open) await this.openEach(page, spec, found)
        items.push(...found)
        const stop = spec.stop
        const done =
          !!stop &&
          found.length > 0 &&
          found.every((i) =>
            stop.words.some((w) => w.toLowerCase() === (i[stop.field] ?? '').toLowerCase()),
          )
        if (done || !spec.next || (spec.pages !== undefined && pages >= spec.pages)) break
        const next = page.locator(spec.next).first()
        const to = await next
          .evaluate((a) =>
            a.getAttribute('aria-disabled') === 'true' || a.hasAttribute('disabled')
              ? 'none'
              : a.getAttribute('href')
                ? (a as HTMLAnchorElement).href
                : 'click',
          )
          .catch(() => 'none')
        if (to === 'none') break
        if (to === 'click') {
          // a page turned by a button: the same page, its list replaced
          const before = await this.firstOf(page, spec.list)
          await this.waitTurn(host)
          await next.click()
          const turned = await page
            .waitForFunction(
              ([css, was]) => (document.querySelector(css)?.textContent ?? '') !== was,
              [spec.list, before] as const,
              { timeout: 15_000 },
            )
            .then(() => true)
            .catch(() => false)
          const now = await this.firstOf(page, spec.list)
          if (!turned || seen.has(now)) break
          seen.add(now)
        } else {
          if (seen.has(to)) break
          seen.add(to)
          await page.close()
          page = (await this.load(to)).page
        }
      }
    } finally {
      await page.close()
    }
    return { url, pages, items }
  }

  // The listings on the page as it is now, each field by its CSS, with its id and its address.
  private async listed(page: Page, spec: ExtractSpec): Promise<Extracted['items']> {
    const found: Extracted['items'] = await page.$$eval(
      spec.list,
      (nodes, fields) =>
        nodes.map((node) => {
          const out: Record<string, string> = {}
          for (const [name, f] of Object.entries(fields)) {
            const el = f.css === ':scope' ? node : node.querySelector(f.css)
            if (!el) continue
            const v = f.attr
              ? f.attr === 'href'
                ? (el as HTMLAnchorElement).href
                : el.getAttribute(f.attr)
              : el.textContent
            if (v) out[name] = v.trim().replace(/\s+/g, ' ')
          }
          return out
        }),
      spec.fields,
    )
    for (const item of found) this.identify(item, spec)
    return found
  }

  private identify(item: Extracted['items'][number], spec: ExtractSpec): void {
    if (spec.id) {
      const raw = item[spec.id.field] ?? ''
      // with a pattern, a listing it does not find an ID in has none (never its whole text)
      const m = spec.id.pattern ? new RegExp(spec.id.pattern).exec(raw) : null
      const id = spec.id.pattern ? (m ? (m[1] ?? m[0]) : '') : raw
      if (id) item._id = id
    }
    const link = Object.entries(item).find(([k, v]) => !k.startsWith('_') && /^https?:\/\//.test(v))
    if (link) item._url = link[1]
  }

  private async firstOf(page: Page, css: string): Promise<string> {
    return page
      .locator(css)
      .first()
      .textContent({ timeout: 5_000 })
      .catch(() => '')
      .then((t) => t ?? '')
  }

  // Each listing not known yet is clicked, at a person's pace, for the address it opens; the
  // reader comes back to the list each time, and stops if the list does not come back.
  private async openEach(page: Page, spec: ExtractSpec, found: Extracted['items']): Promise<void> {
    const open = spec.open
    if (!open) return
    const host = hostOf(page.url())
    const list = page.url()
    const known = new Set((spec.known ?? []).map((k) => k.toLowerCase()))
    for (const [i, item] of found.entries()) {
      if (item[open.field] || (item._id && known.has(item._id.toLowerCase()))) continue
      const before = await this.firstOf(page, spec.list)
      const node = page.locator(spec.list).nth(i)
      await this.waitTurn(host)
      await (open.css ? node.locator(open.css).first() : node).click()
      const moved = await page
        .waitForURL((u) => u.href !== list, { timeout: 15_000 })
        .then(() => true)
        .catch(() => false)
      if (!moved) continue
      const landed = page.url()
      const robots = this.robots.get(hostOf(landed)) ?? ''
      const u = new URL(landed)
      if (robotsAllow(robots, u.pathname + u.search)) {
        item[open.field] = landed
        this.identify(item, spec)
      }
      await page.goBack({ waitUntil: 'domcontentloaded' })
      const back = await page
        .waitForFunction(
          ([css, was]) => (document.querySelector(css)?.textContent ?? '') === was,
          [spec.list, before] as const,
          { timeout: 15_000 },
        )
        .then(() => true)
        .catch(() => false)
      if (!back)
        throw new Problem(
          `${host}'s list did not come back after opening a listing; Alpha stopped.`,
        )
    }
  }

  // What a CSS selector finds on a page: how many, and the first few as HTML, so a reader's
  // extraction can be written and checked.
  async inspect(
    url: string,
    css: string,
    samples = 3,
  ): Promise<{ url: string; count: number; html: string[] }> {
    const { page } = await this.load(url)
    try {
      const html = await page
        .$$eval(css, (nodes) => nodes.map((n) => n.outerHTML))
        .catch(() => [] as string[])
      return {
        url: page.url(),
        count: html.length,
        html: html.slice(0, samples).map((h) => h.slice(0, 4000)),
      }
    } finally {
      await page.close()
    }
  }

  // The site in the person's own Google Chrome, where they sign in themselves; Alpha never sees or
  // types what they type.
  async signIn(url: string): Promise<void> {
    const host = hostOf(url)
    const chrome = chromePath()
    if (!chrome) throw new Problem('Signing in to a site needs Google Chrome on this Mac.')
    await this.contexts.get(host)?.close()
    this.contexts.delete(host)
    const dir = this.profileOf(host)
    // the reading browser's profile is not one Chrome can keep, and it holds no sign-in
    if (existsSync(dir) && !existsSync(join(dir, SIGNED_IN)))
      rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, SIGNED_IN), '')
    // its own Chrome, apart from the person's everyday one; it ends when they quit it
    const window = spawn(
      chrome,
      [`--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check', url],
      { stdio: 'ignore' },
    )
    await new Promise<void>((resolve, reject) => {
      window.on('exit', () => resolve())
      window.on('error', (err) => reject(new Problem(`Google Chrome did not open: ${err.message}`)))
    })
  }

  async close(): Promise<void> {
    for (const c of this.contexts.values()) await c.close().catch(() => undefined)
    this.contexts.clear()
  }
}
