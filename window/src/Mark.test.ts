import { describe, expect, it } from 'vitest'
import { boxAt } from './Mark.tsx'

const size = { width: 320, height: 170 }
const view = { width: 1024, height: 700 }
const at = (top: number, bottom: number, left = 100) => boxAt({ top, bottom, left }, size, view)

describe('the comment box stays fully on screen', () => {
  it('goes under what was marked', () => expect(at(100, 120)).toEqual({ top: 128, left: 100 }))
  it('else over it, near the bottom', () => expect(at(600, 690)).toEqual({ top: 422, left: 100 }))
  it('else inside the window, for something as tall as it', () =>
    expect(at(20, 690)).toEqual({ top: 28, left: 100 }))
  it('never below the window, however low', () =>
    expect(at(650, 690).top + size.height).toBeLessThanOrEqual(view.height - 8))
  it('shifts in from the right edge', () => expect(at(100, 120, 990).left).toBe(696))
  it('and from the left', () => expect(at(100, 120, -40).left).toBe(8))
})
