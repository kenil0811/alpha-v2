// A view over rows: filters by kind, sorts with empty values last, groups, totals and colours.
import type { FieldView, FilterRule, RowView } from '@alpha/core/api'
import { FILTER_CASES } from '@alpha/core/filter-cases'
import { describe, expect, it } from 'vitest'
import {
  applyFilters,
  applySearch,
  BLANK,
  columns,
  groupRows,
  matches,
  ruleWords,
  sortRows,
  tintOf,
  toneOf,
  total,
} from './engine.ts'

const field = (id: string, kind: string, extra: Partial<FieldView> = {}): FieldView =>
  ({
    id,
    name: id[0]?.toUpperCase() + id.slice(1),
    slug: id,
    kind,
    choices: [],
    tones: {},
    ...extra,
  }) as FieldView

const name = field('name', 'text')
const price = field('price', 'money')
const stage = field('stage', 'choice', {
  choices: ['New', 'Looking', 'Passed'],
  tones: { Passed: 'bad' },
})
const listed = field('listed', 'date')
const fields = [name, price, stage, listed]

const row = (id: string, v: Record<string, unknown>): RowView =>
  ({ id, values: v, sources: {} }) as RowView
const usd = (amount: number) => ({ amount, currency: 'USD' })
const rows = [
  row('a', { name: 'Payroll firm', price: usd(1_200_000), stage: 'New', listed: '2026-10-20' }),
  row('b', { name: 'CPA practice', price: usd(2_400_000), stage: 'Passed', listed: '2026-09-02' }),
  row('c', { name: 'Tax shop', price: null, stage: 'Looking', listed: null }),
  row('d', { name: 'Bookkeeper', price: usd(800_000), stage: null, listed: '2026-10-22' }),
]
const now = new Date(2026, 9, 20, 13, 0) // Tuesday 20 October 2026
const ids = (rs: RowView[]) => rs.map((r) => r.id)

describe('a filter', () => {
  it('compares money by its amount, and a missing amount is not more or less', () => {
    const rules = [{ field: 'price', op: 'gt' as const, value: 1_000_000 }]
    expect(ids(applyFilters(rows, fields, { match: 'all', rules }, {}))).toEqual(['a', 'b'])
    const between = [{ field: 'price', op: 'between' as const, value: 700_000, value2: 1_300_000 }]
    expect(ids(applyFilters(rows, fields, { match: 'all', rules: between }, {}))).toEqual([
      'a',
      'd',
    ])
  })

  it('reads dates by day: today, this week, the next days, before and after', () => {
    const m = (op: 'today' | 'this_week' | 'next_days' | 'before', value?: string | number) =>
      ids(
        rows.filter((r) =>
          matches({ field: 'listed', op, value }, listed, r.values.listed, {}, now),
        ),
      )
    expect(m('today')).toEqual(['a'])
    expect(m('this_week')).toEqual(['a', 'd'])
    expect(m('next_days', 1)).toEqual(['a'])
    expect(m('before', '2026-10-01')).toEqual(['b'])
  })

  it('takes a choice among several, text by its words, and empties', () => {
    const f = (rule: object) =>
      ids(applyFilters(rows, fields, { match: 'all', rules: [rule as never] }, {}))
    expect(f({ field: 'stage', op: 'in', values: ['New', 'Looking'] })).toEqual(['a', 'c'])
    expect(f({ field: 'name', op: 'contains', value: 'FIRM' })).toEqual(['a'])
    expect(f({ field: 'stage', op: 'empty' })).toEqual(['d'])
  })

  it('joins rules by all or any', () => {
    const rules = [
      { field: 'stage', op: 'in' as const, values: ['Passed'] },
      { field: 'name', op: 'starts' as const, value: 'book' },
    ]
    expect(ids(applyFilters(rows, fields, { match: 'all', rules }, {}))).toEqual([])
    expect(ids(applyFilters(rows, fields, { match: 'any', rules }, {}))).toEqual(['b', 'd'])
  })

  it('says itself in words', () => {
    expect(ruleWords({ field: 'price', op: 'gt', value: 1_500_000 }, price)).toBe(
      `Price more than ${(1_500_000).toLocaleString()}`,
    )
    expect(ruleWords({ field: 'stage', op: 'in', values: ['New', 'Looking'] }, stage)).toBe(
      'Stage is New or Looking',
    )
  })

  it('finds words in any field', () => {
    expect(ids(applySearch(rows, fields, 'cpa', {}))).toEqual(['b'])
  })
})

describe('sorting', () => {
  it('puts empty values last either way, and a choice in its order', () => {
    expect(ids(sortRows(rows, fields, [{ field: 'price', dir: 'asc' }], {}))).toEqual([
      'd',
      'a',
      'b',
      'c',
    ])
    expect(ids(sortRows(rows, fields, [{ field: 'price', dir: 'desc' }], {}))).toEqual([
      'b',
      'a',
      'd',
      'c',
    ])
    expect(ids(sortRows(rows, fields, [{ field: 'stage', dir: 'asc' }], {}))).toEqual([
      'a',
      'c',
      'b',
      'd',
    ])
  })

  it('sorts by a second field where the first is the same', () => {
    const same = [row('x', { stage: 'New', name: 'Zed' }), row('y', { stage: 'New', name: 'Abe' })]
    const by = [
      { field: 'stage', dir: 'asc' as const },
      { field: 'name', dir: 'asc' as const },
    ]
    expect(ids(sortRows(same, fields, by, {}))).toEqual(['y', 'x'])
  })
})

describe('groups, totals and colours', () => {
  it('groups a choice in its order with no value last, and dates by month', () => {
    expect(groupRows(rows, stage, {}).map((g) => [g.label, g.rows.length])).toEqual([
      ['New', 1],
      ['Looking', 1],
      ['Passed', 1],
      ['No stage', 1],
    ])
    expect(groupRows(rows, listed, {}).map((g) => g.label)).toEqual([
      new Date(2026, 8, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      new Date(2026, 9, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      'No listed',
    ])
  })

  it('totals what is shown', () => {
    expect(total('sum', price, rows, {})).toBe('$4,400,000')
    expect(total('avg', price, rows, {})).toBe('$1,466,667')
    expect(total('empty', price, rows, {})).toBe('1')
    expect(total('unique', stage, rows, {})).toBe('3')
  })

  it('colours a value by its condition and a row by its choice', () => {
    const config = {
      ...BLANK,
      colours: {
        tint: 'stage',
        when: [{ field: 'price', op: 'gt' as const, value: 1_500_000, tone: 'bad' as const }],
      },
    }
    expect(toneOf(config, price, usd(2_400_000))).toBe('bad')
    expect(toneOf(config, price, usd(800_000))).toBeNull()
    expect(rows.map((r) => tintOf(config, fields, r))).toEqual([null, 'bad', null, null])
  })

  it('shows columns in the view’s order, less the hidden', () => {
    const config = { ...BLANK, order: ['stage'], hidden: ['listed'] }
    expect(columns(fields, config).map((f) => f.id)).toEqual(['stage', 'name', 'price'])
  })
})

// The window's filter means what a summary's condition means in SQL: both answer these cases
// (core step 3c).
describe('the same cases as a summary’s condition', () => {
  it.each(FILTER_CASES)('$kind $rule.op $rule.value$rule.values on $value is $match', (c) => {
    const f = field('v', c.kind, { many: !!c.tags })
    const rule = { field: 'v', ...c.rule } as FilterRule
    expect(matches(rule, f, c.value, {})).toBe(c.match)
  })
})
