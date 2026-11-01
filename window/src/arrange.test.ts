import { expect, it } from 'vitest'
import {
  columnsOf,
  keyOf,
  moved,
  movedIn,
  pairs,
  rowsOf,
  sized,
  sizeOf,
  stacked,
} from './arrange.tsx'

it('moves a block beside, above or below another, and keeps new blocks at the foot', () => {
  const rows = [['a', 'b'], ['c']]
  expect(moved(rows, 'c', 'a', 'right')).toEqual([['a', 'c', 'b']])
  expect(moved(rows, 'b', 'c', 'bottom')).toEqual([['a'], ['c'], ['b']])
  expect(moved(rows, 'a', 'b', 'top')).toEqual([['a'], ['b'], ['c']])
  expect(rowsOf([['x', 'a']], [], ['a', 'b'])).toEqual([['a'], ['b']])
  expect(pairs(['a', 'w', 'b', 'c'], (k) => k === 'w')).toEqual([['a'], ['w'], ['b', 'c']])
})

it('keeps a block’s size with it as it moves, and gives it back', () => {
  const rows = sized([['a', 'b'], ['c']], 'a', { w: 33.4, h: null })
  expect(rows).toEqual([['a@33', 'b'], ['c']])
  expect(moved(rows, 'a', 'c', 'right')).toEqual([['b'], ['c', 'a@33']])
  expect(moved(rows, 'c', 'a', 'left')).toEqual([['c', 'a@33', 'b']])
  expect(rowsOf(rows, [], ['a', 'b', 'c', 'd'])).toEqual([['a@33', 'b'], ['c'], ['d']])
  expect(sized(rows, 'a', { w: 5, h: null })).toEqual([['a@20', 'b'], ['c']])
  expect(sized(rows, 'a', null)).toEqual([['a', 'b'], ['c']])
  const tall = sized(rows, 'b', { w: 50, h: 319.6 })
  expect(tall).toEqual([['a@33', 'b@50x320'], ['c']])
  expect(moved(tall, 'b', 'c', 'top')).toEqual([['a@33'], ['b@50x320'], ['c']])
  expect(sized(tall, 'c', { w: null, h: 10 })).toEqual([['a@33', 'b@50x320'], ['c@x80']])
  expect(['a', 'a@40', 'a@40x320', 'a@x80'].map(keyOf)).toEqual(['a', 'a', 'a', 'a'])
  expect(sizeOf('a@40')).toEqual({ w: 40, h: null })
  expect(sizeOf('a@40x320')).toEqual({ w: 40, h: 320 })
  expect(sizeOf('a')).toEqual({ w: null, h: null })
  // a block not shown just now keeps its place in what is kept
  const all = rowsOf([['gone', 'a'], ['b']], [], ['gone', 'a', 'b'])
  expect(sized(all, 'a', { w: 40, h: 300 })).toEqual([['gone', 'a@40x300'], ['b']])
})

it('moves a block within or across columns, and stacks the columns in order', () => {
  const cols = [
    [['a', 'b'], ['c']],
    [['ask'], ['gov@50x200'], ['files']],
  ]
  // across: Governance beside a, its size with it; and back to the foot of the right column
  const left = movedIn(cols, 'gov', 'a', 'right')
  expect(left).toEqual([
    [['a', 'gov@50x200', 'b'], ['c']],
    [['ask'], ['files']],
  ])
  expect(movedIn(left, 'gov', 1)).toEqual([
    [['a', 'b'], ['c']],
    [['ask'], ['files'], ['gov@50x200']],
  ])
  // within: files above ask, the left column untouched
  expect(movedIn(cols, 'files', 'ask', 'top')).toEqual([
    cols[0],
    [['files'], ['ask'], ['gov@50x200']],
  ])
  // a column emptied stays, to take a block back
  expect(movedIn([[['a']], [['b']]], 'b', 'a', 'bottom')).toEqual([[['a'], ['b']], []])
  expect(movedIn([[['a'], ['b']], []], 'b', 1)).toEqual([[['a']], [['b']]])
  // what is kept in either column wins; a new block goes to the foot of the column it starts in
  expect(
    columnsOf(
      [[['a', 'gov']], [['ask']]],
      [[['a']], [['ask'], ['gov'], ['new']]],
      ['a', 'gov', 'ask', 'new'],
    ),
  ).toEqual([[['a', 'gov']], [['ask'], ['new']]])
  // narrow: the work first, then the standard column
  expect(stacked(left).map((r) => r.map(keyOf))).toEqual([
    ['a', 'gov', 'b'],
    ['c'],
    ['ask'],
    ['files'],
  ])
})
