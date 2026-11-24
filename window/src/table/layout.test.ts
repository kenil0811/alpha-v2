import type { ViewConfig } from '@alpha/core/api'
import { expect, it } from 'vitest'
import { layoutOf, runOn } from './layout.ts'

it('keeps a column in one of Clip (the default), Overflow and Wrap', () => {
  let c = { frozen: 1, wrap: ['a'], overflow: [] } as unknown as ViewConfig
  const now = () =>
    layoutOf(c, (n) => {
      c = n
    })
  expect(now().spillOf('a')).toBe('wrap')
  expect(now().spillOf('b')).toBe('clip')
  now().setSpill('a', 'overflow')
  expect([c.wrap, c.overflow]).toEqual([[], ['a']])
  now().setSpill('a', 'clip')
  expect([c.wrap, c.overflow, now().spillOf('a')]).toEqual([[], [], 'clip'])
})

it('runs a cell on over the empty cells after it only as far as its words reach', () => {
  // a b _ _ c _ : a is blocked by b; b's words need two of the empty cells; c's fit in its own
  const blank = [false, false, true, true, false, true]
  const widths = [10, 20, 30, 40, 50, 60]
  const run = runOn(blank, widths, [40, 80, 0, 0, 30, 0])
  expect(run.more).toEqual([0, 70, 0, 0, 0, 0])
  expect(run.under).toEqual([false, false, true, true, false, false])
  // words that reach into the first empty cell only leave the second its dash
  const short = runOn(blank, widths, [0, 35, 0, 0, 0, 0])
  expect(short.more).toEqual([0, 30, 0, 0, 0, 0])
  expect(short.under).toEqual([false, false, true, false, false, false])
})
