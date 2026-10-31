import { expect, it } from 'vitest'
import { keyOf, moved, pairs, rowsOf, sized, sizeOf } from './arrange.tsx'

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
