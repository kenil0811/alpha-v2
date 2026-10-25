import type { FieldView, RowView, TableView } from '@alpha/core/api'
import { describe, expect, it } from 'vitest'
import { relatedTo } from './RecordPage.tsx'

const field = (slug: string, kind: string): FieldView => ({
  id: slug,
  name: slug,
  slug,
  kind,
  choices: [],
  tones: {},
  many: false,
  about: null,
  aboutBy: null,
})
const row = (id: string, values: Record<string, unknown>) =>
  ({ id, values, sources: {} }) as unknown as RowView
const table = (id: string, fields: FieldView[], rows: RowView[]) =>
  ({ id, name: id, fields, rows }) as unknown as TableView

describe('a record’s page', () => {
  it('lists the records of other tables whose relations hold it, one or many', () => {
    const financials = table(
      'Financials',
      [field('year', 'number'), field('deal', 'relation')],
      [row('f1', { year: 2024, deal: 'd1' }), row('f2', { year: 2025, deal: 'd2' })],
    )
    const staff = table(
      'Staff',
      [field('name', 'text'), field('deals', 'relation')],
      [row('s1', { name: 'Ada', deals: ['d2', 'd1'] })],
    )
    const notes = table('Notes', [field('text', 'text')], [row('n1', { text: 'd1' })])
    const found = relatedTo('d1', [financials, staff, notes])
    expect(found.map((r) => [r.table.name, r.rows.map((x) => x.id)])).toEqual([
      ['Financials', ['f1']],
      ['Staff', ['s1']],
    ])
  })
})
