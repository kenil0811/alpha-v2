// What the Interviewer may read (the onboarding plan, calls 8 and 11 to 18; in Set up Alpha's Get
// to know you, the redesign's calls 15 and 16): each with what it reads, its reader, which says
// what it found (the counts and the top few) and every row, file or line it may cite, and its
// lines for the draft.
import type { PluginHost, Row } from '@alpha/plugin-sdk'

export interface Found {
  words: string // what was found, to say before the next card
  cites: string[] // what may be cited from it: row <id>, file <hash>, line <id>
  text: string // everything it read, for the names a line may use
}

export interface Source {
  key: string
  name: string // the card's first words
  asks: string // the rest of the card's question
  reads: string // what it reads, in the card's ⓘ
  // the connectors that fill it: none connected, its card's Allow also opens Connections (calls 11
  // and 12); none at all for what is Alpha's own
  connectors: string[]
  // read there and then on the person's Allow, never on a clock (call 20): the computer's readers
  atInterview?: boolean
  read(host: PluginHost, person: string, days: number): Found
  // what it holds, one line each with what cites it, for the draft (Set up Alpha's What I learned)
  lines(host: PluginHost, person: string, days: number): string[]
}

// Each source gives the draft this many of its lines at most, the newest first.
const LINES = 150

// Whether something that fills it is connected here, by the catalogue alone: nothing is read.
export const connected = (host: PluginHost, s: Source): boolean =>
  !s.connectors.length ||
  host.catalogue().connectors.some((c) => c.connected && s.connectors.includes(c.name))

const DAY = 86_400_000
const within = (at: unknown, days: number) =>
  typeof at === 'string' && Date.parse(at) >= Date.now() - days * DAY

// The words a value says, for the names a line may use.
const textOf = (rows: Row[]) =>
  rows
    .map((r) =>
      Object.values(r.values)
        .map((v) => String(v ?? ''))
        .join(' '),
    )
    .join('\n')

// The few that come back most, each with how often and a row to cite.
function top(rows: Row[], key: (r: Row) => string, n = 5): string[] {
  const by = new Map<string, Row[]>()
  for (const r of rows) {
    const k = key(r).trim()
    if (k) by.set(k, [...(by.get(k) ?? []), r])
  }
  return [...by.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(
      ([k, rs]) =>
        `${k} (${rs.length}; ${rs
          .slice(0, 3)
          .map((r) => `row ${r.id}`)
          .join(', ')})`,
    )
}

// A reader's rows are one to a site or an app, each with its own count: the most first, each with
// its count and its row to cite (counting rows put every one at 1, so "most used" was the first
// few by the alphabet).
function most(rows: Row[], name: string, count: string, unit: string, n = 5): string[] {
  return [...rows]
    .sort(
      (a, b) =>
        Number(b.values[count] ?? 0) - Number(a.values[count] ?? 0) ||
        String(a.values[name]).localeCompare(String(b.values[name])),
    )
    .slice(0, n)
    .map((r) => `${String(r.values[name])} (${Number(r.values[count] ?? 0)} ${unit}; row ${r.id})`)
}

// Which browsers the sites came from, each with how many: " from Chrome (316) and Edge (266)".
function fromBrowsers(rows: Row[]): string {
  const by = new Map<string, number>()
  for (const r of rows)
    for (const b of String(r.values.Browsers ?? '')
      .split(', ')
      .filter(Boolean))
      by.set(b, (by.get(b) ?? 0) + 1)
  const said = [...by].sort((a, b) => b[1] - a[1]).map(([b, k]) => `${b} (${k})`)
  return said.length
    ? ` from ${said.length > 1 ? `${said.slice(0, -1).join(', ')} and ${said.at(-1)}` : said[0]}`
    : ''
}

// A subject or a title as it comes back: no Re:, no numbers, no dates.
const gist = (v: unknown) =>
  String(v ?? '')
    .replace(/^(\s*(re|fw|fwd)\s*:\s*)+/i, '')
    .replace(/[#\d][\d/.,:-]*/g, '')
    .replace(/\s+/g, ' ')
    .trim()

function rowsSource(
  key: string,
  name: string,
  asks: string,
  reads: string,
  where: { module: string; table: string; at?: string; keep?: (r: Row) => boolean },
  say: (rows: Row[], days: number) => string,
  none: string,
  connectors: string[],
  atInterview = false,
): Source {
  return {
    key,
    name,
    asks,
    reads,
    connectors,
    ...(atInterview ? { atInterview } : {}),
    read: (host, _person, days) => {
      const rows = rowsOf(host, where, days)
      if (!rows.length) return { words: none, cites: [], text: '' }
      return { words: say(rows, days), cites: rows.map((r) => `row ${r.id}`), text: textOf(rows) }
    },
    lines: (host, _person, days) =>
      rowsOf(host, where, days)
        .slice(-LINES)
        .reverse()
        .map(
          (r) =>
            `row ${r.id}: ${Object.entries(r.values)
              .filter(([, v]) => v !== null && v !== '' && v !== undefined)
              .map(([k, v]) => `${k}: ${String(v).replace(/\s+/g, ' ').slice(0, 120)}`)
              .join(' · ')}`,
        ),
  }
}

function rowsOf(
  host: PluginHost,
  where: { module: string; table: string; at?: string; keep?: (r: Row) => boolean },
  days: number,
): Row[] {
  const all = host.rows(where.module, where.table).filter((r) => !where.keep || where.keep(r))
  return where.at ? all.filter((r) => within(r.values[where.at as string], days)) : all
}

// A request a person wrote themselves, not what a tool put in their session in their name (a
// harness's wake, a scheduled task's text): those open with a tag.
const theirOwn = (r: Row) => !/^\s*</.test(String(r.values.Request ?? ''))

export const SOURCES: Source[] = [
  rowsSource(
    'mail',
    'Mail',
    'may I read your mail’s headers from the last few months?',
    'Who wrote, to whom, the subject and the day, from your own mail connection here; never what a mail says.',
    { module: 'Mail', table: 'Mail', at: 'Date' },
    (rows, days) =>
      [
        `${rows.length} mails in the last ${days} days.`,
        `Most from: ${top(rows, (r) => String(r.values.From ?? '')).join('; ')}.`,
        `Subjects that come back: ${top(rows, (r) => gist(r.values.Subject)).join('; ')}.`,
      ].join('\n'),
    'No mail is here yet: connect Gmail or Outlook in Connect, a step back.',
    ['gmail', 'outlook'],
  ),
  rowsSource(
    'calendar',
    'Calendar',
    'may I read your calendar from the last few months?',
    'Each event’s title, time, place and who was asked, from the calendars connected here.',
    { module: 'Calendar', table: 'Events', at: 'Starts' },
    (rows, days) =>
      [
        `${rows.length} events in the last ${days} days.`,
        `Ones that come back: ${top(rows, (r) => gist(r.values.Title)).join('; ')}.`,
      ].join('\n'),
    'No calendar is here yet: connect one in Connect, a step back.',
    ['calendar', 'outlook', 'google'],
  ),
  rowsSource(
    'contacts',
    'Contacts',
    'may I read your contacts?',
    'Each contact’s name, company and title, from the contacts connected here.',
    { module: 'People', table: 'Contacts' },
    (rows) =>
      [
        `${rows.length} contacts.`,
        `Companies most of them are at: ${top(rows, (r) => String(r.values.Company ?? '')).join('; ')}.`,
      ].join('\n'),
    'No contacts are here yet: connect them in Connect, a step back.',
    ['contacts', 'outlook', 'google'],
  ),
  {
    key: 'folder',
    name: 'A folder',
    asks: 'may I read the names of the files in the folder you lent?',
    reads:
      'The names, kinds and dates of the files in the folder you lent in Alpha Bridge; never what is inside them.',
    connectors: ['folder'],
    read: (host, _person, days) => {
      const files = host.files('folder').filter((f) => within(f.at, days))
      if (!files.length)
        return {
          words: 'No folder is lent yet: lend one in Alpha Bridge on your computer.',
          cites: [],
          text: '',
        }
      const kinds = new Map<string, number>()
      for (const f of files) kinds.set(f.kind, (kinds.get(f.kind) ?? 0) + 1)
      return {
        words: [
          `${files.length} files.`,
          `Kinds: ${[...kinds].map(([k, n]) => `${k} (${n})`).join('; ')}.`,
          `Names: ${files
            .slice(0, 12)
            .map((f) => `${f.name} (file ${f.hash})`)
            .join('; ')}.`,
        ].join('\n'),
        cites: files.map((f) => `file ${f.hash}`),
        text: files.map((f) => f.name).join('\n'),
      }
    },
    lines: (host, _person, days) =>
      host
        .files('folder')
        .filter((f) => within(f.at, days))
        .slice(0, LINES)
        .map((f) => `file ${f.hash}: ${f.name} (${f.kind}, ${f.at.slice(0, 10)})`),
  },
  rowsSource(
    'browsing',
    'Browsing',
    'may I read which sites you use, and on how many days?',
    'The sites your browsers open on your computer and on how many days, counted there by Alpha Bridge; only sites seen on two days or more reach Alpha.',
    { module: 'Your work', table: 'Sites' },
    (rows) =>
      [
        `${rows.length} sites${fromBrowsers(rows)}.`,
        `Most used: ${most(rows, 'Site', 'Days used', 'days').join('; ')}.`,
      ].join('\n'),
    'Nothing has come from your computer’s browsing yet.',
    ['browsing'],
    true,
  ),
  rowsSource(
    'apps',
    'Apps',
    'may I read which apps you have, and when you last used them?',
    'The apps on your computer, with when each was last used and how often where it keeps that, read by Alpha Bridge.',
    { module: 'Your work', table: 'Apps' },
    (rows) =>
      [
        `${rows.length} apps.`,
        `Most used: ${most(rows, 'App', 'Times used', 'times').join('; ')}.`,
      ].join('\n'),
    'Nothing has come from your computer’s apps yet.',
    ['apps'],
    true,
  ),
  rowsSource(
    'ai',
    'AI work',
    'may I read what you have asked AI tools?',
    'Your own requests to Claude Code and Codex on your computer, and the titles of your ChatGPT and claude.ai conversations; never the AI’s replies.',
    { module: 'Your work', table: 'AI requests', keep: theirOwn },
    (rows) => `${rows.length} requests. ${top(rows, (r) => gist(r.values.Request)).join('; ')}.`,
    'No AI work has come from your computer yet.',
    ['ai-work'],
    true,
  ),
  {
    key: 'alpha',
    name: 'What you have in Alpha',
    asks: 'may I read what you have set up and done here?',
    reads:
      'The modules, agents and schedules here, and what you did in Alpha in the last few months, as Activity keeps it.',
    connectors: [],
    read: (host, person, days) => {
      const c = host.catalogue()
      const lines = host.activity(person, days)
      const kinds = new Map<string, number>()
      for (const l of lines) kinds.set(l.kind, (kinds.get(l.kind) ?? 0) + 1)
      const words = [
        `Modules: ${c.modules.map((m) => m.name).join(', ') || 'none'}.`,
        `Agents: ${c.agents.map((a) => a.name).join(', ') || 'none'}.`,
        `Schedules: ${c.schedules.map((s) => `${s.name}${s.on ? '' : ' (paused)'}`).join(', ') || 'none'}.`,
        `What you did in the last ${days} days: ${lines.length} lines; ${[...kinds]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([k, n]) => `${k} ${n}`)
          .join(', ')}.`,
        ...lines.slice(-8).map((l) => `line ${l.id}: ${l.words}`),
      ].join('\n')
      return {
        words,
        cites: lines.map((l) => `line ${l.id}`),
        text: [words, ...lines.map((l) => l.words)].join('\n'),
      }
    },
    lines: (host, person, days) => {
      const c = host.catalogue()
      return [
        `Modules here: ${c.modules.map((m) => m.name).join(', ') || 'none'}.`,
        ...host
          .activity(person, days)
          .slice(-LINES)
          .reverse()
          .map((l) => `line ${l.id}: ${l.at.slice(0, 10)} ${l.words.slice(0, 160)}`),
      ]
    },
  },
]

export const sourceOf = (key: string): Source | undefined => SOURCES.find((s) => s.key === key)
