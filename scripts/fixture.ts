// The numbers: a world with a generic 40-field table of 200,000 rows and a
// related table of 20,000, built through the same calls a kit uses, then the questions the
// window, the model, a kit and a connection ask of it, each timed. The same script ran on the
// JSON records of c988f49 and runs on the real tables, so every number has its twin.
//   pnpm fixture [rows] [--keep]     (rows: the big table's size, 200000 unless said)
// Out: .data/fixture/<stamp>/ (the world; removed unless --keep) and the table printed.
import { mkdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { World } from '../core/src/world/world.ts'

const ROOT = join(import.meta.dirname, '..')
const args = process.argv.slice(2)
const ROWS = Number(args.find((a) => /^\d+$/.test(a)) ?? 200000)
const OTHERS = Math.max(100, Math.round(ROWS / 10))
const keep = args.includes('--keep')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const dir = join(ROOT, '.data', 'fixture', stamp)
mkdirSync(dir, { recursive: true })

// deterministic values, so both runs hold the same rows
let seed = 20261022
const rand = () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)] as T
const WORDS = [
  'alpha',
  'broker',
  'census',
  'deal',
  'estate',
  'figure',
  'garden',
  'harbour',
  'needle',
  'orchard',
]
const words = (n: number) => Array.from({ length: n }, () => pick(WORDS)).join(' ')
const CHOICES = ['A', 'B', 'C', 'D']
const day = (i: number) =>
  new Date(Date.UTC(2024, 0, 1) + (i % 900) * 86400000).toISOString().slice(0, 10)

const alpha = { kind: 'alpha' as const }
const world = await World.open(join(dir, 'tenants', 't_fixture'))
const m = world.shape.makeModule('Fixture', { actor: alpha })
const others = world.shape.makeTable(
  m.id,
  'Others',
  [
    { name: 'Name', kind: 'text' },
    { name: 'Score', kind: 'number' },
  ],
  { actor: alpha },
)
const fields: Parameters<typeof world.shape.makeTable>[2] = [
  ...Array.from({ length: 12 }, (_, i) => ({ name: `Text ${i + 1}`, kind: 'text' as const })),
  ...Array.from({ length: 8 }, (_, i) => ({ name: `Number ${i + 1}`, kind: 'number' as const })),
  ...Array.from({ length: 6 }, (_, i) => ({ name: `Money ${i + 1}`, kind: 'money' as const })),
  ...Array.from({ length: 4 }, (_, i) => ({ name: `Date ${i + 1}`, kind: 'date' as const })),
  ...Array.from({ length: 4 }, (_, i) => ({
    name: `Choice ${i + 1}`,
    kind: 'choice' as const,
    choices: CHOICES,
  })),
  { name: 'Link', kind: 'link' },
  { name: 'Email', kind: 'email' },
  { name: 'Phone', kind: 'phone' },
  { name: 'Other', kind: 'relation', relatesTo: 'Others' },
  // a list relation: `many` is read by the real-tables shape store and ignored by the JSON one
  { name: 'Others', kind: 'relation', relatesTo: 'Others', ...({ many: true } as object) },
]
// 40 fields: 12 + 8 + 6 + 4 + 4 + 3 + 2 = 39, and Notes
fields.push({ name: 'Notes', kind: 'text' })
const things = world.shape.makeTable(m.id, 'Things', fields, { actor: alpha })
const prov = { kind: 'looked_up' as const, source: { url: 'https://example.com/fixture' } }

const ms = (t0: number) => Math.round((performance.now() - t0) * 10) / 10
const out: [string, string][] = []
const say = (what: string, value: string) => {
  out.push([what, value])
  console.log(`· ${what}: ${value}`)
}

let t0 = performance.now()
const otherIds: string[] = []
for (let i = 0; i < OTHERS; i += 1000) {
  const batch = Array.from({ length: Math.min(1000, OTHERS - i) }, (_, k) => ({
    values: { Name: `Other ${i + k} ${words(2)}`, Score: Math.round(rand() * 1000) },
    provenance: prov,
  }))
  otherIds.push(...world.records.add(others.id, batch, { actor: alpha }))
}
say(`Add ${OTHERS} rows to Others`, `${ms(t0)} ms`)

const thing = (i: number) => {
  const v: Record<string, unknown> = {}
  for (let k = 1; k <= 12; k++) v[`Text ${k}`] = words(3)
  for (let k = 1; k <= 8; k++) v[`Number ${k}`] = Math.round(rand() * 100000) / 100
  for (let k = 1; k <= 6; k++)
    v[`Money ${k}`] = { amount: Math.round(rand() * 1e6), currency: 'USD' }
  for (let k = 1; k <= 4; k++) v[`Date ${k}`] = day(i + k)
  for (let k = 1; k <= 4; k++) v[`Choice ${k}`] = pick(CHOICES)
  v.Link = `https://example.com/things/${i}`
  v.Email = `thing${i}@example.com`
  v.Phone = `+1415555${String(i % 10000).padStart(4, '0')}`
  v.Other = pick(otherIds)
  v.Others = [pick(otherIds), pick(otherIds)]
  v.Notes = i % 1000 === 7 ? `${words(4)} needle ${words(2)}` : words(6)
  return v
}
t0 = performance.now()
for (let i = 0; i < ROWS; i += 1000) {
  const batch = Array.from({ length: Math.min(1000, ROWS - i) }, (_, k) => ({
    values: thing(i + k),
    provenance: prov,
  }))
  world.records.add(things.id, batch, { actor: alpha })
}
say(`Add ${ROWS} rows to Things`, `${ms(t0)} ms`)

const median = (f: () => unknown, n = 3) => {
  const times: number[] = []
  for (let i = 0; i < n; i++) {
    const t = performance.now()
    f()
    times.push(performance.now() - t)
  }
  times.sort((a, b) => a - b)
  return `${Math.round((times[Math.floor(n / 2)] as number) * 10) / 10} ms`
}

// what the window asks for
let listed: ReturnType<typeof world.records.list> = []
say(
  'List Things whole (the window)',
  median(() => (listed = world.records.list(things.id)), 1),
)
say(
  'Count Things',
  median(() => world.records.count(things.id)),
)
say(
  'Filter in the window (Choice 1 is B, over the list)',
  median(() => listed.filter((r) => r.values.choice_1 === 'B').length),
)
// what the model asks for
const sql = (q: string) => world.sql.query(q)
say(
  `Model: count where Choice 1 = 'B'`,
  median(() => sql(`SELECT count(*) AS n FROM things WHERE choice_1 = 'B'`)),
)
say(
  `Model: rows where Notes contain needle`,
  median(() => sql(`SELECT id, text_1 FROM things WHERE notes LIKE '%needle%'`)),
)
say(
  `Model: top 50 by Number 1`,
  median(() => sql(`SELECT id, number_1 FROM things ORDER BY number_1 DESC LIMIT 50`)),
)
say(
  'Model: join Things to Others',
  median(() =>
    sql(
      `SELECT t.text_1, o.name FROM things t JOIN others o ON o.id = t.other WHERE o.score > 990 LIMIT 50`,
    ),
  ),
)
// what a kit and a connection do
const one = listed[Math.floor(listed.length / 2)] as (typeof listed)[number]
say(
  'Change one row',
  median(() =>
    world.records.change(
      things.id,
      [
        {
          id: one.id,
          values: { 'Text 1': words(3) },
          provenance: { kind: 'estimated', basis: 'the fixture' },
        },
      ],
      { actor: alpha },
    ),
  ),
)
const items = Array.from({ length: 1000 }, (_, k) => ({
  key: `item-${k}`,
  values: { 'Text 2': words(3), 'Number 2': k },
}))
world.records.land(things.id, items.slice(0, 500), { connector: 'fixture' }, { actor: alpha })
t0 = performance.now()
world.records.land(
  things.id,
  items.map((it, k) => (k < 500 ? { ...it, values: { ...it.values, 'Number 2': k + 1 } } : it)),
  { connector: 'fixture' },
  { actor: alpha },
)
say('Land 1,000 items (500 changed, 500 new)', `${ms(t0)} ms`)
// shape changes on the populated table
t0 = performance.now()
world.shape.addFields(things.id, [{ name: 'Added', kind: 'text' }], { actor: alpha })
say('Add a field', `${ms(t0)} ms`)
t0 = performance.now()
world.shape.rename({ table: things.id, field: 'Added' }, 'Renamed', { actor: alpha })
say('Rename the field', `${ms(t0)} ms`)
const shape = world.shape as unknown as {
  removeField?: (t: string, f: string, ctx: unknown) => void
}
if (shape.removeField) {
  t0 = performance.now()
  shape.removeField.call(world.shape, things.id, 'Renamed', { actor: alpha })
  say('Drop the field', `${ms(t0)} ms`)
} else say('Drop the field', 'not possible on this code')
world.db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
say(
  'World file',
  `${Math.round(statSync(join(dir, 'tenants', 't_fixture', 'world.sqlite')).size / 1048576)} MB`,
)
world.close()
if (!keep) rmSync(dir, { recursive: true, force: true })

console.log('\n| Measured | Time |\n| --- | --- |')
for (const [k, v] of out) console.log(`| ${k} | ${v} |`)
