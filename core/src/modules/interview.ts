// Interview me, dynamic (Vikas, 30 Oct: "the number of questions, durations, everything should be
// dynamically decided, but the agent has a huge list of questions which it rank orders and
// evaluates on a daily basis"). A skill of Alpha's, not a character: each morning Morning refreshes
// one pool of questions, from everything unresolved (what code finds in the world) and a standing
// bank (config/interview-bank.yaml, the onboarding research's spine), and ranks it by expected
// value: the kind's weight, what it holds up, its age, its skips. The model words the most valuable
// (config/interviewing.md). A sitting asks the most useful first and stops when the next is worth
// less than interview_stop_value, or the person says they are done or answers briefly. A skipped
// question sinks; an answered one leaves the pool until its answer goes stale. The pool is kept
// in the world's meta table, one JSON value.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { config } from '../config.ts'
import type { Ask } from '../files/reading.ts'
import { all, run as exec, json, one, parse } from '../world/db.ts'
import { quote } from '../world/ddl.ts'
import type { Line } from '../world/journal.ts'
import type { World } from '../world/world.ts'
import { agents } from './agents.ts'
import { installedKits } from './kits/index.ts'

const POOL = 'interview_pool'
export const OPENING = 'A few questions today, starting with the most useful.'

// Something to ask, with code's own words for it until the model words it.
export interface Unresolved {
  key: string // stable across days: what an answer is kept against
  kind: string // its weight's name in limits.yaml interview_weights
  module: string | null // the module's id; none for the business as a whole
  reach: number // how much it holds up: rows blank, modules and agents it helps
  facts: string // what is known, for the model
  ask: string
  why: string
  unblocks: string
}

export interface PoolItem extends Unresolved {
  worded: boolean // the model's words, not code's
  added: string
  asked: string | null // when it was last asked
  skips: number
  value: number
}

export interface Pool {
  at: string | null // when it was last ranked
  items: PoolItem[]
  settled: Record<string, string> // keys the notes already answer, with when the model said so
}

export interface Question {
  key: string
  module: string | null
  ask: string
  why: string
  unblocks: string
  value: number
}

const DAY = 86_400_000
const notesOf = (dir: string): string => {
  const f = join(dir, 'NOTES.md')
  return existsSync(f) ? readFileSync(f, 'utf8').trim() : ''
}
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// Alpha's own module, where its kit lives: never asked about.
export function alphaModule(world: World): string | null {
  return installedKits(world).find((k) => k.core)?.module ?? null
}

// A question's expected value to the person: its kind's weight, what it holds up, how long since
// it was last asked (or added), and how often it was skipped.
export function worth(
  i: Pick<PoolItem, 'kind' | 'reach' | 'asked' | 'added' | 'skips'>,
  nowMs = Date.now(),
): number {
  const l = config.limits()
  const weight = l.interview_weights[i.kind] ?? 1
  const helps = 1 + Math.min(Math.max(i.reach, 0), 9) / 3
  const since = (nowMs - Date.parse(i.asked ?? i.added)) / DAY
  const age = 1 + l.interview_age_boost * Math.min(1, Math.max(0, since) / l.interview_stale_days)
  const skip = l.interview_skip_decay ** i.skips
  return Math.round(weight * helps * age * skip * 10) / 10
}

// When the person last answered each question, in an interview on any day.
export function answeredAt(world: World): Map<string, string> {
  return new Map(
    all<{ k: string; at: string }>(
      world.db,
      "SELECT json_extract(data, '$.answers') AS k, max(at) AS at FROM journal WHERE kind = 'said' AND json_extract(data, '$.answers') IS NOT NULL GROUP BY k",
    ).map((r) => [r.k, r.at]),
  )
}

// Answered, and not yet stale: what the pool leaves out.
export function answeredKeys(world: World, nowMs = Date.now()): Set<string> {
  const stale = config.limits().interview_answer_stale_days * DAY
  return new Set(
    [...answeredAt(world)].filter(([, at]) => nowMs - Date.parse(at) < stale).map(([k]) => k),
  )
}

// The standing bank, once for the business and once for each module.
export function bank(world: World, own: string | null): Unresolved[] {
  const b = config.interviewBank()
  const out: Unresolved[] = b.business.map((q) => ({
    key: q.id,
    kind: q.kind,
    module: null,
    reach: q.reach,
    facts: `The business as a whole: ${q.ask}`,
    ask: q.ask,
    why: q.why,
    unblocks: q.unblocks,
  }))
  for (const m of world.shape.modules().filter((x) => x.id !== own))
    for (const q of b.module) {
      const w = (s: string) => s.replaceAll('{module}', m.name)
      out.push({
        key: `${q.id}:${m.id}`,
        kind: q.kind,
        module: m.id,
        reach: q.reach + agents(world, m.id).length,
        facts: `${m.name}: ${w(q.ask)}`,
        ask: w(q.ask),
        why: w(q.why),
        unblocks: w(q.unblocks),
      })
    }
  return out
}

// What is unresolved, read from the world: open questions, agents that did not finish, rules
// waiting, tables empty, blank or stale, fields nobody said the meaning of. Alpha's own module is
// left out.
export function unresolved(world: World, own: string | null, nowMs = Date.now()): Unresolved[] {
  const out: Unresolved[] = []
  const name = new Map(world.shape.modules().map((m) => [m.id, m.name]))
  const modules = world.shape.modules().filter((m) => m.id !== own)
  for (const c of world.cards.waiting()) {
    if (c.kind !== 'question' || c.call) continue
    out.push({
      key: `card:${c.id}`,
      kind: 'card',
      module: c.module,
      reach: 1,
      facts: `A question waiting since ${c.createdAt.slice(0, 10)}: ${c.words}${c.options.length ? ` (${c.options.join(' / ')})` : ''}`,
      ask: c.words,
      why: `It has waited for you since ${c.createdAt.slice(0, 10)}.`,
      unblocks: 'The work that asked it carries on.',
    })
  }
  for (const r of world.rules.list()) {
    if (r.kind !== 'inferred' || r.revokedAt || (r.module && r.module === own)) continue
    out.push({
      key: `rule:${r.id}`,
      kind: 'rule',
      module: r.module ?? null,
      reach: r.uses,
      facts: `A rule Alpha noticed, not yet confirmed: ${r.words}`,
      ask: `Alpha noticed you always do this: “${r.words}”. Should it hold as a rule?`,
      why: 'Alpha noticed it from your answers, and asks each time until you say.',
      unblocks: 'Alpha stops asking about it each time.',
    })
  }
  for (const a of agents(world)) {
    if (a.module === own || a.state !== 'on') continue
    const last = one<{ state: string; words: string | null }>(
      world.db,
      'SELECT state, words FROM runs WHERE agent_id = ? ORDER BY started_at DESC LIMIT 1',
      a.id,
    )
    if (last?.state !== 'failed') continue
    out.push({
      key: `agent:${a.id}`,
      kind: 'agent',
      module: a.module,
      reach: 2,
      facts: `The agent ${a.name} in ${name.get(a.module)} did not finish its last run: ${last.words ?? 'no reason given'}`,
      ask: `${a.name} did not finish its last run (“${last.words ?? 'no reason given'}”). Is something missing that it needs, or should it stop?`,
      why: `${a.name} is on but its work is not getting done.`,
      unblocks: `${a.name}'s next run.`,
    })
  }
  const stale = config.limits().interview_stale_days * DAY
  for (const m of modules) {
    const tables = world.shape.tables(m.id).filter((t) => !t.hidden)
    const readers = agents(world, m.id).length
    for (const t of tables) {
      const n = world.records.count(t.id)
      if (!n) {
        out.push({
          key: `empty:${t.id}`,
          kind: 'empty',
          module: m.id,
          reach: readers + 1,
          facts: `${t.name} in ${m.name} has no rows. ${t.about ?? ''}`.trim(),
          ask: `${t.name} in ${m.name} has no rows yet. Where do these live today: a sheet, a system, an inbox?`,
          why: `${t.name} is empty, so nothing in ${m.name} can read it.`,
          unblocks: `Filling ${t.name}${readers ? `, and ${plural(readers, 'agent')} that read ${m.name}` : ''}.`,
        })
        continue
      }
      const at = one<{ at: string | null }>(
        world.db,
        `SELECT max(updated_at) AS at FROM ${quote(t.slug)}`,
      )?.at
      if (at && nowMs - Date.parse(at) > stale)
        out.push({
          key: `stale:${t.id}`,
          kind: 'stale',
          module: m.id,
          reach: Math.ceil(n / 50),
          facts: `${t.name} in ${m.name}: ${plural(n, 'row')}, none changed since ${at.slice(0, 10)}.`,
          ask: `Nothing in ${t.name} changed since ${at.slice(0, 10)}. Is it still where you keep this, or has it moved?`,
          why: 'A table nobody changes is either done or kept somewhere else now.',
          unblocks: `Trusting what ${m.name} shows.`,
        })
      for (const f of t.fields) {
        if (['summary', 'notes'].includes(f.kind) || f.many || f.partOf) continue
        // ponytail: one count per field, once a day; read from a sample if tables grow large
        const blank =
          one<{ n: number }>(
            world.db,
            `SELECT count(*) AS n FROM ${quote(t.slug)} WHERE ${quote(f.slug)} IS NULL OR ${quote(f.slug)} = ''`,
          )?.n ?? 0
        if (n >= 3 && blank * 2 >= n)
          out.push({
            key: `blank:${t.id}:${f.id}`,
            kind: 'blank',
            module: m.id,
            reach: Math.ceil(blank / 10),
            facts: `${blank} of ${n} rows of ${t.name} in ${m.name} have no ${f.name}${f.about ? ` (${f.about})` : ''}.`,
            ask: `${blank} of ${n} ${t.name} have no ${f.name}. Where would I find it, or does it not matter?`,
            why: `${f.name} is blank on most of ${t.name}.`,
            unblocks: `Views and charts of ${t.name} that use ${f.name}.`,
          })
        else if (!f.about)
          out.push({
            key: `meaning:${t.id}:${f.id}`,
            kind: 'meaning',
            module: m.id,
            reach: 0,
            facts: `${f.name} (${f.kind}) in ${t.name}, ${m.name}: nobody said what it means.`,
            ask: `What does ${f.name} mean in ${t.name}?`,
            why: 'Alpha reads every table by what its fields mean.',
            unblocks: `Answers about ${t.name} that use ${f.name}.`,
          })
      }
    }
  }
  return out
}

export function loadPool(world: World): Pool {
  const r = one<{ value: string }>(world.db, 'SELECT value FROM meta WHERE key = ?', POOL)
  return parse<Pool>(r?.value, { at: null, items: [], settled: {} })
}

function savePool(world: World, pool: Pool): void {
  exec(
    world.db,
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    POOL,
    json(pool),
  )
}

// The pool as it stands now: answered and settled ones out, each valued, the best first.
export function ranked(world: World, module: string | null = null, nowMs = Date.now()): PoolItem[] {
  const pool = loadPool(world)
  const answered = answeredKeys(world, nowMs)
  return pool.items
    .filter((i) => !answered.has(i.key) && !(i.key in pool.settled))
    .filter((i) => !module || i.module === module)
    .map((i) => ({ ...i, value: worth(i, nowMs) }))
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
}

// What is left worth asking now: above the stop value, and not asked yet today.
export function worthAsking(
  world: World,
  module: string | null = null,
  nowMs = Date.now(),
): PoolItem[] {
  const stop = config.limits().interview_stop_value
  const today = new Date(nowMs).toDateString()
  return ranked(world, module, nowMs).filter(
    (i) => i.value >= stop && (!i.asked || new Date(i.asked).toDateString() !== today),
  )
}

// What the model is given to word: the items, the modules' notes, what was answered before.
function pastAnswers(world: World, limit: number): string[] {
  return all<{ words: string; asked: string | null }>(
    world.db,
    `SELECT s.words, (SELECT json_extract(q.data, '$.interview.ask') FROM journal q WHERE q.kind = 'replied'
        AND json_extract(q.data, '$.interview.key') = json_extract(s.data, '$.answers')
        ORDER BY q.id DESC LIMIT 1) AS asked
       FROM journal s WHERE s.kind = 'said' AND json_extract(s.data, '$.answers') IS NOT NULL
       ORDER BY s.id DESC LIMIT ?`,
    limit,
  ).map((r) => `- Asked: ${r.asked ?? '(unknown)'} Answered: ${r.words}`)
}

async function word(
  world: World,
  ask: Ask,
  own: string | null,
  items: PoolItem[],
): Promise<{
  words: Map<string, Pick<Unresolved, 'ask' | 'why' | 'unblocks'> | null>
  tokens: number
}> {
  const words = new Map<string, Pick<Unresolved, 'ask' | 'why' | 'unblocks'> | null>()
  if (!items.length) return { words, tokens: 0 }
  const notes = world.shape
    .modules()
    .filter((m) => m.id !== own)
    .map((m) => [m.name, notesOf(m.dir).slice(0, 1500)] as const)
    .filter(([, t]) => t.includes('\n'))
  const past = pastAnswers(world, 20)
  const prompt = [
    `The questions to word, most valuable first (key: facts):\n${items.map((u) => `${u.key}: ${u.facts}`).join('\n')}`,
    notes.length
      ? `The modules' notes:\n${notes.map(([m, t]) => `### ${m}\n${t}`).join('\n\n')}`
      : 'No module has notes yet.',
    past.length ? `Earlier interview answers:\n${past.join('\n')}` : 'No earlier interview.',
  ].join('\n\n')
  const keys = items.map((u) => u.key)
  const schema = {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', enum: keys },
            settled: { type: 'boolean' },
            ask: { type: 'string' },
            why: { type: 'string' },
            unblocks: { type: 'string' },
          },
          required: ['key', 'settled', 'ask', 'why', 'unblocks'],
          additionalProperties: false,
        },
      },
    },
    required: ['questions'],
    additionalProperties: false,
  }
  const { answer, tokens } = await ask(prompt, schema)
  for (const q of ((answer as { questions?: unknown[] })?.questions ?? []) as Record<
    string,
    unknown
  >[]) {
    // a wall: only a key it was given, once
    const key = String(q?.key ?? '')
    if (!keys.includes(key) || words.has(key)) continue
    const text = (k: string) => String(q[k] ?? '').trim()
    if (q.settled === true) words.set(key, null)
    else if (text('ask'))
      words.set(key, { ask: text('ask'), why: text('why'), unblocks: text('unblocks') })
  }
  return { words, tokens }
}

// The morning's refresh: what is unresolved and the bank, merged into the pool; what was
// resolved since leaves it; an answer gone stale brings its question back; all re-ranked; the
// most valuable not yet worded are worded by the model, which may only word or settle them.
export async function refresh(
  world: World,
  ask: Ask,
  own: string | null,
  nowMs = Date.now(),
): Promise<{ pool: Pool; tokens: number; worded: boolean }> {
  const limits = config.limits()
  const at = new Date(nowMs).toISOString()
  const pool = loadPool(world)
  const answered = answeredKeys(world, nowMs)
  const was = new Map(pool.items.map((i) => [i.key, i]))
  const stale = limits.interview_answer_stale_days * DAY
  for (const [k, when] of Object.entries(pool.settled))
    if (nowMs - Date.parse(when) >= stale) delete pool.settled[k]
  const found = [...unresolved(world, own, nowMs), ...bank(world, own)].filter(
    (u) => !answered.has(u.key) && !(u.key in pool.settled),
  )
  pool.items = found.map((u) => {
    const old = was.get(u.key)
    const item: PoolItem = old
      ? {
          ...old,
          kind: u.kind,
          module: u.module,
          reach: u.reach,
          facts: u.facts,
          ...(old.worded ? {} : { ask: u.ask, why: u.why, unblocks: u.unblocks }),
        }
      : { ...u, worded: false, added: at, asked: null, skips: 0, value: 0 }
    return { ...item, value: worth(item, nowMs) }
  })
  pool.items.sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
  const toWord = pool.items.filter((i) => !i.worded).slice(0, limits.interview_word_per_day)
  let tokens = 0
  let worded = false
  try {
    const out = await word(world, ask, own, toWord)
    tokens = out.tokens
    worded = toWord.length > 0
    for (const i of toWord) {
      const w = out.words.get(i.key)
      if (w === null) pool.settled[i.key] = at
      else if (w) Object.assign(i, w, { worded: true })
    }
    pool.items = pool.items.filter((i) => !(i.key in pool.settled))
  } catch {
    // the model did not answer: code's own words stand, and the day still has its pool
  }
  pool.at = at
  savePool(world, pool)
  return { pool, tokens, worded }
}

function mark(world: World, key: string, change: (i: PoolItem) => void): void {
  const pool = loadPool(world)
  const i = pool.items.find((x) => x.key === key)
  if (!i) return
  change(i)
  savePool(world, pool)
}

export const markAsked = (world: World, key: string, nowMs = Date.now()) =>
  mark(world, key, (i) => {
    i.asked = new Date(nowMs).toISOString()
  })
export const markSkipped = (world: World, key: string) =>
  mark(world, key, (i) => {
    i.skips += 1
  })

// Whether the pool was ranked on this local day.
export const rankedToday = (pool: Pool, nowMs = Date.now()): boolean =>
  !!pool.at && new Date(pool.at).toDateString() === new Date(nowMs).toDateString()

// How the person's words after a question read: they are done, they pass on it, or an answer;
// a brief answer ends the sitting once it is kept.
export function readReply(words: string): 'done' | 'skip' | 'brief' | 'answer' {
  const w = config.words()
  const said = words
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const count = said ? said.split(' ').length : 0
  const is = (list: string[]) =>
    list.some((x) => said === x || (count <= 4 && said.startsWith(`${x} `)))
  if (is(w.interview_done)) return 'done'
  if (is(w.interview_skip)) return 'skip'
  return count <= config.limits().interview_brief_words ? 'brief' : 'answer'
}

const lower = (w: string) => (w ? `${w[0]?.toLowerCase()}${w.slice(1)}` : w)

// Alpha asks a question of the pool in the conversation: a reply of its own turn, the question's
// key in its data, so the person's next words are kept as its answer. The first of a sitting
// opens with the sitting's line; there is no count.
export function askLine(
  world: World,
  user: string,
  module: string | null,
  q: Question,
  first: boolean,
): Line {
  markAsked(world, q.key)
  return world.line({
    actor: { kind: 'alpha' },
    kind: 'replied',
    words: `${first ? `${OPENING}\n\n` : ''}${q.ask}\n\nI ask because ${lower(q.why)} It unblocks: ${lower(q.unblocks)}`,
    data: { interview: { key: q.key, module, ask: q.ask } },
    user,
    module: q.module ?? module,
    turn: `iv${Date.now()}`,
  })
}

// The question the person has not answered yet, when it is the last thing Alpha said to them.
export function pending(
  world: World,
  user: string,
): { key: string; module: string | null; ask: string } | null {
  const r = one<{ data: string }>(
    world.db,
    "SELECT data FROM journal WHERE kind = 'replied' AND user_id = ? ORDER BY id DESC LIMIT 1",
    user,
  )
  const iv = r
    ? parse<{ interview?: { key: string; module: string | null; ask: string } }>(r.data, {})
        .interview
    : undefined
  if (!iv || answeredKeys(world).has(iv.key)) return null
  return iv
}
