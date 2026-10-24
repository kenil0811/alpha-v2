// People and companies (design §4): one each, however many rows name them. The store: the
// person's own addresses, a table's map of its rows to people, the rebuild, the rules, and the
// small readers under everything (a person's row, root, parts, keys). Landing rows is in
// landing.ts, likely pairs and the person's word in matching.ts, reading in reading.ts, as
// functions of the store.
import type { CountryCode } from 'libphonenumber-js/max'
import { config } from '../../config.ts'
import type { Cards } from '../cards.ts'
import { all, type Db, json, one, parse, run, tx } from '../db.ts'
import { Refused } from '../kinds.ts'
import { likelyRegion, phoneKey } from '../phones.ts'
import type { Records } from '../records/index.ts'
import type { PeopleMap, Shape, Table, WriteCtx } from '../shape/index.ts'
import { isEmail, nameKey, profileKey, uniq } from './keys.ts'
import { derive, forget, gone, rows, sweep } from './landing.ts'
import {
  apart,
  decidePair,
  isYou,
  matchView,
  merge,
  mergeSamePlace,
  name as nameOf,
  settle,
  unmerge,
} from './matching.ts'
import { contact, get, history, list, names, namings, pairs, ref, rowsNaming } from './reading.ts'
import type {
  Contact,
  Exchange,
  KeyKind,
  Keys,
  Kind,
  MatchView,
  Pair,
  PersonLine,
  PersonOut,
  PersonRow,
  Said,
} from './types.ts'
import { PEOPLE_RULES, PERSONS_WORD } from './types.ts'

export class People {
  // The rows' own store, set by the world: what a row holds is read through it.
  records: Records | null = null
  db: Db
  shape: Shape
  cards: Cards
  region: { count: number; region: CountryCode | null } | null = null
  met = { people: 0, companies: 0 }
  // whether anyone came, went, was renamed or moved company since likely ones were last looked for
  changed = false
  // what one landing reads once: the person's addresses and the judgements
  batch: {
    you: Set<string>
    judgements: ReturnType<People['readJudgements']>
    region?: CountryCode | null
  } | null = null

  constructor(db: Db, shape: Shape, cards: Cards) {
    this.db = db
    this.shape = shape
    this.cards = cards
  }

  judgements() {
    return this.batch?.judgements ?? this.readJudgements()
  }

  readJudgements() {
    const c = config.people()
    return {
      services: new Set(c.mail_services.map((s) => s.toLowerCase())),
      seconds: new Set(c.second_levels.map((s) => s.toLowerCase())),
      most: c.meeting_most_people,
      days: c.contact_days,
    }
  }

  // The country a phone written without its code is read in.
  phoneRegion(): CountryCode | null {
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

  learnYou(emails: string[]): string[] {
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

  row(id: string): PersonRow | undefined {
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

  mustRoot(id: string): PersonRow {
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

  ownKeys(id: string): { key: KeyKind; value: string }[] {
    return all<{ key: KeyKind; value: string }>(
      this.db,
      'SELECT key, value FROM people_keys WHERE person_id = ? ORDER BY key, value',
      id,
    )
  }

  keysOf(ids: string[]): Keys {
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

  count(kind: Kind = 'person'): number {
    return Number(
      one<{ n: number }>(
        this.db,
        'SELECT count(*) AS n FROM people WHERE kind = ? AND merged_into IS NULL',
        kind,
      )?.n ?? 0,
    )
  }

  derive(
    table: Table,
    vals: Record<string, unknown>,
  ): { said: Said[]; exchanges: Exchange[]; yours: string[] } {
    return derive(this, table, vals)
  }
  rows(table: Table, ids: string[], ctx: WriteCtx): void {
    rows(this, table, ids, ctx)
  }
  gone(ids: string[]): void {
    gone(this, ids)
  }
  forget(recordIds: string[]): void {
    forget(this, recordIds)
  }
  sweep(ids: Set<string>): void {
    sweep(this, ids)
  }
  settle(): string | null {
    return settle(this)
  }
  decidePair(pairId: string, merge: boolean, ctx: WriteCtx): MatchView | null {
    return decidePair(this, pairId, merge, ctx)
  }
  mergeSamePlace(cardId: string, ctx: WriteCtx): MatchView | null {
    return mergeSamePlace(this, cardId, ctx)
  }
  matchView(cardId: string): MatchView | null {
    return matchView(this, cardId)
  }
  merge(keepId: string, otherId: string, ctx: WriteCtx): PersonOut {
    return merge(this, keepId, otherId, ctx)
  }
  unmerge(id: string, ctx: WriteCtx): PersonOut {
    return unmerge(this, id, ctx)
  }
  isYou(id: string, ctx: WriteCtx): string[] {
    return isYou(this, id, ctx)
  }
  apart(a: string, b: string, ctx: WriteCtx): void {
    apart(this, a, b, ctx)
  }
  name(id: string, name: string, ctx: WriteCtx): PersonOut {
    return nameOf(this, id, name, ctx)
  }
  contact(id: string): Contact {
    return contact(this, id)
  }
  get(id: string): PersonOut | undefined {
    return get(this, id)
  }
  ref(said: string): string {
    return ref(this, said)
  }
  rowsNaming(id: string): { table: string; record: string; field: string }[] {
    return rowsNaming(this, id)
  }
  namings(): Map<string, { table: string; field: string; rows: number }[]> {
    return namings(this)
  }
  names(ids: string[]): Record<string, string> {
    return names(this, ids)
  }
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
    return history(this, id, limit)
  }
  list(kind: Kind = 'person', words = ''): PersonLine[] {
    return list(this, kind, words)
  }
  pairs(state?: Pair['state']): Pair[] {
    return pairs(this, state)
  }
}
