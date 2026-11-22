// A journey's checks on an interview and on plugins, read from the world and the plugins' own
// routes, never from the model's prose: what How to work holds and whether the person kept it,
// what each report row rests on, that a skipped source is never cited and words nothing read held
// appear nowhere, that numbers are computed in code or marked estimated with their basis, that a
// card answered so is never asked again, and that an Alpha without a plugin shows no trace of it.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import type { buildServer } from '../api/server.ts'
import { instructionsFile } from '../engine/tools/common.ts'
import { readKit } from '../modules/kits/index.ts'
import { PLUGINS_DIR, type Plugins } from '../plugins/plugins.ts'
import type { Card } from '../world/cards.ts'
import type { Table } from '../world/shape/index.ts'
import { workspaceFor } from '../world/workspace.ts'
import type { User, World } from '../world/world.ts'
import { AS_WINDOW as HEADERS } from './headers.ts'

type Saw = { check: string; ok: boolean; saw: string }

export const InterviewChecks = [
  // How to work's lines, for the person or for everyone: so many, words in them, and each one
  // kept by the person, never written by an agent on its own (rules I4, call 27)
  z.object({
    how_to_work: z.object({
      for: z.enum(['me', 'everyone']),
      matches: z.string().optional(),
      count: z.number().optional(),
      at_least: z.number().optional(),
      kept: z.boolean().optional(),
    }),
  }),
  // every row of a table rests on something read or answered, that is there (rules I1)
  z.object({ cited: z.object({ table: z.string(), field: z.string().default('Rests on') }) }),
  // no row of a module rests on a source the person skipped: Files, or a table by name (rules I3)
  z.object({ never_cited: z.object({ module: z.string(), source: z.string() }) }),
  // words in no row of a module, no How to work and no card: a name nothing read held
  z.object({ nowhere: z.object({ matches: z.string(), module: z.string() }) }),
  // a number computed in code, or estimated with what it rests on, or the person's own (rules I2)
  z.object({ numbers: z.object({ table: z.string(), field: z.string() }) }),
  // a card answered so is never asked again in the same words: a declined proposal, a dropped
  // line (rules I4)
  z.object({ asked_once: z.object({ matches: z.string(), answered: z.string() }) }),
  // every row of a table has a row of another pointing at it: each workflow closes (call 32)
  z.object({ each_has: z.object({ table: z.string(), part: z.string() }) }),
  // what a plugin's screen reads through its own route, or that it is not there
  z.object({
    plugin_route: z.object({
      name: z.string(),
      get: z.string(),
      matches: z.string().optional(),
      status: z.number().optional(),
    }),
  }),
  // an Alpha that has not switched a plugin on shows nothing of it (rules P1)
  z.object({ no_trace: z.string() }),
] as const

export interface CheckHere {
  world: World
  user: User
  app: () => ReturnType<typeof buildServer>
  plugins: Plugins
}

// How to work's own lines, in the file the window and the desk read.
const linesOf = (world: World, user: string | null): string[] => {
  const file = instructionsFile(world, user)
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2).trim())
}

// A row's citations, one to a line: a row read ("row <id>"), the person's answer ("answer <card
// id>"), a page of a site ("page <address>"), a file ("file <hash>"), or a journal line
// ("line <id>"): what they did in Alpha.
const CITE = /^(row|answer|page|file|line)\s+(\S+)/
const citesOf = (v: unknown): { kind: string; id: string }[] =>
  String(v ?? '')
    .split('\n')
    .map((l) => CITE.exec(l.trim()))
    .filter((m) => !!m)
    .map((m) => ({ kind: m[1] ?? '', id: m[2] ?? '' }))

const cardsOf = (world: World): Card[] =>
  (world.db.prepare('SELECT id FROM cards ORDER BY created_at').all() as { id: string }[])
    .map((r) => world.cards.get(r.id))
    .filter((c) => !!c)

const tablesOf = (world: World, module: string): Table[] => {
  const m = world.shape.module(module)
  return m ? world.shape.tables().filter((t) => t.module.id === m.id) : []
}

const tableOfRow = (world: World, id: string): Table | undefined =>
  world.shape.tables().find((t) => world.records.list(t.id).some((r) => r.id === id))

// Whether a citation names something that is there.
function holds(world: World, c: { kind: string; id: string }): boolean {
  if (c.kind === 'row') return !!tableOfRow(world, c.id)
  // an answer on a card in a chat, or in Set up Alpha's What I learned (a row of Questions)
  if (c.kind === 'answer') {
    // who the work is for, in the owner's own words in Your workspace
    if (c.id === 'workspace') return !!workspaceFor(world.db)
    if (world.cards.get(c.id)?.answer) return true
    const t = tableOfRow(world, c.id)
    const f = t?.fields.find((x) => x.name === 'Answer')
    return !!t && !!f && !!String(world.records.get(c.id)?.record.values[f.slug] ?? '').trim()
  }
  if (c.kind === 'page') return /^https?:\/\//.test(c.id)
  if (c.kind === 'file') return !!world.files.file(c.id)
  return world.lines({}).some((l) => String(l.id) === c.id)
}

const shortly = (xs: string[]) => (xs.length ? xs.slice(0, 6).join('; ') : 'none')

export async function interviewCheck(check: object, h: CheckHere): Promise<Saw | null> {
  const { world, user } = h
  if ('how_to_work' in check) {
    const c = check.how_to_work as {
      for: 'me' | 'everyone'
      matches?: string
      count?: number
      at_least?: number
      kept?: boolean
    }
    const lines = linesOf(world, c.for === 'me' ? user.id : null)
    const kept = world
      .lines({ kinds: ['remembered'] })
      .filter((l) => l.actor.kind === 'person')
      .map((l) => l.words)
    const unkept = lines.filter((l) => !kept.some((k) => k.endsWith(l)))
    const ok =
      (c.count === undefined || lines.length === c.count) &&
      (c.at_least === undefined || lines.length >= c.at_least) &&
      (!c.matches || lines.some((l) => new RegExp(c.matches ?? '', 'i').test(l))) &&
      (!c.kept || !unkept.length)
    const want = [
      c.count !== undefined && `${c.count} line(s)`,
      c.at_least !== undefined && `at least ${c.at_least} line(s)`,
      c.matches && `a line /${c.matches}/`,
      c.kept && 'each kept by the person',
    ].filter(Boolean)
    return {
      check: `How to work › ${c.for === 'me' ? 'For you' : 'For everyone here'}: ${want.join(', ')}`,
      ok,
      saw: `${lines.length}: ${shortly(lines)}${unkept.length ? `; not kept: ${shortly(unkept)}` : ''}`,
    }
  }
  if ('cited' in check) {
    const c = check.cited as { table: string; field: string }
    const t = world.shape.table(c.table)
    const f = t?.fields.find((x) => x.name === c.field)
    if (!t || !f)
      return { check: `every row of ${c.table} cites`, ok: false, saw: `no ${c.field} there` }
    const rows = world.records.list(t.id)
    const bare = rows.filter((r) => {
      const cites = citesOf(r.values[f.slug])
      return !cites.length || cites.some((x) => !holds(world, x))
    })
    return {
      check: `every row of ${c.table} cites what it rests on, and it is there`,
      ok: rows.length > 0 && !bare.length,
      saw: rows.length
        ? `${rows.length} rows; ${bare.length} citing nothing there: ${shortly(bare.map((r) => world.rowName(t, r.values)))}`
        : 'no rows',
    }
  }
  if ('never_cited' in check) {
    const c = check.never_cited as { module: string; source: string }
    const found: string[] = []
    for (const t of tablesOf(world, c.module))
      for (const r of world.records.list(t.id))
        for (const v of Object.values(r.values))
          for (const x of citesOf(v))
            if (
              (c.source === 'Files' && x.kind === 'file') ||
              (x.kind === 'row' && tableOfRow(world, x.id)?.name === c.source)
            )
              found.push(`${world.rowName(t, r.values)} cites ${x.kind} ${x.id}`)
    return {
      check: `nothing in ${c.module} rests on ${c.source}`,
      ok: tablesOf(world, c.module).length > 0 && !found.length,
      saw: tablesOf(world, c.module).length ? shortly(found) : `no module ${c.module}`,
    }
  }
  if ('nowhere' in check) {
    const c = check.nowhere as { matches: string; module: string }
    const re = new RegExp(c.matches, 'i')
    const found: string[] = []
    for (const t of tablesOf(world, c.module))
      for (const r of world.records.list(t.id))
        if (Object.values(r.values).some((v) => re.test(String(v ?? ''))))
          found.push(`${t.name}: ${world.rowName(t, r.values)}`)
    for (const l of [...linesOf(world, user.id), ...linesOf(world, null)])
      if (re.test(l)) found.push(`How to work: ${l}`)
    for (const k of cardsOf(world))
      if (re.test([k.words, k.detail ?? '', ...k.options].join('\n')))
        found.push(`card: ${k.words}`)
    return { check: `/${c.matches}/ appears nowhere`, ok: !found.length, saw: shortly(found) }
  }
  if ('numbers' in check) {
    const c = check.numbers as { table: string; field: string }
    const t = world.shape.table(c.table)
    const f = t?.fields.find((x) => x.name === c.field)
    if (!t || !f)
      return { check: `${c.table}'s ${c.field} from code`, ok: false, saw: 'no such field' }
    const bad: string[] = []
    let n = 0
    for (const r of world.records.list(t.id)) {
      const v = r.values[f.slug]
      if (v === null || v === undefined || v === '') continue
      n++
      const p = r.provenance[f.slug]
      const fine =
        p?.kind === 'computed' ||
        p?.kind === 'stated' ||
        (p?.kind === 'estimated' && !!p.basis?.trim())
      if (!fine) bad.push(`${world.rowName(t, r.values)}: ${v} (${p?.kind ?? 'no source'})`)
    }
    return {
      check: `every ${c.field} in ${c.table} is computed, the person's, or estimated with its basis`,
      ok: n > 0 && !bad.length,
      saw: n ? `${n} values; ${shortly(bad)}` : 'no values',
    }
  }
  if ('asked_once' in check) {
    const c = check.asked_once as { matches: string; answered: string }
    const norm = (w: string) => w.toLowerCase().replace(/\s+/g, ' ').trim()
    // the playbacks put on cards in a chat, and those in Set up Alpha's What I learned (Proposals,
    // said as the story says them)
    const proposals = world.shape.table('Proposals')
    const slug = (n: string) => proposals?.fields.find((f) => f.name === n)?.slug ?? n
    const played = proposals
      ? world.records.list(proposals.id).flatMap((r) => {
          const name = String(r.values[slug('Name')] ?? '')
          return name
            ? [
                {
                  words: `We'd build ${name}: ${String(r.values[slug('What it does')] ?? '')}`,
                  answer: (r.values[slug('Answer')] as string | null) ?? null,
                },
              ]
            : []
        })
      : []
    const cards = [
      ...cardsOf(world).map((k) => ({ words: k.words, answer: k.answer })),
      ...played,
    ].filter((k) => new RegExp(c.matches, 'i').test(k.words))
    const again: string[] = []
    cards.forEach((k, i) => {
      if (!k.answer || !new RegExp(c.answered, 'i').test(k.answer)) return
      if (cards.slice(i + 1).some((l) => norm(l.words) === norm(k.words))) again.push(k.words)
    })
    const declined = cards.filter((k) => k.answer && new RegExp(c.answered, 'i').test(k.answer))
    return {
      check: `a card /${c.matches}/ answered /${c.answered}/ is never asked again`,
      ok: declined.length > 0 && !again.length,
      saw: `${declined.length} answered so; asked again: ${shortly(again)}`,
    }
  }
  if ('each_has' in check) {
    const c = check.each_has as { table: string; part: string }
    const t = world.shape.table(c.table)
    const p = world.shape.table(c.part)
    if (!t || !p) return { check: `each ${c.table} has ${c.part}`, ok: false, saw: 'no such table' }
    const pointed = new Set(
      world.records
        .list(p.id)
        .flatMap((r) => Object.values(r.values).flatMap((v) => (Array.isArray(v) ? v : [v])))
        .map(String),
    )
    const rows = world.records.list(t.id)
    const open = rows.filter((r) => !pointed.has(r.id)).map((r) => world.rowName(t, r.values))
    return {
      check: `every row of ${c.table} has a row of ${c.part}`,
      ok: rows.length > 0 && !open.length,
      saw: rows.length ? `${rows.length} rows; without: ${shortly(open)}` : 'no rows',
    }
  }
  if ('plugin_route' in check) {
    const c = check.plugin_route as { name: string; get: string; matches?: string; status?: number }
    const res = await h
      .app()
      .inject({ url: `/api/plugins/${c.name}/${c.get.replace(/^\//, '')}`, headers: HEADERS })
    const ok =
      (c.status === undefined || res.statusCode === c.status) &&
      (!c.matches || new RegExp(c.matches, 'i').test(res.body))
    return {
      check: `${c.name}'s ${c.get}${c.status ? ` answers ${c.status}` : ''}${c.matches ? ` shows /${c.matches}/` : ''}`,
      ok,
      saw: `${res.statusCode}: ${res.body.slice(0, 300)}`,
    }
  }
  if ('no_trace' in check) return noTrace(check.no_trace as string, h)
  return null
}

// Nothing of a plugin the Alpha has not switched on: not loaded, no route answering, no module of
// its kit, no agent of its kit, no schedule of theirs, no line in its name.
async function noTrace(name: string, h: CheckHere): Promise<Saw> {
  const { world } = h
  const found: string[] = []
  if (h.plugins.loaded.some((l) => l.plugin.name === name)) found.push('loaded')
  const routes = h.plugins.routes.filter((r) => r.path.startsWith(`/api/plugins/${name}/`))
  if (routes.length) found.push(`routes ${routes.map((r) => r.path).join(', ')}`)
  for (const path of ['home', 'start'])
    for (const method of ['GET', 'POST'] as const) {
      const res = await h.app().inject({
        method,
        url: `/api/plugins/${name}/${path}`,
        headers: HEADERS,
        ...(method === 'POST' ? { payload: {} } : {}),
      })
      if (res.statusCode !== 404) found.push(`${method} ${path} answers ${res.statusCode}`)
    }
  const kit = join(PLUGINS_DIR, name, 'kit')
  if (existsSync(join(kit, 'module.yaml'))) {
    const m = world.shape.ownModule(readKit(kit).manifest.name)
    if (m) found.push(`the module ${m.name}`)
    const agents = existsSync(join(kit, 'agents')) ? readdirSync(join(kit, 'agents')) : []
    for (const a of world.agents.list())
      if ((m && a.source === m.id) || agents.includes(a.key ?? ''))
        found.push(`the agent ${a.name}`)
  }
  const lines = world.lines({}).filter((l) => l.actor.id === `plugin:${name}`)
  if (lines.length) found.push(`${lines.length} journal line(s) in its name`)
  return { check: `no trace of the ${name} plugin`, ok: !found.length, saw: shortly(found) }
}
