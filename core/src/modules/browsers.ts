// The browser reader (onboarding from the footprint, step 2): bookmarks, extensions and sites
// visited, from Chrome, Edge, Brave, Arc, Firefox and Safari where each is readable, read in place.
// Walls, each in code with its test (browsers.test.ts):
// - Only the files in ALLOWED are ever opened (Kenil's question 7, the recommended answer): never
//   Login Data, Web Data, Cookies, a keychain or anything else a browser keeps.
// - History is sites only: a page's address is cut to its host the moment it is read; titles,
//   paths, queries and the search-box table are never selected.
// - Databases are opened read-only and immutable where they lie, never copied (db.ts).
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join, sep } from 'node:path'
import type { Places } from '../platform/index.ts'
import { openForeign } from '../world/db.ts'

export const ALLOWED = new Set([
  'Local State',
  'Preferences',
  'Bookmarks',
  'History',
  'places.sqlite',
  'extensions.json',
  'History.db',
  'Bookmarks.plist',
  'manifest.json', // an extension's own, under Extensions/
  'messages.json', // its name in its language, under Extensions/
])

// The wall: a file Alpha may open, or a refusal. Every read in this file goes through it.
export function allowed(file: string): string {
  const name = basename(file)
  const inExtension = file.split(sep).includes('Extensions')
  if (
    !ALLOWED.has(name) ||
    ((name === 'manifest.json' || name === 'messages.json') && !inExtension)
  )
    throw new Error(`Alpha never opens a browser's ${name}.`)
  return file
}

const text = (file: string) => readFileSync(allowed(file), 'utf8')
const jsonOf = <T>(file: string, fallback: T): T => {
  try {
    return JSON.parse(text(file)) as T
  } catch {
    return fallback
  }
}

// A site from an address: its host without www, or nothing for what is not a web page.
export function siteOf(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.hostname.replace(/^www\./, '').toLowerCase() || null
  } catch {
    return null
  }
}

export interface Bookmark {
  browser: string
  folder: string
  name: string
  site: string
}
export interface Extension {
  browser: string
  name: string
}
export interface Read {
  browsers: string[]
  bookmarks: Bookmark[]
  extensions: Extension[]
  sites: { site: string; visits: number }[]
  problems: string[] // a browser that could not be read, and why, in words
}

const DAY = 86_400_000
const dirs = (d: string) => {
  try {
    return readdirSync(d, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => join(d, e.name))
  } catch {
    return []
  }
}

// A profile's name, as the browser shows it.
function profiles(root: string): { dir: string; name: string }[] {
  const state = jsonOf<{ profile?: { info_cache?: Record<string, { name?: string }> } }>(
    join(root, 'Local State'),
    {},
  )
  return dirs(root)
    .filter((d) => existsSync(join(d, 'Preferences')))
    .map((d) => ({ dir: d, name: state.profile?.info_cache?.[basename(d)]?.name ?? basename(d) }))
}

interface Node {
  type?: string
  name?: string
  url?: string
  children?: Node[]
}
function walk(n: Node | undefined, folder: string, out: Omit<Bookmark, 'browser'>[]): void {
  if (!n) return
  if (n.type === 'url' && n.url) {
    const site = siteOf(n.url)
    if (site) out.push({ folder, name: n.name ?? site, site })
  }
  for (const c of n.children ?? [])
    walk(c, n.type === 'folder' && folder ? `${folder} › ${n.name}` : (n.name ?? folder), out)
}

function extensionName(dir: string): string | null {
  const versions = dirs(dir)
  const v = versions.at(-1)
  if (!v) return null
  const m = jsonOf<{ name?: string; theme?: unknown; default_locale?: string }>(
    join(v, 'manifest.json'),
    {},
  )
  if (!m.name || m.theme) return null
  const key = /^__MSG_(.+)__$/.exec(m.name)?.[1]
  if (!key) return m.name
  const msgs = jsonOf<Record<string, { message?: string }>>(
    join(v, '_locales', m.default_locale ?? 'en', 'messages.json'),
    {},
  )
  const hit = Object.entries(msgs).find(([k]) => k.toLowerCase() === key.toLowerCase())
  return hit?.[1].message ?? null
}

// Sites from a History database, with how often each was visited since `since`: the address is
// cut to its site here, and nothing else of a row is selected.
function sitesFrom(file: string, sql: string, since: number, into: Map<string, number>): void {
  const db = openForeign(allowed(file))
  try {
    for (const r of db.prepare(sql).all(since) as { url: string; n: number }[]) {
      const s = siteOf(r.url)
      if (s) into.set(s, (into.get(s) ?? 0) + Number(r.n ?? 1))
    }
  } finally {
    db.close()
  }
}

export interface Want {
  bookmarks?: boolean
  extensions?: boolean
  history?: boolean
}

// Everything readable where this computer keeps its browsers (the platform's places), as much as
// is wanted: nothing is opened for what is not.
export function readBrowsers(
  at: Pick<Places, 'chromium' | 'firefox' | 'safari' | 'plist' | 'access'>,
  want: Want,
  historyDays: number,
  nowMs = Date.now(),
): Read {
  const out: Read = { browsers: [], bookmarks: [], extensions: [], sites: [], problems: [] }
  const visits = new Map<string, number>()
  const since = nowMs - historyDays * DAY
  const tryRead = (browser: string, f: () => void) => {
    try {
      f()
    } catch (err) {
      // macOS keeps Safari's files from any app without Full Disk Access
      const said = `${(err as { code?: string }).code ?? ''} ${(err as Error).message ?? ''}`
      const words =
        at.access && /EPERM|EACCES|not permitted|permission|unable to open/i.test(said)
          ? `${browser} needs ${at.access} for Alpha; skipped.`
          : `${browser} could not be read; skipped.`
      if (!out.problems.includes(words)) out.problems.push(words)
    }
  }
  for (const [browser, root] of at.chromium) {
    if (!existsSync(root)) continue
    out.browsers.push(browser)
    for (const p of profiles(root)) {
      const label = p.name === 'Default' ? browser : `${browser} (${p.name})`
      if (want.bookmarks && existsSync(join(p.dir, 'Bookmarks')))
        tryRead(label, () => {
          const b = jsonOf<{ roots?: Record<string, Node> }>(join(p.dir, 'Bookmarks'), {})
          const found: Omit<Bookmark, 'browser'>[] = []
          for (const r of Object.values(b.roots ?? {})) walk(r, '', found)
          out.bookmarks.push(...found.map((x) => ({ ...x, browser: label })))
        })
      if (want.extensions)
        for (const e of dirs(join(p.dir, 'Extensions'))) {
          const name = extensionName(e)
          if (name) out.extensions.push({ browser: label, name })
        }
      if (want.history && existsSync(join(p.dir, 'History')))
        tryRead(label, () =>
          sitesFrom(
            join(p.dir, 'History'),
            // Chromium counts microseconds from 1601
            'SELECT url, visit_count AS n FROM urls WHERE last_visit_time > ?',
            (since + 11_644_473_600_000) * 1000,
            visits,
          ),
        )
    }
  }
  for (const p of at.firefox.flatMap(dirs)) {
    if (!out.browsers.includes('Firefox')) out.browsers.push('Firefox')
    const places = join(p, 'places.sqlite')
    if (existsSync(places) && (want.bookmarks || want.history))
      tryRead('Firefox', () => {
        if (want.history)
          sitesFrom(
            places,
            'SELECT url, visit_count AS n FROM moz_places WHERE last_visit_date > ?',
            since * 1000,
            visits,
          )
        if (want.bookmarks) {
          const db = openForeign(allowed(places))
          try {
            const rows = db
              .prepare(
                `SELECT b.title AS name, p.url AS url, f.title AS folder FROM moz_bookmarks b
                   JOIN moz_places p ON p.id = b.fk LEFT JOIN moz_bookmarks f ON f.id = b.parent
                  WHERE b.type = 1`,
              )
              .all() as { name: string | null; url: string; folder: string | null }[]
            for (const r of rows) {
              const site = siteOf(r.url)
              if (site)
                out.bookmarks.push({
                  browser: 'Firefox',
                  folder: r.folder ?? '',
                  name: r.name ?? site,
                  site,
                })
            }
          } finally {
            db.close()
          }
        }
      })
    if (want.extensions && existsSync(join(p, 'extensions.json')))
      for (const a of jsonOf<{
        addons?: { type?: string; location?: string; defaultLocale?: { name?: string } }[]
      }>(join(p, 'extensions.json'), {}).addons ?? [])
        if (a.type === 'extension' && a.location === 'app-profile' && a.defaultLocale?.name)
          out.extensions.push({ browser: 'Firefox', name: a.defaultLocale.name })
  }
  const { safari, plist } = at
  if (safari && existsSync(safari)) {
    out.browsers.push('Safari')
    if (want.history && existsSync(join(safari, 'History.db')))
      tryRead('Safari', () =>
        sitesFrom(
          join(safari, 'History.db'),
          // Safari counts seconds from 2001
          `SELECT i.url AS url, count(*) AS n FROM history_visits v
             JOIN history_items i ON i.id = v.history_item WHERE v.visit_time > ? GROUP BY i.id`,
          since / 1000 - 978_307_200,
          visits,
        ),
      )
    if (want.bookmarks && plist && existsSync(join(safari, 'Bookmarks.plist')))
      tryRead('Safari', () => {
        const xml = plist(allowed(join(safari, 'Bookmarks.plist')))
        for (const m of xml.matchAll(/<key>URLString<\/key>\s*<string>([^<]+)<\/string>/g)) {
          const site = siteOf(m[1] ?? '')
          if (site) out.bookmarks.push({ browser: 'Safari', folder: '', name: site, site })
        }
      })
  }
  out.sites = [...visits]
    .map(([site, n]) => ({ site, visits: n }))
    .sort((a, b) => b.visits - a.visits || a.site.localeCompare(b.site))
  return out
}
