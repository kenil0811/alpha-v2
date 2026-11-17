// A saved list's tip says what it holds, one line each and only the lines it has (D27b).
import type { FieldView } from '@alpha/core/api'
import { describe, expect, it } from 'vitest'
import { BLANK } from './engine.ts'
import { listWords } from './list-words.ts'

const field = (id: string, name: string, kind: string): FieldView =>
  ({ id, name, slug: id, kind, many: false }) as unknown as FieldView
const fields = [
  field('stage', 'Stage', 'choice'),
  field('added', 'Added', 'date'),
  field('owner', 'Owner', 'person'),
  field('price', 'Asking price', 'money'),
  ...['email', 'phone', 'notes', 'source', 'city'].map((id) =>
    field(id, id[0]?.toUpperCase() + id.slice(1), 'text'),
  ),
]

describe('what a saved list holds', () => {
  it('says nothing of a list that shows every row and column', () => {
    expect(listWords(BLANK, fields)).toEqual([])
  })

  it('says its filters, search, sort, group and hidden columns, a line each', () => {
    const lines = listWords(
      {
        ...BLANK,
        search: ' georgia ',
        filters: {
          match: 'any',
          rules: [
            { field: 'stage', op: 'in', values: ['Interested', 'Contacted'] },
            { field: 'price', op: 'gt', value: 1000000 },
          ],
        },
        sorts: [
          { field: 'added', dir: 'desc' },
          { field: 'stage', dir: 'asc' },
        ],
        group: 'owner',
        hidden: ['email', 'phone', 'notes', 'source', 'city'],
      },
      fields,
    )
    expect(lines[0]).toBe('Stage is Interested or Contacted, or Asking price more than 1,000,000')
    expect(lines.slice(1)).toEqual([
      'Search: georgia',
      'Sorted by Added, newest first, then Stage, A to Z',
      'Grouped by Owner',
      'Hides 5 columns: Email, Phone, Notes, Source, and 1 more',
    ])
  })

  it('names its layout when it is not a table, and skips a column that has gone', () => {
    expect(
      listWords({ ...BLANK, kind: 'board', by: 'stage', group: 'gone', hidden: ['gone'] }, fields),
    ).toEqual(['Board by Stage'])
  })
})
