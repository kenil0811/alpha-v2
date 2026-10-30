import { describe, expect, it } from 'vitest'
import { ticksOf, together } from './chart.tsx'

describe('ticksOf', () => {
  it('steps round from below the least to above the most', () => {
    expect(ticksOf(0, 4)).toEqual([0, 1, 2, 3, 4])
    expect(ticksOf(104, 147)).toEqual([100, 120, 140, 160])
    expect(ticksOf(0, 7300)).toEqual([0, 2000, 4000, 6000, 8000])
  })
})

describe('bubbles that fall together', () => {
  it('are one bubble with their count, amounts added, the most common colour', () => {
    const at = Date.parse('2026-10-28T10:00:00')
    const out = together([
      { at, lane: 'Under LOI', size: 2, tone: 'bad', label: 'A', href: '#/a' },
      { at: at + 3600_000, lane: 'Under LOI', size: 3, tone: 'warn', label: 'B' },
      { at, lane: 'Under LOI', size: 1, tone: 'warn', label: 'C' },
      { at, lane: 'Listed', size: 1, label: 'D', href: '#/d' },
    ])
    expect(out).toHaveLength(2)
    const loi = out.find((b) => b.lane === 'Under LOI')
    expect(loi).toMatchObject({ count: 3, size: 6, tone: 'warn' })
    expect(loi?.label).toBe('3 on this day:\nA\nB\nC')
    expect(out.find((b) => b.lane === 'Listed')).toMatchObject({ label: 'D', href: '#/d' })
  })
})
