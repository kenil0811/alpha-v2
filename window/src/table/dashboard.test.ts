import type { FieldView, RowView, ViewConfig } from '@alpha/core/api'
import { describe, expect, it } from 'vitest'
import { tilesOf } from './Dashboard.tsx'

const field = (id: string, kind: string, choices: string[] = []): FieldView => ({
  id,
  name: id,
  slug: id,
  kind,
  choices,
  tones: {},
  default: null,
  many: false,
  relatesTo: null,
  summary: null,
  about: null,
  aboutBy: null,
})
const row = (id: string, values: Record<string, unknown>): RowView => ({ id, values, sources: {} })
const config = { filters: { match: 'all', rules: [] }, sorts: [] } as unknown as ViewConfig

describe('the dashboard row', () => {
  const fields = [
    field('Fit', 'choice', ['Yes']),
    field('Stage', 'choice', ['Won', 'Lost']),
    field('Price', 'number'),
  ]
  const rows = [
    row('a', { Stage: 'Won', Price: 10 }),
    row('b', { Stage: 'Lost', Price: 30 }),
    row('c', { Stage: 'Won' }),
  ]

  it('counts, skips a choice no row holds, and sums by the one that holds something', () => {
    const tiles = tilesOf(rows, 3, fields, {}, config)
    expect(tiles.map((t) => t.label)).toEqual(['Rows', 'Stage', 'Total price'])
    expect(tiles[1]?.value).toBe('2 Won')
    expect(tiles[2]?.parts?.map((p) => p.value)).toEqual([10, 30])
    expect(tiles[2]?.buttons.map((b) => b.label)).toEqual(['Largest first', 'Empty 1'])
  })

  it('a button shows those rows', () => {
    const stage = tilesOf(rows, 3, fields, {}, config)[1]
    expect(stage?.buttons[0]?.pick().filters.rules).toEqual([
      { field: 'Stage', op: 'in', values: ['Won'] },
    ])
  })

  it('draws nothing for an empty table', () => {
    expect(tilesOf([], 0, fields, {}, config)).toEqual([])
  })
})
