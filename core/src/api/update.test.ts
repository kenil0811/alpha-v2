// Check for updates: the feed's version against the one running.
import { describe, expect, it } from 'vitest'
import { newer, updateFrom } from './update.ts'

const feed = (body: unknown, ok = true) =>
  (async () => ({ ok, json: async () => body })) as unknown as typeof fetch

describe('Check for updates', () => {
  it('compares versions part by part', () => {
    expect(newer('0.10.0', '0.9.3')).toBe(true)
    expect(newer('1.2.3', '1.2.3')).toBe(false)
    expect(newer('1.2', '1.2.1')).toBe(false)
    expect(newer('1.0.0', 'from a repository')).toBe(false)
  })

  it('says a newer one and where it is, or that this one is the newest', async () => {
    const out = { version: '0.9.0', url: 'https://example.com/alpha-0.9.0.dmg' }
    expect(await updateFrom('https://f', '0.8.1', feed(out))).toEqual({
      current: '0.8.1',
      set: true,
      newest: '0.9.0',
      url: out.url,
    })
    expect(await updateFrom('https://f', '0.9.0', feed(out))).toEqual({
      current: '0.9.0',
      set: true,
    })
  })

  it('is not set up without a feed, and refuses a feed that does not answer or names no web page', async () => {
    expect(await updateFrom(undefined, '0.9.0')).toEqual({ current: '0.9.0', set: false })
    await expect(updateFrom('https://f', '0.9.0', feed({}, false))).rejects.toThrow(
      /did not answer/,
    )
    await expect(
      updateFrom('https://f', '0.9.0', feed({ version: '1.0.0', url: 'javascript:alert(1)' })),
    ).rejects.toThrow(/did not answer/)
  })
})
