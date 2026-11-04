import { describe, expect, it } from 'vitest'
import { pageOf } from './pager.tsx'

describe('pageOf', () => {
  it('shows five rows a page and says which', () => {
    expect(pageOf(12, 0)).toMatchObject({ pages: 3, from: 0, to: 5, words: '1–5 of 12' })
    expect(pageOf(12, 2)).toMatchObject({ from: 10, to: 12, words: '11–12 of 12' })
  })
  it('keeps to the last page when rows go', () => {
    expect(pageOf(6, 1)).toMatchObject({ page: 1, from: 5, to: 6 })
    expect(pageOf(5, 1)).toMatchObject({ page: 0, pages: 1, from: 0, to: 5 })
    expect(pageOf(0, 3)).toMatchObject({ page: 0, from: 0, to: 0 })
  })
})
