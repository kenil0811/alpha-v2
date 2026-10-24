import { all, json, newId, now, one, parse, run, tx } from '../db.ts'
import { append } from '../journal.ts'
import { likelyRegion, phoneKey } from '../phones.ts'
import { findField, type Table, type WriteCtx } from '../shape/index.ts'
import {
  addressList,
  domainOf,
  domainWords,
  isEmail,
  keyLike,
  nameKey,
  profileKey,
  text,
  uniq,
} from './keys.ts'
import { notePair, settle } from './matching.ts'
import type { People } from './people.ts'
import type { Exchange, Keys, Said } from './types.ts'
import { KEYS_OF, PERSONS_WORD, RANK } from './types.ts'

// Who a row names and what exchanges it is, by its table's map.
export function derive(
  people: People,
  table: Table,
  vals: Record<string, unknown>,
): { said: Said[]; exchanges: Exchange[]; yours: string[] } {
  const map = table.people
  const none = { said: [], exchanges: [], yours: [] }
  if (!map) return none
  const v = (name?: string) => (name ? text(vals[findField(table, name).id]).trim() : '')
  const you = new Set(people.batch?.you ?? people.you())
  if (map.each === 'person') {
    const region = people.batch?.region !== undefined ? people.batch.region : people.phoneRegion()
    const name = v(map.name)
    const emails = uniq(
      v(map.emails)
        .split(/[\s,;]+/)
        .map((e) => e.toLowerCase())
        .filter(isEmail),
    )
    // the person's own card: their addresses, never one of their people
    if (map.you && v(map.you.field) === map.you.is)
      return { said: [], exchanges: [], yours: emails }
    if (emails.some((e) => you.has(e))) return none
    const phones = uniq(
      v(map.phones)
        .split(/[,;\n]+/)
        .map((p) => phoneKey(p, region))
        .filter((p) => (p.match(/\d/g) ?? []).length >= 6),
    )
    const profile = profileKey(v(map.profile))
    const company = v(map.company) || null
    const title = v(map.title) || null
    const keys: Keys = {
      ...(emails.length ? { email: emails } : {}),
      ...(phones.length ? { phone: phones } : {}),
      ...(profile ? { profile: [profile] } : {}),
    }
    // a card for a company itself: its name is its company's
    if (name && company && nameKey(name) === nameKey(company) && !title)
      return {
        said: [
          {
            kind: 'company',
            name: company,
            rank: RANK.row,
            keys: companyKeys(people, company, emails),
          },
        ],
        exchanges: [],
        yours: [],
      }
    const shown = name || emails[0] || phones[0] || profile
    if (!shown) return none
    return {
      said: [
        {
          kind: 'person',
          name: shown,
          rank: name && !keyLike(name) ? RANK.row : RANK.key,
          keys,
          company,
          title,
        },
      ],
      exchanges: [],
      yours: [],
    }
  }
  const at = v(map.at)
  if (!at || Number.isNaN(Date.parse(at))) return none
  const sent = map.sent ? v(map.sent.field) === map.sent.is : false
  const from = map.from ? addressList(v(map.from)) : []
  const yours = [
    ...(sent ? from.map((a) => a.email) : []),
    ...(map.you ? addressList(v(map.you)).map((a) => a.email) : []),
  ]
  for (const e of yours) you.add(e)
  const person = (a: { name: string | null; email: string }): Said => ({
    kind: 'person',
    name: a.name ?? a.email,
    rank: a.name && !keyLike(a.name) ? RANK.header : RANK.key,
    keys: { email: [a.email] },
  })
  const list = (fields: string[] | undefined) => {
    const seen = new Map<string, { name: string | null; email: string }>()
    for (const f of fields ?? [])
      for (const a of addressList(v(f))) if (!seen.get(a.email)?.name) seen.set(a.email, a)
    return [...seen.values()].filter((a) => !you.has(a.email))
  }
  if (map.with?.length) {
    const others = list(map.with)
    // the person is one of the meeting's people, at it on the list or not
    if (!others.length || others.length + 1 > people.judgements().most)
      return { said: [], exchanges: [], yours }
    // who asked for it, when the row says: the organizer
    const organizer = map.by ? addressList(v(map.by))[0]?.email : undefined
    const by = !organizer ? null : you.has(organizer) ? ('you' as const) : ('them' as const)
    return {
      said: others.map(person),
      exchanges: others.map((a) => ({ value: a.email, channel: map.channel, at, by })),
      yours,
    }
  }
  if (sent) {
    // only those the person writes to become people (Kenil, 21 Oct): a reply is a message sent
    const to = list(map.to)
    return {
      said: to.map(person),
      exchanges: to.map((a) => ({ value: a.email, channel: map.channel, at, by: 'you' })),
      yours,
    }
  }
  return {
    said: [],
    exchanges: from
      .filter((a) => !you.has(a.email))
      .map((a) => ({ value: a.email, channel: map.channel, at, by: 'them' as const })),
    yours,
  }
}

export function companyKeys(people: People, company: string | null, emails: string[]): Keys {
  const { services, seconds } = people.judgements()
  const domains = uniq(
    emails.map((e) => domainOf(e, services, seconds)).filter((d): d is string => !!d),
  )
  return {
    ...(domains.length ? { domain: domains.slice(0, 1) } : {}),
    ...(company ? { company: [nameKey(company)] } : {}),
  }
}

// The companies a person's row names: one per address domain that is no mail service, and the
// company it names, which goes with the first such domain (Oakmill and oakmill.com are one).
export function companiesOf(people: People, s: Said): Said[] {
  const { services, seconds } = people.judgements()
  const domains = uniq(
    (s.keys.email ?? []).map((e) => domainOf(e, services, seconds)).filter((d): d is string => !!d),
  )
  const out: Said[] = domains.map((d, i) =>
    s.company && i === 0
      ? {
          kind: 'company',
          name: s.company,
          rank: RANK.row,
          keys: { domain: [d], company: [nameKey(s.company)] },
          title: s.title ?? null,
        }
      : { kind: 'company', name: domainWords(d), rank: RANK.key, keys: { domain: [d] } },
  )
  if (s.company && !domains.length)
    out.push({
      kind: 'company',
      name: s.company,
      rank: RANK.row,
      keys: { company: [nameKey(s.company)] },
      title: s.title ?? null,
    })
  return out
}

// After rows of a table were added or changed: who they name, again. Inside the write's
// transaction; one journal line for what was new.
export function rows(people: People, table: Table, ids: string[], ctx: WriteCtx): void {
  if (!table.people || !ids.length) return
  tx(people.db, () => {
    people.met = { people: 0, companies: 0 }
    const outer = people.batch
    people.batch = { you: people.you(), judgements: people.readJudgements() }
    // the country a number without its code is read in: from the numbers kept and these rows'
    // own, worked out once for the whole landing
    const map = table.people
    if (map?.each === 'person' && map.phones) {
      const f = findField(table, map.phones)
      const theirs = (people.records?.valuesOf(ids, f.id) ?? []).flatMap((v) =>
        String(v ?? '')
          .split(/[,;\n]+/)
          .map((x) => x.trim()),
      )
      const kept = all<{ value: string }>(
        people.db,
        "SELECT value FROM people_keys WHERE key = 'phone' AND value LIKE '+%'",
      ).map((r) => r.value)
      people.batch.region = likelyRegion([
        ...kept,
        ...theirs
          .filter((x) => x.startsWith('+') || x.startsWith('00'))
          .map((x) => phoneKey(x, null)),
      ])
    }
    try {
      for (const id of ids) landRecord(people, table, id)
    } finally {
      people.batch = outer
    }
    say(people, table, ctx)
    if (people.changed) settle(people)
  })
}

// Before rows are removed: what they alone brought goes with them.
export function gone(people: People, ids: string[]): void {
  if (!ids.length) return
  tx(people.db, () => forget(people, ids))
}

export function say(people: People, table: Table, ctx: WriteCtx): void {
  const { people: persons, companies } = people.met
  if (!persons && !companies) return
  const parts = [
    persons ? `${persons} ${persons === 1 ? 'person' : 'people'}` : '',
    companies ? `${companies} ${companies === 1 ? 'company' : 'companies'}` : '',
  ].filter(Boolean)
  append(people.db, {
    actor: ctx.actor,
    kind: 'people',
    words: `Met ${parts.join(' and ')} in ${table.name}.`,
    data: { table: table.id, ...people.met },
    user: ctx.user ?? null,
    turn: ctx.turn ?? null,
    run: ctx.run ?? null,
    module: table.module.id,
  })
}

export function landRecord(people: People, table: Table, recordId: string): void {
  const r = people.records?.rawValues(recordId)
  if (!r || r.table.id !== table.id) {
    forget(people, [recordId])
    return
  }
  const { said, exchanges, yours } = derive(people, table, r.vals)
  const learned = people.learnYou(yours)
  const before = all<{ person_id: string }>(
    people.db,
    'SELECT person_id FROM people_sources WHERE record_id = ?',
    recordId,
  ).map((x) => x.person_id)
  const named = new Set<string>()
  const links = new Set<string>()
  const touched = new Set<string>(before)
  // a row that is one person stays theirs when its keys change (a contact's new address)
  const prior =
    table.people?.each === 'person'
      ? (before.find((p) => people.row(p)?.kind === said[0]?.kind) ?? null)
      : null
  for (const s of said) {
    const id = resolve(people, s, recordId, table.id, s.kind === said[0]?.kind ? prior : null)
    named.add(id)
    touched.add(id)
    if (s.kind !== 'person') continue
    for (const c of companiesOf(people, s)) {
      const cid = resolve(people, c, recordId, table.id, null)
      named.add(cid)
      touched.add(cid)
      links.add(link(people, id, cid, c.title ?? null, recordId))
    }
  }
  // links this row gave that it gives no more: gone with a person it no longer names, ended
  // with a company it no longer names (the company kept, with the dates)
  const at = now()
  for (const l of all<{ id: string; person_id: string; company_id: string; ended_at: string }>(
    people.db,
    'SELECT id, person_id, company_id, ended_at FROM people_links WHERE record_id = ?',
    recordId,
  )) {
    if (links.has(l.id)) continue
    if (!named.has(l.person_id)) run(people.db, 'DELETE FROM people_links WHERE id = ?', l.id)
    else if (!l.ended_at)
      run(people.db, 'UPDATE people_links SET ended_at = ? WHERE id = ?', at, l.id)
  }
  const linked = new Set(
    all<{ company_id: string }>(
      people.db,
      'SELECT DISTINCT company_id FROM people_links WHERE record_id = ?',
      recordId,
    ).map((x) => x.company_id),
  )
  for (const p of before)
    if (!named.has(p) && !linked.has(p))
      run(
        people.db,
        'DELETE FROM people_sources WHERE record_id = ? AND person_id = ?',
        recordId,
        p,
      )
  run(people.db, 'DELETE FROM exchanges WHERE record_id = ?', recordId)
  for (const e of exchanges)
    run(
      people.db,
      `INSERT INTO exchanges (record_id, key, value, channel, at, started_by) VALUES (?, 'email', ?, ?, ?, ?)
       ON CONFLICT (record_id, key, value) DO NOTHING`,
      recordId,
      e.value,
      e.channel,
      e.at,
      e.by,
    )
  sweep(people, touched)
  if (learned.length) relandNaming(people, learned, recordId)
}

// An address found to be the person's own: the rows that named it as someone else, read again.
export function relandNaming(people: People, emails: string[], except: string): void {
  const marks = emails.map(() => '?').join(', ')
  const records = all<{ record_id: string }>(
    people.db,
    `SELECT DISTINCT s.record_id FROM people_sources s, json_each(s.said, '$.keys.email') j
       WHERE j.value IN (${marks}) AND s.record_id != ?
     UNION SELECT DISTINCT record_id FROM exchanges WHERE key = 'email' AND value IN (${marks})`,
    ...emails,
    PERSONS_WORD,
    ...emails,
  )
  for (const { record_id } of records) {
    if (record_id === except) continue
    const t = one<{ table_id: string }>(
      people.db,
      'SELECT table_id FROM records WHERE id = ?',
      record_id,
    )
    const table = t ? people.shape.table(t.table_id) : undefined
    if (table?.people) landRecord(people, table, record_id)
    else forget(people, [record_id])
  }
}

// The one these keys name: the first owner of any of them (the pair noted when they name two),
// else the one this row is (prior), else someone new. Keys no one holds become theirs.
export function resolve(
  people: People,
  s: Said,
  recordId: string,
  tableId: string | null,
  prior: string | null,
): string {
  const keyPairs = KEYS_OF[s.kind].flatMap((k) => (s.keys[k] ?? []).map((v) => [k, v] as const))
  const owners = keyPairs.map(([k, v]) => ({
    k,
    v,
    leaf: one<{ person_id: string }>(
      people.db,
      'SELECT person_id FROM people_keys WHERE key = ? AND value = ?',
      k,
      v,
    )?.person_id,
  }))
  const hits = uniq(owners.map((o) => o.leaf).filter((x): x is string => !!x))
  let leaf: string
  if (hits.length) {
    leaf = hits[0] as string
    const first = people.root(leaf)
    for (const h of hits.slice(1)) {
      const other = people.root(h)
      if (other !== first) notePair(people, first, other, 'a row names both')
    }
  } else {
    if (prior && people.row(prior)) leaf = prior
    else {
      leaf = newId(s.kind === 'person' ? 'p' : 'co')
      const at = now()
      run(
        people.db,
        'INSERT INTO people (id, kind, name, rank, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        leaf,
        s.kind,
        s.name,
        s.rank,
        at,
        at,
      )
      if (s.kind === 'person') people.met.people++
      else people.met.companies++
      people.changed = true
    }
  }
  for (const o of owners)
    if (!o.leaf)
      run(
        people.db,
        'INSERT OR IGNORE INTO people_keys (key, value, person_id) VALUES (?, ?, ?)',
        o.k,
        o.v,
        leaf,
      )
  run(
    people.db,
    `INSERT INTO people_sources (person_id, record_id, table_id, said, at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (record_id, person_id) DO UPDATE SET said = excluded.said`,
    leaf,
    recordId,
    tableId,
    json(s),
    now(),
  )
  return leaf
}

// Someone at a company as a row says, with their title; a new title ends the old one.
export function link(
  people: People,
  person: string,
  company: string,
  title: string | null,
  recordId: string,
): string {
  const open = one<{ id: string; title: string | null }>(
    people.db,
    'SELECT id, title FROM people_links WHERE person_id = ? AND company_id = ? AND record_id = ? AND ended_at IS NULL',
    person,
    company,
    recordId,
  )
  if (open && (open.title ?? null) === title) return open.id
  const at = now()
  people.changed = true
  if (open) run(people.db, 'UPDATE people_links SET ended_at = ? WHERE id = ?', at, open.id)
  const id = newId('pl')
  run(
    people.db,
    'INSERT INTO people_links (id, person_id, company_id, title, record_id, started_at) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    person,
    company,
    title,
    recordId,
    at,
  )
  return id
}

// Rows gone: their sources, links and exchanges, and whoever only they gave.
export function forget(people: People, recordIds: string[]): void {
  const touched = new Set<string>()
  for (const id of recordIds) {
    if (id === PERSONS_WORD) continue
    for (const s of all<{ person_id: string }>(
      people.db,
      'SELECT person_id FROM people_sources WHERE record_id = ?',
      id,
    ))
      touched.add(s.person_id)
    for (const l of all<{ person_id: string; company_id: string }>(
      people.db,
      'SELECT person_id, company_id FROM people_links WHERE record_id = ?',
      id,
    )) {
      touched.add(l.person_id)
      touched.add(l.company_id)
    }
    run(people.db, 'DELETE FROM people_sources WHERE record_id = ?', id)
    run(people.db, 'DELETE FROM people_links WHERE record_id = ?', id)
    run(people.db, 'DELETE FROM exchanges WHERE record_id = ?', id)
  }
  sweep(people, touched)
}

// Whoever no row and no word of the person's gives any more goes, with their keys, links and
// pairs; the keys a person's rows no longer state are let go, to another who states them.
export function sweep(people: People, ids: Set<string>): void {
  for (const id of ids) sweepOne(people, id)
}

export function sweepOne(people: People, id: string): void {
  const p = people.row(id)
  if (!p) return
  const sources = all<{ said: string }>(
    people.db,
    'SELECT said FROM people_sources WHERE person_id = ?',
    id,
  ).map((s) => parse<Said>(s.said, { kind: p.kind, name: '', rank: 0, keys: {} }))
  const children = Number(
    one<{ n: number }>(people.db, 'SELECT count(*) AS n FROM people WHERE merged_into = ?', id)
      ?.n ?? 0,
  )
  if (!sources.length && !children) {
    run(people.db, 'DELETE FROM people_links WHERE person_id = ? OR company_id = ?', id, id)
    run(people.db, 'DELETE FROM people_pairs WHERE a = ? OR b = ?', id, id)
    run(people.db, 'DELETE FROM people_keys WHERE person_id = ?', id)
    run(people.db, 'DELETE FROM people WHERE id = ?', id)
    people.changed = true
    if (p.merged_into) sweepOne(people, p.merged_into)
    return
  }
  const stated = new Set(
    sources.flatMap((s) =>
      Object.entries(s.keys).flatMap(([k, vs]) => (vs ?? []).map((v) => `${k}\u0000${v}`)),
    ),
  )
  for (const k of people.ownKeys(id)) {
    if (stated.has(`${k.key}\u0000${k.value}`)) continue
    const other = one<{ person_id: string }>(
      people.db,
      `SELECT s.person_id FROM people_sources s, json_each(s.said, '$.keys.' || ?) j
       WHERE j.value = ? AND s.person_id != ? LIMIT 1`,
      k.key,
      k.value,
      id,
    )
    if (other)
      run(
        people.db,
        'UPDATE people_keys SET person_id = ? WHERE key = ? AND value = ?',
        other.person_id,
        k.key,
        k.value,
      )
    else run(people.db, 'DELETE FROM people_keys WHERE key = ? AND value = ?', k.key, k.value)
  }
  rename(people, id)
}

// A name from the best of what its rows said and its merged ones' names; the earliest wins a
// tie. Up through what it is merged into.
export function rename(people: People, id: string): void {
  const p = people.row(id)
  if (!p) return
  const said = all<{ said: string; at: string }>(
    people.db,
    'SELECT said, at FROM people_sources WHERE person_id = ? ORDER BY at, rowid',
    id,
  ).map((s) => parse<Said>(s.said, { kind: p.kind, name: '', rank: 0, keys: {} }))
  const children = all<{ name: string; rank: number }>(
    people.db,
    'SELECT name, rank FROM people WHERE merged_into = ? ORDER BY created_at',
    id,
  )
  let best = { name: p.name, rank: 0 }
  for (const c of [...said, ...children])
    if (c.name && c.rank > best.rank) best = { name: c.name, rank: c.rank }
  if (best.rank && best.name !== p.name) people.changed = true
  if (best.rank && (best.name !== p.name || best.rank !== p.rank))
    run(
      people.db,
      'UPDATE people SET name = ?, rank = ?, updated_at = ? WHERE id = ?',
      best.name,
      best.rank,
      now(),
      id,
    )
  if (p.merged_into) rename(people, p.merged_into)
}
