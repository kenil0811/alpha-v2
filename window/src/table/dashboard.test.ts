import type { FieldView, RowView, ViewConfig } from '@alpha/core/api'
import { describe, expect, it } from 'vitest'
import { relevant, tilesOf } from './Dashboard.tsx'

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
    field('Seen', 'date'),
  ]
  const rows = [
    row('a', { Stage: 'Won', Price: 10, Seen: '2020-01-01' }),
    row('b', { Stage: 'Lost', Price: 30 }),
    row('c', { Stage: 'Won' }),
  ]

  it('shows only what says something: no row count, no empty choice, no date all behind', () => {
    const tiles = tilesOf(rows, 3, fields, {}, config)
    expect(tiles.map((t) => t.label)).toEqual(['Stage', 'Total price'])
    expect(tiles[0]?.value).toBe('2')
    expect(tiles[1]?.parts?.map((p) => p.value)).toEqual([10, 30])
    expect(tiles[1]?.buttons.map((b) => b.label)).toEqual(['Largest first', 'Empty 1'])
  })

  it('a button shows those rows', () => {
    const stage = tilesOf(rows, 3, fields, {}, config)[0]
    expect(stage?.buttons[0]?.pick().filters.rules).toEqual([
      { field: 'Stage', op: 'in', values: ['Won'] },
    ])
  })

  it('nothing relevant, no tiles', () => {
    const flat = [row('a', { Stage: 'Won', Price: 5 }), row('b', { Stage: 'Won', Price: 5 })]
    expect(tilesOf(flat, 2, fields, {}, config)).toEqual([])
    expect(tilesOf([], 0, fields, {}, config)).toEqual([])
    expect(relevant.choice([1015, 2])).toBe(false)
    expect(relevant.choice([572, 424, 17])).toBe(true)
  })
})
