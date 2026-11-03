import { describe, expect, it } from 'vitest'
import { pagerWords } from './pager.tsx'

describe('pagerWords', () => {
  it('says what it counts', () => {
    expect(pagerWords(0, 4, 'Approval')).toBe('Approval 1 of 4')
    expect(pagerWords(0, 6, 'Agents', { per: 3, total: 16 })).toBe('Agents 1–3 of 16')
    expect(pagerWords(5, 6, 'Agents', { per: 3, total: 16 })).toBe('Agents 16 of 16')
    expect(pagerWords(4, 6, 'Agents', { per: 3, total: 16 })).toBe('Agents 13–15 of 16')
  })
})
