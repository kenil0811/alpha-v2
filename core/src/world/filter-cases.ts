// The cases a summary's condition (filter-sql.ts, in SQL) and the window's filter (its table
// engine, in the browser) both answer, so the same words mean the same rows in both. Each is a
// field, a rule, a value a row holds, and whether the rule takes that row. Both test files read
// this one list.
export interface FilterCase {
  kind: string
  tags?: boolean
  rule: {
    op: string
    value?: string | number | null
    value2?: string | number | null
    values?: string[]
  }
  value: unknown
  match: boolean
}

const text = (op: string, value: string, row: unknown, match: boolean): FilterCase => ({
  kind: 'text',
  rule: { op, value },
  value: row,
  match,
})
const num = (op: string, value: number, row: unknown, match: boolean, value2?: number) => ({
  kind: 'number',
  rule: { op, value, ...(value2 === undefined ? {} : { value2 }) },
  value: row,
  match,
})
const day = (op: string, value: string, row: unknown, match: boolean, value2?: string) => ({
  kind: 'date',
  rule: { op, value, ...(value2 === undefined ? {} : { value2 }) },
  value: row,
  match,
})
const tags = (op: string, values: string[], row: unknown, match: boolean): FilterCase => ({
  kind: 'choice',
  tags: true,
  rule: { op, values },
  value: row,
  match,
})

export const FILTER_CASES: FilterCase[] = [
  text('is', 'acme', 'Acme', true),
  text('is', 'acme', 'Acme Ltd', false),
  text('is_not', 'acme', null, true),
  text('contains', 'me l', 'Acme Ltd', true),
  text('contains', '50%', '50% off', true),
  text('contains', '50%', '500 off', false),
  text('not_contains', 'x', null, true),
  text('starts', 'ac', 'Acme', true),
  text('starts', 'me', 'Acme', false),
  text('ends', 'LTD', 'Acme Ltd', true),
  { kind: 'text', rule: { op: 'empty' }, value: '', match: true },
  { kind: 'text', rule: { op: 'empty' }, value: null, match: true },
  { kind: 'text', rule: { op: 'not_empty' }, value: 'a', match: true },
  num('eq', 5, 5, true),
  num('ne', 5, null, true),
  num('ne', 5, 4, true),
  num('gt', 5, null, false),
  num('gt', 5, 6, true),
  num('lt', 5, 5, false),
  num('between', 10, 5, true, 1),
  num('between', 1, 10, true, 10),
  {
    kind: 'money',
    rule: { op: 'gt', value: 100 },
    value: { amount: 250, currency: 'USD' },
    match: true,
  },
  { kind: 'number', rule: { op: 'empty' }, value: null, match: true },
  day('before', '2026-10-20', '2026-10-19', true),
  day('before', '2026-10-20', '2026-10-20', false),
  day('after', '2026-10-20', '2026-10-21', true),
  day('after', '2026-10-20', null, false),
  day('between', '2026-10-25', '2026-10-25', true, '2026-10-01'),
  day('between', '2026-10-01', '2026-10-26', false, '2026-10-25'),
  { kind: 'choice', rule: { op: 'in', values: ['No'] }, value: 'No', match: true },
  { kind: 'choice', rule: { op: 'in', values: ['No', 'Partly'] }, value: 'Yes', match: false },
  { kind: 'choice', rule: { op: 'in', values: ['No'] }, value: null, match: false },
  { kind: 'choice', rule: { op: 'empty' }, value: null, match: true },
  tags('in', ['Late', 'Rush'], ['Rush'], true),
  tags('in', ['Late'], ['Rush'], false),
  tags('in', ['Late'], null, false),
  tags('all_of', ['Rush', 'Late'], ['Late', 'Rush', 'Big'], true),
  tags('all_of', ['Rush', 'Late'], ['Rush'], false),
  tags('none_of', ['Late'], ['Rush'], true),
  tags('none_of', ['Late'], null, true),
  tags('none_of', ['Late'], ['Late'], false),
  { kind: 'choice', tags: true, rule: { op: 'empty' }, value: null, match: true },
  { kind: 'choice', tags: true, rule: { op: 'not_empty' }, value: ['Rush'], match: true },
]
