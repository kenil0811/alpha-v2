// `alpha kit test <dir>` (decision 9): a kit's skills run against a fixture world and recorded
// answers, without the model, and the rows they land are compared with what the kit's test
// expects. A case is tests/<name>.yaml in the kit: which agent or script, its input, the rows to
// seed (a used kit's or connector's tables too, made for the case from their definitions), the
// pages a browser call gets, a connector's reads and an item's files as recorded, the model's
// recorded answers, and what to expect. A refusal by a wall fails the case. `--record` runs the
// model for real and writes its answers into the case, to replay from then on.
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { type BrowserEngine, type Connector, Problem } from '@alpha/connector-sdk'
import { parse, stringify } from 'yaml'
import { z } from 'zod'
import { loadSet, STANDARD_DIR } from '../connectors/discover.ts'
import { askModel } from '../engine/ask.ts'
import type { Ask } from '../files/reading.ts'
import { run as exec, now } from '../world/db.ts'
import { Refused } from '../world/kinds.ts'
import type { Table, WriteCtx } from '../world/shape/index.ts'
import { World } from '../world/world.ts'
import { agents } from './agents.ts'
import { install, type KitManifest, readKit } from './kits/index.ts'
import { shapeTables } from './kits/shape.ts'
import { AgentRunner, toolOf } from './runs/index.ts'

const Case = z.object({
  agent: z.string().optional(),
  script: z.string().optional(),
  input: z.record(z.string(), z.unknown()).default({}),
  rows: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))).default({}),
  // by url: what browser.extract or open gets; { fail, kind } makes the call fail as a site would
  // (a timeout, a 403's blocked), so a reader's way with a failure can be tried
  pages: z.record(z.string(), z.unknown()).default({}),
  answers: z
    .array(z.object({ key: z.string(), about: z.string(), answer: z.unknown() }))
    .default([]),
  // what a connector's tool that only reads gives, by its call (gmail.read) and input
  tools: z
    .array(
      z.object({
        call: z.string(),
        input: z.record(z.string(), z.unknown()).default({}),
        answer: z.unknown(),
      }),
    )
    .default([]),
  // the files a connector's item carries, by connector and item: each a name and its text
  files: z
    .record(
      z.string(),
      z.record(
        z.string(),
        z.array(
          z.object({
            name: z.string(),
            mime: z.string().default('text/plain'),
            text: z.string().default(''),
            inline: z.boolean().default(false),
          }),
        ),
      ),
    )
    .default({}),
  expect: z
    .object({
      state: z.enum(['ok', 'failed', 'stopped']).default('ok'),
      words: z.string().optional(), // a regular expression over the run's words
      result: z.unknown().optional(),
      rows: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))).default({}),
    })
    .default({ state: 'ok', rows: {} }),
})
export type KitTestCase = z.infer<typeof Case>

export interface KitTestReport {
  passed: string[]
  failed: { name: string; why: string }[]
}

const keyOf = (prompt: string, schema: unknown) =>
  createHash('sha256')
    .update(`${prompt}\n${JSON.stringify(schema)}`)
    .digest('hex')
    .slice(0, 16)

export async function kitTest(
  dir: string,
  options: { record?: boolean; only?: string } = {},
): Promise<KitTestReport> {
  const testsDir = join(dir, 'tests')
  const files = existsSync(testsDir)
    ? readdirSync(testsDir)
        .filter((f) => f.endsWith('.yaml'))
        .sort()
    : []
  const report: KitTestReport = { passed: [], failed: [] }
  for (const f of files) {
    const name = f.replace(/\.yaml$/, '')
    if (options.only && name !== options.only) continue
    try {
      await runCase(dir, join(testsDir, f), options.record ?? false)
      report.passed.push(name)
    } catch (err) {
      report.failed.push({ name, why: err instanceof Error ? err.message : String(err) })
    }
  }
  return report
}

async function runCase(dir: string, file: string, record: boolean): Promise<void> {
  const parsed = Case.safeParse(parse(readFileSync(file, 'utf8')) ?? {})
  if (!parsed.success) throw new Refused(`The case is not right: ${z.prettifyError(parsed.error)}`)
  const c = parsed.data
  if (!c.agent && !c.script) throw new Refused('A case names an agent, or a script to run.')
  const home = mkdtempSync(join(tmpdir(), 'alpha-kit-test-'))
  const world = await World.open(join(home, 'tenants', 't_test'))
  const recorded = new Map(c.answers.map((a) => [a.key, a.answer]))
  const learned: KitTestCase['answers'] = []
  try {
    const ctx = { actor: { kind: 'alpha' as const } }
    const known = await standIns(world, dir, c, ctx)
    const module = await install(world, dir, ctx)
    // the pages recorded are sites the kit may read in the test
    const hosts = Object.keys(c.pages).map((u) => new URL(u).host)
    if (hosts.length) {
      const manifest = join(module.dir, 'module.yaml')
      const m = (parse(readFileSync(manifest, 'utf8')) ?? {}) as Record<string, unknown>
      const list = Array.isArray(m.network) ? m.network.map(String) : []
      writeFileSync(manifest, stringify({ ...m, network: [...new Set([...list, ...hosts])] }))
    }
    for (const [tableName, rows] of Object.entries(c.rows)) {
      const t = world.shape.table(tableName)
      if (!t)
        throw new Refused(`The case seeds rows in ${tableName}, which the kit has no table called.`)
      world.records.add(
        t.id,
        rows.map((values) => ({ values, provenance: { kind: 'estimated', basis: 'the test' } })),
        ctx,
      )
    }
    const page = (url: string) => {
      if (!(url in c.pages)) throw new Refused(`The case has no page recorded for ${url}.`)
      const p = c.pages[url] as { fail?: unknown; kind?: unknown } | null
      if (p && typeof p.fail === 'string')
        throw new Problem(
          p.fail,
          p.kind === 'blocked' || p.kind === 'sign_in' || p.kind === 'gone' ? p.kind : 'other',
        )
      return p
    }
    const engine = {
      open: async (url: string) => page(url),
      extract: async (url: string) => page(url),
    } as unknown as BrowserEngine
    const real = record ? askModel(world.paths.dir) : null
    const ask: Ask = async (prompt, schema) => {
      const key = keyOf(prompt, schema)
      if (recorded.has(key)) return { answer: recorded.get(key), tokens: 0 }
      if (!real)
        throw new Refused(
          `The script asked the model something this case has no answer recorded for (key ${key}: ${prompt.slice(0, 80).replace(/\s+/g, ' ')}); run the test with --record once, or record its answer by hand under that key.`,
        )
      const out = await real(prompt, schema)
      learned.push({ key, about: prompt.slice(0, 120).replace(/\s+/g, ' '), answer: out.answer })
      return out
    }
    const runner = new AgentRunner(world, () => engine, { owner: null, ask, judge: ask })
    runner.connectors = {
      tool: (connector, tool, input) => toolOf(known, connector, tool, input),
      carries: (connector) => !!known.find((k) => k.manifest.name === connector)?.files,
      run: async (connector, tool, input) => {
        const t = c.tools.find((x) => x.call === `${connector}.${tool}` && matches(input, x.input))
        if (!t)
          throw new Refused(
            `The case has no answer recorded for ${connector}.${tool} ${JSON.stringify(input)}.`,
          )
        return t.answer
      },
      files: async (connector, item) =>
        (c.files[connector]?.[item] ?? []).map((f) => ({
          name: f.name,
          mime: f.mime,
          bytes: new TextEncoder().encode(f.text),
          inline: f.inline,
        })),
    }
    const out = c.agent
      ? await (async () => {
          const a = agents(world, module.id).find((x) => x.name === c.agent)
          if (!a) throw new Refused(`The kit has no agent called ${c.agent}.`)
          // a kit's test is its author asking: a paused agent runs for it
          return runner.runAgent(a, undefined, c.input, { asked: true })
        })()
      : await runner.runScript(module, c.script as string, c.input, 'the test', null)
    const refused = world
      .lines({ kinds: ['run_step'] })
      .filter((l) => l.words.startsWith('Refused: '))
      .map((l) => l.words)
    if (refused.length) throw new Refused(refused.join(' '))
    if (out.state !== c.expect.state)
      throw new Refused(`The run ended ${out.state}, not ${c.expect.state}: ${out.words}`)
    if (c.expect.words && !new RegExp(c.expect.words).test(out.words))
      throw new Refused(`The run said "${out.words}", not /${c.expect.words}/.`)
    if (c.expect.result !== undefined && !matches(out.result, c.expect.result))
      throw new Refused(
        `The run returned ${JSON.stringify(out.result)}, not ${JSON.stringify(c.expect.result)}.`,
      )
    for (const [tableName, rows] of Object.entries(c.expect.rows)) {
      const t = world.shape.table(tableName)
      if (!t) throw new Refused(`The case expects rows in ${tableName}, which is not there.`)
      const landed = world.records.list(t.id).map((r) => byName(t, r.values))
      for (const want of rows)
        if (!landed.some((have) => matches(have, want)))
          throw new Refused(
            `No row in ${t.name} has ${JSON.stringify(want)}; the table holds ${JSON.stringify(landed)}.`,
          )
    }
    if (learned.length) {
      const raw = (parse(readFileSync(file, 'utf8')) ?? {}) as Record<string, unknown>
      const answers = Array.isArray(raw.answers) ? raw.answers : []
      writeFileSync(file, stringify({ ...raw, answers: [...answers, ...learned] }))
    }
  } finally {
    world.close()
    rmSync(home, { recursive: true, force: true })
  }
}

// What the kit uses of other kits and of connectors, made for the case so its install's uses
// check passes and its rows can seed them: a used kit's tables as the kit's folder beside this one
// has them (with that kit's version), else from the fields the case seeds; a connector's tables as
// the connector defines them. The connectors loaded are given back, for their tools' effects.
async function standIns(
  world: World,
  dir: string,
  c: KitTestCase,
  ctx: WriteCtx,
): Promise<Connector[]> {
  const { manifest } = readKit(dir)
  const known = manifest.uses.some((u) => u.connector)
    ? (await loadSet(STANDARD_DIR)).connectors
    : []
  const seeded = (name: string) =>
    [...new Set((c.rows[name] ?? []).flatMap((r) => Object.keys(r)))].map((n) => ({
      name: n,
      kind: 'text' as const,
    }))
  for (const u of manifest.uses) {
    if (u.connector) {
      const conn = known.find((k) => k.manifest.name === u.connector)
      const name = conn?.module ?? u.connector
      const m = world.shape.module(name) ?? world.shape.makeModule(name, ctx)
      for (const t of u.tables) {
        if (world.shape.table(t)) continue
        const spec = conn?.tables.find((x) => x.name === t)
        const made = world.shape.makeTable(m.id, t, spec?.fields ?? seeded(t), ctx, {
          hidden: true,
        })
        if (spec?.people) world.people.mapTable(made.id, spec.people, ctx)
      }
      continue
    }
    if (!u.kit || world.shape.module(u.kit)) continue
    const beside = besideKit(dirname(dir), u.kit)
    const picked = (beside?.tables ?? [])
      .filter((t) => u.tables.includes(t.name))
      .map((t) => ({
        ...t,
        setup: false,
        views: [],
        fields: t.fields.filter((f) =>
          f.kind === 'relation' ? u.tables.includes(f.relates_to ?? '') : f.kind !== 'summary',
        ),
      }))
    const m = world.shape.makeModule(u.kit, ctx)
    if (beside) shapeTables(world, m, { ...beside, tables: picked }, ctx)
    for (const t of u.tables)
      if (!world.shape.table(t)) world.shape.makeTable(m.id, t, seeded(t), ctx)
    exec(
      world.db,
      'INSERT INTO kits (module_id, kit, version, source, installed_at, updated_at, api) VALUES (?, ?, ?, ?, ?, ?, 1)',
      m.id,
      u.kit,
      beside?.version ?? u.min ?? '0.0.0',
      dir,
      now(),
      now(),
    )
  }
  return known
}

// The kit of that name in a folder beside the one tested, as its module.yaml says it.
function besideKit(parent: string, name: string): KitManifest | null {
  for (const e of readdirSync(parent, { withFileTypes: true })) {
    if (!e.isDirectory() || !existsSync(join(parent, e.name, 'module.yaml'))) continue
    try {
      const { manifest } = readKit(join(parent, e.name))
      if (manifest.name === name) return manifest
    } catch {}
  }
  return null
}

function byName(t: Table, values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [slug, v] of Object.entries(values)) {
    const f = t.fields.find((x) => x.slug === slug)
    out[f?.name ?? slug] = v
  }
  return out
}

// `want` is matched by every key it gives; a field named in want is found by name or slug.
function matches(have: unknown, want: unknown): boolean {
  if (want === null || typeof want !== 'object')
    return JSON.stringify(have) === JSON.stringify(want)
  if (Array.isArray(want)) return Array.isArray(have) && want.every((w, i) => matches(have[i], w))
  if (have === null || typeof have !== 'object') return false
  const h = have as Record<string, unknown>
  return Object.entries(want as Record<string, unknown>).every(([k, v]) => {
    const key = k in h ? k : Object.keys(h).find((x) => x.toLowerCase() === k.toLowerCase())
    return key !== undefined && matches(h[key], v)
  })
}
