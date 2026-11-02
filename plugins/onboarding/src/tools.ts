// The closer look's tools (onboarding B, Kenil's yes 2 Nov): read-only, each answering from what
// the session read once (sources.ts), in the person's own time zone. A tool without input counts;
// with a site, an app, a folder, a person or some words it lists. Nothing is cut to a size of
// ours: a list is as long as what it lists, and the model narrows it when it wants less.
import type { PluginHost, PluginTool } from '@alpha/plugin-sdk'
import { z } from 'zod'
import {
  clock,
  hours,
  MINUTE,
  matches,
  median,
  minutes,
  round,
  type Timed,
  tally,
  type When,
  weekdays,
} from './count.ts'
import { peopleTools, search } from './people.ts'
import type { AppUse, Message, Name, Sources, Span, Visit } from './sources.ts'

// Spans of one app side by side (two minutes apart or less) as one time in it.
export function appRuns(spans: Span[]): Span[] {
  const out: Span[] = []
  for (const s of spans) {
    const last = out.at(-1)
    if (last && last.app === s.app && Date.parse(s.start) - Date.parse(last.end) <= 2 * MINUTE) {
      if (s.end > last.end) last.end = s.end
    } else out.push({ ...s })
  }
  return out
}

// Visits to one site one after another (half an hour apart or less) as one time on it.
function siteRuns(visits: Timed<Visit>[]) {
  const out: { site: string; start: string; end: string; visits: number; titles: string[] }[] = []
  for (const v of visits) {
    const last = out.at(-1)
    if (last && last.site === v.site && Date.parse(v.at) - Date.parse(last.end) <= 30 * MINUTE) {
      last.end = v.at
      last.visits++
      if (v.title && !last.titles.includes(v.title)) last.titles.push(v.title)
    } else
      out.push({
        site: v.site,
        start: v.at,
        end: v.at,
        visits: 1,
        titles: v.title ? [v.title] : [],
      })
  }
  return out
}

const MONTHS =
  /\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)\b/gi

// A name's shape, its numbers and months left out: Invoice_0042.pdf is Invoice_#.pdf.
export const shapeOf = (name: string) => name.replace(MONTHS, '<month>').replace(/\d+/g, '#')

// Names in one folder of one shape, three or more: what is made again and again.
export function seriesOf(names: Name[]) {
  const groups = new Map<string, Name[]>()
  for (const n of names) {
    if (n.kind === 'folder' || n.kind === 'project') continue
    const parts = n.path.split('/')
    const base = parts.pop() ?? ''
    const shape = shapeOf(base)
    if (shape === base) continue
    const key = [n.folder, ...parts, shape].join('/')
    groups.set(key, [...(groups.get(key) ?? []), n])
  }
  return [...groups.entries()]
    .filter(([, ns]) => ns.length >= 3)
    .map(([pattern, ns]) => {
      const dates = ns.map((n) => n.modified).sort()
      return {
        pattern,
        names: ns.length,
        first: dates[0]?.slice(0, 10) ?? '',
        last: dates.at(-1)?.slice(0, 10) ?? '',
        like: ns
          .slice()
          .sort((a, b) => b.modified.localeCompare(a.modified))
          .slice(0, 3)
          .map((n) => n.path.split('/').pop()),
      }
    })
    .sort((a, b) => b.names - a.names || a.pattern.localeCompare(b.pattern))
}

const fullName = (n: Name) => `${n.folder}/${n.path}`

export function toolsOf(s: Sources, host: PluginHost): PluginTool[] {
  const when = clock(host.person().zone)
  const timed = <T>(xs: T[], at: (x: T) => string): Timed<T>[] =>
    xs.flatMap((x) => {
      const w = when(at(x))
      return w ? [{ ...x, w }] : []
    })
  const visits = timed(s.visits ?? [], (v) => v.at)
  const runs = timed(appRuns(s.spans ?? []), (r) => r.start)
  const names = timed(
    (s.names ?? []).filter((n) => n.kind !== 'folder'),
    (n) => n.modified,
  )
  const downloads = timed(s.downloads ?? [], (d) => d.at)
  const mail = timed(s.mail, (m) => m.at)
  const meetings = timed(s.meetings, (m) => m.starts)
  const fromOf = new Map(downloads.map((d) => [`downloads/${d.name}`, d.sites]))
  const notRead = (what: string, list: unknown[] | null) =>
    list === null ? { [what]: 'not read: not connected' } : {}

  const visitsMatching = (words: string) => {
    const m = matches(words)
    return tally(
      visits.filter((v) => m(v.site, v.title)),
      (v) => `${v.site}\u0000${v.title}`,
    ).map(([k, n]) => {
      const [site, title] = k.split('\u0000')
      const these = visits.filter((v) => v.site === site && v.title === title)
      return {
        site,
        title,
        visits: n,
        days: new Set(these.map((v) => v.w.day)).size,
        last: these.at(-1)?.w.day,
      }
    })
  }
  const namesMatching = (words: string) => {
    const m = matches(words)
    return names
      .filter((n) => m(fullName(n)))
      .sort((a, b) => b.modified.localeCompare(a.modified))
      .map((n) => ({
        name: fullName(n),
        kind: n.kind,
        changed: n.w.day,
        ...(fromOf.get(fullName(n)) ? { from: fromOf.get(fullName(n)) } : {}),
      }))
  }
  const mailLine = (m: Timed<Message>) => ({
    day: m.w.day,
    time: m.w.time,
    ...(m.sent ? { sent: true, to: m.to } : { from: m.from, domain: m.fromSite }),
    ...(m.automated ? { automated: true } : {}),
    subject: m.subject,
    ...(m.attachments.length ? { attachments: m.attachments } : {}),
  })
  const mailMatching = (test: (m: Timed<Message>) => boolean) =>
    mail
      .filter(test)
      .sort((a, b) => b.at.localeCompare(a.at))
      .map(mailLine)
  const meetingsMatching = (words: string) => {
    const m = matches(words)
    return meetings
      .filter((x) => m(x.title, x.location, ...x.people))
      .sort((a, b) => b.starts.localeCompare(a.starts))
      .map((x) => ({
        day: x.w.day,
        at: x.allDay ? 'all day' : x.w.time,
        ...(x.allDay ? {} : { until: when(x.ends)?.time }),
        title: x.title,
        with: x.people,
        ...(x.location ? { location: x.location } : {}),
      }))
  }
  const contactsMatching = (words: string) => {
    const m = matches(words)
    return s.contacts
      .filter((c) => m(c.name, c.company, c.title))
      .map(({ name, company, title }) => ({ name, company, title }))
  }

  const day: PluginTool = {
    name: 'day',
    description:
      'One of the person’s days in time order: the app in front, the sites with their page titles, meetings, mail sent and received, files changed and downloads. Without a date, every day with something on it and how much: pick days to look at.',
    input: { date: z.string().optional().describe('The day, as 2026-10-31') },
    run: async ({ date }) => {
      if (!date) {
        const days = new Map<string, Record<string, number | string>>()
        const add = (w: When, what: string, n = 1) => {
          const d = days.get(w.day) ?? { day: w.day, weekday: w.weekday }
          d[what] = round(Number(d[what] ?? 0) + n)
          days.set(w.day, d)
        }
        for (const v of visits) add(v.w, 'visits')
        for (const r of runs) add(r.w, 'appHours', minutes(r.start, r.end) / 60)
        for (const m of meetings) add(m.w, 'meetings')
        for (const m of mail) add(m.w, m.sent ? 'sent' : 'received')
        for (const n of names) add(n.w, 'filesChanged')
        for (const d of downloads) add(d.w, 'downloads')
        return {
          days: [...days.values()].sort((a, b) => String(b.day).localeCompare(String(a.day))),
        }
      }
      const items: { at: string; [k: string]: unknown }[] = []
      for (const r of runs.filter((r) => r.w.day === date)) {
        const m = minutes(r.start, r.end)
        if (m >= 1) items.push({ at: r.w.time, until: when(r.end)?.time, app: r.app, minutes: m })
      }
      for (const r of siteRuns(visits.filter((v) => v.w.day === date)))
        items.push({
          at: when(r.start)?.time ?? '',
          until: when(r.end)?.time,
          site: r.site,
          visits: r.visits,
          ...(r.titles.length ? { titles: r.titles } : {}),
        })
      for (const m of meetings.filter((m) => m.w.day === date))
        items.push({
          at: m.allDay ? '00:00' : m.w.time,
          ...(m.allDay ? { allDay: true } : { until: when(m.ends)?.time }),
          meeting: m.title,
          with: m.people,
        })
      for (const m of mail.filter((m) => m.w.day === date)) {
        const { day: _, time, ...rest } = mailLine(m)
        items.push({ at: time, mail: m.sent ? 'sent' : 'received', ...rest })
      }
      for (const n of names.filter((n) => n.w.day === date))
        items.push({ at: n.w.time, fileChanged: fullName(n) })
      for (const d of downloads.filter((d) => d.w.day === date))
        items.push({ at: d.w.time, downloaded: d.name, from: d.sites })
      items.sort((a, b) => a.at.localeCompare(b.at))
      return { day: date, weekday: when(`${date}T12:00:00Z`)?.weekday, items }
    },
  }

  const sites: PluginTool = {
    name: 'sites',
    description:
      'The sites the person visits (site and page titles only, never addresses). Without input, every site counted; with a site, its page titles, the weekdays and hours they are on it, and the files downloaded from it; with words, the pages whose site or title has them.',
    input: {
      site: z.string().optional().describe('A site, as bizbuysell.com'),
      words: z.string().optional(),
    },
    run: async ({ site, words }) => {
      if (s.visits === null) return notRead('browsing', null)
      if (words) return { pages: visitsMatching(String(words)) }
      if (site) {
        const at = String(site)
          .toLowerCase()
          .replace(/^www\./, '')
        const these = visits.filter((v) => v.site === at || v.site.endsWith(`.${at}`))
        return {
          site: at,
          visits: these.length,
          days: new Set(these.map((v) => v.w.day)).size,
          first: these[0]?.w.day,
          last: these.at(-1)?.w.day,
          weekdays: weekdays(these.map((v) => v.w)),
          hours: hours(these.map((v) => v.w)),
          titles: tally(these, (v) => v.title).map(([title, n]) => ({
            title,
            visits: n,
            last: these.filter((v) => v.title === title).at(-1)?.w.day,
          })),
          downloads: downloads
            .filter((d) => d.sites.some((x) => x === at || x.endsWith(`.${at}`)))
            .map((d) => ({ name: d.name, day: d.w.day })),
        }
      }
      return {
        sites: tally(visits, (v) => v.site).map(([site, n]) => {
          const these = visits.filter((v) => v.site === site)
          return {
            site,
            visits: n,
            days: new Set(these.map((v) => v.w.day)).size,
            last: these.at(-1)?.w.day,
            titles: new Set(these.map((v) => v.title).filter(Boolean)).size,
          }
        }),
        downloadsFrom: tally(
          downloads.flatMap((d) => d.sites),
          (x) => x,
        ).map(([site, files]) => ({ site, files })),
      }
    },
  }

  const apps: PluginTool = {
    name: 'apps',
    description:
      'The apps the person uses. Without input, each app with its hours a week, launches, last use, times in front and days used; with an app, the weekdays and hours it is used, how long a time in it usually lasts, and which apps come just before and after it.',
    input: { app: z.string().optional().describe('An app’s name, as Microsoft Excel') },
    run: async ({ app }) => {
      if (s.apps === null && s.spans === null) return notRead('apps', null)
      if (app) {
        const name = String(app).toLowerCase()
        const all = runs.slice().sort((a, b) => a.start.localeCompare(b.start))
        const these = all.filter((r) => r.app.toLowerCase() === name)
        const near = (step: -1 | 1) =>
          tally(
            these.map((r) => {
              const other = all[all.indexOf(r) + step]
              if (!other || other.app === r.app) return null
              const gap =
                step === 1
                  ? Date.parse(other.start) - Date.parse(r.end)
                  : Date.parse(r.start) - Date.parse(other.end)
              return gap <= 10 * MINUTE ? other.app : null
            }),
            (x) => x,
          ).map(([app, times]) => ({ app, times }))
        const long = these.map((r) => minutes(r.start, r.end))
        return {
          app: these[0]?.app ?? app,
          times: these.length,
          days: new Set(these.map((r) => r.w.day)).size,
          hours: round(long.reduce((a, b) => a + b, 0) / 60),
          usualMinutes: median(long),
          hoursByWeekday: weekdays(
            these.map((r) => r.w),
            (i) => (long[i] ?? 0) / 60,
          ),
          startsByHour: hours(these.map((r) => r.w)),
          before: near(-1),
          after: near(1),
        }
      }
      const times = new Map(tally(runs, (r) => r.app))
      const days = new Map<string, Set<string>>()
      for (const r of runs) days.set(r.app, (days.get(r.app) ?? new Set()).add(r.w.day))
      const listed = new Set((s.apps ?? []).map((a) => a.name))
      return {
        ...notRead('timeInApps', s.spans),
        apps: [
          ...(s.apps ?? []),
          ...[...times.keys()].filter((n) => !listed.has(n)).map((name): AppUse => ({ name })),
        ]
          .map((a) => ({
            ...a,
            ...(times.get(a.name)
              ? { times: times.get(a.name), days: days.get(a.name)?.size }
              : {}),
          }))
          .filter((a) => a.launches || a.lastUsed || a.hoursWeek || 'times' in a),
      }
    },
  }

  const files: PluginTool = {
    name: 'files',
    description:
      'The names of files in Documents, Desktop and Downloads (never what is in them). Without input, the folders two levels deep with counts by kind, and the series made again and again (Invoice_#.pdf); with a folder, the names in it and its folders; with words, the names that have them. Downloads say the sites they came from.',
    input: {
      folder: z.string().optional().describe('A folder, as documents/Deals'),
      words: z.string().optional(),
    },
    run: async ({ folder, words }) => {
      if (s.names === null) return notRead('fileNames', null)
      if (words) return { names: namesMatching(String(words)) }
      if (folder) {
        const at = String(folder).toLowerCase().replace(/\/+$/, '')
        const under = names.filter((n) => fullName(n).toLowerCase().startsWith(`${at}/`))
        const rest = (n: Name) => fullName(n).slice(at.length + 1)
        return {
          folder: at,
          names: under
            .filter((n) => !rest(n).includes('/'))
            .sort((a, b) => b.modified.localeCompare(a.modified))
            .map((n) => ({
              name: rest(n),
              kind: n.kind,
              changed: n.w.day,
              ...(fromOf.get(fullName(n)) ? { from: fromOf.get(fullName(n)) } : {}),
            })),
          folders: tally(
            under.filter((n) => rest(n).includes('/')),
            (n) => rest(n).split('/')[0],
          ).map(([name, files]) => ({ name, files })),
        }
      }
      const tree = new Map<
        string,
        { folder: string; files: number; kinds: Record<string, number>; last: string }
      >()
      for (const n of names) {
        const parts = n.path.split('/')
        const at = [n.folder, ...parts.slice(0, Math.min(parts.length - 1, 2))].join('/')
        const t = tree.get(at) ?? { folder: at, files: 0, kinds: {}, last: '' }
        t.files++
        t.kinds[n.kind || 'other'] = (t.kinds[n.kind || 'other'] ?? 0) + 1
        if (n.w.day > t.last) t.last = n.w.day
        tree.set(at, t)
      }
      return {
        folders: [...tree.values()].sort((a, b) => b.files - a.files),
        series: seriesOf(s.names),
        ...notRead('downloadSources', s.downloads),
      }
    },
  }

  return [
    day,
    sites,
    apps,
    files,
    ...peopleTools(s, host, { mail, meetings, mailMatching, meetingsMatching, contactsMatching }),
    search(visitsMatching, namesMatching, mailMatching, meetingsMatching, contactsMatching),
  ]
}
