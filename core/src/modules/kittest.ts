// `alpha kit test <dir>`: a kit's skills run against a fixture world and recorded
// answers, without the model, and the rows they land are compared with what the kit's test
// expects. A case is tests/<name>.yaml in the kit: which schedule or script, its input, the rows to
// seed, the pages a browser call gets, the model's recorded answers, and what to expect. `then`
// runs it again in the same world, each time with the pages a site shows by then and what to
// expect of that run (a reader's second read: a new listing, a changed one, one gone). A
// refusal by a wall fails the case. `--record` runs the model for real and writes its answers
// into the case, to replay from then on.
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type BrowserEngine, Problem } from '@alpha/connector-sdk'
import { parse, stringify } from 'yaml'
import { z } from 'zod'
import { askModel } from '../engine/ask.ts'
import type { Ask } from '../files/reading.ts'
import { Refused } from '../world/kinds.ts'
import type { Table } from '../world/shape/index.ts'
import { World } from '../world/world.ts'
import { install } from './kits/index.ts'
import { ScheduleRunner } from './runs/index.ts'
import { schedules } from './schedules.ts'

const Expect = z
  .object({
    state: z.enum(['ok', 'failed', 'stopped']).default('ok'),
    words: z.string().optional(), // a regular expression over the run's words
    result: z.unknown().optional(),
    rows: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))).default({}),
  })
  .default({ state: 'ok', rows: {} })

const Case = z.object({
  schedule: z.string().optional(),
  script: z.string().optional(),
  input: z.record(z.string(), z.unknown()).default({}),
  rows: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))).default({}),
  // by url: what browser.extract or open gets; { fail, kind } makes the call fail as a site would
  // (a timeout, a 403's blocked), so a reader's way with a failure can be tried
  pages: z.record(z.string(), z.unknown()).default({}),
  answers: z
    .array(z.object({ key: z.string(), about: z.string(), answer: z.unknown() }))
    .default([]),
  expect: Expect,
  // the runs after the first, in the same world: each with its own pages, and its input when it
  // differs
  // biome-ignore lint/suspicious/noThenProperty: the word a kit's author writes for a later run
  then: z
    .array(
      z.object({
        input: z.record(z.string(), z.unknown()).optional(),
        pages: z.record(z.string(), z.unknown()).default({}),
        expect: Expect,
      }),
    )
    .default([]),
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
  if (!c.schedule && !c.script) throw new Refused('A case names a schedule, or a script to run.')
  const home = mkdtempSync(join(tmpdir(), 'alpha-kit-test-'))
  const world = await World.open(join(home, 'tenants', 't_test'))
  const recorded = new Map(c.answers.map((a) => [a.key, a.answer]))
  const learned: KitTestCase['answers'] = []
  try {
    const ctx = { actor: { kind: 'alpha' as const } }
    const module = await install(world, dir, ctx)
    // the pages recorded are sites the kit may read in the test
    let pages = c.pages
    const hosts = [c.pages, ...c.then.map((t) => t.pages)].flatMap((p) =>
      Object.keys(p).map((u) => new URL(u).host),
    )
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
      if (!(url in pages)) throw new Refused(`The case has no page recorded for ${url}.`)
      const p = pages[url] as { fail?: unknown; kind?: unknown } | null
      if (p && typeof p.fail === 'string')
        throw new Problem(
          p.fail,
          p.kind === 'blocked' || p.kind === 'sign_in' || p.kind === 'gone' ? p.kind : 'other',
        )
      return p
    }
    const engine = {
      as() {
        return this
      },
      open: async (url: string) => page(url),
      extract: async (url: string) => page(url),
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
    const runner = new ScheduleRunner(world, () => engine, { owner: null, ask, judge: ask })
    // One run and what it is expected to leave; `nth` names a later run in what a failure says.
    const run = async (input: Record<string, unknown>, expect: KitTestCase['expect'], nth = '') => {
      const out = c.schedule
        ? await (async () => {
            const a = schedules(world, module.id).find((x) => x.name === c.schedule)
            if (!a) throw new Refused(`The kit has no schedule called ${c.schedule}.`)
            // a kit's test is its author asking: a paused schedule runs for it
            return runner.runSchedule(a, undefined, input, { asked: true })
          })()
        : await runner.runScript(module, c.script as string, input, 'the test', null)
      const refused = world
        .lines({ kinds: ['run_step'] })
        .filter((l) => l.words.startsWith('Refused: '))
        .map((l) => l.words)
      if (refused.length) throw new Refused(refused.join(' '))
      if (out.state !== expect.state)
        throw new Refused(`${nth}The run ended ${out.state}, not ${expect.state}: ${out.words}`)
      if (expect.words && !new RegExp(expect.words).test(out.words))
        throw new Refused(`${nth}The run said "${out.words}", not /${expect.words}/.`)
      if (expect.result !== undefined && !matches(out.result, expect.result))
        throw new Refused(
          `${nth}The run returned ${JSON.stringify(out.result)}, not ${JSON.stringify(expect.result)}.`,
        )
      for (const [tableName, rows] of Object.entries(expect.rows)) {
        const t = world.shape.table(tableName)
        if (!t) throw new Refused(`The case expects rows in ${tableName}, which is not there.`)
        const landed = world.records.list(t.id).map((r) => byName(t, r.values))
        for (const want of rows)
          if (!landed.some((have) => matches(have, want)))
            throw new Refused(
              `${nth}No row in ${t.name} has ${JSON.stringify(want)}; the table holds ${JSON.stringify(landed)}.`,
            )
      }
    }
    await run(c.input, c.expect)
    for (const [n, later] of c.then.entries()) {
      pages = later.pages
      await run(later.input ?? c.input, later.expect, `Run ${n + 2}: `)
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
