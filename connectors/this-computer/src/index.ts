// Three connectors for any computer (onboarding design §3): browsing history, apps and the names
// of files. None names an operating system: each asks the platform's reader for raw rows and
// counts or filters them here with the shared filters. They reach no network, keep no table
// (reading daily is a later switch), and their tools are never offered to the model: only Alpha's
// own onboarding calls them, and only what the filters let through leaves them (counts, sites and
// scrubbed titles, never addresses; names, never what is in them; the never-use list out). They
// are connected from onboarding's cards, so they have no first-open step and no tile of their own.
import { readFileSync } from 'node:fs'
import {
  type Access,
  type Call,
  type Connector,
  defineTool,
  FOLDERS,
  type LocalReader,
  type Manifest,
  Problem,
} from '@alpha/connector-sdk'
import { z } from 'zod'
import {
  countApps,
  countFiles,
  countSites,
  filterDownloads,
  filterNames,
  filterSpans,
  filterVisits,
} from './filters.ts'

const guide = readFileSync(new URL('../GUIDE.md', import.meta.url), 'utf8')
const DAY = 86_400_000
const since = (days: number) => new Date(Date.now() - days * DAY).toISOString()

// The platform's reader, or the plain words where the core has none for this computer.
function reader(c: Call): LocalReader {
  const local = c.host.local?.()
  if (!local) throw new Problem('Not on this computer: Alpha has no way to read it here.', 'gone')
  return local
}

const never = async (c: Call) => (await c.host.never?.()) ?? []

// Each part's access, as the reader says it.
async function access(c: Call, parts: string[]): Promise<Record<string, Access>> {
  const r = reader(c)
  const out: Record<string, Access> = {}
  for (const p of parts) out[p] = (await r.access(p)).state
  return out
}

const base = {
  auth: 'system',
  account: { label: 'This computer' },
  pace: { perMinute: 30 },
  private: true,
} satisfies Partial<Manifest>

export const browsing: Connector = {
  manifest: {
    ...base,
    name: 'browsing',
    title: 'Browsing history',
    icon: 'plug',
    parts: [
      { name: 'chrome', title: 'Chrome', words: 'Sites and page titles from Google Chrome' },
      { name: 'safari', title: 'Safari', words: 'Sites and page titles from Safari' },
    ],
  },
  guide,
  module: 'This computer',
  tables: [],
  tools: {
    sites: defineTool({
      description:
        'Each site visited in the last days with its visits, days seen, last visit and up to three page titles, filtered.',
      input: { days: z.number().int().min(1).max(365).default(90) },
      effect: 'read',
      words: () => 'Counted the sites visited',
      run: async (c, { days }) => {
        const r = reader(c)
        const parts = await access(c, ['chrome', 'safari'])
        const visits = []
        for (const b of await r.browsers())
          if (parts[b.id] === 'ready') visits.push(...(await r.visits(b.id, since(days))))
        return { parts, sites: countSites(visits, await never(c)) }
      },
    }),
    visits: defineTool({
      description:
        'Each visit in the last days in time order: when, the site and its page title, filtered; never the address.',
      input: { days: z.number().int().min(1).max(365).default(90) },
      effect: 'read',
      words: () => 'Read the visits by site and title',
      run: async (c, { days }) => {
        const r = reader(c)
        const parts = await access(c, ['chrome', 'safari'])
        const visits = []
        for (const b of await r.browsers())
          if (parts[b.id] === 'ready') visits.push(...(await r.visits(b.id, since(days))))
        return { parts, visits: filterVisits(visits, await never(c)) }
      },
    }),
  },
  access: (c) => access(c, ['chrome', 'safari']),
  // the reader answers, or says this computer has none
  check: async (c) => {
    await reader(c).browsers()
  },
}

export const apps: Connector = {
  manifest: {
    ...base,
    name: 'apps',
    title: 'Apps',
    icon: 'plug',
    parts: [
      {
        name: 'installed',
        title: 'Your apps',
        words: 'Which apps you have and how often you open them',
      },
      {
        name: 'screen-time',
        title: 'Time in apps',
        words: 'The hours in each app over the last month',
      },
    ],
  },
  guide,
  module: 'This computer',
  tables: [],
  tools: {
    apps: defineTool({
      description:
        'Each app with its launches, last use and, where the time is known, hours a week over the last days.',
      input: { days: z.number().int().min(1).max(90).default(30) },
      effect: 'read',
      words: () => 'Counted the apps used',
      run: async (c, { days }) => {
        const r = reader(c)
        const time = (await r.access('screen-time')).state
        return {
          parts: { installed: 'ready', 'screen-time': time },
          apps: countApps(
            await r.apps(),
            time === 'ready' ? await r.appTime(since(days)) : [],
            days,
            await never(c),
          ),
        }
      },
    }),
    spans: defineTool({
      description:
        'Each time an app was in front over the last days, its start and end, in time order; filtered.',
      input: { days: z.number().int().min(1).max(90).default(30) },
      effect: 'read',
      words: () => 'Read when each app was used',
      run: async (c, { days }) => {
        const r = reader(c)
        const time = (await r.access('screen-time')).state
        return {
          parts: { installed: 'ready', 'screen-time': time },
          spans:
            time === 'ready'
              ? filterSpans(await r.appSpans(since(days)), await r.apps(), await never(c))
              : [],
        }
      },
    }),
  },
  access: async (c) => ({ installed: 'ready', ...(await access(c, ['screen-time'])) }),
  check: async (c) => {
    await reader(c).access('screen-time')
  },
}

export const filenames: Connector = {
  manifest: {
    ...base,
    name: 'filenames',
    title: 'File names',
    icon: 'folder',
    parts: [
      { name: 'documents', title: 'Documents', words: 'Names, kinds and dates in Documents' },
      { name: 'desktop', title: 'Desktop', words: 'Names, kinds and dates on the Desktop' },
      { name: 'downloads', title: 'Downloads', words: 'Names, kinds and dates in Downloads' },
    ],
  },
  guide,
  module: 'This computer',
  tables: [],
  tools: {
    files: defineTool({
      description:
        'The three folders as a tree two levels deep with counts by kind, and the 300 newest names, filtered; never what is in them.',
      input: {},
      effect: 'read',
      words: () => 'Counted the names of files',
      run: async (c) => {
        const r = reader(c)
        const parts = await access(c, [...FOLDERS])
        const seen = []
        for (const f of FOLDERS) if (parts[f] === 'ready') seen.push(...(await r.files(f)))
        return { parts, ...countFiles(seen, await never(c)) }
      },
    }),
    names: defineTool({
      description:
        'Every name in the three folders with its kind and when it changed, filtered; never what is in them.',
      input: {},
      effect: 'read',
      words: () => 'Read the names of files',
      run: async (c) => {
        const r = reader(c)
        const parts = await access(c, [...FOLDERS])
        const seen = []
        for (const f of FOLDERS) if (parts[f] === 'ready') seen.push(...(await r.files(f)))
        return { parts, names: filterNames(seen, await never(c)) }
      },
    }),
    downloads: defineTool({
      description:
        'Each file in Downloads with the sites it came from and when it arrived, filtered; never the addresses.',
      input: {},
      effect: 'read',
      words: () => 'Read where downloads came from',
      run: async (c) => {
        const parts = await access(c, ['downloads'])
        return {
          parts,
          downloads:
            parts.downloads === 'ready'
              ? filterDownloads(await reader(c).downloads(), await never(c))
              : [],
        }
      },
    }),
  },
  access: (c) => access(c, [...FOLDERS]),
  check: async (c) => {
    await reader(c).access('documents')
  },
}

export const connectors = [browsing, apps, filenames]
