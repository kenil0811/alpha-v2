// What a summary field comes to (core step 3c, Kenil's yes 27 Oct). A summary has no column and
// is never written: it is worked out when its table is read, one grouped query per summary per
// read, so it is never stale and nothing keeps it in step. Its provenance is computed, with what
// it is in words. Amounts in more than one currency are not added together: that summary is
// left empty on that row. The model reads a summary as a column of the table's view.
import { all, now } from '../db.ts'
import { quote } from '../ddl.ts'
import { ruleSql } from '../filter-sql.ts'
import type { Provenance } from '../kinds.ts'
import type { Field, Shape, SummarySpec, Table } from '../shape/index.ts'
import { summaryWords } from '../shape/summary.ts'
import type { Records } from './records.ts'
import { CHUNK } from './types.ts'

interface Parts {
  child: Table
  key: string // the child's relation column, on alias c
  where: string // the condition, with its value inlined as a literal
  value: string // the child's column the summary takes, on alias c
  currency: string | null // a money field's currency column
  order: string // latest: newest first
}

type Lookup = (id: string) => Table | undefined

function parts(table: Lookup, s: SummarySpec): Parts | null {
  const child = table(s.of)
  const through = child?.fields.find((f) => f.id === s.through)
  if (!child || !through) return null
  const f = child.fields.find((x) => x.id === s.field)
  const by = child.fields.find((x) => x.id === s.by)
  return {
    child,
    key: `c.${quote(through.slug)}`,
    where: whereSql(child, s),
    value: f ? `c.${quote(f.slug)}` : 'NULL',
    currency: f?.kind === 'money' ? `c.${quote(`${f.slug}_currency`)}` : null,
    order: `${by ? `c.${quote(by.slug)} DESC NULLS LAST, ` : ''}c.created_at DESC, c.rowid DESC`,
  }
}

// The condition, as a view's filter means it, its values inlined.
function whereSql(child: Table, s: SummarySpec): string {
  const w = s.where
  const f = w ? child.fields.find((x) => x.id === w.field) : undefined
  return w && f ? ` AND ${ruleSql(f, `c.${quote(f.slug)}`, w)}` : ''
}

// One summary over the child's rows of each parent, as SQL: id, v, and for money cur and curs.
function select(p: Parts, s: SummarySpec): string {
  const from = `FROM ${quote(p.child.slug)} c WHERE ${p.key} IS NOT NULL${p.where}`
  if (s.op === 'latest')
    return `SELECT id, v${p.currency ? ', cur, 1 AS curs' : ''} FROM (
      SELECT ${p.key} AS id, ${p.value} AS v${p.currency ? `, ${p.currency} AS cur` : ''},
        row_number() OVER (PARTITION BY ${p.key} ORDER BY ${p.order}) AS n
      ${from} AND ${p.value} IS NOT NULL) WHERE n = 1`
  const agg = s.op === 'count' ? 'count(*)' : `${s.op}(${p.value})`
  const cur = p.currency ? `, max(${p.currency}) AS cur, count(DISTINCT ${p.currency}) AS curs` : ''
  return `SELECT ${p.key} AS id, ${agg} AS v${cur} ${from} GROUP BY ${p.key}`
}

// The currency most of a money field's amounts are in, for a sum of none: 0 in it.
function usual(records: Records, p: Parts): string | null {
  if (!p.currency) return null
  return (
    all<{ cur: string }>(
      records.db,
      `SELECT ${p.currency} AS cur FROM ${quote(p.child.slug)} c WHERE ${p.currency} IS NOT NULL GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`,
    )[0]?.cur ?? null
  )
}

// Every summary of a table worked out for these rows, by row then field id: a count or a sum of
// none is 0 (a sum of money, 0 in its usual currency); the least, most or latest of none is not
// there.
export function summaries(
  records: Records,
  table: Table,
  ids: string[],
): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>()
  const put = (id: string, f: string, v: unknown) => out.set(id, { ...out.get(id), [f]: v })
  const mixed = new Set<string>() // rows whose amounts are in more than one currency
  for (const f of table.fields) {
    const s = f.summary
    const p = s ? parts((id) => records.shape.table(id), s) : null
    if (!s || !p || !ids.length) continue
    for (let i = 0; i < ids.length; i += CHUNK) {
      const part = ids.slice(i, i + CHUNK)
      const rows = all<{ id: string; v: unknown; cur?: string | null; curs?: number }>(
        records.db,
        `SELECT * FROM (${select(p, s)}) WHERE id IN (${part.map(() => '?').join(', ')})`,
        ...part,
      )
      for (const r of rows) {
        if ((r.curs ?? 1) > 1) mixed.add(r.id)
        if (r.v === null || r.v === undefined || (r.curs ?? 1) > 1) continue
        put(r.id, f.id, p.currency ? { amount: r.v, currency: r.cur ?? '' } : r.v)
      }
    }
    const cur = s.op === 'sum' ? usual(records, p) : null
    const none =
      s.op === 'count' || (s.op === 'sum' && !p.currency)
        ? 0
        : cur
          ? { amount: 0, currency: cur }
          : undefined
    if (none !== undefined)
      for (const id of ids)
        if (out.get(id)?.[f.id] === undefined && !mixed.has(id)) put(id, f.id, none)
  }
  return out
}

// A summary's provenance: computed, with what it is in words.
export function summaryProvenance(shape: Shape, f: Field): Provenance {
  return {
    kind: 'computed',
    source: { formula: f.summary ? summaryWords(shape, f.summary) : f.name },
    at: now(),
  }
}

// A summary as the columns of the model's view of its table (alias t): its value, and a money
// summary's currency beside it, as a money field has.
export function summaryColumns(table: Lookup, f: Field): string[] {
  const s = f.summary
  const p = s ? parts(table, s) : null
  if (!s || !p) return [`NULL AS ${quote(f.slug)}`]
  const from = `FROM main.${quote(p.child.slug)} c WHERE ${p.key} = t.id${p.where}`
  const one = (what: string) =>
    s.op === 'latest'
      ? `(SELECT ${what} ${from} AND ${p.value} IS NOT NULL ORDER BY ${p.order} LIMIT 1)`
      : `(SELECT ${what} ${from})`
  // a count or a sum of none is 0, as the record store has it
  const agg = one(
    s.op === 'count'
      ? 'count(*)'
      : s.op === 'latest'
        ? p.value
        : `${s.op === 'sum' ? 'total' : s.op}(${p.value})`,
  )
  // amounts in more than one currency are not added together
  const value =
    p.currency && s.op !== 'latest'
      ? `CASE WHEN ${one(`count(DISTINCT ${p.currency})`)} > 1 THEN NULL ELSE ${agg} END`
      : agg
  const cols = [`${value} AS ${quote(f.slug)}`]
  // a sum of none takes the currency most of the amounts are in
  const usualSql = `(SELECT ${p.currency} FROM main.${quote(p.child.slug)} c WHERE ${p.currency} IS NOT NULL GROUP BY 1 ORDER BY count(*) DESC LIMIT 1)`
  if (p.currency)
    cols.push(
      `${s.op === 'latest' ? one(p.currency) : s.op === 'sum' ? `coalesce(${one(`max(${p.currency})`)}, ${usualSql})` : one(`max(${p.currency})`)} AS ${quote(`${f.slug}_currency`)}`,
    )
  return cols
}
