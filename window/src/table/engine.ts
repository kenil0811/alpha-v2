// A view applied to a table's rows (step 10, from v1's views/engine.ts, rewritten): search,
// filters by kind, sorts in levels with empty values last, one level of groups, totals and
// colours. Pure functions over the rows the window already holds.
import type { FieldView, FilterOp, FilterRule, RowView, TotalOp, ViewConfig } from '@alpha/core/api'
import { money, show } from './values.ts'

export const BLANK: ViewConfig = {
  kind: 'table',
  search: '',
  filters: { match: 'all', rules: [] },
  sorts: [],
  group: null,
  by: null,
  measure: null,
  hidden: [],
  order: [],
  widths: {},
  frozen: 1,
  wrap: [],
  totals: {},
  colours: { tint: null, when: [] },
}

// A saved view's config may predate a part; fill what is missing.
export function complete(c: Partial<ViewConfig> | undefined): ViewConfig {
  return {
    ...BLANK,
    ...c,
    filters: { ...BLANK.filters, ...c?.filters },
    colours: { ...BLANK.colours, ...c?.colours },
  }
}

export const differs = (a: ViewConfig, b: ViewConfig) =>
  JSON.stringify(complete(a)) !== JSON.stringify(complete(b))

export type Family = 'text' | 'number' | 'date' | 'choice' | 'tags' | 'other'

// A field's family; a choice holding several (tags, core step 3c) is its own.
export function family(kind: string, many = false): Family {
  if (kind === 'number' || kind === 'money') return 'number'
  if (kind === 'date') return 'date'
  if (kind === 'choice') return many ? 'tags' : 'choice'
  if (['text', 'link', 'email', 'phone'].includes(kind)) return 'text'
  return 'other'
}

export const OPS: Record<Family, FilterOp[]> = {
  text: ['contains', 'not_contains', 'is', 'is_not', 'starts', 'ends', 'empty', 'not_empty'],
  number: ['eq', 'ne', 'gt', 'lt', 'between', 'empty', 'not_empty'],
  date: [
    'before',
    'after',
    'between',
    'today',
    'due',
    'this_week',
    'next_days',
    'empty',
    'not_empty',
  ],
  choice: ['in', 'empty', 'not_empty'],
  tags: ['in', 'all_of', 'none_of', 'empty', 'not_empty'],
  other: ['empty', 'not_empty'],
}

export const OP_WORDS: Record<FilterOp, string> = {
  is: 'is',
  is_not: 'is not',
  contains: 'contains',
  not_contains: 'doesn’t contain',
  starts: 'starts with',
  ends: 'ends with',
  eq: 'equals',
  ne: 'is not',
  gt: 'more than',
  lt: 'less than',
  between: 'between',
  before: 'before',
  after: 'after',
  today: 'is today',
  due: 'is due by today',
  this_week: 'is this week',
  next_days: 'in the next',
  in: 'is',
  all_of: 'has all of',
  none_of: 'has none of',
  empty: 'is empty',
  not_empty: 'is not empty',
}

// What a rule needs beside its op: nothing, a value, two, or a list of choices.
export function needs(op: FilterOp): 0 | 1 | 2 | 'list' {
  if (op === 'between') return 2
  if (op === 'in' || op === 'all_of' || op === 'none_of') return 'list'
  if (['today', 'due', 'this_week', 'empty', 'not_empty'].includes(op)) return 0
  return 1
}

const isEmpty = (v: unknown) =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)

// A value as a number for comparing: money's amount, a number, a date's time.
export function numberOf(field: FieldView, value: unknown): number | null {
  if (isEmpty(value)) return null
  if (field.kind === 'money' && typeof value === 'object')
    return (value as { amount: number }).amount
  if (field.kind === 'date') {
    const t = Date.parse(String(value))
    return Number.isNaN(t) ? null : t
  }
  const n = Number(value)
  return Number.isNaN(n) ? null : n
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
// a rule's date value ("2026-10-20") as the start of that day, in the person's zone
const dateOf = (v: unknown) => {
  const s = String(v ?? '')
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : Date.parse(s)
}

export function matches(
  rule: FilterRule,
  field: FieldView,
  value: unknown,
  names: Record<string, string>,
  now: Date = new Date(),
): boolean {
  if (rule.op === 'empty') return isEmpty(value)
  if (rule.op === 'not_empty') return !isEmpty(value)
  const fam = family(field.kind, field.many)
  if (fam === 'choice' && rule.op === 'in')
    return !rule.values?.length || rule.values.includes(String(value ?? ''))
  if (fam === 'tags') {
    const held = Array.isArray(value) ? value.map(String) : []
    const want = rule.values ?? []
    if (rule.op === 'in') return !want.length || want.some((v) => held.includes(v))
    if (rule.op === 'all_of') return want.every((v) => held.includes(v))
    if (rule.op === 'none_of') return !want.some((v) => held.includes(v))
    return true
  }
  if (fam === 'number') {
    const n = numberOf(field, value)
    const a = Number(rule.value)
    const b = Number(rule.value2)
    if (n === null) return rule.op === 'ne'
    if (rule.op === 'eq') return n === a
    if (rule.op === 'ne') return n !== a
    if (rule.op === 'gt') return n > a
    if (rule.op === 'lt') return n < a
    if (rule.op === 'between') return n >= Math.min(a, b) && n <= Math.max(a, b)
    return true
  }
  if (fam === 'date') {
    const t = numberOf(field, value)
    if (t === null) return false
    const day = dayStart(new Date(t))
    const today = dayStart(now)
    if (rule.op === 'today') return day === today
    if (rule.op === 'due') return day <= today
    if (rule.op === 'this_week') {
      const monday = today - ((now.getDay() + 6) % 7) * 86_400_000
      return day >= monday && day < monday + 7 * 86_400_000
    }
    if (rule.op === 'next_days')
      return day >= today && day <= today + Number(rule.value ?? 0) * 86_400_000
    if (rule.op === 'before') return day < dateOf(rule.value)
    if (rule.op === 'after') return day > dateOf(rule.value)
    if (rule.op === 'between') {
      const a = dateOf(rule.value)
      const b = dateOf(rule.value2)
      return day >= Math.min(a, b) && day <= Math.max(a, b)
    }
    return true
  }
  const text = show(field, value, names).toLowerCase()
  const want = String(rule.value ?? '').toLowerCase()
  if (rule.op === 'is') return text === want
  if (rule.op === 'is_not') return text !== want
  if (rule.op === 'contains') return text.includes(want)
  if (rule.op === 'not_contains') return !text.includes(want)
  if (rule.op === 'starts') return text.startsWith(want)
  if (rule.op === 'ends') return text.endsWith(want)
  return true
}

// A rule in words, for its chip: "Asking price more than $1,000,000".
export function ruleWords(rule: FilterRule, field: FieldView): string {
  const fam = family(field.kind, field.many)
  const v = (x: unknown) =>
    fam === 'number' && x !== null && x !== undefined && x !== ''
      ? Number(x).toLocaleString()
      : String(x ?? '')
  if (rule.op === 'in')
    return `${field.name} ${fam === 'tags' ? 'has any of' : 'is'} ${(rule.values ?? []).join(' or ') || 'anything'}`
  if (rule.op === 'all_of') return `${field.name} has all of ${(rule.values ?? []).join(' and ')}`
  if (rule.op === 'none_of') return `${field.name} has none of ${(rule.values ?? []).join(' or ')}`
  if (needs(rule.op) === 0) return `${field.name} ${OP_WORDS[rule.op]}`
  if (rule.op === 'between') return `${field.name} between ${v(rule.value)} and ${v(rule.value2)}`
  if (rule.op === 'next_days') return `${field.name} in the next ${rule.value} days`
  return `${field.name} ${fam === 'number' && rule.op === 'ne' ? 'is not' : OP_WORDS[rule.op]} ${v(rule.value)}`
}

export function applySearch(
  rows: RowView[],
  fields: FieldView[],
  words: string,
  names: Record<string, string>,
): RowView[] {
  const w = words.trim().toLowerCase()
  if (!w) return rows
  return rows.filter((r) =>
    fields.some((f) => show(f, r.values[f.slug], names).toLowerCase().includes(w)),
  )
}

export function applyFilters(
  rows: RowView[],
  fields: FieldView[],
  filters: ViewConfig['filters'],
  names: Record<string, string>,
  now: Date = new Date(),
): RowView[] {
  const rules = filters.rules
    .map((r) => ({ rule: r, field: fields.find((f) => f.id === r.field) }))
    .filter((x): x is { rule: FilterRule; field: FieldView } => !!x.field)
  if (!rules.length) return rows
  return rows.filter((row) => {
    const each = rules.map(({ rule, field }) =>
      matches(rule, field, row.values[field.slug], names, now),
    )
    return filters.match === 'any' ? each.some(Boolean) : each.every(Boolean)
  })
}

// Two values of a field in order; a choice sorts by its place in the choices.
export function compare(
  field: FieldView,
  a: unknown,
  b: unknown,
  names: Record<string, string>,
): number {
  const fam = family(field.kind)
  if (fam === 'number' || fam === 'date')
    return (numberOf(field, a) ?? 0) - (numberOf(field, b) ?? 0)
  if (fam === 'choice') {
    const i = field.choices.indexOf(String(a))
    const j = field.choices.indexOf(String(b))
    if (i !== j) return (i < 0 ? 1e9 : i) - (j < 0 ? 1e9 : j)
  }
  return show(field, a, names).localeCompare(show(field, b, names), undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

export function sortRows(
  rows: RowView[],
  fields: FieldView[],
  sorts: ViewConfig['sorts'],
  names: Record<string, string>,
): RowView[] {
  const levels = sorts
    .map((s) => ({ ...s, field: fields.find((f) => f.id === s.field) }))
    .filter((s): s is { field: FieldView; dir: 'asc' | 'desc' } => !!s.field)
  if (!levels.length) return rows
  return [...rows].sort((x, y) => {
    for (const { field, dir } of levels) {
      const a = x.values[field.slug]
      const b = y.values[field.slug]
      // empty values always go last, whichever way
      if (isEmpty(a) !== isEmpty(b)) return isEmpty(a) ? 1 : -1
      if (isEmpty(a)) continue
      const c = compare(field, a, b, names)
      if (c) return dir === 'asc' ? c : -c
    }
    return 0
  })
}

export const GROUPABLE = new Set(['choice', 'text', 'date', 'relation', 'person', 'email', 'link'])

export interface Group {
  key: string
  label: string
  rows: RowView[]
}

// One level of groups: a choice in its order, a date by month, anything else by its words; the
// rows with no value last.
export function groupRows(
  rows: RowView[],
  field: FieldView,
  names: Record<string, string>,
): Group[] {
  const groups = new Map<string, Group>()
  const keyOf = (v: unknown): [string, string] => {
    if (isEmpty(v)) return ['', `No ${field.name.toLowerCase()}`]
    if (field.kind === 'date') {
      const t = numberOf(field, v)
      if (t === null) return ['', `No ${field.name.toLowerCase()}`]
      const d = new Date(t)
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return [k, d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })]
    }
    const label = show(field, v, names)
    return [label, label]
  }
  for (const r of rows) {
    const [key, label] = keyOf(r.values[field.slug])
    const g = groups.get(key) ?? { key, label, rows: [] }
    g.rows.push(r)
    groups.set(key, g)
  }
  const all = [...groups.values()]
  const rank = (g: Group) => {
    if (g.key === '') return Number.POSITIVE_INFINITY
    if (field.kind === 'choice') {
      const i = field.choices.indexOf(g.key)
      return i < 0 ? 1e9 : i
    }
    return 0
  }
  return all.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.key === '' || b.key === ''
        ? 0
        : a.key.localeCompare(b.key, undefined, { numeric: true, sensitivity: 'base' })),
  )
}

export const TOTALS: Record<Family, TotalOp[]> = {
  number: ['sum', 'avg', 'min', 'max', 'count', 'empty', 'filled'],
  date: ['earliest', 'latest', 'count', 'empty', 'filled'],
  text: ['count', 'empty', 'filled', 'unique'],
  choice: ['count', 'empty', 'filled', 'unique'],
  tags: ['count', 'empty', 'filled'],
  other: ['count', 'empty', 'filled'],
}

export const TOTAL_WORDS: Record<TotalOp, string> = {
  sum: 'Sum',
  avg: 'Average',
  min: 'Smallest',
  max: 'Largest',
  count: 'Rows',
  empty: 'Empty',
  filled: 'Filled',
  unique: 'Different',
  earliest: 'Earliest',
  latest: 'Latest',
}

// A total over the rows shown, in words; compact for money in a narrow footer, full in its title.
export function total(
  op: TotalOp,
  field: FieldView,
  rows: RowView[],
  names: Record<string, string>,
  compact = false,
): string {
  const values = rows.map((r) => r.values[field.slug])
  const filled = values.filter((v) => !isEmpty(v))
  if (op === 'count') return String(rows.length)
  if (op === 'empty') return String(values.length - filled.length)
  if (op === 'filled') return String(filled.length)
  if (op === 'unique') return String(new Set(filled.map((v) => show(field, v, names))).size)
  const nums = filled.map((v) => numberOf(field, v)).filter((n): n is number => n !== null)
  if (!nums.length) return '—'
  if (op === 'earliest' || op === 'latest') {
    const t = op === 'earliest' ? Math.min(...nums) : Math.max(...nums)
    return show(field, new Date(t).toISOString().slice(0, 10))
  }
  const n =
    op === 'sum'
      ? nums.reduce((a, b) => a + b, 0)
      : op === 'avg'
        ? nums.reduce((a, b) => a + b, 0) / nums.length
        : op === 'min'
          ? Math.min(...nums)
          : Math.max(...nums)
  if (field.kind === 'money') {
    const currency = (filled[0] as { currency?: string }).currency ?? 'USD'
    return money(op === 'avg' ? Math.round(n) : n, currency, compact)
  }
  return Number.isInteger(n)
    ? n.toLocaleString()
    : n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

// The columns a view shows, in its order: the ones it orders first, then the rest as the table
// has them, less the hidden.
export function columns(fields: FieldView[], config: ViewConfig): FieldView[] {
  const ordered = [
    ...config.order.map((id) => fields.find((f) => f.id === id)).filter((f): f is FieldView => !!f),
    ...fields.filter((f) => !config.order.includes(f.id)),
  ]
  return ordered.filter((f) => !config.hidden.includes(f.id))
}

// A value's colour by the view's condition on its field, if it meets it.
export function toneOf(
  config: ViewConfig,
  field: FieldView,
  value: unknown,
): 'good' | 'warn' | 'bad' | 'accent' | null {
  const w = config.colours.when.find((x) => x.field === field.id)
  if (!w) return null
  const n = numberOf(field, value)
  if (n === null) return null
  const v = field.kind === 'date' ? dateOf(w.value) : Number(w.value)
  const day = field.kind === 'date' ? dayStart(new Date(n)) : n
  const met =
    w.op === 'gt' || w.op === 'after'
      ? day > v
      : w.op === 'lt' || w.op === 'before'
        ? day < v
        : day === v
  return met ? w.tone : null
}

// A row's tint, by the choice the view tints rows by.
export function tintOf(
  config: ViewConfig,
  fields: FieldView[],
  row: RowView,
): 'good' | 'warn' | 'bad' | 'accent' | null {
  const f = fields.find((x) => x.id === config.colours.tint)
  if (!f) return null
  return f.tones[String(row.values[f.slug] ?? '')] ?? null
}

// A column's width when the view does not say: by its kind, the name column wider.
export function widthOf(field: FieldView, config: ViewConfig, first: boolean): number {
  const w = config.widths[field.id]
  if (w) return w
  if (first) return 260
  const byKind =
    field.kind === 'money'
      ? 132
      : field.kind === 'number'
        ? 116
        : field.kind === 'date'
          ? 136
          : field.kind === 'choice'
            ? 148
            : field.kind === 'link'
              ? 240
              : 190
  // room for the name, a sort arrow and the menu button
  return Math.max(byKind, Math.round(field.name.length * 7.2) + 64)
}
