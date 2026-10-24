import { all, json, newId, now, one, parse, run, tx } from '../db.ts'
import { append } from '../journal.ts'
import { Refused } from '../kinds.ts'
import { phoneWords } from '../phones.ts'
import type { WriteCtx } from '../shape/index.ts'
import { keyLike, nameKey, uniq } from './keys.ts'
import { relandNaming, rename, sweepOne } from './landing.ts'
import type { People } from './people.ts'
import { get, pairs } from './reading.ts'
import type { Kind, MatchView, Pair, PersonOut, PersonRow, Said, Side } from './types.ts'
import { PERSONS_WORD, RANK, SAME_NAME, SAME_PLACE } from './types.ts'

// After people change: pairs that are one by now withdrawn, the likely ones found, and the new
// ones put on the card that waits, or on a new one: one card per batch, never merged by code.
export function settle(people: People): string | null {
  return tx(people.db, () => {
    withdrawStale(people)
    findLikely(people)
    people.changed = false
    return propose(people)
  })
}

export function withdrawStale(people: People, cardsToo = true): void {
  // one question per two people: a pair that is one by now, or that asks what another pair
  // (or a decision) already asks of the same two, is withdrawn
  const up = new Map(
    all<{ id: string; merged_into: string | null }>(
      people.db,
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
  const known = pairs(people)
  const asked = new Set<string>()
  for (const p of known.filter((x) => x.state !== 'found' && x.state !== 'proposed'))
    if (up.has(p.a) && up.has(p.b)) asked.add([rootOf(p.a), rootOf(p.b)].sort().join('\u0000'))
  const at = now()
  for (const p of known.filter((x) => x.state === 'found' || x.state === 'proposed')) {
    const two = up.has(p.a) && up.has(p.b) ? [rootOf(p.a), rootOf(p.b)].sort() : null
    const key = two?.join('\u0000') ?? ''
    if (!two || two[0] === two[1] || asked.has(key))
      run(
        people.db,
        "UPDATE people_pairs SET state = 'withdrawn', decided_at = ? WHERE id = ?",
        at,
        p.id,
      )
    else asked.add(key)
  }
  if (!cardsToo) return
  for (const c of all<{ card_id: string }>(
    people.db,
    `SELECT DISTINCT p.card_id FROM people_pairs p JOIN cards c ON c.id = p.card_id
     WHERE c.state = 'waiting' AND NOT EXISTS (
       SELECT 1 FROM people_pairs q WHERE q.card_id = p.card_id AND q.state = 'proposed')`,
  ))
    people.cards.withdraw(c.card_id, { kind: 'alpha' }, 'they are settled already')
}

// The same full name (two words or more for a person), or the same name at the same company.
export function findLikely(people: People): void {
  const rows = all<{
    id: string
    kind: Kind
    name: string
    rank: number
    merged_into: string | null
  }>(people.db, 'SELECT id, kind, name, rank, merged_into FROM people')
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
    people.db,
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
        notePair(people, a, b, shared ? SAME_PLACE : SAME_NAME)
      }
}

export function propose(people: People): string | null {
  const fresh = all<{ id: string }>(
    people.db,
    "SELECT id FROM people_pairs WHERE state = 'found' ORDER BY created_at",
  )
  if (!fresh.length) return null
  const open = one<{ card_id: string }>(
    people.db,
    `SELECT p.card_id FROM people_pairs p JOIN cards c ON c.id = p.card_id
     WHERE p.state = 'proposed' AND c.state = 'waiting' ORDER BY p.created_at DESC LIMIT 1`,
  )?.card_id
  const card =
    open ??
    people.cards.open({
      kind: 'match',
      gate: 'match',
      words: 'These may be the same person or company',
      options: [],
      actor: { kind: 'alpha' },
    }).id
  run(
    people.db,
    "UPDATE people_pairs SET state = 'proposed', card_id = ? WHERE state = 'found'",
    card,
  )
  return card
}

// The person's Merge or Keep apart on one pair; the one Alpha has known longer is kept. The card
// closes when its last pair is decided.
export function decidePair(
  people: People,
  pairId: string,
  yes: boolean,
  ctx: WriteCtx,
): MatchView | null {
  return tx(people.db, () => {
    const p = pairs(people).find((x) => x.id === pairId)
    if (!p) throw new Refused('That pair is not there.')
    if (p.state !== 'proposed') throw new Refused('That pair is decided already.')
    const a = people.mustRoot(p.a)
    const b = people.mustRoot(p.b)
    if (a.id === b.id)
      run(
        people.db,
        "UPDATE people_pairs SET state = 'withdrawn', decided_at = ? WHERE id = ?",
        now(),
        p.id,
      )
    else if (yes) {
      const [keep, other] = a.created_at <= b.created_at ? [a, b] : [b, a]
      merge(people, keep.id, other.id, ctx)
      run(
        people.db,
        "UPDATE people_pairs SET state = 'merged', decided_at = ? WHERE id = ?",
        now(),
        p.id,
      )
    } else {
      apart(people, a.id, b.id, ctx)
      run(
        people.db,
        "UPDATE people_pairs SET state = 'apart', decided_at = ? WHERE id = ?",
        now(),
        p.id,
      )
    }
    // a merge can make other pairs one already: withdrawn before the card is closed
    withdrawStale(people, false)
    if (p.card) closeIfDone(people, p.card, ctx)
    return p.card ? matchView(people, p.card) : null
  })
}

// Merge all with the same name and company: every such pair on the card.
export function mergeSamePlace(people: People, cardId: string, ctx: WriteCtx): MatchView | null {
  return tx(people.db, () => {
    for (const p of pairs(people, 'proposed').filter(
      (x) => x.card === cardId && x.why === SAME_PLACE,
    ))
      if (pairs(people).find((x) => x.id === p.id)?.state === 'proposed')
        decidePair(people, p.id, true, ctx)
    return matchView(people, cardId)
  })
}

export function closeIfDone(people: People, cardId: string, ctx: WriteCtx): void {
  const on = pairs(people).filter((x) => x.card === cardId)
  if (on.some((x) => x.state === 'proposed')) return
  if (!on.some((x) => x.state === 'merged' || x.state === 'apart')) {
    people.cards.withdraw(cardId, { kind: 'alpha' }, 'they are settled already')
    return
  }
  const merged = on.filter((x) => x.state === 'merged').length
  const apart = on.filter((x) => x.state === 'apart').length
  if (people.cards.get(cardId)?.state === 'waiting')
    people.cards.answer(cardId, `Merged ${merged}, kept ${apart} apart`, ctx.actor)
}

export function side(people: People, id: string): Side {
  const p = get(people, id) as PersonOut
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
        .map((s) => (s.table ? (people.shape.table(s.table)?.name ?? null) : 'You'))
        .filter((x): x is string => !!x),
    ),
    last: p.contact.last,
    count: p.contact.count,
  }
}

// A match card's pairs, side by side, the undecided first and those at one company first.
export function matchView(people: People, cardId: string): MatchView | null {
  const on = pairs(people).filter((x) => x.card === cardId)
  if (!on.length) return null
  const order = (x: Pair) => (x.state === 'proposed' ? 0 : 1) * 2 + (x.why === SAME_PLACE ? 0 : 1)
  const shown = on
    .filter((x) => people.row(x.a) && people.row(x.b))
    .sort((x, y) => order(x) - order(y))
    .map((x) => {
      // the one Alpha has known longer first: the one a merge keeps
      const [a, b] = [side(people, x.a), side(people, x.b)]
      const older = (people.row(x.a)?.created_at ?? '') <= (people.row(x.b)?.created_at ?? '')
      return { id: x.id, why: x.why, state: x.state, a: older ? a : b, b: older ? b : a }
    })
  return {
    pairs: shown,
    open: shown.filter((x) => x.state === 'proposed').length,
    samePlace: shown.filter((x) => x.state === 'proposed' && x.why === SAME_PLACE).length,
  }
}

export function notePair(people: People, a: string, b: string, why: string): void {
  const [x, y] = [a, b].sort() as [string, string]
  if (x === y) return
  people.changed = true
  run(
    people.db,
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
export function merge(people: People, keepId: string, otherId: string, ctx: WriteCtx): PersonOut {
  return tx(people.db, () => {
    const keep = people.mustRoot(keepId)
    const other = people.mustRoot(otherId)
    if (keep.id === other.id) throw new Refused('Those are already one.')
    if (keep.kind !== other.kind) throw new Refused('A person and a company are never merged.')
    const at = now()
    run(
      people.db,
      'UPDATE people SET merged_into = ?, updated_at = ? WHERE id = ?',
      keep.id,
      at,
      other.id,
    )
    decide(people, keep.id, other.id, 'merged', 'you merged them')
    rename(people, keep.id)
    const [x, y] = twoNames(people, keep, other)
    append(people.db, {
      actor: ctx.actor,
      kind: 'people',
      words: `${x} and ${y} are one ${keep.kind} now.`,
      data: { merged: other.id, into: keep.id },
      user: ctx.user ?? null,
      turn: ctx.turn ?? null,
      run: ctx.run ?? null,
    })
    return get(people, keep.id) as PersonOut
  })
}

// One merged in stands alone again with its own keys and rows, kept apart from then on.
export function unmerge(people: People, id: string, ctx: WriteCtx): PersonOut {
  return tx(people.db, () => {
    const p = people.row(id)
    if (!p) throw new Refused('That one is not there.')
    if (!p.merged_into) throw new Refused(`${p.name} is not merged into anyone.`)
    const was = people.row(people.root(p.merged_into)) as PersonRow
    run(people.db, 'UPDATE people SET merged_into = NULL, updated_at = ? WHERE id = ?', now(), p.id)
    decide(people, was.id, p.id, 'apart', 'you unmerged them')
    recount(people, p.merged_into)
    recount(people, p.id)
    const [x, y] = twoNames(people, people.row(p.id) ?? p, people.row(was.id) ?? was)
    append(people.db, {
      actor: ctx.actor,
      kind: 'people',
      words: `${x} is not ${y}.`,
      data: { unmerged: p.id, from: p.merged_into },
      user: ctx.user ?? null,
      turn: ctx.turn ?? null,
      run: ctx.run ?? null,
    })
    return get(people, p.id) as PersonOut
  })
}

// The person says someone is themselves (their other address): those addresses become their
// own, and every row that named them as someone else is read again, so they leave People.
export function isYou(people: People, id: string, ctx: WriteCtx): string[] {
  return tx(people.db, () => {
    const p = people.mustRoot(id)
    if (p.kind !== 'person') throw new Refused(`${p.name} is a company.`)
    const emails = people.keysOf(people.parts(p.id)).email ?? []
    if (!emails.length)
      throw new Refused(`${p.name} has no address Alpha could know the person by.`)
    const fresh = people.learnYou(emails)
    append(people.db, {
      actor: ctx.actor,
      kind: 'people',
      words: `${emails.join(', ')} ${emails.length === 1 ? 'is' : 'are'} the person's own now, not someone they know.`,
      data: { you: emails },
      user: ctx.user ?? null,
      turn: ctx.turn ?? null,
      run: ctx.run ?? null,
    })
    relandNaming(people, fresh, '')
    if (people.changed) settle(people)
    return emails
  })
}

// Two the person says are not one: never proposed again.
export function apart(people: People, a: string, b: string, ctx: WriteCtx): void {
  tx(people.db, () => {
    const x = people.mustRoot(a)
    const y = people.mustRoot(b)
    if (x.id === y.id) throw new Refused('Those are one already; Unmerge parts them.')
    decide(people, x.id, y.id, 'apart', 'you kept them apart')
    const [n, m] = twoNames(people, x, y)
    append(people.db, {
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
export function name(people: People, id: string, name: string, ctx: WriteCtx): PersonOut {
  const clean = name.trim()
  if (!clean) throw new Refused('A name is needed.')
  return tx(people.db, () => {
    const p = people.mustRoot(id)
    const own = one<{ said: string }>(
      people.db,
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
      people.db,
      `INSERT INTO people_sources (person_id, record_id, table_id, said, at) VALUES (?, ?, NULL, ?, ?)
       ON CONFLICT (record_id, person_id) DO UPDATE SET said = excluded.said`,
      p.id,
      PERSONS_WORD,
      json({ ...said, name: clean, rank: RANK.person }),
      now(),
    )
    rename(people, p.id)
    append(people.db, {
      actor: ctx.actor,
      kind: 'people',
      words: `${p.name} is called ${clean} now.`,
      data: { person: p.id, name: clean },
      user: ctx.user ?? null,
      turn: ctx.turn ?? null,
      run: ctx.run ?? null,
    })
    settle(people)
    return get(people, p.id) as PersonOut
  })
}

export function decide(
  people: People,
  a: string,
  b: string,
  state: 'merged' | 'apart',
  why: string,
): void {
  const [x, y] = [a, b].sort() as [string, string]
  const at = now()
  run(
    people.db,
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
export function recount(people: People, id: string): void {
  run(people.db, 'UPDATE people SET rank = 0 WHERE id = ?', id)
  rename(people, id)
  sweepOne(people, id)
}

// Two names as a sentence says them: with a way to reach each when the names are the same.
export function twoNames(people: People, a: PersonRow, b: PersonRow): [string, string] {
  if (nameKey(a.name) !== nameKey(b.name)) return [a.name, b.name]
  const called = (p: PersonRow) => {
    const k = people.ownKeys(p.id)[0]
    return k ? `${p.name} (${k.value})` : p.name
  }
  return [called(a), called(b)]
}
