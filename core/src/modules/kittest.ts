// `alpha kit test <dir>` (decision 9): a kit's skills run against a fixture world and recorded
// answers, without the model, and the rows they land are compared with what the kit's test
// expects. A case is tests/<name>.yaml in the kit: which agent or script, its input, the rows to
// seed, the pages a browser call gets, the model's recorded answers, and what to expect. A
// refusal by a wall fails the case. `--record` runs the model for real and writes its answers
// into the case, to replay from then on.
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BrowserEngine } from '@alpha/connector-sdk'
import { parse, stringify } from 'yaml'
import { z } from 'zod'
import { askModel } from '../engine/ask.ts'
import type { Ask } from '../files/reading.ts'
import { Refused } from '../world/kinds.ts'
import type { Table } from '../world/shape.ts'
import { World } from '../world/world.ts'
import { agents } from './agents.ts'
import { install } from './kits.ts'
import { AgentRunner } from './runs.ts'

const Case = z.object({
  agent: z.string().optional(),
  script: z.string().optional(),
  input: z.record(z.string(), z.unknown()).default({}),
  rows: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))).default({}),
  pages: z.record(z.string(), z.unknown()).default({}), // by url: what browser.extract or open gets
  answers: z
    .array(z.object({ key: z.string(), about: z.string(), answer: z.unknown() }))
    .default([]),
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
    const engine = {
      open: async (url: string) => {
        if (!(url in c.pages)) throw new Refused(`The case has no page recorded for ${url}.`)
        return c.pages[url]
      },
      extract: async (url: string) => {
        if (!(url in c.pages)) throw new Refused(`The case has no page recorded for ${url}.`)
        return c.pages[url]
      },
    } as unknown as BrowserEngine
    const real = record ? askModel(world.paths.dir) : null
    const ask: Ask = async (prompt, schema) => {
      const key = keyOf(prompt, schema)
      if (recorded.has(key)) return { answer: recorded.get(key), tokens: 0 }
      if (!real)
        throw new Refused(
          'The script asked the model something this case has no answer recorded for; run the test with --record once.',
        )
      const out = await real(prompt, schema)
      learned.push({ key, about: prompt.slice(0, 120).replace(/\s+/g, ' '), answer: out.answer })
      return out
    }
    const runner = new AgentRunner(world, () => engine, { owner: null, ask, judge: ask })
    const out = c.agent
      ? await (async () => {
          const a = agents(world, module.id).find((x) => x.name === c.agent)
          if (!a) throw new Refused(`The kit has no agent called ${c.agent}.`)
          return runner.runAgent(a, undefined, c.input)
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
