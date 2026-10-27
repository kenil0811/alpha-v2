// A journey's checks (design §16): each reads the world after a step, never the model's prose,
// and says what it saw. The runner (run.ts) judges every step's checks here.
import { join } from 'node:path'
import { z } from 'zod'
import { agents } from '../modules/agents.ts'
import { printPage } from '../pages/pages.ts'
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
  z.object({ place: z.object({ table: z.string(), is: z.enum(['main', 'part', 'setup']) }) }),
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
  z.object({ reply_matches: z.string() }),
  z.object({
    card: z.object({
      gate: z.string().optional(), // none: a question, such as a rule's Save card
      words: z.string().optional(),
      detail: z.string().optional(),
    }),
  }),
  z.object({ connector_calls: z.object({ words: z.string(), count: z.number() }) }),
  z.object({ agents_on: z.number() }),
  z.object({ last_run: z.enum(['ok', 'failed', 'stopped']) }),
  z.object({ looked_up_from: z.object({ table: z.string(), url: z.string() }) }),
  z.object({ question: z.object({ words: z.string().optional(), options: z.string() }) }),
  z.object({
    field: z.object({
      table: z.string(),
      key: z.string(), // the row's own key, as a connection or a reader landed it
      field: z.string(),
      equals: z.string().optional(),
      count: z.number().optional(), // a relation's rows
    }),
  }),
  z.object({ told: z.object({ matches: z.string(), rows: z.number().optional() }) }),
  // a module's page, drawn with its data: its words match
  z.object({ page: z.object({ module: z.string(), name: z.string(), matches: z.string() }) }),
])
export type Check = z.infer<typeof Check>

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
    return {
      check: `“${check.connector_calls.words}” ${check.connector_calls.count} time(s)`,
      ok: n === check.connector_calls.count,
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
    const t = world.shape.table(f.table)
    const row = t ? world.records.byKey(t.id, f.key) : undefined
    const slug = t?.fields.find((x) => x.name === f.field)?.slug ?? ''
    const value =
      t && row ? world.records.list(t.id).find((r) => r.id === row)?.values[slug] : undefined
    const ok =
      f.equals !== undefined
        ? value === f.equals
        : f.count !== undefined
          ? Array.isArray(value) && value.length === f.count
          : value !== undefined
    return {
      check: `${f.field} of ${f.key} in ${f.table} ${f.equals !== undefined ? `is ${f.equals}` : `has ${f.count}`}`,
      ok,
      saw: JSON.stringify(value ?? null),
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
