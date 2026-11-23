import type { ViewConfig } from '@alpha/core/api'
import { expect, it } from 'vitest'
import { layoutOf, runOn } from './layout.ts'

it('keeps a column in one of Overflow, Wrap and Clip', () => {
  let c = { frozen: 1, wrap: ['a'], clip: [] } as unknown as ViewConfig
  const now = () =>
    layoutOf(c, (n) => {
      c = n
    })
  expect(now().spillOf('a')).toBe('wrap')
  expect(now().spillOf('b')).toBe('overflow')
  now().setSpill('a', 'clip')
  expect([c.wrap, c.clip]).toEqual([[], ['a']])
  now().setSpill('a', 'overflow')
  expect([c.wrap, c.clip, now().spillOf('a')]).toEqual([[], [], 'overflow'])
})

it('runs a cell on over the empty cells after it, up to the next filled one', () => {
  // a b _ _ c _ : a is blocked by b; b runs over two; c may not run on
  const blank = [false, false, true, true, false, true]
  const run = runOn(blank, [10, 20, 30, 40, 50, 60], [true, true, true, true, false, true])
  expect(run.more).toEqual([0, 70, 0, 0, 0, 0])
  expect(run.under).toEqual([false, false, true, true, false, false])
})
