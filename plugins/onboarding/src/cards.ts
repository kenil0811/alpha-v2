// The one-at-a-time cards (onboarding design §2, Kenil's yes 2 Nov): seven sources, each asked for
// on its own card with what it reads and what it leaves alone; Allow connects it (macOS asks where
// it must), Alpha reads it here and shows what it found before the next. Ticks put a site or a
// folder on the never-use list. What the person said on each card is kept in the plugin's folder,
// so leaving part way keeps it; a skipped browser or Screen Time is never read after.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type PluginHost, Refusal } from '@alpha/plugin-sdk'
import type { CardDef, CardView, Found } from './run.ts'

export type { CardDef, Found }

export const CARDS: CardDef[] = [
  {
    name: 'calendar',
    title: 'Calendar',
    reads: 'Your meetings, the last 90 days and the next 60, with who was in them.',
    never: 'What the invitations say.',
    connect: ['calendar'],
  },
  {
    name: 'contacts',
    title: 'Contacts',
    reads: 'Names, organizations and titles, and your own card.',
    never: 'Phone numbers and addresses.',
    connect: ['contacts'],
  },
  {
    name: 'apps',
    title: 'Apps',
    reads: 'Which apps you have and how often you open them.',
    never: 'What you do inside them.',
    connect: ['apps'],
  },
  {
    name: 'chrome',
    title: 'Chrome',
    reads: 'Sites and page titles from the last 90 days, counted here.',
    never: 'The rest of an address, and sites you untick.',
    connect: ['browsing'],
    parts: { browsing: ['chrome'] },
  },
  {
    name: 'safari',
    title: 'Safari and Screen Time',
    reads: 'Safari’s sites and titles, and the hours in each app over the last month.',
    never:
      'Your mail and messages. Safari and Screen Time lock their records, so reading them needs Full Disk Access, which would open those too; Alpha reads only Safari’s history and Screen Time with it.',
    connect: ['browsing', 'apps'],
    parts: { browsing: ['safari'], apps: ['screen-time'] },
  },
  {
    name: 'files',
    title: 'File names',
    reads: 'Names, kinds and dates of files in Documents, Desktop and Downloads.',
    never: 'What is inside them, and folders you untick.',
    connect: ['filenames'],
    parts: { filenames: ['documents', 'desktop', 'downloads'] },
  },
  {
    name: 'mail',
    title: 'Mail',
    reads: 'Who you write to and the subjects, the last 90 days.',
    never: 'What a message says.',
    connect: [],
  },
]

export type Said = 'allowed' | 'skipped'

export interface Progress {
  said: Record<string, Said>
}

// What Alpha may read, from what the person said on the cards: none said (no cards yet, or a
// computer set up before them) is everything connected.
export interface Choices {
  browsers?: ('chrome' | 'safari')[]
  screenTime: boolean
  skipped: string[] // the cards said no to: their sources are not read
}

export function choicesOf(p: Progress): Choices {
  if (!Object.keys(p.said).length) return { screenTime: true, skipped: [] }
  return {
    browsers: (['chrome', 'safari'] as const).filter((b) => p.said[b] === 'allowed'),
    screenTime: p.said.safari === 'allowed',
    skipped: Object.entries(p.said)
      .filter(([, s]) => s === 'skipped')
      .map(([c]) => c),
  }
}

export const ALL: Choices = { screenTime: true, skipped: [] }

export class Cards {
  readonly file: string
  constructor(dir: string) {
    this.file = join(dir, 'cards.json')
  }
  get(): Progress {
    return existsSync(this.file)
      ? (JSON.parse(readFileSync(this.file, 'utf8')) as Progress)
      : { said: {} }
  }
  say(card: string, said: Said): Progress {
    const p = this.get()
    p.said[card] = said
    mkdirSync(join(this.file, '..'), { recursive: true })
    writeFileSync(this.file, JSON.stringify(p, null, 1))
    return p
  }
  // the first card not yet answered, or none when all are
  next(): string | null {
    const p = this.get()
    return CARDS.find((c) => !p.said[c.name])?.name ?? null
  }
}

export const cardOf = (name: string): CardDef => {
  const c = CARDS.find((x) => x.name === name)
  if (!c) throw new Refusal('There is no such card.')
  return c
}

// Each part the card needs, and whether Alpha can read it now.
export async function partsOf(host: PluginHost, card: CardDef): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const [connector, parts] of Object.entries(card.parts ?? {})) {
    const states = (await host.connectorTool(connector, 'parts', {}).catch(() => ({}))) as Record<
      string,
      string
    >
    for (const p of parts) out[p] = states[p] ?? 'absent'
  }
  return out
}

const n = (k: number, one: string, many = `${one}s`) =>
  `${k.toLocaleString('en-GB')} ${k === 1 ? one : many}`
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())

async function tool<T>(host: PluginHost, connector: string, name: string, input = {}) {
  return (await host.connectorTool(connector, name, input).catch(() => null)) as T | null
}

// What a card shows once allowed.
export async function foundOf(host: PluginHost, card: CardDef): Promise<Found> {
  switch (card.name) {
    case 'calendar': {
      const rows = host.rows('Calendar', 'Events')
      const people = new Set(
        rows.flatMap((r) => str(r.values.Attendees).split(/,\s*/).filter(Boolean)),
      )
      return rows.length
        ? { lines: [`${n(rows.length, 'meeting')} with ${n(people.size, 'person', 'people')}.`] }
        : { lines: [], reading: true }
    }
    case 'contacts': {
      const rows = host.rows('Contacts', 'Contacts')
      const orgs = new Set(rows.map((r) => str(r.values.Company)).filter(Boolean))
      return rows.length
        ? { lines: [`${n(rows.length, 'contact')} at ${n(orgs.size, 'organization')}.`] }
        : { lines: [], reading: true }
    }
    case 'apps': {
      const a = await tool<{ apps: { name: string }[] }>(host, 'apps', 'apps', {
        days: 30,
        time: false,
      })
      const apps = a?.apps ?? []
      return {
        lines: [
          `${n(apps.length, 'app')}${
            apps.length
              ? `; used most: ${apps
                  .slice(0, 3)
                  .map((x) => x.name)
                  .join(', ')}`
              : ''
          }.`,
        ],
      }
    }
    case 'chrome':
    case 'safari': {
      const browser = card.name
      const s = await tool<{ sites: { site: string; visits: number }[] }>(
        host,
        'browsing',
        'sites',
        {
          days: 90,
          browsers: [browser],
        },
      )
      const out = [...(s?.sites ?? [])].map((x) => ({
        item: x.site,
        sub: n(x.visits, 'visit'),
        on: true,
      }))
      const left = host.neverOf('browsing').map((x) => ({ item: x, sub: 'Left out', on: false }))
      const lines = [`${n(out.length, 'site')} seen on two days or more.`]
      if (browser === 'safari') {
        const a = await tool<{ apps: { name: string; hoursWeek?: number }[] }>(
          host,
          'apps',
          'apps',
          {
            days: 30,
          },
        )
        const timed = (a?.apps ?? []).filter((x) => x.hoursWeek).slice(0, 3)
        if (timed.length)
          lines.push(
            `Most hours a week: ${timed.map((x) => `${x.name} ${x.hoursWeek}`).join(', ')}.`,
          )
      }
      return { lines, ticks: [...out, ...left] }
    }
    case 'files': {
      const f = await tool<{
        tree: { folder: string; path: string; files: number }[]
        recent: { path: string }[]
      }>(host, 'filenames', 'files')
      const by = new Map<string, number>()
      for (const t of f?.tree ?? []) {
        const top = t.path.split('/')[0]
        if (!top) continue
        const key = `${t.folder.charAt(0).toUpperCase()}${t.folder.slice(1)}/${top}`
        by.set(key, (by.get(key) ?? 0) + t.files)
      }
      const total = (f?.tree ?? []).reduce((k, t) => k + t.files, 0)
      const recent = (f?.recent ?? []).slice(0, 3).map((r) => r.path.split('/').pop())
      return {
        lines: [`${n(total, 'file')}${recent.length ? `; recent: ${recent.join(', ')}` : ''}.`],
        ticks: [
          ...[...by.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([item, k]) => ({ item, sub: n(k, 'file'), on: true })),
          ...host.neverOf('filenames').map((x) => ({ item: x, sub: 'Left out', on: false })),
        ],
      }
    }
    default: {
      const rows = host.rows('Mail', 'Mail')
      const to = new Set(
        rows
          .filter((r) => str(r.values.Direction) === 'sent')
          .flatMap((r) => str(r.values['To addresses']).split(/,\s*/).filter(Boolean)),
      )
      return rows.length
        ? {
            lines: [
              `${n(rows.length, 'message')}; ${n(to.size, 'person', 'people')} you write to.`,
            ],
          }
        : { lines: [], reading: true }
    }
  }
}

// A tick on a card: the folder's own name or the site joins the never-use list, or leaves it.
export function tick(host: PluginHost, card: CardDef, item: string, on: boolean): void {
  const connector = card.name === 'files' ? 'filenames' : 'browsing'
  const word = (card.name === 'files' ? (item.split('/').pop() ?? item) : item).toLowerCase()
  const list = host.neverOf(connector).map((x) => x.toLowerCase())
  host.setNever(connector, on ? list.filter((x) => x !== word) : [...list, word])
}

// Whether what the card needs can be read: Chrome must be there, Safari and Screen Time both
// opened by Full Disk Access, at least one folder; the rest need nothing past being connected.
function ready(card: CardDef, parts: Record<string, string>): boolean {
  const states = Object.values(parts)
  if (card.name === 'files') return states.some((s) => s === 'ready')
  return states.every((s) => s === 'ready')
}

// A card as the page shows it: what it is, what was said, its parts, and what was found.
export async function viewOf(host: PluginHost, cards: Cards, name: string): Promise<CardView> {
  const card = cardOf(name)
  const said = cards.get().said[name] ?? null
  const known = host.catalogue().connectors
  const connected = card.connect.every((k) => known.find((c) => c.name === k)?.connected)
  const parts = connected ? await partsOf(host, card) : {}
  const mail = known
    .filter((c) => c.name === 'gmail' || c.name === 'outlook')
    .map(({ name, title, connected }) => ({ name, title, connected }))
  const can = card.name === 'mail' ? mail.some((m) => m.connected) : connected && ready(card, parts)
  return {
    ...card,
    at: CARDS.indexOf(card) + 1,
    of: CARDS.length,
    said,
    connected,
    states: parts,
    ready: can,
    ...(card.name === 'mail' ? { mail } : {}),
    found: said === 'allowed' && can ? await foundOf(host, card) : null,
  }
}

// The cards' routes: each card's view, Allow, Skip, its System Settings, and a tick.
export function cardRoutes(host: PluginHost, cards: Cards): void {
  host.route('GET', '/cards', async () => ({
    names: CARDS.map((c) => c.name),
    next: cards.next(),
    said: cards.get().said,
  }))
  host.route('GET', '/card/:name', async ({ params }) => viewOf(host, cards, params.name ?? ''))
  host.route('POST', '/card/:name/allow', async ({ params }) => {
    const card = cardOf(params.name ?? '')
    for (const k of card.connect) {
      const r = await host.connect(k)
      if (!r.connected)
        return {
          ...(await viewOf(host, cards, card.name)),
          problem: r.problem ?? 'It did not connect.',
        }
    }
    const view = await viewOf(host, cards, card.name)
    if (!view.ready)
      return {
        ...view,
        problem:
          card.name === 'mail'
            ? 'Connect Gmail or Outlook first, then come back to this card.'
            : null,
      }
    cards.say(card.name, 'allowed')
    host.journal(`Allowed ${card.title} for getting to know the person.`, { card: card.name })
    return viewOf(host, cards, card.name)
  })
  host.route('POST', '/card/:name/skip', async ({ params }) => {
    const card = cardOf(params.name ?? '')
    cards.say(card.name, 'skipped')
    host.journal(`Skipped ${card.title} for getting to know the person.`, { card: card.name })
    return viewOf(host, cards, card.name)
  })
  host.route('POST', '/card/:name/settings', async ({ params }) => {
    const card = cardOf(params.name ?? '')
    const parts = await partsOf(host, card)
    for (const [connector, names] of Object.entries(card.parts ?? {})) {
      const part = names.find((p) => parts[p] !== 'ready')
      if (part) {
        await host.connectorTool(connector, 'settings', { part })
        return { opened: part }
      }
    }
    return { opened: null }
  })
  host.route('POST', '/card/:name/tick', async ({ params, body }) => {
    const card = cardOf(params.name ?? '')
    const b = (body ?? {}) as { item?: unknown; on?: unknown }
    const item = String(b.item ?? '').trim()
    if (!item) throw new Refusal('Which one?')
    tick(host, card, item, b.on === true)
    return viewOf(host, cards, card.name)
  })
}
