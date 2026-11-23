// What a person's computer says about their work, read there through Alpha Bridge (the onboarding
// plan, calls 14 to 18): browsing (sites by the days they were opened), apps, and AI work (their
// own requests to Claude Code and Codex, and their ChatGPT and claude.ai conversations' titles).
// Each runs only on the computer, only where its person ticked it in the Bridge, and comes with
// the interviews plugin: an Alpha without it knows none of them (rules P1). Their rows land in
// Your work, the Interviewer's module. They read at the interview (call 20) and, once the person
// finished Set up Alpha, Browsing and Apps every day for what they switched on there: the core
// holds that wall (proposed, Vikas 23 Nov). AI work reads at the interview alone.
import { readFileSync } from 'node:fs'
import { type Call, type Connector, Problem, type TableSpec } from '@alpha/connector-sdk'
import { visitsIn } from './history.ts'
import {
  appDirs,
  BROWSERS,
  browserRoots,
  claudeDir,
  codexDir,
  historyFiles,
  home,
} from './paths.ts'
import {
  type App,
  claudeRequests,
  codexRequests,
  macApps,
  sitesOf,
  webConversations,
  windowsApps,
} from './read.ts'
import { safariBlocked, safariHistory, safariVisits } from './safari.ts'

const DAYS = 90
const MODULE = 'Your work'
const guide = readFileSync(new URL('../GUIDE-computer.md', import.meta.url), 'utf8')

const SITES: TableSpec = {
  name: 'Sites',
  fields: [
    { name: 'Site', kind: 'text' },
    { name: 'Days used', kind: 'number' },
    { name: 'Last used', kind: 'date' },
    { name: 'Titles', kind: 'text' },
    { name: 'Browsers', kind: 'text' },
  ],
}
const APPS: TableSpec = {
  name: 'Apps',
  fields: [
    { name: 'App', kind: 'text' },
    { name: 'Last used', kind: 'date' },
    { name: 'Times used', kind: 'number' },
  ],
}
const REQUESTS: TableSpec = {
  name: 'AI requests',
  fields: [
    { name: 'Request', kind: 'text' },
    { name: 'Tool', kind: 'choice', choices: ['Claude Code', 'Codex', 'ChatGPT', 'claude.ai'] },
    { name: 'Project', kind: 'text' },
    { name: 'Date', kind: 'date' },
  ],
}

const visits = () =>
  visitsIn(
    browserRoots().flatMap((r) => historyFiles(r)),
    DAYS,
  )

// Each reader's account is the computer it reads, by the name Alpha knows it by.
const base = (name: string, title: string) => ({
  name,
  title,
  auth: 'path' as const, // what it reads is files on the computer
  icon: 'plug' as const,
  account: { label: 'This computer' },
  pace: { perMinute: 6 },
  runs: 'computer' as const,
  plugin: 'interviews',
  setup: { sub: 'Ticked in Alpha Bridge on your computer' },
})

const nothing = (what: string) =>
  new Problem(`${what} is not on this computer, so there is nothing for Alpha to read.`)

// once a day, and only while the core's keeps-learning wall lets it
const DAILY = 24 * 60

export const browsing: Connector = {
  manifest: { ...base('browsing', 'Browsing'), syncEveryMinutes: DAILY },
  guide,
  module: MODULE,
  tables: [SITES],
  tools: {},
  check: async () => {
    if (!browserRoots().length)
      throw nothing(`No ${BROWSERS.slice(0, -1).join(', ')} or ${BROWSERS.at(-1)}`)
  },
  sync: async (c: Call) => {
    const sites = sitesOf(visits())
    const landed = await c.host.land(
      'Sites',
      sites.map((s) => ({
        key: s.site,
        values: {
          Site: s.site,
          'Days used': s.days,
          'Last used': s.last,
          Titles: s.titles,
          Browsers: s.browsers,
        },
      })),
    )
    return { rows: sites.length, sawNew: landed.added > 0 }
  },
}

// Safari, once its person said yes to Alpha's offer and gave Alpha Bridge Full Disk Access: its
// sites, counted as the other browsers' are, in a table of its own.
export const safari: Connector = {
  manifest: { ...base('safari', 'Safari'), syncEveryMinutes: DAILY },
  guide,
  module: MODULE,
  tables: [{ ...SITES, name: 'Safari sites' }],
  tools: {},
  check: async () => {
    const why = safariBlocked(safariHistory(home()))
    if (why) throw new Problem(why)
  },
  sync: async (c: Call) => {
    const why = safariBlocked(safariHistory(home()))
    if (why) throw new Problem(why)
    const sites = sitesOf(safariVisits(safariHistory(home()), DAYS))
    const landed = await c.host.land(
      'Safari sites',
      sites.map((s) => ({
        key: s.site,
        values: {
          Site: s.site,
          'Days used': s.days,
          'Last used': s.last,
          Titles: s.titles,
          Browsers: s.browsers,
        },
      })),
    )
    return { rows: sites.length, sawNew: landed.added > 0 }
  },
}

export const apps: Connector = {
  manifest: { ...base('apps', 'Apps'), syncEveryMinutes: DAILY },
  guide,
  module: MODULE,
  tables: [APPS],
  tools: {},
  sync: async (c: Call) => {
    // a Mac's Spotlight answers the Bridge itself, outside the reader's sandbox (its helper channel)
    const all =
      process.platform === 'win32'
        ? windowsApps()
        : c.host.helper
          ? ((await c.host.helper(['apps'])) as App[])
          : macApps(appDirs())
    const landed = await c.host.land(
      'Apps',
      all.map((a) => ({
        key: a.app,
        values: { App: a.app, 'Last used': a.last, 'Times used': a.times },
      })),
    )
    return { rows: all.length, sawNew: landed.added > 0 }
  },
}

export const aiWork: Connector = {
  manifest: base('ai-work', 'AI work'),
  guide,
  module: MODULE,
  tables: [REQUESTS],
  tools: {},
  sync: async (c: Call) => {
    const all = [
      ...claudeRequests(claudeDir(), DAYS),
      ...codexRequests(codexDir(), DAYS),
      ...webConversations(visits()),
    ]
    const landed = await c.host.land(
      'AI requests',
      all.map((r) => ({
        key: r.key,
        values: { Request: r.request, Tool: r.tool, Project: r.project, Date: r.at },
      })),
    )
    return { rows: all.length, sawNew: landed.added > 0 }
  },
}

// What a folder of this connector exports for Alpha to load: four readers, Safari's offered only
// after its offer was taken (core/src/offers.ts).
export const connectors = [browsing, apps, aiWork, safari]
