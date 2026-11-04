import { expect, it } from 'vitest'
import { movedIn, nudged, placed } from './arrange.tsx'

it('places what was kept, each card once, a new one at the foot of its start column', () => {
  const start = [
    ['a', 'b'],
    ['c', 'd'],
  ]
  expect(placed(undefined, start, ['a', 'b', 'c'])).toEqual([
    [['a'], ['b']],
    [['c'], ['d']],
  ])
  expect(placed([[['c', 'a']], []], start, ['a', 'c', 'd'])).toEqual([[['c', 'a']], [['d']]])
})

it('moves a card beside, above or below another, across columns, or to a column’s foot', () => {
  const cols = [[['a', 'b'], ['c']], [['d']]]
  expect(movedIn(cols, 'c', 'a', 'right')).toEqual([[['a', 'c', 'b']], [['d']]])
  expect(movedIn(cols, 'a', 'c', 'bottom')).toEqual([[['b'], ['c'], ['a']], [['d']]])
  expect(movedIn(cols, 'd', 'b', 'top')).toEqual([[['d'], ['a', 'b'], ['c']], []])
  expect(movedIn(movedIn(cols, 'd', 'b', 'top'), 'a', 1, 'bottom')).toEqual([
    [['d'], ['b'], ['c']],
    [['a']],
  ])
})

it('moves a card by the arrows, out of a shared row first, then across columns', () => {
  const cols = [[['a', 'b'], ['c']], [['d']]]
  expect(nudged(cols, cols, 'b', 'ArrowLeft')).toEqual([[['b', 'a'], ['c']], [['d']]])
  expect(nudged(cols, cols, 'a', 'ArrowDown')).toEqual([[['b'], ['a'], ['c']], [['d']]])
  expect(nudged(cols, cols, 'c', 'ArrowDown')).toEqual([[['a', 'b']], [['c'], ['d']]])
  expect(nudged(cols, cols, 'd', 'ArrowUp')).toEqual([[['a', 'b'], ['c'], ['d']], []])
  expect(nudged(cols, cols, 'c', 'ArrowUp')).toEqual([[['c'], ['a', 'b']], [['d']]])
  // nothing past the first or the last
  expect(nudged(cols, cols, 'd', 'ArrowDown')).toBe(cols)
})
