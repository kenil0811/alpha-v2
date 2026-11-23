import { expect, it } from 'vitest'
import { nearestWidth } from './CardGrid.tsx'

it('snaps a dragged share of the row to the nearest width', () => {
  expect(nearestWidth(0.05)).toBe('1/16')
  expect(nearestWidth(0.13)).toBe('1/8')
  expect(nearestWidth(0.2)).toBe('1/4')
  expect(nearestWidth(0.31)).toBe('1/3')
  expect(nearestWidth(0.55)).toBe('1/2')
  expect(nearestWidth(0.8)).toBe('1')
  expect(nearestWidth(1.4)).toBe('1')
})
