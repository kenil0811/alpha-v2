// Read now on a table: the line under it says what reads into it and when, in the person's own
// day; each connector named once.
import type { ReadByView } from '@alpha/core/api'
import { describe, expect, it } from 'vitest'
import { lastRead, readByWords, titles } from './ReadNow.tsx'

const by = (
  title: string,
  lastReadAt: string | null,
  reason: string | null = null,
): ReadByView => ({
  connection: `k_${title}`,
  title,
  account: 'me@example.com',
  reason,
  lastReadAt,
})

describe('what reads into a table', () => {
  const now = new Date(2026, 10, 1, 16, 0)
  const today = new Date(2026, 10, 1, 10, 42).toISOString()
  const earlier = new Date(2026, 10, 1, 9, 5).toISOString()

  it('names each connector once', () => {
    expect(titles([by('Gmail', null), by('Outlook', null)])).toBe('Gmail and Outlook')
    expect(titles([by('Gmail', null), by('Gmail', null)])).toBe('Gmail')
  })

  it('says when it was last read: the time today, else the day', () => {
    expect(lastRead([by('Gmail', earlier), by('Outlook', today)], now)).toMatch(/10.42/)
    expect(lastRead([by('Gmail', new Date(2026, 9, 30, 8, 0).toISOString())], now)).toMatch(/30/)
    expect(lastRead([by('Gmail', null)], now)).toBeNull()
  })

  it('reads "Read by Gmail and Outlook, 10:42", and nothing for a table kept by hand', () => {
    expect(readByWords([by('Gmail', earlier), by('Outlook', today)], now)).toMatch(
      /^Read by Gmail and Outlook, 10.42/,
    )
    expect(readByWords([by('Gmail', null)], now)).toBe('Read by Gmail, not yet')
    expect(readByWords([], now)).toBeNull()
  })
})
