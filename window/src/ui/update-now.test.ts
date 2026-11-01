import { expect, test } from 'vitest'
import { updatedWords } from './update-now.tsx'

test('Update now says when, relative while recent', () => {
  const now = new Date(2026, 9, 30, 15, 0).getTime()
  expect(updatedWords(new Date(now - 20_000).toISOString(), now)).toBe('just now')
  expect(updatedWords(new Date(now - 12 * 60_000).toISOString(), now)).toBe('12 min ago')
  expect(updatedWords(new Date(2026, 9, 30, 12, 42).toISOString(), now)).toMatch(/12.42/)
  expect(updatedWords(new Date(2026, 9, 29, 12, 42).toISOString(), now)).toMatch(/29.*Oct|Oct.*29/)
})
