// Onboarding from the footprint (Vikas, 30 Oct: "ensure the onboarding flow which we discussed is
// in place"; proposals/2026-10-30-footprint-onboarding.md). Alpha reads first and asks last:
// 1. Count, don't read: what each source holds, as numbers; the owner ticks; nothing is read
//    before its tick. The first tick saves the default deny list as approved rules (Governance).
// 2. Read the ticked sources locally, no sign-in; a site an approved deny rule names is skipped.
// 4. The owner's AI memory, pasted back: every fact it brings is unconfirmed.
// 5. A draft of the business from what was read, each fact with its source, as Noticed rows in
//    Alpha's own module (Second Brain) on one review card: Confirmed or Dropped, fixed by a
//    double-click on the row.
// 6. A confirmed fact settles the interview questions it answers (answeredByFootprint).
// 9. The ledger: per source what Alpha read and skipped, and Forget this source.
// What was read is kept in the world's meta table, one JSON value, beside the interview pool.
import { createHash } from 'node:crypto'
import { resolveMx, resolveTxt } from 'node:dns/promises'
import { readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { config } from '../config.ts'
import type { Ask } from '../files/reading.ts'
import type { Places, Platform } from '../platform/index.ts'
import { all, run as exec, json, one, parse } from '../world/db.ts'
import { quote } from '../world/ddl.ts'
import { Refused } from '../world/kinds.ts'
import { covers, type Rule } from '../world/rules.ts'
import type { Table, WriteCtx } from '../world/shape/index.ts'
import type { World } from '../world/world.ts'
import { readBrowsers, siteOf, type Want } from './browsers.ts'
import { installedKits } from './kits/index.ts'
import { REVIEW, Reviews } from './reviews.ts'

const KEY = 'footprint'

// What reaches past the person's files: where this computer keeps things (the platform's places)
// and the network, given so tests read a temp home and fake records.
export type Env = Places & {
  home: string
  records: (domain: string) => Promise<string[]> // a domain's MX and TXT records
  page: (url: string) => Promise<string> // a page's HTML
}

export function envHere(platform: Platform): Env {
  const home = homedir()
  return {
    home,
    ...platform.places(home),
    records: async (domain) => {
      const mx = await resolveMx(domain).catch(() => [])
      const txt = await resolveTxt(domain).catch(() => [])
      return [...mx.map((r) => `MX ${r.exchange}`), ...txt.map((r) => `TXT ${r.join('')}`)]
    },
    page: async (url) => {
      const r = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: 'follow' })
      return (await r.text()).slice(0, 200_000)
    },
  }
}

export interface Ledger {
  at: string
  read: number
  skipped: number
  why: string | null // why some were skipped, in words
  items: string[] // what was read, a few, as the ledger shows them
}

export interface State {
  ticks: Record<string, boolean>
  counts: Record<string, number | null>
  countedAt: string | null
  site: string | null // the business's website, as the owner gave it
  denied: boolean // the default deny list was saved, once: a rule revoked is not put back
  ledger: Record<string, Ledger>
  data: Record<string, string[]> // what each source read, a line each, for the draft
  card: string | null // the draft's review card
  done: boolean // the owner went on to the questions
}

export interface SourceView {
  id: string
  title: string
  unit: string
  sub: string
  count: number | null
  needs: string | null // the connector to connect first
  ticked: boolean
  read: Ledger | null
}

export function load(world: World): State {
  const r = one<{ value: string }>(world.db, 'SELECT value FROM meta WHERE key = ?', KEY)
  return {
    ticks: {},
    counts: {},
    countedAt: null,
    site: null,
    denied: false,
    ledger: {},
    data: {},
    card: null,
    done: false,
    ...parse<Partial<State>>(r?.value, {}),
  }
}

function save(world: World, s: State): void {
  exec(
    world.db,
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    KEY,
    json(s),
  )
}

const connected = (world: World, connector: string) =>
  world.connections.list().some((c) => c.connector === connector)

export function sources(world: World): SourceView[] {
  const s = load(world)
  return config.footprint().sources.map((x) => ({
    id: x.id,
    title: x.title,
    unit: x.unit,
    sub: x.sub,
    count: s.counts[x.id] ?? null,
    needs: x.needs && !connected(world, x.needs) ? x.needs : null,
    ticked: !!s.ticks[x.id],
    read: s.ledger[x.id] ?? null,
  }))
}

// ---- the local readers: each gives lines, nothing more ----

function apps(env: Env): string[] {
  const pinned = new Set(env.pinned())
  return env.apps.flatMap((d) => {
    let names: string[] = []
    try {
      names = readdirSync(d).filter((n) => n.endsWith(env.app))
    } catch {}
    return names.map((n) => {
      const name = n.slice(0, -env.app.length)
      let since = ''
      try {
        since = `, since ${statSync(join(d, n)).birthtime.toISOString().slice(0, 10)}`
      } catch {}
      return `${name}${since}${pinned.has(name) ? `, in ${env.pinnedIn}` : ''}`
    })
  })
}

// Folder and file names under Desktop, Documents and Downloads, two levels down; never a file's
// contents, never a hidden one.
function folders(env: Env, keep: number): string[] {
  const out: string[] = []
  const walk = (dir: string, rel: string, depth: number) => {
    let list: import('node:fs').Dirent[] = []
    try {
      list = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of list) {
      if (out.length >= keep) return
      if (e.name.startsWith('.') || e.name.endsWith(env.app)) continue
      const at = `${rel}/${e.name}`
      if (e.isDirectory()) {
        out.push(`${at}/`)
        if (depth < 2) walk(join(dir, e.name), at, depth + 1)
      } else out.push(at)
    }
  }
  for (const top of ['Desktop', 'Documents', 'Downloads']) walk(join(env.home, top), top, 1)
  return out
}

// People and organizations the owner mails or meets most, from what Gmail and Calendar brought.
function exchanges(world: World, channel: string, keep: number): string[] {
  return all<{ name: string; kind: string; n: number }>(
    world.db,
    `SELECT p.name, p.kind, count(DISTINCT e.record_id) AS n FROM exchanges e
       JOIN people_keys k ON k.key = e.key AND k.value = e.value
       JOIN people p ON p.id = k.person_id
      WHERE e.channel = ? AND p.merged_into IS NULL
      GROUP BY p.id ORDER BY n DESC LIMIT ?`,
    channel,
    keep,
  ).map(
    (r) =>
      `${r.name}${r.kind === 'company' ? ' (organization)' : ''}: ${r.n} ${channel === 'mail' ? 'mails' : 'meetings'}`,
  )
}

function contacts(world: World, keep: number): string[] {
  return all<{ name: string; n: number }>(
    world.db,
    `SELECT c.name, count(DISTINCT l.person_id) AS n FROM people_links l
       JOIN people c ON c.id = l.company_id WHERE l.ended_at IS NULL AND c.merged_into IS NULL
      GROUP BY c.id ORDER BY n DESC LIMIT ?`,
    keep,
  ).map((r) => `${r.name}: ${r.n} ${r.n === 1 ? 'contact' : 'contacts'}`)
}

const count1 = (world: World, sql: string, ...p: string[]) =>
  one<{ n: number }>(world.db, sql, ...p)?.n ?? 0

// Step 1: what each source holds, as numbers. The browsers are counted by the same reader, in
// memory; only the numbers are kept. Nothing reaches the network.
export function count(world: World, env: Env): SourceView[] {
  const f = config.footprint()
  const s = load(world)
  const b = readBrowsers(env, { bookmarks: true, extensions: true, history: true }, f.history_days)
  s.counts = {
    apps: apps(env).length,
    bookmarks: b.bookmarks.length,
    extensions: b.extensions.length,
    history: b.sites.length,
    folders: folders(env, 100_000).length,
    recent: env.recent(f.recent_days).length,
    contacts: connected(world, 'contacts')
      ? count1(
          world,
          "SELECT count(*) AS n FROM people WHERE kind = 'person' AND merged_into IS NULL",
        )
      : null,
    calendar: connected(world, 'calendar')
      ? count1(
          world,
          "SELECT count(DISTINCT record_id) AS n FROM exchanges WHERE channel = 'meeting'",
        )
      : null,
    mail: connected(world, 'gmail')
      ? count1(world, "SELECT count(DISTINCT record_id) AS n FROM exchanges WHERE channel = 'mail'")
      : null,
    website: null,
  }
  s.countedAt = new Date().toISOString()
  save(world, s)
  return sources(world)
}

// The approved deny rules a site falls under, by the name each was saved with.
function denies(world: World): Rule[] {
  return world.rules
    .list()
    .filter((r) => !r.revokedAt && r.kind === 'approved' && r.side === 'deny')
}
function blockedBy(rules: Rule[], site: string): Rule | undefined {
  return rules.find((r) =>
    covers(r, {
      effect: 'read',
      tool: 'footprint',
      site,
      to: [],
      table: null,
      module: null,
      agent: null,
      own: false,
    }),
  )
}

// The default deny list, saved once as the owner's approved rules (their tick is the yes).
function denyDefaults(world: World, s: State, ctx: WriteCtx): void {
  if (s.denied) return
  for (const d of config.footprint().deny)
    world.rules.save(
      {
        side: 'deny',
        module: null,
        agent: null,
        covers: { does: ['read'], sites: d.sites },
        said: `${d.name}: sites Alpha never reads while it learns your business`,
      },
      ctx,
    )
  s.denied = true
}

export function tick(world: World, id: string, on: boolean, ctx: WriteCtx): SourceView[] {
  if (!config.footprint().sources.some((x) => x.id === id))
    throw new Refused('There is no such source.')
  const s = load(world)
  if (on) denyDefaults(world, s, ctx)
  s.ticks[id] = on
  save(world, s)
  return sources(world)
}

export function setSite(world: World, site: string): void {
  const s = load(world)
  const host = siteOf(/^https?:\/\//.test(site) ? site : `https://${site}`)
  if (site.trim() && !host) throw new Refused(`${site} is not a website (example.com).`)
  s.site = host
  save(world, s)
}

// Step 2: every ticked source read, and only those; a site under a deny rule skipped. Each read is
// a line in Activity and an entry in the ledger.
export async function read(world: World, env: Env, ctx: WriteCtx): Promise<SourceView[]> {
  const f = config.footprint()
  const s = load(world)
  const on = (id: string) => !!s.ticks[id]
  const rules = denies(world)
  const want: Want = {
    bookmarks: on('bookmarks'),
    extensions: on('extensions'),
    history: on('history'),
  }
  const b =
    want.bookmarks || want.extensions || want.history
      ? readBrowsers(env, want, f.history_days)
      : null
  const keep = f.keep
  const results: Record<string, { lines: string[]; skipped: Rule[]; note?: string }> = {}
  const sited = <T extends { site: string }>(xs: T[], line: (x: T) => string) => {
    const skipped: Rule[] = []
    const lines: string[] = []
    for (const x of xs) {
      const r = blockedBy(rules, x.site)
      if (r) skipped.push(r)
      else if (lines.length < keep) lines.push(line(x))
    }
    return { lines, skipped }
  }
  const problems = b?.problems.length ? b.problems.join(' ') : undefined
  if (on('apps')) results.apps = { lines: apps(env).slice(0, keep), skipped: [] }
  if (b && on('bookmarks'))
    results.bookmarks = {
      ...sited(
        b.bookmarks,
        (x) => `${x.browser}${x.folder ? ` › ${x.folder}` : ''} › ${x.name} (${x.site})`,
      ),
      ...(problems ? { note: problems } : {}),
    }
  if (b && on('extensions'))
    results.extensions = {
      lines: [...new Set(b.extensions.map((x) => x.name))].slice(0, keep),
      skipped: [],
    }
  if (b && on('history'))
    results.history = {
      ...sited(b.sites, (x) => `${x.site}: ${x.visits} visits`),
      ...(problems ? { note: problems } : {}),
    }
  if (on('folders')) results.folders = { lines: folders(env, keep), skipped: [] }
  if (on('recent'))
    results.recent = {
      lines: env
        .recent(f.recent_days)
        .map((p) => basename(p))
        .filter(Boolean)
        .slice(0, keep),
      skipped: [],
    }
  const needs = (id: string, connector: string, title: string, lines: () => string[]) => {
    if (!on(id)) return
    results[id] = connected(world, connector)
      ? { lines: lines(), skipped: [] }
      : { lines: [], skipped: [], note: `${title} is not connected, so it was skipped.` }
  }
  needs('contacts', 'contacts', 'Contacts', () => contacts(world, keep))
  needs('calendar', 'calendar', 'Calendar', () => exchanges(world, 'meeting', keep))
  needs('mail', 'gmail', 'Gmail', () => exchanges(world, 'mail', keep))
  if (on('website'))
    results.website = s.site
      ? blockedBy(rules, s.site)
        ? { lines: [], skipped: [blockedBy(rules, s.site) as Rule] }
        : { lines: await website(env, s.site), skipped: [] }
      : { lines: [], skipped: [], note: 'No website was given, so it was skipped.' }

  const at = new Date().toISOString()
  for (const [id, r] of Object.entries(results)) {
    const src = f.sources.find((x) => x.id === id)
    const title = src?.title ?? id
    const names = [...new Set(r.skipped.map((x) => (x.said ?? '').split(':')[0]).filter(Boolean))]
    const why = r.skipped.length
      ? `${r.skipped.length} under your rules (${names.join(', ') || 'Governance'})`
      : null
    s.data[id] = r.lines
    s.ledger[id] = {
      at,
      read: r.lines.length,
      skipped: r.skipped.length,
      why: [why, r.note].filter(Boolean).join('. ') || null,
      items: r.lines.slice(0, 20),
    }
    world.line({
      actor: { kind: 'alpha' },
      kind: 'connection_read',
      words: `Read ${r.lines.length} ${src?.unit ?? 'items'} from ${title.toLowerCase()}${why ? `; skipped ${why}` : ''}.`,
      data: { name: title, ms: 0, state: 'ok', footprint: id },
      user: ctx.user ?? null,
    })
  }
  save(world, s)
  return sources(world)
}

// The business's website: its title and description, and what its domain's public records say it
// runs on (Kenil's question 9: from the core with Node's dns, the recommended answer).
async function website(env: Env, site: string): Promise<string[]> {
  const out: string[] = []
  try {
    const html = await env.page(`https://${site}`)
    const tag = (re: RegExp) => re.exec(html)?.[1]?.replace(/\s+/g, ' ').trim()
    const title = tag(/<title[^>]*>([^<]*)<\/title>/i)
    const about = tag(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
    if (title) out.push(`The site's title: ${title}`)
    if (about) out.push(`The site says: ${about}`)
  } catch {
    out.push('The site did not answer.')
  }
  const records = await env.records(site.split('.').slice(-2).join('.')).catch(() => [])
  const tools = new Set(
    config
      .footprint()
      .dns.filter((d) => records.some((r) => r.toLowerCase().includes(d.match.toLowerCase())))
      .map((d) => d.tool),
  )
  for (const t of tools) out.push(`The domain's records show ${t}`)
  return out
}

// ---- Alpha's own Noticed table, in Second Brain: where drafted and remembered facts are kept ----

export function alphaModuleId(world: World): string | null {
  return installedKits(world).find((k) => k.core)?.module ?? null
}
export function noticed(world: World): Table | undefined {
  const m = alphaModuleId(world)
  return m ? world.shape.tables(m).find((t) => t.name === 'Noticed') : undefined
}

interface Fact {
  about: string
  fact: string
  source: string // a source's id, or memory
}

const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 12)

// Facts land as Proposed (unconfirmed) rows, each with where it came from, on one review card.
function propose(world: World, facts: Fact[], words: string, ctx: WriteCtx): string | null {
  const t = noticed(world)
  const m = alphaModuleId(world)
  if (!t || !m) throw new Refused('Alpha’s own module is not installed yet.')
  if (!facts.length) return null
  const titles = new Map(config.footprint().sources.map((x) => [x.id, x.title.toLowerCase()]))
  const today = new Date().toISOString().slice(0, 10)
  const items = facts.map((x) => ({
    key: `footprint:${x.source}:${hash(`${x.about}\n${x.fact}`)}`,
    values: {
      About: x.about,
      Fact: x.fact,
      'Said on': today,
      State: 'Proposed',
      Why:
        x.source === 'memory'
          ? 'From your AI’s memory; unconfirmed until you confirm it'
          : `From your ${titles.get(x.source) ?? x.source}`,
    },
  }))
  world.records.land(t.id, items, { connector: 'footprint', account: 'Your footprint' }, ctx)
  const keys = new Set(items.map((i) => i.key))
  const ids = all<{ id: string; item_key: string }>(
    world.db,
    `SELECT id, item_key FROM ${quote(t.slug)} WHERE item_key LIKE 'footprint:%'`,
  )
    .filter((r) => keys.has(r.item_key))
    .map((r) => r.id)
  const card = new Reviews(world, ctx.user ?? null).open(
    {
      words,
      table: t,
      field: 'State',
      choices: ['Confirmed', 'Dropped'],
      rows: ids,
      note: 'Fact',
      also: 'Why',
    },
    { agent: 'Interviewer', module: m, run: null },
  )
  return card.id
}

// Step 4: the owner's AI memory, pasted back as "Topic: fact" lines. Code reads the lines; no
// model. Every fact is unconfirmed until the owner confirms it.
export function remember(
  world: World,
  pasted: string,
  ctx: WriteCtx,
): { facts: number; card: string | null } {
  const f = config.footprint()
  const topics = new Map(f.topics.map((t) => [t.name.toLowerCase(), t.name]))
  const facts: Fact[] = []
  for (const raw of pasted.split('\n')) {
    const m = /^[\s>*•\-\d.)]*([^:]{2,60}):\s*(.{3,})$/.exec(raw.replaceAll('**', '').trim())
    if (!m) continue
    const label = (m[1] ?? '').trim()
    facts.push({
      about: topics.get(label.toLowerCase()) ?? label,
      fact: (m[2] ?? '').trim().slice(0, 300),
      source: 'memory',
    })
    if (facts.length >= f.draft_facts) break
  }
  if (!facts.length)
    throw new Refused(
      'Nothing in that reads as “Topic: fact” lines; paste the answer as your AI gave it.',
    )
  const s = load(world)
  s.data.memory = facts.map((x) => `${x.about}: ${x.fact}`)
  s.ledger.memory = {
    at: new Date().toISOString(),
    read: facts.length,
    skipped: 0,
    why: null,
    items: s.data.memory.slice(0, 20),
  }
  const card = propose(
    world,
    facts,
    `Your AI remembered ${facts.length} ${facts.length === 1 ? 'fact' : 'facts'}: confirm or drop each`,
    ctx,
  )
  s.card = card ?? s.card
  save(world, s)
  return { facts: facts.length, card }
}

// Step 5: the model drafts the business from what was read (config/footprint-draft.md); code
// keeps only facts on a topic and a source it was given (a wall), at most draft_facts.
export async function draft(
  world: World,
  ask: Ask,
  ctx: WriteCtx,
): Promise<{ facts: number; card: string | null; tokens: number }> {
  const f = config.footprint()
  const s = load(world)
  const ids = Object.keys(s.data).filter((k) => (s.data[k] ?? []).length)
  if (!ids.length) throw new Refused('Nothing has been read yet: tick a source and read it first.')
  const titles = new Map([
    ...f.sources.map((x) => [x.id, x.title] as const),
    ['memory', 'What your AI remembered'],
  ])
  const topics = f.topics.map((t) => t.name)
  const prompt = [
    `Topics: ${topics.join('; ')}`,
    ...ids.map(
      (id) =>
        `### ${id}: ${titles.get(id) ?? id}\n${(s.data[id] ?? []).slice(0, f.draft_items).join('\n')}`,
    ),
  ].join('\n\n')
  const schema = {
    type: 'object',
    properties: {
      facts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            about: { type: 'string', enum: topics },
            fact: { type: 'string' },
            source: { type: 'string', enum: ids },
          },
          required: ['about', 'fact', 'source'],
          additionalProperties: false,
        },
      },
    },
    required: ['facts'],
    additionalProperties: false,
  }
  const { answer, tokens } = await ask(prompt, schema)
  const facts = (((answer as { facts?: unknown[] })?.facts ?? []) as Record<string, unknown>[])
    .map((x) => ({
      about: String(x?.about ?? ''),
      fact: String(x?.fact ?? '').trim(),
      source: String(x?.source ?? ''),
    }))
    .filter((x) => topics.includes(x.about) && ids.includes(x.source) && x.fact)
    .slice(0, f.draft_facts)
  const card = propose(
    world,
    facts,
    `Alpha drafted your business from what it read: confirm or drop each fact`,
    ctx,
  )
  s.card = card ?? s.card
  save(world, s)
  return { facts: facts.length, card, tokens }
}

// Step 6: the interview questions a confirmed fact answers, by its topic.
export function answeredByFootprint(world: World): Set<string> {
  const t = noticed(world)
  const about = t?.fields.find((x) => x.name === 'About')
  const state = t?.fields.find((x) => x.name === 'State')
  if (!t || !about || !state) return new Set()
  const confirmed = new Set(
    all<{ a: string }>(
      world.db,
      `SELECT DISTINCT ${quote(about.slug)} AS a FROM ${quote(t.slug)} WHERE ${quote(state.slug)} = 'Confirmed'`,
    ).map((r) => r.a),
  )
  return new Set(
    config
      .footprint()
      .topics.filter((x) => confirmed.has(x.name))
      .flatMap((x) => x.answers),
  )
}

// Forget this source: what it read is gone from the ledger and the draft, its tick is off, and
// the facts drawn from it the owner has not confirmed are removed. A confirmed fact is the owner's
// own word now and stays.
export function forget(world: World, id: string, ctx: WriteCtx): void {
  const s = load(world)
  delete s.data[id]
  delete s.ledger[id]
  s.ticks[id] = false
  const t = noticed(world)
  const state = t?.fields.find((x) => x.name === 'State')
  if (t && state) {
    const ids = all<{ id: string }>(
      world.db,
      `SELECT id FROM ${quote(t.slug)} WHERE item_key LIKE ? AND ${quote(state.slug)} IS NOT 'Confirmed'`,
      `footprint:${id}:%`,
    ).map((r) => r.id)
    if (ids.length) world.records.remove(t.id, ids, ctx)
  }
  save(world, s)
  world.line({
    actor: ctx.actor,
    kind: 'connection_read',
    words: `Forgot what Alpha read from ${(config.footprint().sources.find((x) => x.id === id)?.title ?? 'your AI’s memory').toLowerCase()}.`,
    data: { name: 'Forget a source', ms: 0, state: 'ok', footprint: id },
    user: ctx.user ?? null,
  })
}

export function finish(world: World): void {
  const s = load(world)
  s.done = true
  save(world, s)
}

// The draft's card, while it waits.
export function draftCard(world: World): string | null {
  const id = load(world).card
  const c = id ? world.cards.get(id) : undefined
  return c && c.state === 'waiting' && c.call?.tool === REVIEW ? c.id : null
}
