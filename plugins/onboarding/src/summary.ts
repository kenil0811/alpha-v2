// The overview the closer look starts from (onboarding design §5, and B): every fact on its own
// line with an id the answer may cite ([B17]), counted here from what the person allowed and
// dropped after; nothing raw is kept. No size of our choosing: everything counted goes in.
import type { PluginHost, Row } from '@alpha/plugin-sdk'
import { mailRows, meetingRows } from './sources.ts'

export interface Summary {
  text: string
  ids: string[] // every id the draft may cite
  counts: {
    meetings: number
    contacts: number
    mail: number
    sites: number
    apps: number
    files: number
  }
}

type Part = { letter: string; title: string; lines: string[] }

const day = (at: unknown) => {
  const d = new Date(String(at))
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())
const count = <T>(items: T[], key: (x: T) => string | null) => {
  const by = new Map<string, number>()
  for (const x of items) {
    const k = key(x)
    if (k) by.set(k, (by.get(k) ?? 0) + 1)
  }
  return [...by.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

// A name of a person from "Name <address>" or an address.
const who = (s: string) =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/^"|"$/g, '')
    .trim()

function calendar(rows: Row[]): string[] {
  if (!rows.length) return ['Calendar: nothing read (not connected, or no meetings).']
  const v = rows.map((r) => r.values)
  const now = Date.now()
  const past = v.filter((e) => Date.parse(str(e.Starts)) <= now).length
  const starts = v.map((e) => str(e.Starts)).sort()
  const out = [
    `${plural(v.length, 'meeting')} from ${day(starts[0])} to ${day(starts.at(-1))}: ${past} past, ${v.length - past} ahead.`,
  ]
  const mine = new Set(v.map((e) => str(e['Your address']).toLowerCase()).filter(Boolean))
  const people = count(
    v.flatMap((e) =>
      str(e.Attendees)
        .split(/,\s*/)
        .filter((a) => a && ![...mine].some((m) => a.toLowerCase().includes(m))),
    ),
    (a) => who(a) || null,
  ).filter(([, n]) => n > 1)
  for (const [name, n] of people) out.push(`Met ${name} in ${plural(n, 'meeting')}.`)
  for (const [title, n] of count(v, (e) => str(e.Title) || null).filter(([, n]) => n > 2))
    out.push(`"${title}" comes back: ${n} times.`)
  const hours = count(
    v.filter((e) => str(e['All day']) !== 'yes'),
    (e) => {
      const d = new Date(str(e.Starts))
      return Number.isNaN(d.getTime()) ? null : String(d.getHours()).padStart(2, '0')
    },
  )
  const busy = hours.filter(([, n]) => n >= v.length * 0.1).map(([h]) => `${h}:00`)
  if (busy.length) out.push(`Meetings mostly start at ${busy.sort().join(', ')}.`)
  return out
}

function contacts(rows: Row[]): string[] {
  if (!rows.length) return ['Contacts: nothing read (not connected, or none).']
  const v = rows.map((r) => r.values)
  const me = v.find((c) => str(c['Is you']) === 'yes')
  const out = [`${plural(v.length, 'contact')}.`]
  if (me)
    out.push(
      `Their own card: ${[str(me.Name), str(me.Title), str(me.Company)].filter(Boolean).join(', ')}.`,
    )
  for (const [company, n] of count(v, (c) => str(c.Company) || null).filter(([, n]) => n > 1))
    out.push(`${company}: ${plural(n, 'contact')}.`)
  for (const [title, n] of count(v, (c) => str(c.Title) || null).filter(([, n]) => n > 1))
    out.push(`${n} contacts are a ${title}.`)
  return out
}

function mail(rows: Row[]): string[] {
  if (!rows.length) return ['Mail: nothing read (not connected, or none).']
  const sent = rows.map((r) => r.values).filter((m) => str(m.Direction) === 'sent')
  const out = [`${plural(rows.length, 'message')}, ${sent.length} of them sent.`]
  const to = sent.flatMap((m) => str(m['To addresses']).split(/,\s*/).filter(Boolean))
  for (const [address, n] of count(to, (a) => a.toLowerCase()).filter(([, n]) => n > 1))
    out.push(`Wrote to ${address} ${plural(n, 'time')}.`)
  for (const [domain, n] of count(to, (a) => a.split('@')[1]?.toLowerCase() ?? null).filter(
    ([, n]) => n > 1,
  ))
    out.push(`Wrote to people at ${domain} ${plural(n, 'time')}.`)
  const subject = (s: string) =>
    s
      .replace(/^((re|fwd?|aw)\s*:\s*)+/i, '')
      .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '')
      .replace(/\d{5,}/g, '')
      .trim()
  for (const [s, n] of count(sent, (m) => subject(str(m.Subject)) || null))
    out.push(`Wrote in "${s}" (${plural(n, 'message')}).`)
  return out
}

interface Site {
  site: string
  visits: number
  days: number
  last: string
  titles: string[]
}

function browsing(sites: Site[] | null): string[] {
  if (!sites) return ['Browsing history: nothing read (not connected).']
  return sites.map(
    (s) =>
      `${s.site}: ${plural(s.visits, 'visit')} on ${plural(s.days, 'day')}, last ${day(s.last)}${
        s.titles.length ? `; pages like ${s.titles.map((t) => `"${t}"`).join(', ')}` : ''
      }.`,
  )
}

interface App {
  name: string
  launches?: number
  lastUsed?: string
  hoursWeek?: number
}

function apps(list: App[] | null): string[] {
  if (!list) return ['Apps: nothing read (not connected).']
  return list.map((a) =>
    [
      a.name,
      a.hoursWeek ? `${a.hoursWeek} hours a week` : '',
      a.launches ? `opened ${plural(a.launches, 'time')}` : '',
      a.lastUsed ? `last used ${day(a.lastUsed)}` : '',
    ]
      .filter(Boolean)
      .join('; ')
      .concat('.'),
  )
}

interface Files {
  tree: { folder: string; path: string; files: number; kinds: Record<string, number> }[]
  recent: { folder: string; path: string; modified: string }[]
}

const folderName = (f: string) => f.charAt(0).toUpperCase() + f.slice(1)

function files(f: Files | null): string[] {
  if (!f) return ['File names: nothing read (not connected).']
  return [
    ...f.tree.map(
      (t) =>
        `${[folderName(t.folder), t.path].filter(Boolean).join('/')}: ${plural(t.files, 'file')} (${Object.entries(
          t.kinds,
        )
          .sort((a, b) => b[1] - a[1])
          .map(([k, n]) => `${k} ${n}`)
          .join(', ')}).`,
    ),
    ...f.recent.map((r) => `${folderName(r.folder)}/${r.path}, changed ${day(r.modified)}.`),
  ]
}

function catalogue(host: PluginHost, own: string): string[] {
  const c = host.catalogue()
  return [
    ...c.modules
      .filter((m) => m.name !== own && m.name !== 'Alpha')
      .map(
        (m) =>
          `Module ${m.name}${m.installed ? ' (installed)' : ''}${
            m.case ? `: for ${m.case.for}; keeps ${m.case.keeps}; decides ${m.case.decides}` : ''
          }.`,
      ),
    ...c.connectors
      .filter((k) => !k.private)
      .map(
        (k) =>
          `Connector ${k.title} (${k.name})${k.connected ? ', connected' : ', not connected'}.`,
      ),
  ]
}

// What a connector of this computer counted, or none where it is not connected.
async function read<T>(
  host: PluginHost,
  connector: string,
  tool: string,
  input: Record<string, unknown>,
) {
  try {
    return (await host.connectorTool(connector, tool, input)) as T
  } catch {
    return null
  }
}

// Every part read and counted.
export async function buildSummary(host: PluginHost, own: string): Promise<Summary> {
  const p = host.person()
  const sites =
    (await read<{ sites: Site[] }>(host, 'browsing', 'sites', { days: 90 }))?.sites ?? null
  const appList = (await read<{ apps: App[] }>(host, 'apps', 'apps', { days: 30 }))?.apps ?? null
  const fileList = await read<Files>(host, 'filenames', 'files', {})
  const events = meetingRows(host)
  const people = host.rows('Contacts', 'Contacts')
  const messages = mailRows(host)
  const parts: Part[] = [
    {
      letter: 'P',
      title: 'The person',
      lines: [
        `${p.name}; region ${p.region ?? 'not known'}; time zone ${p.zone}; language ${p.language}.`,
      ],
    },
    { letter: 'C', title: 'Calendar', lines: calendar(events) },
    { letter: 'K', title: 'Contacts', lines: contacts(people) },
    { letter: 'M', title: 'Mail', lines: mail(messages) },
    {
      letter: 'B',
      title: 'Browsing, the last 90 days',
      lines: browsing(sites),
    },
    { letter: 'A', title: 'Apps, the last 30 days', lines: apps(appList) },
    {
      letter: 'F',
      title: 'File names',
      lines: files(fileList),
    },
    { letter: 'T', title: 'What Alpha can set up', lines: catalogue(host, own) },
  ]
  const ids: string[] = []
  const text = parts
    .map((part) => {
      const lines = part.lines.map((l, i) => {
        const id = `${part.letter}${i + 1}`
        ids.push(id)
        return `[${id}] ${l}`
      })
      return `## ${part.letter}: ${part.title}\n${lines.join('\n')}`
    })
    .join('\n\n')
  return {
    text,
    ids,
    counts: {
      meetings: events.length,
      contacts: people.length,
      mail: messages.length,
      sites: sites?.length ?? 0,
      apps: appList?.length ?? 0,
      files: fileList ? fileList.tree.reduce((n, t) => n + t.files, 0) : 0,
    },
  }
}
