import { describe, expect, it } from 'vitest'
import { type Block, moved, orderOf, placeOf, SUMMARY, TAB } from './RecordPage.tsx'

const kept = (
  k: Partial<{ hidden: string[]; tabs: string[]; places: Record<string, number> }>,
) => ({
  hidden: [],
  tabs: [],
  ...k,
})
const block = (key: string, b: Partial<Block> = {}): Block => ({
  key,
  title: key,
  short: 'x',
  ...b,
})

describe('where a record block shows', () => {
  it('starts on Summary, a page of its own as a tab, one pinned before both ways', () => {
    expect(placeOf(block('activity'), kept({}))).toBe(SUMMARY)
    expect(placeOf(block('page', { short: undefined, full: 'p' }), kept({}))).toBe(TAB)
    expect(placeOf(block('related'), kept({ tabs: ['related'] }))).toBe(SUMMARY | TAB)
  })
  it('takes the place the person chose, nowhere included', () => {
    expect(placeOf(block('events'), kept({ places: { events: 0 } }))).toBe(0)
    expect(placeOf(block('knows'), kept({ places: { knows: 3 } }))).toBe(3)
  })
})

describe('the order of tabs and blocks', () => {
  it('is Summary then the page order, until the person moves one', () => {
    expect(orderOf(['a', 'b', 'c'], kept({}))).toEqual(['summary', 'a', 'b', 'c'])
    expect(orderOf(['a', 'b', 'c'], kept({ tabs: ['c', 'summary'] }))).toEqual([
      'c',
      'summary',
      'a',
      'b',
    ])
  })
  it('moves one before its neighbour going left, after it going right', () => {
    const order = ['summary', 'a', 'b', 'c']
    expect(moved(order, 'b', 'summary', true)).toEqual(['b', 'summary', 'a', 'c'])
    expect(moved(order, 'summary', 'a', false)).toEqual(['a', 'summary', 'b', 'c'])
  })
})
