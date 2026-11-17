// "Showing n of m rows" only for rows a page or a row sent the person to; a list's filters and
// search raise no line.
import { describe, expect, it } from 'vitest'
import { showingWords } from './hiding.ts'

describe('the showing line', () => {
  it('says which rows a page or a row sent the person to', () => {
    expect(showingWords({ shown: 3, total: 140, came: 'page' })).toBe(
      'Showing 3 of 140 rows, the ones a page counted.',
    )
    expect(showingWords({ shown: 5, total: 9, came: 'row' })).toBe(
      'Showing 5 of 9 rows, the ones that belong to the row you came from.',
    )
  })

  it('says nothing of a list’s own filters and search', () => {
    expect(showingWords({ shown: 12, total: 140, came: null })).toBeNull()
    expect(showingWords({ shown: 140, total: 140, came: null })).toBeNull()
  })
})
