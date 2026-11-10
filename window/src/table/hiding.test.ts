// "Showing n of m rows" whenever rows are hidden, a saved list's own filters too, naming what
// hides them, with Clear filters.
import type { FieldView, ViewConfig } from '@alpha/core/api'
import { describe, expect, it } from 'vitest'
import { BLANK, complete, differs } from './engine.ts'
import { cleared, hiding, showingWords } from './hiding.ts'

const field = (id: string, name: string) => ({ id, name, slug: name.toLowerCase() }) as FieldView
const fields = [field('f1', 'Stage'), field('f2', 'Owner')]
const filtered: ViewConfig = complete({
  search: 'harbor',
  filters: {
    match: 'all',
    rules: [
      { field: 'f1', op: 'is', value: 'New' },
      { field: 'f1', op: 'is_not', value: 'Lost' },
    ],
  },
})

describe('the showing line', () => {
  it('names what hides the rows', () => {
    expect(hiding(filtered, fields)).toEqual(['Stage', 'a search'])
    expect(showingWords({ shown: 12, total: 140, hiding: ['Stage', 'a search'], came: null })).toBe(
      'Showing 12 of 140 rows, filtered by Stage and a search.',
    )
    expect(
      showingWords({ shown: 3, total: 140, hiding: ['Stage', 'Owner', 'a search'], came: 'page' }),
    ).toBe('Showing 3 of 140 rows, the ones a page counted, filtered by Stage, Owner and a search.')
    expect(showingWords({ shown: 5, total: 9, hiding: [], came: 'row' })).toBe(
      'Showing 5 of 9 rows, the ones part of the row you came from.',
    )
  })

  it('shows nothing when no row is hidden', () => {
    expect(showingWords({ shown: 140, total: 140, hiding: [], came: null })).toBeNull()
  })

  it('clears the filters and the search; Cancel brings the saved list back', () => {
    const saved = filtered // a saved list's own filters
    const after = cleared(saved)
    expect(after.filters.rules).toEqual([])
    expect(after.search).toBe('')
    expect(differs(after, saved)).toBe(true) // T1's Save and Cancel appear
    expect(differs(saved, saved)).toBe(false) // Cancel is the saved list again
    expect(differs(cleared(BLANK), BLANK)).toBe(false)
  })
})
