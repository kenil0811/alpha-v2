import { all, now, parse } from '../db.ts'
import { Refused } from '../kinds.ts'
import { isEmail, text } from './keys.ts'
import type { People } from './people.ts'
import type { Contact, Kind, Pair, PersonLine, PersonOut, Said } from './types.ts'

export function contact(people: People, id: string): Contact {
  const ids = people.parts(id)
  const { days } = people.judgements()
  const marks = ids.map(() => '?').join(', ')
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const until = now()
  const rows = all<{ channel: string; at: string; started_by: 'you' | 'them' | null }>(
    people.db,
    `SELECT e.channel, e.at, e.started_by FROM exchanges e
       JOIN people_keys k ON k.key = e.key AND k.value = e.value
     WHERE k.person_id IN (${marks}) AND e.at <= ? ORDER BY e.at`,
    ...ids,
    until,
  )
  const recent = rows.filter((r) => r.at >= since)
  const channels = new Map<string, number>()
  for (const r of recent) channels.set(r.channel, (channels.get(r.channel) ?? 0) + 1)
  return {
    days,
    last: rows.at(-1)?.at ?? null,
    count: recent.length,
    channels: [...channels]
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count),
    first: recent.find((r) => r.started_by)?.started_by ?? null,
  }
}

export function get(people: People, id: string): PersonOut | undefined {
  const p = people.row(people.root(id))
  if (!p) return undefined
  const ids = people.parts(p.id)
  const marks = ids.map(() => '?').join(', ')
  const companies = new Map<string, PersonOut['companies'][number]>()
  for (const l of all<{
    company_id: string
    title: string | null
    started_at: string
    ended_at: string | null
  }>(
    people.db,
    `SELECT company_id, title, started_at, ended_at FROM people_links WHERE person_id IN (${marks})
     ORDER BY started_at`,
    ...ids,
  )) {
    const c = people.row(people.root(l.company_id))
    if (!c) continue
    const key = `${c.id}\u0000${l.title ?? ''}`
    const seen = companies.get(key)
    // one line per company and title: since its first link, ended only when every link ended
    companies.set(key, {
      id: c.id,
      name: c.name,
      title: l.title,
      since: seen ? seen.since : l.started_at,
      ended:
        seen && (!seen.ended || !l.ended_at)
          ? null
          : ([seen?.ended, l.ended_at]
              .filter((x): x is string => !!x)
              .sort()
              .at(-1) ?? null),
    })
  }
  // a line with no title says nothing a titled line at the same company doesn't
  for (const [key, c] of companies)
    if (!c.title && [...companies.values()].some((x) => x.id === c.id && x.title))
      companies.delete(key)
  const members = new Map<string, { id: string; name: string; title: string | null }>()
  if (p.kind === 'company')
    for (const l of all<{ person_id: string; title: string | null }>(
      people.db,
      `SELECT person_id, title FROM people_links WHERE company_id IN (${marks}) AND ended_at IS NULL
       ORDER BY started_at`,
      ...ids,
    )) {
      const m = people.row(people.root(l.person_id))
      if (m && !members.get(m.id)?.title)
        members.set(m.id, { id: m.id, name: m.name, title: l.title })
    }
  return {
    id: p.id,
    kind: p.kind,
    name: p.name,
    keys: people.keysOf(ids),
    merged: all<{ id: string; name: string }>(
      people.db,
      'SELECT id, name FROM people WHERE merged_into = ? ORDER BY updated_at',
      p.id,
    ),
    companies: [...companies.values()].sort(
      (a, b) => Number(!!a.ended) - Number(!!b.ended) || b.since.localeCompare(a.since),
    ),
    people: [...members.values()].sort((a, b) => a.name.localeCompare(b.name)),
    sources: all<{ table_id: string | null; record_id: string; said: string; at: string }>(
      people.db,
      `SELECT table_id, record_id, said, at FROM people_sources WHERE person_id IN (${marks})
       ORDER BY at`,
      ...ids,
    ).map((s) => ({
      table: s.table_id,
      record: s.record_id,
      said: parse<Said>(s.said, { kind: p.kind, name: '', rank: 0, keys: {} }),
      at: s.at,
    })),
    contact: contact(people, p.id),
    createdAt: p.created_at,
  }
}

// Who a person field's value names: one of the person's people by their id, an address they
// hold, or a name only one of them has. Anyone else is refused in words (a wall: a person field
// never holds a stranger's name as text).
export function ref(people: People, said: string): string {
  const v = said.trim()
  if (!v) throw new Refused('A person field needs someone.')
  const p = people.row(v)
  if (p) {
    if (p.kind !== 'person') throw new Refused(`${p.name} is a company, not a person.`)
    return people.root(p.id)
  }
  if (isEmail(v.toLowerCase())) {
    const id = people.byKey('email', v)
    if (id) return id
    throw new Refused(
      `No one among the person's people has ${v}. Keep the address in an email field; once they write to each other, they are one of their people.`,
    )
  }
  const named = all<{ id: string }>(
    people.db,
    "SELECT id FROM people WHERE kind = 'person' AND merged_into IS NULL AND lower(name) = lower(?)",
    v,
  )
  if (named.length === 1) return (named[0] as { id: string }).id
  if (named.length > 1)
    throw new Refused(
      `${named.length} of the person's people are called ${v}: name one by their email or id (view people).`,
    )
  throw new Refused(`No one called ${v} among the person's people (view people).`)
}

// The rows of the person's modules that name someone: a person field holding them, or an email
// field holding an address of theirs. A connection's own tables stay out: their mail and
// meetings are the history.
export function rowsNaming(
  people: People,
  id: string,
): { table: string; record: string; field: string }[] {
  const ids = people.parts(id)
  const emails = people.keysOf(ids).email ?? []
  const out: { table: string; record: string; field: string }[] = []
  for (const t of people.shape.tables()) {
    if (t.hidden) continue
    for (const f of t.fields) {
      const values = f.kind === 'person' ? ids : f.kind === 'email' ? emails : []
      if (!values.length) continue
      for (const id of people.records?.idsWhere(t.id, f.id, values) ?? [])
        if (!out.some((o) => o.record === id)) out.push({ table: t.id, record: id, field: f.name })
    }
  }
  return out
}

// For everyone at once: the rows of the person's modules that name them (a person field, or an
// email field holding one of their addresses), counted by table and field.
export function namings(
  people: People,
): Map<string, { table: string; field: string; rows: number }[]> {
  const owner = new Map<string, string>()
  for (const k of all<{ value: string; person_id: string }>(
    people.db,
    "SELECT value, person_id FROM people_keys WHERE key = 'email'",
  ))
    owner.set(k.value, people.root(k.person_id))
  const out = new Map<string, Map<string, { table: string; field: string; rows: number }>>()
  for (const t of people.shape.tables()) {
    if (t.hidden) continue
    for (const f of t.fields) {
      if (f.kind !== 'person' && f.kind !== 'email') continue
      for (const { value } of people.records?.column(t.id, f.id) ?? []) {
        const v = typeof value === 'string' ? value : ''
        if (!v) continue
        const who =
          f.kind === 'person'
            ? people.row(v)
              ? people.root(v)
              : undefined
            : owner.get(v.trim().toLowerCase())
        if (!who) continue
        const mine = out.get(who) ?? new Map()
        const key = `${t.name}\u0000${f.name}`
        const seen = mine.get(key) ?? { table: t.name, field: f.name, rows: 0 }
        seen.rows++
        mine.set(key, seen)
        out.set(who, mine)
      }
    }
  }
  return new Map([...out].map(([k, v]) => [k, [...v.values()]]))
}

// The names of people a person field holds, for showing.
export function names(people: People, ids: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const id of ids) {
    const p = people.row(people.root(id))
    if (p) out[id] = p.name
  }
  return out
}

// Messages and meetings with someone, newest first, each with what it was about.
export function history(
  people: People,
  id: string,
  limit = 100,
): {
  at: string
  channel: string
  by: 'you' | 'them' | null
  about: string | null
  record: string
  table: string
}[] {
  const ids = people.parts(id)
  const marks = ids.map(() => '?').join(', ')
  return all<{
    record_id: string
    channel: string
    at: string
    started_by: 'you' | 'them' | null
    table_id: string
  }>(
    people.db,
    `SELECT e.record_id, e.channel, e.at, e.started_by, r.table_id FROM exchanges e
       JOIN people_keys k ON k.key = e.key AND k.value = e.value
       JOIN records r ON r.id = e.record_id
     WHERE k.person_id IN (${marks})
     GROUP BY e.record_id ORDER BY e.at DESC LIMIT ?`,
    ...ids,
    limit,
  ).map((r) => {
    const t = people.shape.table(r.table_id)
    const map = t?.people
    const field =
      t && map?.each === 'exchange' && map.about
        ? t.fields.find((f) => f.name.toLowerCase() === map.about?.toLowerCase())
        : undefined
    const about = field ? text(people.records?.rawValues(r.record_id)?.vals[field.id]).trim() : ''
    return {
      at: r.at,
      channel: r.channel,
      by: r.started_by,
      about: about || null,
      record: r.record_id,
      table: r.table_id,
    }
  })
}

// Everyone, or every company, in one read: each with how to reach them, where they work and
// the last contact; the most recently in touch first.
export function list(people: People, kind: Kind = 'person', words = ''): PersonLine[] {
  const { days } = people.judgements()
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const until = now()
  const rows = all<{
    id: string
    name: string
    emails: string | null
    phones: string | null
    domains: string | null
    companies: string | null
    titles: string | null
    last: string | null
    count: number | null
    first: string | null
    people: number | null
    tables: string | null
  }>(
    people.db,
    `WITH RECURSIVE up (id, root) AS (
       SELECT id, id FROM people WHERE merged_into IS NULL
       UNION ALL SELECT p.id, up.root FROM people p JOIN up ON p.merged_into = up.id
     ),
     keys AS MATERIALIZED (
       SELECT up.root, k.key, k.value FROM people_keys k JOIN up ON up.id = k.person_id
     ),
     kagg AS (
       SELECT root,
         group_concat(CASE WHEN key = 'email' THEN value END, char(31)) AS emails,
         group_concat(CASE WHEN key = 'phone' THEN value END, char(31)) AS phones,
         group_concat(CASE WHEN key = 'domain' THEN value END, char(31)) AS domains
       FROM keys GROUP BY root
     ),
     ex AS MATERIALIZED (
       SELECT keys.root, e.at, e.started_by FROM exchanges e
         JOIN keys ON keys.key = e.key AND keys.value = e.value WHERE e.at <= ?
     ),
     eagg AS (SELECT root, max(at) AS last, sum(at >= ?) AS count FROM ex GROUP BY root),
     efirst AS (
       SELECT root, started_by FROM (
         SELECT root, started_by, row_number() OVER (PARTITION BY root ORDER BY at) AS n
         FROM ex WHERE at >= ? AND started_by IS NOT NULL
       ) WHERE n = 1
     ),
     links AS MATERIALIZED (
       SELECT DISTINCT a.root AS person, b.root AS company, l.title FROM people_links l
         JOIN up a ON a.id = l.person_id JOIN up b ON b.id = l.company_id
       WHERE l.ended_at IS NULL
     ),
     works AS (
       SELECT person AS root, group_concat(name, char(31)) AS companies FROM (
         SELECT DISTINCT links.person, c.name FROM links JOIN people c ON c.id = links.company
       ) GROUP BY person
     ),
     titled AS (
       SELECT person AS root, group_concat(title, char(31)) AS titles FROM (
         SELECT DISTINCT person, title FROM links WHERE title IS NOT NULL
       ) GROUP BY person
     ),
     staff AS (SELECT company AS root, count(DISTINCT person) AS n FROM links GROUP BY company),
     said AS (
       SELECT root, group_concat(coalesce(table_id, ''), char(31)) AS tables FROM (
         SELECT DISTINCT up.root, s.table_id FROM people_sources s JOIN up ON up.id = s.person_id
       ) GROUP BY root
     )
     SELECT p.id, p.name, kagg.emails, kagg.phones, kagg.domains, works.companies, titled.titles,
       eagg.last, eagg.count, efirst.started_by AS first, staff.n AS people, said.tables
     FROM people p
       LEFT JOIN kagg ON kagg.root = p.id LEFT JOIN eagg ON eagg.root = p.id
       LEFT JOIN efirst ON efirst.root = p.id LEFT JOIN works ON works.root = p.id
       LEFT JOIN titled ON titled.root = p.id LEFT JOIN staff ON staff.root = p.id
       LEFT JOIN said ON said.root = p.id
     WHERE p.merged_into IS NULL AND p.kind = ?`,
    until,
    since,
    since,
    kind,
  )
  const w = words.trim().toLowerCase()
  const split = (s: string | null) => (s ? s.split('\u001f').filter(Boolean) : [])
  return rows
    .filter(
      (r) =>
        !w ||
        [r.name, r.emails, r.phones, r.companies, r.titles, r.domains].some((x) =>
          (x ?? '').toLowerCase().includes(w),
        ),
    )
    .map((r) => ({
      id: r.id,
      kind,
      name: r.name,
      emails: split(r.emails),
      phones: split(r.phones),
      companies: split(r.companies),
      titles: split(r.titles),
      domains: split(r.domains),
      last: r.last,
      count: Number(r.count ?? 0),
      first: (r.first as 'you' | 'them' | null) ?? null,
      people: Number(r.people ?? 0),
      tables: r.tables === null ? [] : r.tables.split('\u001f').map((t) => t || null),
    }))
    .sort((a, b) => (b.last ?? '').localeCompare(a.last ?? '') || a.name.localeCompare(b.name))
}

export function pairs(people: People, state?: Pair['state']): Pair[] {
  return all<{
    id: string
    a: string
    b: string
    why: string
    state: Pair['state']
    card_id: string | null
  }>(
    people.db,
    `SELECT id, a, b, why, state, card_id FROM people_pairs ${state ? 'WHERE state = ?' : ''} ORDER BY created_at`,
    ...(state ? [state] : []),
  ).map((r) => ({ id: r.id, a: r.a, b: r.b, why: r.why, state: r.state, card: r.card_id }))
}
