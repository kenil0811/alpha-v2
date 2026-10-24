// People and companies (design §4): one each, however many rows name them. They are derived from
// the rows of tables that say how their rows name people (a contact card, the recipients of a
// message the person sent, a meeting's attendees) and from the person's own word. A key (an
// email, a phone in E.164, a profile link, a company's domain or name) is one person's or
// company's: the one whose row first gave it. A row whose keys name two people never merges them:
// the pair is noted for the person to decide. A merge keeps both, the one merged pointing at the
// other, so Unmerge gives it back with its own keys and rows. Removing a row takes away only what
// it alone brought.
import type { CountryCode } from 'libphonenumber-js/max'
import { config } from '../config.ts'
import type { Cards } from './cards.ts'
import { all, type Db, json, newId, now, one, parse, run, tx } from './db.ts'
import { append } from './journal.ts'
import { Refused } from './kinds.ts'
import { likelyRegion, phoneKey, phoneWords } from './phones.ts'
import type { Records } from './records/index.ts'
import { findField, type PeopleMap, type Shape, type Table, type WriteCtx } from './shape/index.ts'

export type KeyKind = 'email' | 'phone' | 'profile' | 'domain' | 'company'
export type Keys = Partial<Record<KeyKind, string[]>>
type Kind = 'person' | 'company'

const KEYS_OF: Record<Kind, KeyKind[]> = {
  person: ['email', 'phone', 'profile'],
  company: ['domain', 'company'],
}

// How good a name is: the person's word, a row that is the person (a contact card), a name a
// message or meeting gives, a key standing in for a name.
export const RANK = { person: 4, row: 3, header: 2, key: 1 } as const

// What a row said of someone.
export interface Said {
  kind: Kind
  name: string
  rank: number
  keys: Keys
  company?: string | null
  title?: string | null
}

interface Exchange {
  value: string // the address it reached them at
  channel: string
  at: string
  by: 'you' | 'them' | null
}

// The person's own word is a source like a row, under this record.
export const PERSONS_WORD = 'person'

// The rules rows are read for people by; raised when they change, so every row is read again.
// 2: companies by their main domain, named in words (21 Oct).
export const PEOPLE_RULES = 2

export interface Contact {
  days: number
  last: string | null
  count: number
  channels: { channel: string; count: number }[]
  first: 'you' | 'them' | null // who wrote first in those days
}

export interface PersonOut {
  id: string
  kind: Kind
  name: string
  keys: Keys
  merged: { id: string; name: string }[] // merged into it, each as it was on its own
  companies: {
    id: string
    name: string
    title: string | null
    since: string
    ended: string | null
  }[]
  people: { id: string; name: string; title: string | null }[] // a company's, now
  sources: { table: string | null; record: string; said: Said; at: string }[]
  contact: Contact
  createdAt: string
}

export interface PersonLine {
  id: string
  kind: Kind
  name: string
  emails: string[]
  phones: string[]
  companies: string[]
  titles: string[] // their titles now, as rows give them
  domains: string[]
  last: string | null
  count: number
  first: 'you' | 'them' | null
  people: number // a company's, now
}

export interface Pair {
  id: string
  a: string
  b: string
  why: string
  state: 'found' | 'proposed' | 'merged' | 'apart' | 'withdrawn'
  card: string | null
}

// Why two may be one, as the card says it.
export const SAME_NAME = 'the same name'
export const SAME_PLACE = 'the same name and company'
export const NAMES_BOTH = 'a row names both'

// One side of a pair on its card: enough to tell the two apart.
export interface Side {
  id: string
  kind: Kind
  name: string
  emails: string[]
  phones: string[]
  profile: string | null
  companies: string[]
  from: string[] // the tables it came from
  last: string | null
  count: number
}

export interface MatchView {
  pairs: { id: string; why: string; state: Pair['state']; a: Side; b: Side }[]
  open: number
  samePlace: number // undecided pairs with the same name and company
}

// ---- words and keys -------------------------------------------------------------------------

// A name as it is compared: case and spacing aside, outer punctuation dropped.
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
    .replace(/^[\s.,;]+|[\s.,;]+$/g, '')
}

export function isEmail(s: string): boolean {
  return /^[^@\s<>,;"']+@[^@\s<>,;"']+\.[^@\s<>,;"']+$/.test(s)
}

// A name that is only a way to reach someone: an address, a number, a link.
function keyLike(name: string): boolean {
  const t = name.trim()
  return (
    t.includes('@') ||
    /^https?:\/\//i.test(t) ||
    ((t.match(/\d/g) ?? []).length >= 6 && !/\p{L}/u.test(t))
  )
}

// A profile link as it is compared: no scheme, no www, no query, no trailing slash.
export function profileKey(url: string): string | null {
  const t = url.trim().toLowerCase()
  if (!t) return null
  const bare = t
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
  return bare.includes('.') && bare.includes('/') ? bare : null
}

// The domain an address says its owner belongs to; none for a mail service everyone uses.
// The domain under its public suffix: alerts.sbi.co.in is sbi.co.in, mail.acme.com is acme.com.
export function mainDomain(domain: string, seconds: Set<string>): string {
  const labels = domain.toLowerCase().split('.').filter(Boolean)
  const tld = labels.at(-1) ?? ''
  const second = labels.at(-2) ?? ''
  const keep = tld.length === 2 && seconds.has(second) ? 3 : 2
  return labels.slice(-keep).join('.')
}

// The domain an address says its owner belongs to; none for a mail service everyone uses.
export function domainOf(
  email: string,
  services: Set<string>,
  seconds: Set<string> = new Set(),
): string | null {
  const at = email.lastIndexOf('@')
  const whole = at < 0 ? '' : email.slice(at + 1).toLowerCase()
  if (!whole.includes('.') || services.has(whole)) return null
  const d = mainDomain(whole, seconds)
  return services.has(d) ? null : d
}

// A company's name until a row names it: restopros.com is Restopros, chase-global.com is Chase
// Global.
export function domainWords(domain: string): string {
  return (domain.split('.')[0] ?? domain)
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// Addresses as a message writes them: Name <address>, another@address, "Last, First" <x@y>.
export function addressList(text: string): { name: string | null; email: string }[] {
  const out = new Map<string, string | null>()
  for (const piece of text.split(/(?<=>)\s*[,;]\s*/)) {
    const named = piece.match(/^([\s\S]*)<([^<>]+)>\s*$/)
    const parts = (named ? (named[1] ?? '') : piece).split(/\s*[,;]\s*/).map((p) => p.trim())
    if (!named) {
      for (const p of parts)
        if (isEmail(p) && !out.has(p.toLowerCase())) out.set(p.toLowerCase(), null)
      continue
    }
    let i = 0
    for (; i < parts.length - 1 && isEmail(parts[i] ?? ''); i++) {
      const e = (parts[i] as string).toLowerCase()
      if (!out.has(e)) out.set(e, null)
    }
    const email = (named[2] ?? '').trim().toLowerCase()
    if (!isEmail(email)) continue
    const name = parts
      .slice(i)
      .join(', ')
      .replace(/^["'\s]+|["'\s]+$/g, '')
    const clean = name && name.toLowerCase() !== email && !isEmail(name) ? name : null
    if (!out.get(email)) out.set(email, clean)
  }
  return [...out].map(([email, name]) => ({ email, name }))
}

const text = (v: unknown): string =>
  v === null || v === undefined ? '' : Array.isArray(v) ? v.join(', ') : String(v)

const uniq = <T>(xs: T[]): T[] => [...new Set(xs)]

// ---- the store ------------------------------------------------------------------------------

interface PersonRow {
  id: string
  kind: Kind
  name: string
  rank: number
  merged_into: string | null
  created_at: string
}

export class People {
  // The rows' own store, set by the world: what a row holds is read through it.
  records: Records | null = null
  private db: Db
  private shape: Shape
  private cards: Cards
  private region: { count: number; region: CountryCode | null } | null = null
  private met = { people: 0, companies: 0 }
  // whether anyone came, went, was renamed or moved company since likely ones were last looked for
  private changed = false
  // what one landing reads once: the person's addresses and the judgements
  private batch: {
    you: Set<string>
    judgements: ReturnType<People['readJudgements']>
    region?: CountryCode | null
  } | null = null

  constructor(db: Db, shape: Shape, cards: Cards) {
    this.db = db
    this.shape = shape
    this.cards = cards
  }

  // ---- reading rows -------------------------------------------------------------------------

  private judgements() {
    return this.batch?.judgements ?? this.readJudgements()
  }

  private readJudgements() {
    const c = config.people()
    return {
      services: new Set(c.mail_services.map((s) => s.toLowerCase())),
      seconds: new Set(c.second_levels.map((s) => s.toLowerCase())),
      most: c.meeting_most_people,
      days: c.contact_days,
    }
  }

  // The country a phone written without its code is read in.
  private phoneRegion(): CountryCode | null {
    const count = Number(
      one<{ n: number }>(
        this.db,
        "SELECT count(*) AS n FROM people_keys WHERE key = 'phone' AND value LIKE '+%'",
      )?.n ?? 0,
    )
    if (!this.region || this.region.count !== count) {
      const numbers = all<{ value: string }>(
        this.db,
        "SELECT value FROM people_keys WHERE key = 'phone' AND value LIKE '+%'",
      ).map((r) => r.value)
      this.region = { count, region: likelyRegion(numbers) }
    }
    return this.region.region
  }

  // The person's own addresses: their connections' accounts and what they send from.
  you(): Set<string> {
    const kept = parse<string[]>(
      one<{ value: string }>(this.db, "SELECT value FROM meta WHERE key = 'people_you'")?.value,
      [],
    )
    const accounts = all<{ account: string }>(this.db, 'SELECT account FROM connections')
      .map((a) => a.account.trim().toLowerCase())
      .filter(isEmail)
    return new Set([...kept, ...accounts])
  }

  private learnYou(emails: string[]): string[] {
    if (!emails.length) return []
    const known = this.you()
    const fresh = uniq(emails).filter((e) => !known.has(e))
    if (!fresh.length) return []
    const kept = parse<string[]>(
      one<{ value: string }>(this.db, "SELECT value FROM meta WHERE key = 'people_you'")?.value,
      [],
    )
    run(
      this.db,
      "INSERT INTO meta (key, value) VALUES ('people_you', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      json(uniq([...kept, ...fresh]).sort()),
    )
    if (this.batch) for (const e of fresh) this.batch.you.add(e)
    return fresh
  }

  // Who a row names and what exchanges it is, by its table's map.
  derive(
    table: Table,
    vals: Record<string, unknown>,
  ): { said: Said[]; exchanges: Exchange[]; yours: string[] } {
    const map = table.people
    const none = { said: [], exchanges: [], yours: [] }
    if (!map) return none
    const v = (name?: string) => (name ? text(vals[findField(table, name).id]).trim() : '')
    const you = new Set(this.batch?.you ?? this.you())
    if (map.each === 'person') {
      const region = this.batch?.region !== undefined ? this.batch.region : this.phoneRegion()
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
              keys: this.companyKeys(company, emails),
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
      if (!others.length || others.length + 1 > this.judgements().most)
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

  private companyKeys(company: string | null, emails: string[]): Keys {
    const { services, seconds } = this.judgements()
    const domains = uniq(
      emails.map((e) => domainOf(e, services, seconds)).filter((d): d is string => !!d),
    )
    return {
      ...(domains.length ? { domain: domains.slice(0, 1) } : {}),
      ...(company ? { company: [nameKey(company)] } : {}),
    }
  }

  // The companies a person's row names: one per address domain that is no mail service, and the
  // company it names, which goes with the first such domain (RestoPros and restopros.com are one).
  private companiesOf(s: Said): Said[] {
    const { services, seconds } = this.judgements()
    const domains = uniq(
      (s.keys.email ?? [])
        .map((e) => domainOf(e, services, seconds))
        .filter((d): d is string => !!d),
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

  // ---- landing ------------------------------------------------------------------------------

  // After rows of a table were added or changed: who they name, again. Inside the write's
  // transaction; one journal line for what was new.
  rows(table: Table, ids: string[], ctx: WriteCtx): void {
    if (!table.people || !ids.length) return
    tx(this.db, () => {
      this.met = { people: 0, companies: 0 }
      const outer = this.batch
      this.batch = { you: this.you(), judgements: this.readJudgements() }
      // the country a number without its code is read in: from the numbers kept and these rows'
      // own, worked out once for the whole landing
      const map = table.people
      if (map?.each === 'person' && map.phones) {
        const f = findField(table, map.phones)
        const theirs = (this.records?.valuesOf(ids, f.id) ?? []).flatMap((v) =>
          String(v ?? '')
            .split(/[,;\n]+/)
            .map((x) => x.trim()),
        )
        const kept = all<{ value: string }>(
          this.db,
          "SELECT value FROM people_keys WHERE key = 'phone' AND value LIKE '+%'",
        ).map((r) => r.value)
        this.batch.region = likelyRegion([
          ...kept,
          ...theirs
            .filter((x) => x.startsWith('+') || x.startsWith('00'))
            .map((x) => phoneKey(x, null)),
        ])
      }
      try {
        for (const id of ids) this.landRecord(table, id)
      } finally {
        this.batch = outer
      }
      this.say(table, ctx)
      if (this.changed) this.settle()
    })
  }

  // Before rows are removed: what they alone brought goes with them.
  gone(ids: string[]): void {
    if (!ids.length) return
    tx(this.db, () => this.forget(ids))
  }

  // A table's map set or changed: every row read again, and what rows it no longer reads named
  // forgotten.
  mapTable(tableId: string, map: PeopleMap | null, ctx: WriteCtx): Table {
    return tx(this.db, () => {
      const before = this.shape.table(tableId)
      const table = this.shape.setPeople(tableId, map, ctx)
      if (JSON.stringify(before?.people) === JSON.stringify(table.people)) return table
      const ids = all<{ id: string }>(
        this.db,
        'SELECT id FROM records WHERE table_id = ? ORDER BY created_at',
        table.id,
      ).map((r) => r.id)
      if (!table.people) this.forget(ids)
      else this.rows(table, ids, ctx)
      return table
    })
  }

  // Everything derived again from every mapped table, under the rules as they are now: each
  // person and company keeps their id, their keys, merges and the person's word; what no row gives
  // any more goes.
  rebuild(ctx: WriteCtx): void {
    tx(this.db, () => {
      const everyone = all<{ id: string }>(this.db, 'SELECT id FROM people').map((r) => r.id)
      run(this.db, 'DELETE FROM people_links')
      run(this.db, 'DELETE FROM exchanges')
      run(this.db, 'DELETE FROM people_sources WHERE record_id != ?', PERSONS_WORD)
      for (const t of this.shape.tables())
        if (t.people)
          this.rows(
            t,
            all<{ id: string }>(
              this.db,
              'SELECT id FROM records WHERE table_id = ? ORDER BY created_at',
              t.id,
            ).map((r) => r.id),
            ctx,
          )
      this.sweep(new Set(everyone))
      this.settle()
    })
  }

  // The rules people are read by, as this Alpha has them: a newer Alpha reads every row again.
  keepRules(ctx: WriteCtx): boolean {
    const was = one<{ value: string }>(
      this.db,
      "SELECT value FROM meta WHERE key = 'people_rules'",
    )?.value
    if (was === String(PEOPLE_RULES)) return false
    tx(this.db, () => {
      if (was !== undefined || this.count() + this.count('company') > 0) this.rebuild(ctx)
      run(
        this.db,
        "INSERT INTO meta (key, value) VALUES ('people_rules', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
        String(PEOPLE_RULES),
      )
    })
    return true
  }

  private say(table: Table, ctx: WriteCtx): void {
    const { people, companies } = this.met
    if (!people && !companies) return
    const parts = [
      people ? `${people} ${people === 1 ? 'person' : 'people'}` : '',
      companies ? `${companies} ${companies === 1 ? 'company' : 'companies'}` : '',
    ].filter(Boolean)
    append(this.db, {
      actor: ctx.actor,
      kind: 'people',
      words: `Met ${parts.join(' and ')} in ${table.name}.`,
      data: { table: table.id, ...this.met },
      user: ctx.user ?? null,
      turn: ctx.turn ?? null,
      run: ctx.run ?? null,
      module: table.module.id,
    })
  }

  private landRecord(table: Table, recordId: string): void {
    const r = this.records?.rawValues(recordId)
    if (!r || r.table.id !== table.id) {
      this.forget([recordId])
      return
    }
    const { said, exchanges, yours } = this.derive(table, r.vals)
    const learned = this.learnYou(yours)
    const before = all<{ person_id: string }>(
      this.db,
      'SELECT person_id FROM people_sources WHERE record_id = ?',
      recordId,
    ).map((x) => x.person_id)
    const named = new Set<string>()
    const links = new Set<string>()
    const touched = new Set<string>(before)
    // a row that is one person stays theirs when its keys change (a contact's new address)
    const prior =
      table.people?.each === 'person'
        ? (before.find((p) => this.row(p)?.kind === said[0]?.kind) ?? null)
        : null
    for (const s of said) {
      const id = this.resolve(s, recordId, table.id, s.kind === said[0]?.kind ? prior : null)
      named.add(id)
      touched.add(id)
      if (s.kind !== 'person') continue
      for (const c of this.companiesOf(s)) {
        const cid = this.resolve(c, recordId, table.id, null)
        named.add(cid)
        touched.add(cid)
        links.add(this.link(id, cid, c.title ?? null, recordId))
      }
    }
    // links this row gave that it gives no more: gone with a person it no longer names, ended
    // with a company it no longer names (the company kept, with the dates)
    const at = now()
    for (const l of all<{ id: string; person_id: string; company_id: string; ended_at: string }>(
      this.db,
      'SELECT id, person_id, company_id, ended_at FROM people_links WHERE record_id = ?',
      recordId,
    )) {
      if (links.has(l.id)) continue
      if (!named.has(l.person_id)) run(this.db, 'DELETE FROM people_links WHERE id = ?', l.id)
      else if (!l.ended_at)
        run(this.db, 'UPDATE people_links SET ended_at = ? WHERE id = ?', at, l.id)
    }
    const linked = new Set(
      all<{ company_id: string }>(
        this.db,
        'SELECT DISTINCT company_id FROM people_links WHERE record_id = ?',
        recordId,
      ).map((x) => x.company_id),
    )
    for (const p of before)
      if (!named.has(p) && !linked.has(p))
        run(
          this.db,
          'DELETE FROM people_sources WHERE record_id = ? AND person_id = ?',
          recordId,
          p,
        )
    run(this.db, 'DELETE FROM exchanges WHERE record_id = ?', recordId)
    for (const e of exchanges)
      run(
        this.db,
        `INSERT INTO exchanges (record_id, key, value, channel, at, started_by) VALUES (?, 'email', ?, ?, ?, ?)
         ON CONFLICT (record_id, key, value) DO NOTHING`,
        recordId,
        e.value,
        e.channel,
        e.at,
        e.by,
      )
    this.sweep(touched)
    if (learned.length) this.relandNaming(learned, recordId)
  }

  // An address found to be the person's own: the rows that named it as someone else, read again.
  private relandNaming(emails: string[], except: string): void {
    const marks = emails.map(() => '?').join(', ')
    const records = all<{ record_id: string }>(
      this.db,
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
        this.db,
        'SELECT table_id FROM records WHERE id = ?',
        record_id,
      )
      const table = t ? this.shape.table(t.table_id) : undefined
      if (table?.people) this.landRecord(table, record_id)
      else this.forget([record_id])
    }
  }

  // The one these keys name: the first owner of any of them (the pair noted when they name two),
  // else the one this row is (prior), else someone new. Keys no one holds become theirs.
  private resolve(s: Said, recordId: string, tableId: string | null, prior: string | null): string {
    const pairs = KEYS_OF[s.kind].flatMap((k) => (s.keys[k] ?? []).map((v) => [k, v] as const))
    const owners = pairs.map(([k, v]) => ({
      k,
      v,
      leaf: one<{ person_id: string }>(
        this.db,
        'SELECT person_id FROM people_keys WHERE key = ? AND value = ?',
        k,
        v,
      )?.person_id,
    }))
    const hits = uniq(owners.map((o) => o.leaf).filter((x): x is string => !!x))
    let leaf: string
    if (hits.length) {
      leaf = hits[0] as string
      const first = this.root(leaf)
      for (const h of hits.slice(1)) {
        const other = this.root(h)
        if (other !== first) this.notePair(first, other, 'a row names both')
      }
    } else {
      if (prior && this.row(prior)) leaf = prior
      else {
        leaf = newId(s.kind === 'person' ? 'p' : 'co')
        const at = now()
        run(
          this.db,
          'INSERT INTO people (id, kind, name, rank, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          leaf,
          s.kind,
          s.name,
          s.rank,
          at,
          at,
        )
        if (s.kind === 'person') this.met.people++
        else this.met.companies++
        this.changed = true
      }
    }
    for (const o of owners)
      if (!o.leaf)
        run(
          this.db,
          'INSERT OR IGNORE INTO people_keys (key, value, person_id) VALUES (?, ?, ?)',
          o.k,
          o.v,
          leaf,
        )
    run(
      this.db,
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
  private link(person: string, company: string, title: string | null, recordId: string): string {
    const open = one<{ id: string; title: string | null }>(
      this.db,
      'SELECT id, title FROM people_links WHERE person_id = ? AND company_id = ? AND record_id = ? AND ended_at IS NULL',
      person,
      company,
      recordId,
    )
    if (open && (open.title ?? null) === title) return open.id
    const at = now()
    this.changed = true
    if (open) run(this.db, 'UPDATE people_links SET ended_at = ? WHERE id = ?', at, open.id)
    const id = newId('pl')
    run(
      this.db,
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
  private forget(recordIds: string[]): void {
    const touched = new Set<string>()
    for (const id of recordIds) {
      if (id === PERSONS_WORD) continue
      for (const s of all<{ person_id: string }>(
        this.db,
        'SELECT person_id FROM people_sources WHERE record_id = ?',
        id,
      ))
        touched.add(s.person_id)
      for (const l of all<{ person_id: string; company_id: string }>(
        this.db,
        'SELECT person_id, company_id FROM people_links WHERE record_id = ?',
        id,
      )) {
        touched.add(l.person_id)
        touched.add(l.company_id)
      }
      run(this.db, 'DELETE FROM people_sources WHERE record_id = ?', id)
      run(this.db, 'DELETE FROM people_links WHERE record_id = ?', id)
      run(this.db, 'DELETE FROM exchanges WHERE record_id = ?', id)
    }
    this.sweep(touched)
  }

  // Whoever no row and no word of the person's gives any more goes, with their keys, links and
  // pairs; the keys a person's rows no longer state are let go, to another who states them.
  private sweep(ids: Set<string>): void {
    for (const id of ids) this.sweepOne(id)
  }

  private sweepOne(id: string): void {
    const p = this.row(id)
    if (!p) return
    const sources = all<{ said: string }>(
      this.db,
      'SELECT said FROM people_sources WHERE person_id = ?',
      id,
    ).map((s) => parse<Said>(s.said, { kind: p.kind, name: '', rank: 0, keys: {} }))
    const children = Number(
      one<{ n: number }>(this.db, 'SELECT count(*) AS n FROM people WHERE merged_into = ?', id)
        ?.n ?? 0,
    )
    if (!sources.length && !children) {
      run(this.db, 'DELETE FROM people_links WHERE person_id = ? OR company_id = ?', id, id)
      run(this.db, 'DELETE FROM people_pairs WHERE a = ? OR b = ?', id, id)
      run(this.db, 'DELETE FROM people_keys WHERE person_id = ?', id)
      run(this.db, 'DELETE FROM people WHERE id = ?', id)
      this.changed = true
      if (p.merged_into) this.sweepOne(p.merged_into)
      return
    }
    const stated = new Set(
      sources.flatMap((s) =>
        Object.entries(s.keys).flatMap(([k, vs]) => (vs ?? []).map((v) => `${k}\u0000${v}`)),
      ),
    )
    for (const k of this.ownKeys(id)) {
      if (stated.has(`${k.key}\u0000${k.value}`)) continue
      const other = one<{ person_id: string }>(
        this.db,
        `SELECT s.person_id FROM people_sources s, json_each(s.said, '$.keys.' || ?) j
         WHERE j.value = ? AND s.person_id != ? LIMIT 1`,
        k.key,
        k.value,
        id,
      )
      if (other)
        run(
          this.db,
          'UPDATE people_keys SET person_id = ? WHERE key = ? AND value = ?',
          other.person_id,
          k.key,
          k.value,
        )
      else run(this.db, 'DELETE FROM people_keys WHERE key = ? AND value = ?', k.key, k.value)
    }
    this.rename(id)
  }

  // A name from the best of what its rows said and its merged ones' names; the earliest wins a
  // tie. Up through what it is merged into.
  private rename(id: string): void {
    const p = this.row(id)
    if (!p) return
    const said = all<{ said: string; at: string }>(
      this.db,
      'SELECT said, at FROM people_sources WHERE person_id = ? ORDER BY at, rowid',
      id,
    ).map((s) => parse<Said>(s.said, { kind: p.kind, name: '', rank: 0, keys: {} }))
    const children = all<{ name: string; rank: number }>(
      this.db,
      'SELECT name, rank FROM people WHERE merged_into = ? ORDER BY created_at',
      id,
    )
    let best = { name: p.name, rank: 0 }
    for (const c of [...said, ...children])
      if (c.name && c.rank > best.rank) best = { name: c.name, rank: c.rank }
    if (best.rank && best.name !== p.name) this.changed = true
    if (best.rank && (best.name !== p.name || best.rank !== p.rank))
      run(
        this.db,
        'UPDATE people SET name = ?, rank = ?, updated_at = ? WHERE id = ?',
        best.name,
        best.rank,
        now(),
        id,
      )
    if (p.merged_into) this.rename(p.merged_into)
  }

  // ---- likely ones ------------------------------------------------------------------------

  // After people change: pairs that are one by now withdrawn, the likely ones found, and the new
  // ones put on the card that waits, or on a new one: one card per batch, never merged by code.
  settle(): string | null {
    return tx(this.db, () => {
      this.withdrawStale()
      this.findLikely()
      this.changed = false
      return this.propose()
    })
  }

  private withdrawStale(cardsToo = true): void {
    // one question per two people: a pair that is one by now, or that asks what another pair
    // (or a decision) already asks of the same two, is withdrawn
    const up = new Map(
      all<{ id: string; merged_into: string | null }>(
        this.db,
        'SELECT id, merged_into FROM people',
      ).map((r) => [r.id, r.merged_into]),
    )
    const rootOf = (id: string) => {
      let at = id
      for (let i = 0; i < 64; i++) {
        const next = up.get(at)
        if (!next) return at
        at = next
      }
      return at
    }
    const pairs = this.pairs()
    const asked = new Set<string>()
    for (const p of pairs.filter((x) => x.state !== 'found' && x.state !== 'proposed'))
      if (up.has(p.a) && up.has(p.b)) asked.add([rootOf(p.a), rootOf(p.b)].sort().join('\u0000'))
    const at = now()
    for (const p of pairs.filter((x) => x.state === 'found' || x.state === 'proposed')) {
      const two = up.has(p.a) && up.has(p.b) ? [rootOf(p.a), rootOf(p.b)].sort() : null
      const key = two?.join('\u0000') ?? ''
      if (!two || two[0] === two[1] || asked.has(key))
        run(
          this.db,
          "UPDATE people_pairs SET state = 'withdrawn', decided_at = ? WHERE id = ?",
          at,
          p.id,
        )
      else asked.add(key)
    }
    if (!cardsToo) return
    for (const c of all<{ card_id: string }>(
      this.db,
      `SELECT DISTINCT p.card_id FROM people_pairs p JOIN cards c ON c.id = p.card_id
       WHERE c.state = 'waiting' AND NOT EXISTS (
         SELECT 1 FROM people_pairs q WHERE q.card_id = p.card_id AND q.state = 'proposed')`,
    ))
      this.cards.withdraw(c.card_id, { kind: 'alpha' }, 'they are settled already')
  }

  // The same full name (two words or more for a person), or the same name at the same company.
  private findLikely(): void {
    const rows = all<{
      id: string
      kind: Kind
      name: string
      rank: number
      merged_into: string | null
    }>(this.db, 'SELECT id, kind, name, rank, merged_into FROM people')
    const up = new Map(rows.map((r) => [r.id, r.merged_into]))
    const rootOf = (id: string) => {
      let at = id
      for (let i = 0; i < 64; i++) {
        const next = up.get(at)
        if (!next) return at
        at = next
      }
      return at
    }
    const works = new Map<string, Set<string>>()
    for (const l of all<{ person_id: string; company_id: string }>(
      this.db,
      'SELECT person_id, company_id FROM people_links WHERE ended_at IS NULL',
    )) {
      const p = rootOf(l.person_id)
      const set = works.get(p) ?? new Set<string>()
      set.add(rootOf(l.company_id))
      works.set(p, set)
    }
    const groups = new Map<string, string[]>()
    for (const r of rows) {
      if (r.merged_into) continue
      const n = nameKey(r.name)
      if (!n || keyLike(r.name)) continue
      if (r.kind === 'person' && (r.rank < RANK.header || n.split(' ').length < 2)) continue
      const g = groups.get(`${r.kind}\u0000${n}`) ?? []
      g.push(r.id)
      groups.set(`${r.kind}\u0000${n}`, g)
    }
    for (const ids of groups.values())
      for (let i = 0; i < ids.length; i++)
        for (let j = i + 1; j < ids.length; j++) {
          const a = ids[i] as string
          const b = ids[j] as string
          const wa = works.get(a)
          const shared = !!wa && [...(works.get(b) ?? [])].some((c) => wa.has(c))
          this.notePair(a, b, shared ? SAME_PLACE : SAME_NAME)
        }
  }

  private propose(): string | null {
    const fresh = all<{ id: string }>(
      this.db,
      "SELECT id FROM people_pairs WHERE state = 'found' ORDER BY created_at",
    )
    if (!fresh.length) return null
    const open = one<{ card_id: string }>(
      this.db,
      `SELECT p.card_id FROM people_pairs p JOIN cards c ON c.id = p.card_id
       WHERE p.state = 'proposed' AND c.state = 'waiting' ORDER BY p.created_at DESC LIMIT 1`,
    )?.card_id
    const card =
      open ??
      this.cards.open({
        kind: 'match',
        gate: 'match',
        words: 'These may be the same person or company',
        options: [],
        actor: { kind: 'alpha' },
      }).id
    run(
      this.db,
      "UPDATE people_pairs SET state = 'proposed', card_id = ? WHERE state = 'found'",
      card,
    )
    return card
  }

  // The person's Merge or Keep apart on one pair; the one Alpha has known longer is kept. The card
  // closes when its last pair is decided.
  decidePair(pairId: string, merge: boolean, ctx: WriteCtx): MatchView | null {
    return tx(this.db, () => {
      const p = this.pairs().find((x) => x.id === pairId)
      if (!p) throw new Refused('That pair is not there.')
      if (p.state !== 'proposed') throw new Refused('That pair is decided already.')
      const a = this.mustRoot(p.a)
      const b = this.mustRoot(p.b)
      if (a.id === b.id)
        run(
          this.db,
          "UPDATE people_pairs SET state = 'withdrawn', decided_at = ? WHERE id = ?",
          now(),
          p.id,
        )
      else if (merge) {
        const [keep, other] = a.created_at <= b.created_at ? [a, b] : [b, a]
        this.merge(keep.id, other.id, ctx)
        run(
          this.db,
          "UPDATE people_pairs SET state = 'merged', decided_at = ? WHERE id = ?",
          now(),
          p.id,
        )
      } else {
        this.apart(a.id, b.id, ctx)
        run(
          this.db,
          "UPDATE people_pairs SET state = 'apart', decided_at = ? WHERE id = ?",
          now(),
          p.id,
        )
      }
      // a merge can make other pairs one already: withdrawn before the card is closed
      this.withdrawStale(false)
      if (p.card) this.closeIfDone(p.card, ctx)
      return p.card ? this.matchView(p.card) : null
    })
  }

  // Merge all with the same name and company: every such pair on the card.
  mergeSamePlace(cardId: string, ctx: WriteCtx): MatchView | null {
    return tx(this.db, () => {
      for (const p of this.pairs('proposed').filter(
        (x) => x.card === cardId && x.why === SAME_PLACE,
      ))
        if (this.pairs().find((x) => x.id === p.id)?.state === 'proposed')
          this.decidePair(p.id, true, ctx)
      return this.matchView(cardId)
    })
  }

  private closeIfDone(cardId: string, ctx: WriteCtx): void {
    const on = this.pairs().filter((x) => x.card === cardId)
    if (on.some((x) => x.state === 'proposed')) return
    if (!on.some((x) => x.state === 'merged' || x.state === 'apart')) {
      this.cards.withdraw(cardId, { kind: 'alpha' }, 'they are settled already')
      return
    }
    const merged = on.filter((x) => x.state === 'merged').length
    const apart = on.filter((x) => x.state === 'apart').length
    if (this.cards.get(cardId)?.state === 'waiting')
      this.cards.answer(cardId, `Merged ${merged}, kept ${apart} apart`, ctx.actor)
  }

  private side(id: string): Side {
    const p = this.get(id) as PersonOut
    return {
      id: p.id,
      kind: p.kind,
      name: p.name,
      emails: p.keys.email ?? [],
      phones: (p.keys.phone ?? []).map(phoneWords),
      profile: p.keys.profile?.[0] ?? null,
      companies: (p.kind === 'person' ? p.companies.filter((c) => !c.ended) : []).map((c) =>
        c.title ? `${c.title}, ${c.name}` : c.name,
      ),
      from: uniq(
        p.sources
          .map((s) => (s.table ? (this.shape.table(s.table)?.name ?? null) : 'You'))
          .filter((x): x is string => !!x),
      ),
      last: p.contact.last,
      count: p.contact.count,
    }
  }

  // A match card's pairs, side by side, the undecided first and those at one company first.
  matchView(cardId: string): MatchView | null {
    const on = this.pairs().filter((x) => x.card === cardId)
    if (!on.length) return null
    const order = (x: Pair) => (x.state === 'proposed' ? 0 : 1) * 2 + (x.why === SAME_PLACE ? 0 : 1)
    const pairs = on
      .filter((x) => this.row(x.a) && this.row(x.b))
      .sort((x, y) => order(x) - order(y))
      .map((x) => {
        // the one Alpha has known longer first: the one a merge keeps
        const [a, b] = [this.side(x.a), this.side(x.b)]
        const older = (this.row(x.a)?.created_at ?? '') <= (this.row(x.b)?.created_at ?? '')
        return { id: x.id, why: x.why, state: x.state, a: older ? a : b, b: older ? b : a }
      })
    return {
      pairs,
      open: pairs.filter((x) => x.state === 'proposed').length,
      samePlace: pairs.filter((x) => x.state === 'proposed' && x.why === SAME_PLACE).length,
    }
  }

  // ---- the person's word --------------------------------------------------------------------

  private notePair(a: string, b: string, why: string): void {
    const [x, y] = [a, b].sort() as [string, string]
    if (x === y) return
    this.changed = true
    run(
      this.db,
      `INSERT INTO people_pairs (id, a, b, why, state, created_at) VALUES (?, ?, ?, ?, 'found', ?)
       ON CONFLICT (a, b) DO NOTHING`,
      newId('pp'),
      x,
      y,
      why,
      now(),
    )
  }

  // Two the person says are one: the other joins the one kept, both rows kept for Unmerge.
  merge(keepId: string, otherId: string, ctx: WriteCtx): PersonOut {
    return tx(this.db, () => {
      const keep = this.mustRoot(keepId)
      const other = this.mustRoot(otherId)
      if (keep.id === other.id) throw new Refused('Those are already one.')
      if (keep.kind !== other.kind) throw new Refused('A person and a company are never merged.')
      const at = now()
      run(
        this.db,
        'UPDATE people SET merged_into = ?, updated_at = ? WHERE id = ?',
        keep.id,
        at,
        other.id,
      )
      this.decide(keep.id, other.id, 'merged', 'you merged them')
      this.rename(keep.id)
      const [x, y] = this.twoNames(keep, other)
      append(this.db, {
        actor: ctx.actor,
        kind: 'people',
        words: `${x} and ${y} are one ${keep.kind} now.`,
        data: { merged: other.id, into: keep.id },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        run: ctx.run ?? null,
      })
      return this.get(keep.id) as PersonOut
    })
  }

  // One merged in stands alone again with its own keys and rows, kept apart from then on.
  unmerge(id: string, ctx: WriteCtx): PersonOut {
    return tx(this.db, () => {
      const p = this.row(id)
      if (!p) throw new Refused('That one is not there.')
      if (!p.merged_into) throw new Refused(`${p.name} is not merged into anyone.`)
      const was = this.row(this.root(p.merged_into)) as PersonRow
      run(this.db, 'UPDATE people SET merged_into = NULL, updated_at = ? WHERE id = ?', now(), p.id)
      this.decide(was.id, p.id, 'apart', 'you unmerged them')
      this.recount(p.merged_into)
      this.recount(p.id)
      const [x, y] = this.twoNames(this.row(p.id) ?? p, this.row(was.id) ?? was)
      append(this.db, {
        actor: ctx.actor,
        kind: 'people',
        words: `${x} is not ${y}.`,
        data: { unmerged: p.id, from: p.merged_into },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        run: ctx.run ?? null,
      })
      return this.get(p.id) as PersonOut
    })
  }

  // The person says someone is themselves (their other address): those addresses become their
  // own, and every row that named them as someone else is read again, so they leave People.
  isYou(id: string, ctx: WriteCtx): string[] {
    return tx(this.db, () => {
      const p = this.mustRoot(id)
      if (p.kind !== 'person') throw new Refused(`${p.name} is a company.`)
      const emails = this.keysOf(this.parts(p.id)).email ?? []
      if (!emails.length)
        throw new Refused(`${p.name} has no address Alpha could know the person by.`)
      const fresh = this.learnYou(emails)
      append(this.db, {
        actor: ctx.actor,
        kind: 'people',
        words: `${emails.join(', ')} ${emails.length === 1 ? 'is' : 'are'} the person's own now, not someone they know.`,
        data: { you: emails },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        run: ctx.run ?? null,
      })
      this.relandNaming(fresh, '')
      if (this.changed) this.settle()
      return emails
    })
  }

  // Two the person says are not one: never proposed again.
  apart(a: string, b: string, ctx: WriteCtx): void {
    tx(this.db, () => {
      const x = this.mustRoot(a)
      const y = this.mustRoot(b)
      if (x.id === y.id) throw new Refused('Those are one already; Unmerge parts them.')
      this.decide(x.id, y.id, 'apart', 'you kept them apart')
      const [n, m] = this.twoNames(x, y)
      append(this.db, {
        actor: ctx.actor,
        kind: 'people',
        words: `${n} and ${m} are two ${x.kind === 'person' ? 'people' : 'companies'}.`,
        data: { apart: [x.id, y.id] },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        run: ctx.run ?? null,
      })
    })
  }

  // The person's own name for someone, over any a row gives.
  name(id: string, name: string, ctx: WriteCtx): PersonOut {
    const clean = name.trim()
    if (!clean) throw new Refused('A name is needed.')
    return tx(this.db, () => {
      const p = this.mustRoot(id)
      const own = one<{ said: string }>(
        this.db,
        'SELECT said FROM people_sources WHERE record_id = ? AND person_id = ?',
        PERSONS_WORD,
        p.id,
      )
      const said = parse<Said>(own?.said, {
        kind: p.kind,
        name: clean,
        rank: RANK.person,
        keys: {},
      })
      run(
        this.db,
        `INSERT INTO people_sources (person_id, record_id, table_id, said, at) VALUES (?, ?, NULL, ?, ?)
         ON CONFLICT (record_id, person_id) DO UPDATE SET said = excluded.said`,
        p.id,
        PERSONS_WORD,
        json({ ...said, name: clean, rank: RANK.person }),
        now(),
      )
      this.rename(p.id)
      append(this.db, {
        actor: ctx.actor,
        kind: 'people',
        words: `${p.name} is called ${clean} now.`,
        data: { person: p.id, name: clean },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        run: ctx.run ?? null,
      })
      this.settle()
      return this.get(p.id) as PersonOut
    })
  }

  private decide(a: string, b: string, state: 'merged' | 'apart', why: string): void {
    const [x, y] = [a, b].sort() as [string, string]
    const at = now()
    run(
      this.db,
      `INSERT INTO people_pairs (id, a, b, why, state, created_at, decided_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (a, b) DO UPDATE SET state = excluded.state, decided_at = excluded.decided_at`,
      newId('pp'),
      x,
      y,
      why,
      state,
      at,
      at,
    )
  }

  // A root that lost its merged ones takes its own name again.
  private recount(id: string): void {
    run(this.db, 'UPDATE people SET rank = 0 WHERE id = ?', id)
    this.rename(id)
    this.sweepOne(id)
  }

  // Two names as a sentence says them: with a way to reach each when the names are the same.
  private twoNames(a: PersonRow, b: PersonRow): [string, string] {
    if (nameKey(a.name) !== nameKey(b.name)) return [a.name, b.name]
    const called = (p: PersonRow) => {
      const k = this.ownKeys(p.id)[0]
      return k ? `${p.name} (${k.value})` : p.name
    }
    return [called(a), called(b)]
  }

  // ---- reading ------------------------------------------------------------------------------

  private row(id: string): PersonRow | undefined {
    return one<PersonRow>(
      this.db,
      'SELECT id, kind, name, rank, merged_into, created_at FROM people WHERE id = ?',
      id,
    )
  }

  root(id: string): string {
    let at = id
    for (let i = 0; i < 64; i++) {
      const up = one<{ merged_into: string | null }>(
        this.db,
        'SELECT merged_into FROM people WHERE id = ?',
        at,
      )?.merged_into
      if (!up) return at
      at = up
    }
    return at
  }

  private mustRoot(id: string): PersonRow {
    const p = this.row(this.root(id))
    if (!p) throw new Refused('That one is not there.')
    return p
  }

  // An id and every one merged into it, at any depth.
  parts(id: string): string[] {
    const out: string[] = []
    const todo = [this.root(id)]
    while (todo.length) {
      const at = todo.pop() as string
      if (out.includes(at)) continue
      out.push(at)
      for (const c of all<{ id: string }>(
        this.db,
        'SELECT id FROM people WHERE merged_into = ?',
        at,
      ))
        todo.push(c.id)
    }
    return out
  }

  private ownKeys(id: string): { key: KeyKind; value: string }[] {
    return all<{ key: KeyKind; value: string }>(
      this.db,
      'SELECT key, value FROM people_keys WHERE person_id = ? ORDER BY key, value',
      id,
    )
  }

  private keysOf(ids: string[]): Keys {
    const marks = ids.map(() => '?').join(', ')
    const out: Keys = {}
    for (const k of all<{ key: KeyKind; value: string }>(
      this.db,
      `SELECT key, value FROM people_keys WHERE person_id IN (${marks}) ORDER BY key, value`,
      ...ids,
    )) {
      const list = out[k.key] ?? []
      list.push(k.value)
      out[k.key] = list
    }
    return out
  }

  // Whoever holds a key, as they are now.
  byKey(key: KeyKind, value: string): string | null {
    const v =
      key === 'email' || key === 'domain'
        ? value.trim().toLowerCase()
        : key === 'phone'
          ? phoneKey(value, this.phoneRegion())
          : key === 'profile'
            ? (profileKey(value) ?? '')
            : nameKey(value)
    const leaf = one<{ person_id: string }>(
      this.db,
      'SELECT person_id FROM people_keys WHERE key = ? AND value = ?',
      key,
      v,
    )?.person_id
    return leaf ? this.root(leaf) : null
  }

  contact(id: string): Contact {
    const ids = this.parts(id)
    const { days } = this.judgements()
    const marks = ids.map(() => '?').join(', ')
    const since = new Date(Date.now() - days * 86_400_000).toISOString()
    const until = now()
    const rows = all<{ channel: string; at: string; started_by: 'you' | 'them' | null }>(
      this.db,
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

  get(id: string): PersonOut | undefined {
    const p = this.row(this.root(id))
    if (!p) return undefined
    const ids = this.parts(p.id)
    const marks = ids.map(() => '?').join(', ')
    const companies = new Map<string, PersonOut['companies'][number]>()
    for (const l of all<{
      company_id: string
      title: string | null
      started_at: string
      ended_at: string | null
    }>(
      this.db,
      `SELECT company_id, title, started_at, ended_at FROM people_links WHERE person_id IN (${marks})
       ORDER BY started_at`,
      ...ids,
    )) {
      const c = this.row(this.root(l.company_id))
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
    const people = new Map<string, { id: string; name: string; title: string | null }>()
    if (p.kind === 'company')
      for (const l of all<{ person_id: string; title: string | null }>(
        this.db,
        `SELECT person_id, title FROM people_links WHERE company_id IN (${marks}) AND ended_at IS NULL
         ORDER BY started_at`,
        ...ids,
      )) {
        const m = this.row(this.root(l.person_id))
        if (m && !people.get(m.id)?.title)
          people.set(m.id, { id: m.id, name: m.name, title: l.title })
      }
    return {
      id: p.id,
      kind: p.kind,
      name: p.name,
      keys: this.keysOf(ids),
      merged: all<{ id: string; name: string }>(
        this.db,
        'SELECT id, name FROM people WHERE merged_into = ? ORDER BY updated_at',
        p.id,
      ),
      companies: [...companies.values()].sort(
        (a, b) => Number(!!a.ended) - Number(!!b.ended) || b.since.localeCompare(a.since),
      ),
      people: [...people.values()].sort((a, b) => a.name.localeCompare(b.name)),
      sources: all<{ table_id: string | null; record_id: string; said: string; at: string }>(
        this.db,
        `SELECT table_id, record_id, said, at FROM people_sources WHERE person_id IN (${marks})
         ORDER BY at`,
        ...ids,
      ).map((s) => ({
        table: s.table_id,
        record: s.record_id,
        said: parse<Said>(s.said, { kind: p.kind, name: '', rank: 0, keys: {} }),
        at: s.at,
      })),
      contact: this.contact(p.id),
      createdAt: p.created_at,
    }
  }

  // Who a person field's value names: one of the person's people by their id, an address they
  // hold, or a name only one of them has. Anyone else is refused in words (a wall: a person field
  // never holds a stranger's name as text).
  ref(said: string): string {
    const v = said.trim()
    if (!v) throw new Refused('A person field needs someone.')
    const p = this.row(v)
    if (p) {
      if (p.kind !== 'person') throw new Refused(`${p.name} is a company, not a person.`)
      return this.root(p.id)
    }
    if (isEmail(v.toLowerCase())) {
      const id = this.byKey('email', v)
      if (id) return id
      throw new Refused(
        `No one among the person's people has ${v}. Keep the address in an email field; once they write to each other, they are one of their people.`,
      )
    }
    const named = all<{ id: string }>(
      this.db,
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
  rowsNaming(id: string): { table: string; record: string; field: string }[] {
    const ids = this.parts(id)
    const emails = this.keysOf(ids).email ?? []
    const out: { table: string; record: string; field: string }[] = []
    for (const t of this.shape.tables()) {
      if (t.hidden) continue
      for (const f of t.fields) {
        const values = f.kind === 'person' ? ids : f.kind === 'email' ? emails : []
        if (!values.length) continue
        for (const id of this.records?.idsWhere(t.id, f.id, values) ?? [])
          if (!out.some((o) => o.record === id))
            out.push({ table: t.id, record: id, field: f.name })
      }
    }
    return out
  }

  // For everyone at once: the rows of the person's modules that name them (a person field, or an
  // email field holding one of their addresses), counted by table and field.
  namings(): Map<string, { table: string; field: string; rows: number }[]> {
    const owner = new Map<string, string>()
    for (const k of all<{ value: string; person_id: string }>(
      this.db,
      "SELECT value, person_id FROM people_keys WHERE key = 'email'",
    ))
      owner.set(k.value, this.root(k.person_id))
    const out = new Map<string, Map<string, { table: string; field: string; rows: number }>>()
    for (const t of this.shape.tables()) {
      if (t.hidden) continue
      for (const f of t.fields) {
        if (f.kind !== 'person' && f.kind !== 'email') continue
        for (const { value } of this.records?.column(t.id, f.id) ?? []) {
          const v = typeof value === 'string' ? value : ''
          if (!v) continue
          const who =
            f.kind === 'person'
              ? this.row(v)
                ? this.root(v)
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
  names(ids: string[]): Record<string, string> {
    const out: Record<string, string> = {}
    for (const id of ids) {
      const p = this.row(this.root(id))
      if (p) out[id] = p.name
    }
    return out
  }

  // Messages and meetings with someone, newest first, each with what it was about.
  history(
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
    const ids = this.parts(id)
    const marks = ids.map(() => '?').join(', ')
    return all<{
      record_id: string
      channel: string
      at: string
      started_by: 'you' | 'them' | null
      table_id: string
    }>(
      this.db,
      `SELECT e.record_id, e.channel, e.at, e.started_by, r.table_id FROM exchanges e
         JOIN people_keys k ON k.key = e.key AND k.value = e.value
         JOIN records r ON r.id = e.record_id
       WHERE k.person_id IN (${marks})
       GROUP BY e.record_id ORDER BY e.at DESC LIMIT ?`,
      ...ids,
      limit,
    ).map((r) => {
      const t = this.shape.table(r.table_id)
      const map = t?.people
      const field =
        t && map?.each === 'exchange' && map.about
          ? t.fields.find((f) => f.name.toLowerCase() === map.about?.toLowerCase())
          : undefined
      const about = field ? text(this.records?.rawValues(r.record_id)?.vals[field.id]).trim() : ''
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
  list(kind: Kind = 'person', words = ''): PersonLine[] {
    const { days } = this.judgements()
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
    }>(
      this.db,
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
       staff AS (SELECT company AS root, count(DISTINCT person) AS n FROM links GROUP BY company)
       SELECT p.id, p.name, kagg.emails, kagg.phones, kagg.domains, works.companies, titled.titles,
         eagg.last, eagg.count, efirst.started_by AS first, staff.n AS people
       FROM people p
         LEFT JOIN kagg ON kagg.root = p.id LEFT JOIN eagg ON eagg.root = p.id
         LEFT JOIN efirst ON efirst.root = p.id LEFT JOIN works ON works.root = p.id
         LEFT JOIN titled ON titled.root = p.id LEFT JOIN staff ON staff.root = p.id
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
      }))
      .sort((a, b) => (b.last ?? '').localeCompare(a.last ?? '') || a.name.localeCompare(b.name))
  }

  pairs(state?: Pair['state']): Pair[] {
    return all<{
      id: string
      a: string
      b: string
      why: string
      state: Pair['state']
      card_id: string | null
    }>(
      this.db,
      `SELECT id, a, b, why, state, card_id FROM people_pairs ${state ? 'WHERE state = ?' : ''} ORDER BY created_at`,
      ...(state ? [state] : []),
    ).map((r) => ({ id: r.id, a: r.a, b: r.b, why: r.why, state: r.state, card: r.card_id }))
  }

  count(kind: Kind = 'person'): number {
    return Number(
      one<{ n: number }>(
        this.db,
        'SELECT count(*) AS n FROM people WHERE kind = ? AND merged_into IS NULL',
        kind,
      )?.n ?? 0,
    )
  }
}
