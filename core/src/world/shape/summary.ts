// A summary field as the shape keeps it: a parent row's count, sum, least, most or latest of the
// rows of another table that point at it through a relation to one row, with at most one condition.
// Checked here when it is made, by names, and kept by ids, so a rename moves nothing. What it comes
// to is worked out when read (records/summary.ts).
import { SUMMARY_OPS, type Summary } from '@alpha/kit-sdk'
import type { z } from 'zod'
import { checkRule, ruleWords } from '../filter-sql.ts'
import { Refused } from '../kinds.ts'
import type { Shape } from './shape.ts'
import type { Field, SummarySpec, Table } from './types.ts'

// A summary as a kit or the builder gives it, tables and fields by name: the kit API's schema.
export type SummaryInput = z.infer<typeof Summary>

// A value a summary may take or a condition read: a stored one, not notes, a list or a summary.
const stored = (f: Field) =>
  f.kind !== 'summary' && f.kind !== 'notes' && !(f.kind === 'relation' && f.many)

export function summaryOf(
  shape: Shape,
  table: Table,
  s: SummaryInput | undefined,
  name: string,
): SummarySpec {
  if (!s || typeof s !== 'object' || !s.of)
    throw new Refused(`${name} is a summary: it needs the table whose rows it sums up.`)
  const child = shape.table(s.of)
  if (!child) throw new Refused(`${name} sums up rows of ${s.of}, which is not a table.`)
  const find = (n: string): Field => {
    const f = child.fields.find(
      (x) => x.id === n || x.slug === n || x.name.toLowerCase() === n.toLowerCase(),
    )
    if (!f) throw new Refused(`${child.name} has no field called ${n}.`)
    return f
  }
  const toHere = child.fields.filter((f) => f.kind === 'relation' && f.relatesTo === table.id)
  const through = s.through ? find(s.through) : toHere.length === 1 ? toHere[0] : undefined
  if (!through)
    throw new Refused(
      toHere.length
        ? `${name}: say which of ${toHere.map((f) => f.name).join(', ')} it goes through.`
        : `${name}: no field of ${child.name} points at ${table.name}, so it has nothing to sum up.`,
    )
  if (through.kind !== 'relation' || through.many || through.relatesTo !== table.id)
    throw new Refused(
      `${name}: ${through.name} in ${child.name} must be a relation to one row of ${table.name}.`,
    )
  if (!(SUMMARY_OPS as readonly string[]).includes(s.op))
    throw new Refused(`${name}: a summary is one of ${SUMMARY_OPS.join(', ')}.`)
  const field = s.op !== 'count' && s.field ? find(s.field) : undefined
  if (s.op !== 'count' && !field) throw new Refused(`${name}: ${s.op} needs the field it takes.`)
  // a value shown as itself: not a row, a person or a file named by id, nor a list
  const shown = ['text', 'number', 'money', 'date', 'choice', 'link', 'email', 'phone']
  if (field && (!shown.includes(field.kind) || field.tags))
    throw new Refused(
      `${name}: a summary takes a number, money, a date, words or one choice; ${field.name} is ${field.tags ? 'a list of choices' : field.kind}.`,
    )
  if (s.op === 'sum' && field && field.kind !== 'number' && field.kind !== 'money')
    throw new Refused(`${name}: only a number or money adds up; ${field.name} is ${field.kind}.`)
  if (
    (s.op === 'min' || s.op === 'max') &&
    field &&
    !['number', 'money', 'date'].includes(field.kind)
  )
    throw new Refused(
      `${name}: ${s.op} takes a number, money or a date; ${field.name} is ${field.kind}.`,
    )
  const by = s.by ? find(s.by) : undefined
  if (by && (s.op !== 'latest' || by.kind !== 'date'))
    throw new Refused(`${name}: only latest is ordered, and by a date.`)
  const wf = s.where ? find(s.where.field) : undefined
  if (wf && !stored(wf))
    throw new Refused(`${name}: a condition reads a stored value, and ${wf.name} is not one.`)
  const where = s.where && wf ? { field: wf.id, ...checkRule(wf, s.where, name) } : undefined
  return {
    of: child.id,
    through: through.id,
    op: s.op,
    ...(field ? { field: field.id } : {}),
    ...(by ? { by: by.id } : {}),
    ...(where ? { where } : {}),
  }
}

// The field a summary shows as: a count is a number; the rest are the field they take, with its
// choices and their colours.
export function summaryShows(
  shape: Shape,
  s: SummarySpec,
): Pick<Field, 'kind' | 'choices' | 'tones'> {
  const f = s.op === 'count' ? undefined : shape.table(s.of)?.fields.find((x) => x.id === s.field)
  return f
    ? { kind: f.kind, choices: f.choices, tones: f.tones }
    : { kind: 'number', choices: [], tones: {} }
}

// What it is, in words: "Sum of Amount in Invoices, where Paid is No".
export function summaryWords(shape: Shape, s: SummarySpec): string {
  const child = shape.table(s.of)
  const name = (id: string | undefined) =>
    child?.fields.find((f) => f.id === id)?.name ?? 'a field removed since'
  const op = { count: 'Count', sum: 'Sum', min: 'Least', max: 'Most', latest: 'Latest' }[s.op]
  const what = s.op === 'count' ? 'rows' : name(s.field)
  const by = s.op === 'latest' ? `, by ${s.by ? name(s.by) : 'when added'}` : ''
  const where = s.where ? `, where ${ruleWords(name(s.where.field), s.where)}` : ''
  return `${op} of ${what} in ${child?.name ?? 'a table removed since'}${by}${where}`
}

// A summary by names, as module.yaml keeps it, so the module stays portable.
export function summaryNamed(shape: Shape, s: SummarySpec): SummaryInput {
  const child = shape.table(s.of)
  const name = (id: string) => child?.fields.find((f) => f.id === id)?.name ?? id
  const { field: _f, ...rule } = s.where ?? { field: '' }
  return {
    of: child?.name ?? s.of,
    through: name(s.through),
    op: s.op,
    ...(s.field ? { field: name(s.field) } : {}),
    ...(s.by ? { by: name(s.by) } : {}),
    ...(s.where ? { where: { field: name(s.where.field), ...rule } } : {}),
  } as SummaryInput
}

// The summaries that read a table, or one of its fields: removed with it (clean removal).
export function summariesReading(
  shape: Shape,
  tableId: string,
  fieldId?: string,
): { table: Table; field: Field }[] {
  const out: { table: Table; field: Field }[] = []
  for (const t of shape.tables())
    for (const f of t.fields) {
      const s = f.summary
      if (!s || s.of !== tableId) continue
      if (fieldId && ![s.through, s.field, s.by, s.where?.field].includes(fieldId)) continue
      out.push({ table: t, field: f })
    }
  return out
}
