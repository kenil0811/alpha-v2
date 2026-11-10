// A row's name, as a relation to it shows: its first words, or in a table with none (a day's) its
// first value, a date as a date (Kenil, 10 Nov).
import { describe, expect, it } from 'vitest'
import { rowName, type Table } from './types.ts'

const table = (fields: { kind: string; slug: string }[]) => ({ fields }) as unknown as Table

describe('a row’s name', () => {
  it('is its first words, or its first value, a date as a date', () => {
    const food = table([
      { kind: 'date', slug: 'date' },
      { kind: 'text', slug: 'food' },
    ])
    expect(rowName(food, { date: '2026-11-10', food: 'Avocado' })).toBe('Avocado')
    const day = table([
      { kind: 'notes', slug: 'notes' },
      { kind: 'date', slug: 'date' },
    ])
    expect(rowName(day, { notes: 'a long day', date: '2026-11-10' })).toBe('10 Nov 2026')
    expect(rowName(table([{ kind: 'number', slug: 'n' }]), { n: 3 })).toBe('3')
    expect(rowName(day, {})).toBe('a row')
  })
})
