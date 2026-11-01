// Picking a related row or a person (Batch B, 14b): where the picks come from, the search past
// five, and what a pick sends; a file is never picked here.
import type { FieldView } from '@alpha/core/api'
import { describe, expect, it } from 'vitest'
import { narrowed, pickedValue, picksFrom } from './Pick.tsx'
import { canEdit, canPick, canType } from './values.ts'

const field = (kind: string, more: Partial<FieldView> = {}): FieldView => ({
  id: kind,
  name: kind,
  slug: kind,
  kind,
  choices: [],
  tones: {},
  many: false,
  relatesTo: kind === 'relation' ? 't_suppliers' : null,
  summary: null,
  about: null,
  aboutBy: null,
  ...more,
})

describe('a picker', () => {
  it('is for a related row or a person, never a file or a summary', () => {
    expect(['relation', 'person', 'file', 'text'].map((k) => canPick(field(k)))).toEqual([
      true,
      true,
      false,
      false,
    ])
    expect(canPick(field('relation', { summary: 'How many orders' }))).toBe(false)
    expect(canEdit(field('relation'))).toBe(true)
    expect(canType(field('relation'))).toBe(false) // pasting and filling down stay with Alpha
  })

  it('offers the rows of the table pointed at, or the person’s people', () => {
    expect(picksFrom(field('relation'))).toBe('/api/tables/t_suppliers/names')
    expect(picksFrom(field('person'))).toBe('/api/people/names')
  })

  it('narrows by name or hint, the ones held first', () => {
    const picks = [
      { id: 'a', name: 'Dairy Farm', hint: null },
      { id: 'b', name: 'Mill & Co', hint: 'Harbor' },
      { id: 'c', name: 'Oven Works', hint: null },
    ]
    expect(narrowed(picks, '', ['c']).map((p) => p.id)).toEqual(['c', 'a', 'b'])
    expect(narrowed(picks, 'harb', []).map((p) => p.id)).toEqual(['b'])
    expect(narrowed(picks, 'o', []).map((p) => p.id)).toEqual(['b', 'c'])
  })

  it('sends one id, a list for several, none to clear, and nothing when unchanged', () => {
    expect(pickedValue(field('relation'), ['a'], ['b'])).toBe('b')
    expect(pickedValue(field('relation'), ['a'], [])).toBeNull()
    expect(pickedValue(field('relation', { many: true }), ['a'], ['a', 'b'])).toEqual(['a', 'b'])
    expect(pickedValue(field('person'), ['p'], ['p'])).toBeUndefined()
  })
})
