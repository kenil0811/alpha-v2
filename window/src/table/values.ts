// How a table's values read: a value in words for its kind, and the marks and colours around it.
import type { FieldView, SourceView } from '@alpha/core/api'
import type { Tone } from '../ui/pill.tsx'

export const KIND_TONE: Record<SourceView['kind'], Tone> = {
  stated: 'accent',
  looked_up: 'neutral',
  computed: 'neutral',
  estimated: 'warn',
  assumed: 'warn',
}

export const KIND_WORDS: Record<SourceView['kind'], string> = {
  stated: 'You said',
  looked_up: 'Looked up',
  estimated: 'Estimated',
  assumed: 'Assumed',
  computed: 'Computed',
}

// A choice that is a state shows as a dot in its colour, with its words.
export const DOT: Record<string, string> = {
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  accent: 'bg-accent',
}

// A row tinted by a choice, and a value coloured by a condition.
export const TINT: Record<string, string> = {
  good: 'bg-good-soft',
  warn: 'bg-warn-soft',
  bad: 'bg-bad-soft',
  accent: 'bg-accent-soft',
}
export const INK: Record<string, string> = {
  good: 'text-good',
  warn: 'text-warn',
  bad: 'text-bad',
  accent: 'text-accent',
}

// The marks on a value Alpha is not sure of: ≈ estimated, ? assumed. Grey, never amber: unsure
// is not wrong; a table gives the word on hover, a panel writes it out.
export const MARK: Partial<Record<SourceView['kind'], string>> = { estimated: '≈', assumed: '?' }

// An empty value: a grey dash in a table, Unknown in a panel, for every kind of field.
export const EMPTY_CELL = '–'
export const EMPTY_WORDS = 'Unknown'

export const NUMERIC = new Set(['money', 'number'])
// What can be typed in the window; a relation or a person is picked (canPick), a file is changed
// by asking Alpha.
export const CORRECTABLE = new Set([
  'text',
  'number',
  'money',
  'date',
  'choice',
  'email',
  'link',
  'phone',
])

// What can be typed in this field: a summary is worked out from other rows, never typed.
export const canType = (f: FieldView) => CORRECTABLE.has(f.kind) && !f.summary
// What is picked, one value at a time: a related row, or a person.
export const canPick = (f: FieldView) =>
  (f.kind === 'relation' && !!f.relatesTo && !f.summary) || f.kind === 'person'
// What a double-click changes in the grid and in an opened row (T4).
export const canEdit = (f: FieldView) => canType(f) || canPick(f)
// Why a value can't be changed where it is, said at once on a double-click.
export function whyFixed(f: FieldView, kept: boolean): string {
  if (kept) return 'Kept on its own page: open the row to change it.'
  if (f.summary) return `Worked out: ${f.summary}. It changes when those rows do.`
  return 'Alpha keeps this from where it came from; it is not typed here.'
}
// A choice holding several (tags): a list, shown as chips.
export const isTags = (f: FieldView) => f.kind === 'choice' && f.many

export const when = (at: string) =>
  new Date(at).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

export function money(amount: number, currency: string, compact = false): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    ...(compact
      ? { notation: 'compact', maximumFractionDigits: 1 }
      : Number.isInteger(amount)
        ? { maximumFractionDigits: 0 }
        : {}),
  }).format(amount)
}

export function show(field: FieldView, value: unknown, names: Record<string, string> = {}): string {
  if (value === null || value === undefined) return ''
  if (field.kind === 'relation')
    return (Array.isArray(value) ? value : [value]).map((id) => names[String(id)] ?? '…').join(', ')
  // a person field holds one of the person's people, shown by name (an older value as written)
  if (field.kind === 'person') return names[String(value)] ?? String(value)
  if (field.kind === 'money' && typeof value === 'object') {
    const m = value as { amount: number; currency: string }
    return money(m.amount, m.currency)
  }
  if (field.kind === 'date' && typeof value === 'string' && !Number.isNaN(Date.parse(value)))
    return new Date(value).toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      // a date with its time shows the time, in the person's own zone
      ...(/T\d{2}:\d{2}/.test(value) ? { hour: '2-digit', minute: '2-digit' } : {}),
    })
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

// What the person typed or pasted, read for the field's kind: a value, or what is wrong with it.
// Empty clears the value. Money keeps the currency the value had.
export function readValue(
  field: FieldView,
  typed: string,
  was?: unknown,
): { value: unknown } | { problem: string } {
  const t = typed.trim()
  if (!t) return { value: null }
  if (field.kind === 'money' || field.kind === 'number') {
    const n = Number(t.replace(/[$£€¥,\s]/g, ''))
    if (Number.isNaN(n)) return { problem: `${field.name} takes a number; “${t}” is not one.` }
    if (field.kind === 'number') return { value: n }
    const currency =
      (was && typeof was === 'object' && (was as { currency?: string }).currency) || 'USD'
    return { value: { amount: n, currency } }
  }
  if (field.kind === 'date') {
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null
    if (iso) return { value: iso }
    const d = new Date(t)
    if (Number.isNaN(d.getTime()))
      return { problem: `${field.name} takes a date; “${t}” is not one.` }
    const p = (n: number) => String(n).padStart(2, '0')
    return { value: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
  }
  if (isTags(field)) {
    const said = t
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
    const off = said.filter((x) => !field.choices.some((c) => c.toLowerCase() === x.toLowerCase()))
    if (off.length)
      return {
        problem: `${field.name} takes some of ${field.choices.join(', ')}; “${off[0]}” is not one.`,
      }
    return {
      value: field.choices.filter((c) => said.some((x) => x.toLowerCase() === c.toLowerCase())),
    }
  }
  if (field.kind === 'choice') {
    const c = field.choices.find((x) => x.toLowerCase() === t.toLowerCase())
    if (!c)
      return { problem: `${field.name} is one of ${field.choices.join(', ')}; “${t}” is not.` }
    return { value: c }
  }
  return { value: t }
}

// A value as the person would type it back: money's amount, a number, a date's day.
export function typedOf(field: FieldView, value: unknown): string {
  if (value === null || value === undefined) return ''
  if (field.kind === 'money' && typeof value === 'object')
    return String((value as { amount: number }).amount)
  if (field.kind === 'date') return String(value).slice(0, 10)
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

// A row's title: its first text field's words, or in a table with none its first value (a day's
// date, say).
export function titleOf(fields: FieldView[], row: { values: Record<string, unknown> }): string {
  const f =
    fields.find((x) => x.kind === 'text') ??
    fields.find(
      (x) => x.kind !== 'notes' && row.values[x.slug] != null && row.values[x.slug] !== '',
    )
  return (f && show(f, row.values[f.slug])) || 'Untitled'
}

// What a card shows under its title, each only when it has a value: up to two amounts, two
// choices, a date, then words, as many as asked for.
export function summary(
  fields: FieldView[],
  row: { values: Record<string, unknown> },
  max: number,
  skip: string[] = [],
): FieldView[] {
  const title = fields.find((x) => x.kind === 'text')
  const has = (f: FieldView) =>
    f !== title && !skip.includes(f.id) && row.values[f.slug] != null && row.values[f.slug] !== ''
  const of = (kinds: string[], n: number) =>
    fields.filter((f) => kinds.includes(f.kind) && has(f)).slice(0, n)
  const picked = [
    ...of(['money', 'number'], 2),
    ...of(['choice'], 2),
    ...of(['date'], 1),
    ...of(['text', 'email', 'phone', 'relation', 'person'], 2),
  ]
  return picked.slice(0, max)
}
