// What the Interviewer may read, one source to a card (the onboarding plan, calls 8 and 11 to 18):
// each with the words its card opens with, what it reads (the card's detail), and its reader,
// which says what it found (the counts and the top few) and every row, file or line it may cite.
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
  reads: string // what it reads, in the card's detail
  read(host: PluginHost, person: string, days: number): Found
}

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
  where: { module: string; table: string; at?: string },
  say: (rows: Row[], days: number) => string,
  none: string,
): Source {
  return {
    key,
    name,
    asks,
    reads,
    read: (host, _person, days) => {
      const all = host.rows(where.module, where.table)
      const rows = where.at ? all.filter((r) => within(r.values[where.at as string], days)) : all
      if (!rows.length) return { words: none, cites: [], text: '' }
      return { words: say(rows, days), cites: rows.map((r) => `row ${r.id}`), text: textOf(rows) }
    },
  }
}

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
    'No mail is here yet: connect Gmail or Outlook in Connections, then ask again.',
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
    'No calendar is here yet: connect one, then ask again.',
  ),
  rowsSource(
    'contacts',
    'Contacts',
    'may I read your contacts?',
    'Each contact’s name, company and title, from the contacts connected here.',
    { module: 'People', table: 'Address book' },
    (rows) =>
      [
        `${rows.length} contacts.`,
        `Companies most of them are at: ${top(rows, (r) => String(r.values.Company ?? '')).join('; ')}.`,
      ].join('\n'),
    'No contacts are here yet: connect them, then ask again.',
  ),
  {
    key: 'folder',
    name: 'A folder',
    asks: 'may I read the names of the files in the folder you lent?',
    reads:
      'The names, kinds and dates of the files in the folder you lent in Alpha Bridge; never what is inside them.',
    read: (host, _person, days) => {
      const files = host.files('folder').filter((f) => within(f.at, days))
      if (!files.length)
        return {
          words: 'No folder is lent yet: lend one in Alpha Bridge, then ask again.',
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
  },
  rowsSource(
    'browsing',
    'Browsing',
    'may I read which sites you use, and on how many days?',
    'The sites your browsers open on your computer and on how many days, counted there by Alpha Bridge; only sites seen on two days or more reach Alpha.',
    { module: 'Your work', table: 'Sites' },
    (rows) =>
      `${rows.length} sites. Most used: ${top(rows, (r) => String(r.values.Site ?? '')).join('; ')}.`,
    'Nothing has come from your computer’s browsing yet.',
  ),
  rowsSource(
    'apps',
    'Apps',
    'may I read which apps you have, and when you last used them?',
    'The apps on your computer, with when each was last used and how often where it keeps that, read by Alpha Bridge.',
    { module: 'Your work', table: 'Apps' },
    (rows) => `${rows.length} apps. ${top(rows, (r) => String(r.values.App ?? '')).join('; ')}.`,
    'Nothing has come from your computer’s apps yet.',
  ),
  rowsSource(
    'ai',
    'AI work',
    'may I read what you have asked AI tools?',
    'Your own requests to Claude Code and Codex on your computer, and the titles of your ChatGPT and claude.ai conversations; never the AI’s replies.',
    { module: 'Your work', table: 'AI requests' },
    (rows) => `${rows.length} requests. ${top(rows, (r) => gist(r.values.Request)).join('; ')}.`,
    'No AI work has come from your computer yet.',
  ),
  {
    key: 'alpha',
    name: 'What you have in Alpha',
    asks: 'may I read what you have set up and done here?',
    reads:
      'The modules, agents and schedules here, and what you did in Alpha in the last few months, as Activity keeps it.',
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
  },
]

export const sourceOf = (key: string): Source | undefined => SOURCES.find((s) => s.key === key)
