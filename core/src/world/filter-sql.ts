// A view's filter rule as SQL (core step 3c). A summary's one condition is said in the same words
// as a view's filter and means what the window's filter means: filter-cases.ts holds the cases
// both answer, and both test against them. The dates relative to today (today, this week, the
// next days) are a view's alone: a summary's condition does not move with the clock.
import { lit } from './ddl.ts'
import { Refused } from './kinds.ts'
import type { Field } from './shape/types.ts'
import type { FILTER_OPS } from './views.ts'

export type FilterOp = (typeof FILTER_OPS)[number]

export interface Rule {
  field: string // the field's id where it is kept, its name where it is given
  op: FilterOp
  value?: string | number | null | undefined
  value2?: string | number | null | undefined
  values?: string[] | undefined
}

const TEXT = ['text', 'link', 'email', 'phone']
const TEXT_OPS: FilterOp[] = ['contains', 'not_contains', 'is', 'is_not', 'starts', 'ends']
const NUMBER_OPS: FilterOp[] = ['eq', 'ne', 'gt', 'lt', 'between']
const EMPTY: FilterOp[] = ['empty', 'not_empty']

// The ops a condition on this field may take.
export function opsFor(f: Pick<Field, 'kind' | 'tags'>): FilterOp[] {
  if (f.kind === 'choice') return f.tags ? ['in', 'all_of', 'none_of', ...EMPTY] : ['in', ...EMPTY]
  if (TEXT.includes(f.kind)) return [...TEXT_OPS, ...EMPTY]
  if (f.kind === 'number' || f.kind === 'money') return [...NUMBER_OPS, ...EMPTY]
  if (f.kind === 'date') return ['before', 'after', 'between', ...EMPTY]
  return EMPTY
}

// A rule checked against its field: an op it takes, and the values that op needs.
export function checkRule(f: Field, r: Omit<Rule, 'field'>, name: string): Omit<Rule, 'field'> {
  const ops = opsFor(f)
  if (!ops.includes(r.op))
    throw new Refused(`${name}: a condition on ${f.name} is one of ${ops.join(', ')}.`)
  if (r.op === 'in' || r.op === 'all_of' || r.op === 'none_of') {
    const values = (r.values ?? []).map(String)
    const off = values.filter((v) => f.choices.length && !f.choices.includes(v))
    if (!values.length || off.length)
      throw new Refused(`${name}: ${f.name}'s condition names some of ${f.choices.join(', ')}.`)
    return { op: r.op, values }
  }
  if (EMPTY.includes(r.op)) return { op: r.op }
  const day = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
  const num = (v: unknown) => v !== null && v !== '' && Number.isFinite(Number(v))
  const ok = f.kind === 'date' ? day : NUMBER_OPS.includes(r.op) ? num : () => true
  if (!ok(r.value) || (r.op === 'between' && !ok(r.value2)))
    throw new Refused(
      `${name}: ${f.name} ${r.op} needs ${f.kind === 'date' ? 'a date like 2026-10-27' : 'a value'}${r.op === 'between' ? ' and a second' : ''}.`,
    )
  return {
    op: r.op,
    value: r.value ?? null,
    ...(r.op === 'between' ? { value2: r.value2 ?? null } : {}),
  }
}

const like = (s: string, before: string, after: string) =>
  `${lit(`${before}${s.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}${after}`)} ESCAPE '\\'`

// The rule as a SQL condition on a column (a money field's amount column), its values inlined.
export function ruleSql(
  f: Pick<Field, 'kind' | 'tags'>,
  col: string,
  r: Omit<Rule, 'field'>,
): string {
  const values = (r.values ?? []).map(lit).join(', ')
  if (f.kind === 'choice' && f.tags) {
    const has = `SELECT count(DISTINCT value) FROM json_each(${col}) WHERE value IN (${values})`
    if (r.op === 'in') return `(${has}) > 0`
    if (r.op === 'all_of') return `(${has}) = ${new Set(r.values).size}`
    if (r.op === 'none_of') return `(${has}) = 0`
  }
  const text = TEXT.includes(f.kind) || f.kind === 'choice'
  if (r.op === 'empty') return text ? `(${col} IS NULL OR ${col} = '')` : `${col} IS NULL`
  if (r.op === 'not_empty')
    return text ? `(${col} IS NOT NULL AND ${col} <> '')` : `${col} IS NOT NULL`
  if (r.op === 'in') return r.values?.length ? `${col} IN (${values})` : '1'
  const s = String(r.value ?? '')
  const t = `lower(coalesce(${col}, ''))`
  const n = Number(r.value)
  const day = `substr(${col}, 1, 10)`
  switch (r.op) {
    case 'is':
      return `${t} = ${lit(s.toLowerCase())}`
    case 'is_not':
      return `${t} <> ${lit(s.toLowerCase())}`
    case 'contains':
      return `${t} LIKE ${like(s, '%', '%')}`
    case 'not_contains':
      return `${t} NOT LIKE ${like(s, '%', '%')}`
    case 'starts':
      return `${t} LIKE ${like(s, '', '%')}`
    case 'ends':
      return `${t} LIKE ${like(s, '%', '')}`
    case 'eq':
      return `${col} = ${n}`
    case 'ne':
      return `(${col} IS NULL OR ${col} <> ${n})`
    case 'gt':
      return `${col} > ${n}`
    case 'lt':
      return `${col} < ${n}`
    case 'before':
      return `${day} < ${lit(s)}`
    case 'after':
      return `${day} > ${lit(s)}`
    case 'between': {
      if (f.kind === 'date') {
        const [a, b] = [s, String(r.value2 ?? '')].sort()
        return `${day} BETWEEN ${lit(a as string)} AND ${lit(b as string)}`
      }
      const m = Number(r.value2)
      return `${col} BETWEEN ${Math.min(n, m)} AND ${Math.max(n, m)}`
    }
    default:
      return '1'
  }
}

const WORDS: Partial<Record<FilterOp, string>> = {
  is_not: 'is not',
  not_contains: 'doesn’t contain',
  starts: 'starts with',
  ends: 'ends with',
  eq: 'equals',
  ne: 'is not',
  gt: 'more than',
  lt: 'less than',
  empty: 'is empty',
  not_empty: 'is not empty',
}

// A rule in words: "Paid is No", "Amount more than 100", "Tags has all of Hot and Warm".
export function ruleWords(name: string, r: Omit<Rule, 'field'>): string {
  const list = (r.values ?? []).join(r.op === 'all_of' ? ' and ' : ' or ')
  if (r.op === 'in') return `${name} is ${list}`
  if (r.op === 'all_of') return `${name} has all of ${list}`
  if (r.op === 'none_of') return `${name} has none of ${list}`
  if (r.op === 'between') return `${name} between ${r.value} and ${r.value2}`
  if (EMPTY.includes(r.op)) return `${name} ${WORDS[r.op]}`
  return `${name} ${WORDS[r.op] ?? r.op} ${r.value}`
}
