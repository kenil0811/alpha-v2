// What is counted of this computer, and what never is (onboarding design §5), the same code on
// every computer: raw rows come in from the platform's reader, counts and filtered names go out.
// Nothing here keeps a row. Every filter runs before anything is counted.
import type { AppSeen, AppTime, FileSeen, Folder, Visit } from '@alpha/connector-sdk'

// The never-use list shipped with the package: health, banking and money, dating, adult,
// gambling, religion and politics. A word matches a whole part of a name ("bet" never matches
// "alphabet", "chase" never "purchase"); a stem matches inside one ("bankofamerica").
export const SHIPPED_NEVER = [
  // health
  'clinic',
  'doctor',
  'therapy',
  'webmd',
  'mayoclinic',
  'patient',
  'dental',
  'mental',
  'mychart',
  // banking and money
  'paypal',
  'venmo',
  'chase',
  'wellsfargo',
  'citi',
  'citibank',
  'amex',
  'americanexpress',
  'capitalone',
  'hsbc',
  'barclays',
  'revolut',
  'wise',
  'coinbase',
  'binance',
  'robinhood',
  'schwab',
  'fidelity',
  'vanguard',
  'etrade',
  'creditkarma',
  'loan',
  'loans',
  'zelle',
  // dating
  'tinder',
  'bumble',
  'hinge',
  'okcupid',
  'grindr',
  // adult
  'xxx',
  'onlyfans',
  'xvideos',
  'adult',
  // gambling
  'bet',
  'betting',
  'draftkings',
  'fanduel',
  'bet365',
  'lottery',
  // religion
  'church',
  'mosque',
  'synagogue',
  'temple',
  'bible',
  'quran',
  'religion',
  // politics
  'democrat',
  'democrats',
  'republican',
  'gop',
  'politics',
  'campaign',
  'vote',
]
const SHIPPED_STEMS = [
  'health',
  'hospital',
  'pharma',
  'medical',
  'bank',
  'mortgage',
  'dating',
  'porn',
  'casino',
  'poker',
]

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

// Whether a name (a site, a folder, an app) is on the never-use list: the shipped one and the
// person's own (whole sites and folders, or words).
export function never(name: string, theirs: string[] = []): boolean {
  const n = name.toLowerCase()
  const parts = n.split(/[^a-z0-9]+/).filter(Boolean)
  // the person's own: a whole site or folder, or a word
  for (const w of theirs.map((x) => x.trim().toLowerCase()).filter(Boolean))
    if (n === w || n.endsWith(`.${w}`) || n.startsWith(`${w}/`) || parts.includes(w)) return true
  return (
    SHIPPED_NEVER.some((w) => parts.includes(w)) ||
    SHIPPED_STEMS.some((w) => parts.some((p) => p.includes(w)))
  )
}

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
  for (const v of visits) {
    const site = siteOf(v.url)
    if (!site || never(site, theirs)) continue
    const s = by.get(site) ?? { visits: 0, days: new Set(), last: '', titles: new Map() }
    s.visits++
    s.days.add(dayOf(v.at))
    if (v.at > s.last) s.last = v.at
    const title = TITLES_KEPT_OUT.some((x) => site === x || site.endsWith(`.${x}`))
      ? ''
      : scrubTitle(v.title)
    if (title && !never(title, theirs)) s.titles.set(title, (s.titles.get(title) ?? 0) + 1)
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
  const kept = seen.filter((f) => !f.path.split('/').some((part) => never(part, theirs)))
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
