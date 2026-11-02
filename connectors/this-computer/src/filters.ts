// What is counted of this computer, and what never is (onboarding design §5), the same code on
// every computer: raw rows come in from the platform's reader, counts and filtered names go out.
// Nothing here keeps a row. Every filter runs before anything is counted.
import {
  type AppSeen,
  type AppSpan,
  type AppTime,
  type Download,
  type FileSeen,
  type Folder,
  never,
  type Visit,
} from '@alpha/connector-sdk'

export { never }

// Sites whose page titles are someone's words (a webmail title is a subject line): counted, never
// their titles.
const TITLES_KEPT_OUT = [
  'mail.google.com',
  'outlook.live.com',
  'outlook.office.com',
  'outlook.office365.com',
  'mail.yahoo.com',
  'mail.proton.me',
  'web.whatsapp.com',
  'messenger.com',
  'web.telegram.org',
  'discord.com',
  'app.slack.com',
  'teams.microsoft.com',
  'teams.live.com',
  'icloud.com',
]

// An address's site, www. dropped; none for a local or browser page (localhost, a bare address,
// file:, chrome:, about:), which is never counted.
export function siteOf(url: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  const host = u.hostname.toLowerCase().replace(/^www\./, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local'))
    return null
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return null
  return host
}

// A title without what could say who someone is: email addresses, phone numbers, runs of five or
// more digits; none left, none kept.
export function scrubTitle(title: string): string {
  return title
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, '')
    .replace(/\d{5,}/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s|·:–-]+|[\s|·:–-]+$/g, '')
    .trim()
}

export interface Seen {
  at: string
  site: string
  title: string // '' where the site's titles are someone's words, or nothing was left
}

// Each visit as it may leave the computer: its site and a scrubbed title, never the address; a
// site or a title on the never-use list is not here at all.
export function filterVisits(visits: Visit[], theirs: string[] = []): Seen[] {
  const out: Seen[] = []
  for (const v of visits) {
    const site = siteOf(v.url)
    if (!site || never(site, theirs)) continue
    const title = TITLES_KEPT_OUT.some((x) => site === x || site.endsWith(`.${x}`))
      ? ''
      : scrubTitle(v.title)
    if (title && never(title, theirs)) continue
    out.push({ at: v.at, site, title })
  }
  return out.sort((a, b) => a.at.localeCompare(b.at))
}

export interface Site {
  site: string
  visits: number
  days: number
  last: string
  titles: string[] // up to three, the most seen first
}

// Each site's visits, the days it was seen and the last visit, with up to three titles, most
// visited first. A site seen on one day only is left out as noise.
export function countSites(visits: Visit[], theirs: string[] = [], dayOf = localDay): Site[] {
  const by = new Map<
    string,
    { visits: number; days: Set<string>; last: string; titles: Map<string, number> }
  >()
  for (const { at, site, title } of filterVisits(visits, theirs)) {
    const s = by.get(site) ?? { visits: 0, days: new Set(), last: '', titles: new Map() }
    s.visits++
    s.days.add(dayOf(at))
    if (at > s.last) s.last = at
    if (title) s.titles.set(title, (s.titles.get(title) ?? 0) + 1)
    by.set(site, s)
  }
  return [...by.entries()]
    .filter(([, s]) => s.days.size > 1)
    .map(([site, s]) => ({
      site,
      visits: s.visits,
      days: s.days.size,
      last: s.last,
      titles: [...s.titles.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([t]) => t),
    }))
    .sort((a, b) => b.visits - a.visits || a.site.localeCompare(b.site))
}

// A moment's day on this computer, which is the person's own: the connector runs on it.
function localDay(at: string): string {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export interface AppUse {
  id: string
  name: string
  launches?: number
  lastUsed?: string
  hoursWeek?: number // where the computer keeps the time in each app
}

// Each app with its launches and last use, and its hours a week over the days read where the time
// is known; the most used first. An app with time but not among the installed ones (one kept
// outside the app folders) is counted by the name the computer gives it, else its id.
export function countApps(
  apps: AppSeen[],
  time: AppTime[],
  days: number,
  theirs: string[] = [],
): AppUse[] {
  const seconds = new Map<string, number>()
  for (const t of time) seconds.set(t.id, (seconds.get(t.id) ?? 0) + t.seconds)
  const weeks = Math.max(days, 1) / 7
  const installed = new Set(apps.map((a) => a.id))
  const used = new Map<string, AppSeen>()
  for (const t of time)
    if (!installed.has(t.id) && !used.has(t.id)) used.set(t.id, { id: t.id, name: t.name ?? t.id })
  const out: AppUse[] = [...apps, ...used.values()]
    .filter((a) => !never(a.name, theirs) && !never(a.id, theirs))
    .map((a) => {
      const s = seconds.get(a.id)
      return {
        id: a.id,
        name: a.name,
        ...(a.launches ? { launches: a.launches } : {}),
        ...(a.lastUsed ? { lastUsed: a.lastUsed } : {}),
        ...(s ? { hoursWeek: Math.round((s / 3600 / weeks) * 10) / 10 } : {}),
      }
    })
  return out.sort(
    (a, b) =>
      (b.hoursWeek ?? 0) - (a.hoursWeek ?? 0) ||
      (b.launches ?? 0) - (a.launches ?? 0) ||
      (b.lastUsed ?? '').localeCompare(a.lastUsed ?? '') ||
      a.name.localeCompare(b.name),
  )
}

export interface Span {
  app: string
  start: string
  end: string
}

// Each time an app was in front, by the name it is installed under (else the one the computer
// gives, else its id), in time order; an app on the never-use list is not here.
export function filterSpans(spans: AppSpan[], apps: AppSeen[], theirs: string[] = []): Span[] {
  const names = new Map(apps.map((a) => [a.id, a.name]))
  return spans
    .map((s) => ({ id: s.id, app: names.get(s.id) ?? s.name ?? s.id, start: s.start, end: s.end }))
    .filter((s) => !never(s.app, theirs) && !never(s.id, theirs))
    .map(({ app, start, end }) => ({ app, start, end }))
    .sort((a, b) => a.start.localeCompare(b.start))
}

export interface Fetched {
  name: string // its name in Downloads
  sites: string[] // the sites it came from, never their addresses
  at: string
}

// Where each download came from, by site: one on the never-use list, from a site on it or under a
// folder on it, is not here.
export function filterDownloads(downloads: Download[], theirs: string[] = []): Fetched[] {
  const out: Fetched[] = []
  for (const d of downloads) {
    if (d.path.split('/').some((part) => never(part, theirs))) continue
    const sites = [...new Set(d.from.map(siteOf).filter((s): s is string => !!s))]
    if (sites.some((s) => never(s, theirs))) continue
    out.push({ name: d.path, sites, at: d.at })
  }
  return out.sort((a, b) => b.at.localeCompare(a.at))
}

// Every name the person allowed, filtered: a name on the never-use list, or under a folder on it,
// is not here.
export const filterNames = (seen: FileSeen[], theirs: string[] = []) =>
  seen.filter((f) => !f.path.split('/').some((part) => never(part, theirs)))

export interface FolderCount {
  folder: Folder
  path: string // a folder up to two levels in; '' for the folder itself
  files: number
  kinds: Record<string, number> // by kind: an extension, or project
}

export interface Files {
  tree: FolderCount[]
  recent: { folder: Folder; path: string; kind: string; modified: string }[] // the newest names
}

// The three folders as a tree two levels deep, each with what it holds by kind, and the newest
// names. A name on the never-use list, or under a folder on it, is never counted.
export function countFiles(seen: FileSeen[], theirs: string[] = [], recent = 300): Files {
  const kept = filterNames(seen, theirs)
  const tree = new Map<string, FolderCount>()
  for (const f of kept) {
    if (f.kind === 'folder') continue
    const parts = f.path.split('/')
    const at = parts.slice(0, Math.min(parts.length - (f.kind === 'project' ? 0 : 1), 2)).join('/')
    const key = `${f.folder}/${at}`
    const c = tree.get(key) ?? { folder: f.folder, path: at, files: 0, kinds: {} }
    c.files++
    const kind = f.kind || 'other'
    c.kinds[kind] = (c.kinds[kind] ?? 0) + 1
    tree.set(key, c)
  }
  return {
    tree: [...tree.values()].sort((a, b) => b.files - a.files || a.path.localeCompare(b.path)),
    recent: kept
      .filter((f) => f.kind !== 'folder' && f.kind !== 'project')
      .sort((a, b) => b.modified.localeCompare(a.modified))
      .slice(0, recent)
      .map(({ folder, path, kind, modified }) => ({ folder, path, kind, modified })),
  }
}
