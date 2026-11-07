// A journey's checks (design §16): each reads the world after a step, never the model's prose,
// and says what it saw. The runner (run.ts) judges every step's checks here.
import { join } from 'node:path'
import { z } from 'zod'
import { agents } from '../modules/agents.ts'
import { printPage } from '../pages/pages.ts'
import { businessCase } from '../world/shape/manifest.ts'
import { placeOf } from '../world/shape/parts.ts'
import type { User, World } from '../world/world.ts'

const ROOT = join(import.meta.dirname, '..', '..', '..')

export const Check = z.union([
  z.object({ tables: z.number() }),
  z.object({ rows: z.number() }),
  z.object({ stated: z.object({ matches: z.string(), from: z.string() }) }),
  z.object({ permission_cards: z.number() }),
  z.object({ cards_waiting: z.number() }),
  z.object({ errors: z.number() }),
  z.object({ documents: z.number() }),
  z.object({ rows_in: z.object({ table: z.string(), count: z.number() }) }),
  // where a table sits in its module (core step 3a): a main table, part of a row, or setup
  z.object({
    place: z.object({ table: z.string(), is: z.enum(['main', 'part', 'setup', 'people']) }),
  }),
  // what the model's use cost, kept (core plan step 5): under a module (Alpha's, asked on Home),
  // an agent or a model, more than nothing
  z.object({
    spent: z.object({
      module: z.string().optional(),
      agent: z.string().optional(),
      model: z.string().optional(),
    }),
  }),
  // a table kept as a tab of its module, wherever it sits (28 Oct)
  z.object({ tab: z.object({ table: z.string(), is: z.boolean() }) }),
  // what the model's own views say: how many rows a query gives, or words its rows hold
  z.object({
    query: z.object({
      sql: z.string(),
      count: z.number().optional(),
      matches: z.string().optional(),
    }),
  }),
  // a summary field on a table (core step 3c), and what it comes to on a row named so
  z.object({
    summary: z.object({
      table: z.string(),
      row: z.string().optional(),
      equals: z.number().optional(),
    }),
  }),
  // the rows of a table that name someone, through any merge (core step 3d): each under their
  // own id, and so many of them
  z.object({
    person_rows: z.object({ table: z.string(), person: z.string(), count: z.number().optional() }),
  }),
  // the builder's walls (core step 3e): no table named so, none that is only a name, a field of a
  // kind somewhere, a choice field holding these, and a module's business case (each module's)
  z.object({ no_table: z.string() }),
  z.object({ no_field: z.object({ table: z.string(), field: z.string() }) }),
  z.object({ name_only_tables: z.number() }),
  z.object({ field_kind: z.string() }),
  z.object({ choices: z.array(z.string()) }),
  z.object({ business_case: z.object({ module: z.string().optional() }) }),
  z.object({ reply_matches: z.string() }),
  z.object({
    card: z.object({
      gate: z.string().optional(), // none: a question, such as a rule's Save card
      words: z.string().optional(),
      detail: z.string().optional(),
    }),
  }),
  z.object({
    connector_calls: z.object({
      words: z.string(),
      count: z.number().optional(), // exactly: what must never happen twice, or at all
      at_least: z.number().optional(), // a read the model may repeat as it looks around
    }),
  }),
  // a connection's state, what it says, or who set it up (step 2, part 4)
  z.object({
    connection: z.object({
      connector: z.string(),
      state: z.string().optional(),
      health: z.string().optional(),
      owner: z.string().optional(),
    }),
  }),
  // what the newest revert said, in part (step 2, part 2: a take-back outside Alpha)
  z.object({ reverted: z.string() }),
  // a connector's attempts the sandbox refused, listed under it (step 2, part 1, slice 2)
  z.object({
    refused: z.object({ connector: z.string(), host: z.string(), count: z.number() }),
  }),
  z.object({ agents_on: z.number() }),
  z.object({ last_run: z.enum(['ok', 'failed', 'stopped']) }),
  z.object({ looked_up_from: z.object({ table: z.string(), url: z.string() }) }),
  z.object({ question: z.object({ words: z.string().optional(), options: z.string() }) }),
  z.object({
    field: z.object({
      table: z.string(),
      key: z.string().optional(), // the row's own key, as a connection or a reader landed it
      row: z.string().optional(), // or its name, as the window shows it (rules step 1)
      field: z.string(),
      equals: z.string().optional(),
      count: z.number().optional(), // a relation's rows
    }),
  }),
  // what is kept beside the person's value on a row (rules step 1, D3, D6): a machine's newer
  // value, or the source's, by the row's own key; any at all when no value is named
  z.object({
    beside: z.object({
      table: z.string(),
      key: z.string().optional(),
      row: z.string().optional(),
      field: z.string(),
      equals: z.string().optional(),
    }),
  }),
  z.object({ told: z.object({ matches: z.string(), rows: z.number().optional() }) }),
  // a module's page, drawn with its data: its words match
  z.object({ page: z.object({ module: z.string(), name: z.string(), matches: z.string() }) }),
])
export type Check = z.infer<typeof Check>

// A row's value and where it came from, by the row's own key or its name as the window shows it.
function cellOf(
  world: World,
  c: { table: string; key?: string | undefined; row?: string | undefined; field: string },
) {
  const t = world.shape.table(c.table)
  if (!t) return undefined
  const rows = world.records.list(t.id)
  const id = c.key ? world.records.byKey(t.id, c.key) : undefined
  const r = rows.find((x) => (id ? x.id === id : world.rowName(t, x.values) === c.row))
  const slug = t.fields.find((x) => x.name === c.field)?.slug ?? ''
  return r ? { value: r.values[slug], provenance: r.provenance[slug] } : undefined
}

export interface Outcome {
  check: string
  ok: boolean
  saw: string
}

export async function judge(world: World, user: User, check: Check): Promise<Outcome> {
  if ('page' in check) {
    const m = world.shape.module(check.page.module)
    const words = m
      ? (
          await printPage(world, m, check.page.name, {
            browsers: join(ROOT, '.data', 'browsers'),
            as: 'text',
          })
        ).toString()
      : 'no such module'
    return {
      check: `the page ${check.page.name} shows /${check.page.matches}/`,
      ok: new RegExp(check.page.matches).test(words),
      saw: words.replace(/\s+/g, ' ').slice(0, 600),
    }
  }
  const tables = world.shape.tables()
  if ('tables' in check)
    return {
      check: `tables: ${check.tables}`,
      ok: tables.length === check.tables,
      saw: `${tables.length}: ${tables.map((t) => t.name).join(', ')}`,
    }
  if ('rows' in check) {
    const n = tables.reduce((s, t) => s + world.records.count(t.id), 0)
    return { check: `rows: ${check.rows}`, ok: n === check.rows, saw: String(n) }
  }
  if ('stated' in check) {
    const said = world
      .lines({ user: user.id, kinds: ['said'] })
      .find((l) => l.words === check.stated.from)
    const re = new RegExp(check.stated.matches, 'i')
    const found: string[] = []
    for (const t of tables)
      for (const r of world.records.list(t.id))
        for (const [field, value] of Object.entries(r.values)) {
          const p = r.provenance[field]
          if (
            re.test(String(value)) &&
            p?.kind === 'stated' &&
            said &&
            p.source.message === said.id
          )
            found.push(`${t.name}.${field} = ${JSON.stringify(value)}`)
        }
    return {
      check: `a value matching /${check.stated.matches}/ stated in “${check.stated.from}”`,
      ok: found.length > 0,
      saw: found.join('; ') || 'none',
    }
  }
  if ('place' in check) {
    const t = world.shape.table(check.place.table)
    const is = t ? placeOf(t) : 'missing'
    return {
      check: `${check.place.table} is ${check.place.is}`,
      ok: is === check.place.is,
      saw: is,
    }
  }
  if ('spent' in check) {
    const c = check.spent
    const kept = !!world.db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'spend'")
      .get()
    const rows = kept
      ? (world.db
          .prepare(
            'SELECT module_id, agent, model, input + output + cache_read + cache_write AS tokens, usd FROM spend',
          )
          .all() as {
          module_id: string | null
          agent: string | null
          model: string
          tokens: number
          usd: number | null
        }[])
      : []
    const mine = rows.filter(
      (r) =>
        (!c.module ||
          ((r.module_id && world.shape.module(r.module_id)?.name) || 'Alpha') === c.module) &&
        (!c.agent || r.agent === c.agent) &&
        (!c.model || r.model === c.model),
    )
    const usd = mine.reduce((s, r) => s + (r.usd ?? 0), 0)
    const tokens = mine.reduce((s, r) => s + r.tokens, 0)
    return {
      check: `spent ${
        Object.entries(c)
          .map(([k, v]) => `by ${k} ${v}`)
          .join(', ') || 'in all'
      }`,
      ok: usd > 0 && tokens > 0,
      saw: kept ? `${tokens} tokens, $${usd.toFixed(4)}` : 'no spend kept',
    }
  }
  if ('tab' in check) {
    const t = world.shape.table(check.tab.table)
    const is = !!t?.tab
    return {
      check: `${check.tab.table} is ${check.tab.is ? '' : 'not '}a tab`,
      ok: !!t && is === check.tab.is,
      saw: t ? (is ? 'a tab' : 'not a tab') : 'no such table',
    }
  }
  if ('no_table' in check) {
    const re = new RegExp(check.no_table, 'i')
    const names = world.shape.tables().map((t) => t.name)
    return {
      check: `no table named /${check.no_table}/`,
      ok: !names.some((n) => re.test(n)),
      saw: names.join(', ') || 'no tables',
    }
  }
  if ('name_only_tables' in check) {
    const only = world.shape
      .tables()
      .filter((t) => {
        const fs = t.fields.filter((f) => f.kind !== 'notes')
        return fs.length === 1 && fs[0]?.kind === 'text'
      })
      .map((t) => t.name)
    return {
      check: `${check.name_only_tables} table(s) that are only a name`,
      ok: only.length === check.name_only_tables,
      saw: only.join(', ') || 'none',
    }
  }
  if ('field_kind' in check) {
    const has = world.shape
      .tables()
      .flatMap((t) =>
        t.fields.filter((f) => f.kind === check.field_kind).map((f) => `${t.name}.${f.name}`),
      )
    return {
      check: `a ${check.field_kind} field`,
      ok: has.length > 0,
      saw: has.join(', ') || 'none',
    }
  }
  if ('choices' in check) {
    const want = check.choices.map((c) => c.toLowerCase())
    const fields = world.shape
      .tables()
      .flatMap((t) => t.fields.filter((f) => f.kind === 'choice').map((f) => ({ t, f })))
    const hit = fields.find(({ f }) =>
      want.every((w) => f.choices.some((c) => c.toLowerCase() === w)),
    )
    return {
      check: `a choice field holding ${check.choices.join(', ')}`,
      ok: !!hit,
      saw:
        fields.map(({ t, f }) => `${t.name}.${f.name}: ${f.choices.join(', ')}`).join('; ') ||
        'none',
    }
  }
  if ('business_case' in check) {
    const ms = world.shape
      .modules()
      .filter((m) => !check.business_case.module || m.name === check.business_case.module)
    const without = ms.filter((m) => !businessCase(m)).map((m) => m.name)
    return {
      check: `${check.business_case.module ?? 'every module'} has a business case`,
      ok: ms.length > 0 && !without.length,
      saw: without.length
        ? `none on ${without.join(', ')}`
        : ms.map((m) => `${m.name}: ${businessCase(m)?.keeps}`).join('; '),
    }
  }
  if ('person_rows' in check) {
    const c = check.person_rows
    const t = world.shape.table(c.table)
    const p = world.db
      .prepare("SELECT id FROM people WHERE kind = 'person' AND lower(name) = lower(?)")
      .get(c.person) as { id: string } | undefined
    const f = t?.fields.find((x) => x.kind === 'person')
    const values = t && f && p ? world.records.column(t.id, f.name) : []
    const through = values.filter((v) => v.value && world.people.root(String(v.value)) === p?.id)
    const own = through.filter((v) => v.value === p?.id)
    return {
      check: `${c.table} names ${c.person}${c.count !== undefined ? ` on ${c.count} row(s)` : ''}, each under their own id`,
      ok:
        !!p &&
        own.length === through.length &&
        (c.count === undefined || through.length === c.count),
      saw: `${through.length} row(s), ${own.length} under their own id`,
    }
  }
  if ('summary' in check) {
    const c = check.summary
    const t = world.shape.table(c.table)
    const sums = t?.fields.filter((f) => f.kind === 'summary') ?? []
    const row =
      t && c.row
        ? world.records
            .list(t.id)
            .find((r) => world.rowName(t, r.values).toLowerCase() === c.row?.toLowerCase())
        : undefined
    const amounts = sums.map((f) => {
      const v = row?.values[f.slug]
      return v && typeof v === 'object' ? (v as { amount: number }).amount : v
    })
    return {
      check: `${c.table} has a summary${c.row ? ` that comes to ${c.equals} on ${c.row}` : ''}`,
      ok: sums.length > 0 && (!c.row || amounts.includes(c.equals)),
      saw:
        sums
          .map((f, i) => `${f.name}${c.row ? ` = ${JSON.stringify(amounts[i] ?? null)}` : ''}`)
          .join(', ') || 'no summary',
    }
  }
  if ('permission_cards' in check) {
    const n = Number(
      (
        world.db.prepare("SELECT count(*) AS n FROM cards WHERE kind = 'permission'").get() as {
          n: number
        }
      ).n,
    )
    return {
      check: `permission cards: ${check.permission_cards}`,
      ok: n === check.permission_cards,
      saw: String(n),
    }
  }
  if ('cards_waiting' in check) {
    const n = world.cards.waiting(user.id).length
    return {
      check: `cards waiting: ${check.cards_waiting}`,
      ok: n === check.cards_waiting,
      saw: String(n),
    }
  }
  if ('documents' in check) {
    const docs = world.files.documents()
    return {
      check: `documents: ${check.documents}`,
      ok: docs.length === check.documents,
      saw: `${docs.length}: ${docs.map((d) => `${d.title} (${d.chunks})`).join('; ')}`,
    }
  }
  if ('rows_in' in check) {
    const t = world.shape.table(check.rows_in.table)
    const n = t ? world.records.count(t.id) : -1
    return {
      check: `rows in ${check.rows_in.table}: ${check.rows_in.count}`,
      ok: n === check.rows_in.count,
      saw: t ? String(n) : 'no such table',
    }
  }
  if ('query' in check) {
    const q = check.query
    let rows: Record<string, unknown>[] = []
    let problem = ''
    try {
      rows = world.sql.query(q.sql).rows
    } catch (err) {
      problem = err instanceof Error ? err.message : String(err)
    }
    const text = JSON.stringify(rows)
    return {
      check: `${q.sql}${q.count !== undefined ? ` gives ${q.count}` : ''}${q.matches ? ` showing /${q.matches}/` : ''}`,
      ok:
        !problem &&
        (q.count === undefined || rows.length === q.count) &&
        (!q.matches || new RegExp(q.matches, 'i').test(text)),
      saw: problem || text.slice(0, 400),
    }
  }
  if ('reply_matches' in check) {
    const reply = world.lines({ user: user.id, kinds: ['replied'] }).at(-1)?.words ?? ''
    const re = new RegExp(check.reply_matches, 'i')
    return {
      check: `the reply matches /${check.reply_matches}/`,
      ok: re.test(reply),
      saw: reply.slice(0, 160),
    }
  }
  if ('card' in check) {
    const cards = world.cards.waiting(user.id).filter((c) => c.gate === (check.card.gate ?? null))
    const hit = cards.find(
      (c) =>
        (!check.card.words || new RegExp(check.card.words, 'i').test(c.words)) &&
        (!check.card.detail || new RegExp(check.card.detail, 'i').test(c.detail ?? '')),
    )
    return {
      check: `a ${check.card.gate ?? 'question'} card waiting${check.card.detail ? ` showing /${check.card.detail}/` : ''}`,
      ok: !!hit,
      saw: cards.map((c) => `${c.words} | ${(c.detail ?? '').slice(0, 80)}`).join('; ') || 'none',
    }
  }
  if ('connector_calls' in check) {
    const n = world
      .lines({ kinds: ['connector_call'] })
      .filter((l) => l.words === check.connector_calls.words).length
    const { words, count, at_least } = check.connector_calls
    return {
      check: `“${words}” ${at_least !== undefined ? `at least ${at_least}` : count} time(s)`,
      ok: at_least !== undefined ? n >= at_least : n === count,
      saw: String(n),
    }
  }
  if ('connection' in check) {
    const c = check.connection
    const k = world.connections.list().find((x) => x.connector === c.connector)
    const saw = k ? `${k.state} | ${k.health ?? ''} | ${k.madeBy}` : 'no connection'
    const ok =
      !!k &&
      (c.state === undefined || k.state === c.state) &&
      (c.health === undefined || new RegExp(c.health, 'i').test(k.health ?? '')) &&
      (c.owner === undefined || k.madeBy.startsWith(c.owner))
    return {
      check: `the ${c.connector} connection ${[c.state && `is ${c.state}`, c.health && `says /${c.health}/`, c.owner && `was set up by ${c.owner}`].filter(Boolean).join(', ')}`,
      ok,
      saw,
    }
  }
  if ('reverted' in check) {
    const last = world.lines({ kinds: ['reverted', 'took_back'] }).at(-1)
    return {
      check: `the newest revert says /${check.reverted}/`,
      ok: !!last && new RegExp(check.reverted, 'i').test(last.words),
      saw: last?.words ?? 'no revert',
    }
  }
  if ('refused' in check) {
    const r = check.refused
    const n = world
      .lines({ kinds: ['reach_refused'] })
      .filter(
        (l) => l.data.connector === r.connector && String(l.data.host).startsWith(r.host),
      ).length
    return {
      check: `${r.connector} refused reaching ${r.host} ${r.count} time(s)`,
      ok: n === r.count,
      saw: String(n),
    }
  }
  if ('agents_on' in check) {
    const n = agents(world).filter((a) => a.state === 'on').length
    return { check: `agents on: ${check.agents_on}`, ok: n === check.agents_on, saw: String(n) }
  }
  if ('last_run' in check) {
    const r = world.db
      .prepare('SELECT state, words FROM runs ORDER BY started_at DESC, rowid DESC LIMIT 1')
      .get() as { state: string; words: string } | undefined
    return {
      check: `the last run ended ${check.last_run}`,
      ok: r?.state === check.last_run,
      saw: r ? `${r.state}: ${r.words}` : 'no run',
    }
  }
  if ('looked_up_from' in check) {
    const t = world.shape.table(check.looked_up_from.table)
    const rows = t ? world.records.list(t.id) : []
    const off = rows.filter(
      (r) =>
        !Object.values(r.provenance).some(
          (p) => p?.kind === 'looked_up' && p.source.url?.includes(check.looked_up_from.url),
        ),
    )
    return {
      check: `every row in ${check.looked_up_from.table} looked up from a page with ${check.looked_up_from.url}`,
      ok: rows.length > 0 && off.length === 0,
      saw: `${rows.length - off.length} of ${rows.length}`,
    }
  }
  if ('question' in check) {
    const q = check.question
    const cards = world.cards
      .waiting(user.id)
      .filter((c) => c.kind === 'question' && c.options.includes(q.options))
      .filter((c) => !q.words || new RegExp(q.words, 'i').test(c.words))
    return {
      check: `a question waiting with the option ${q.options}`,
      ok: cards.length > 0,
      saw: world.cards
        .waiting(user.id)
        .map((c) => `${c.words} [${c.options.join(' / ')}]`)
        .join(' | '),
    }
  }
  if ('field' in check) {
    const f = check.field
    const value = cellOf(world, f)?.value
    const ok =
      f.equals !== undefined
        ? value === f.equals
        : f.count !== undefined
          ? Array.isArray(value) && value.length === f.count
          : value !== undefined
    return {
      check: `${f.field} of ${f.row ?? f.key} in ${f.table} ${f.equals !== undefined ? `is ${f.equals}` : `has ${f.count}`}`,
      ok,
      saw: JSON.stringify(value ?? null),
    }
  }
  if ('no_field' in check) {
    const t = world.shape.table(check.no_field.table)
    const names = t?.fields.map((f) => f.name) ?? []
    return {
      check: `${check.no_field.table} has no field ${check.no_field.field}`,
      ok: !names.includes(check.no_field.field),
      saw: names.join(', '),
    }
  }
  if ('beside' in check) {
    const b = check.beside
    const kept = cellOf(world, b)?.provenance?.beside
    return {
      check: `beside ${b.field} of ${b.row ?? b.key} in ${b.table}: ${b.equals ?? 'a value'}`,
      ok: b.equals !== undefined ? kept?.value === b.equals : kept !== undefined,
      saw: JSON.stringify(kept?.value ?? null),
    }
  }
  if ('told' in check) {
    const told = world.lines({ user: user.id, kinds: ['told'] })
    const re = new RegExp(check.told.matches, 'i')
    const n = told.filter((l) => re.test(l.words)).length
    return {
      check: `told /${check.told.matches}/${check.told.rows !== undefined ? ` ${check.told.rows} time(s)` : ''}`,
      ok: check.told.rows !== undefined ? n === check.told.rows : n > 0,
      saw: told.map((l) => l.words).join(' | ') || 'nothing told',
    }
  }
  const n = world.lines({ kinds: ['error'] }).length
  return { check: `errors: ${check.errors}`, ok: n === check.errors, saw: String(n) }
}
