import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type Host, type Manifest, Problem } from './connector.ts'
import { judgeHealth, makeCall } from './runtime.ts'

const judgements = { retries: 2, busyWaitMs: 300_000, fewerRowsRatio: 0.5, quietDays: 7 }
let dir: string
let lines: { words: string; data?: Record<string, unknown> }[]

const manifest = (perDay?: number): Manifest => ({
  name: 'test',
  title: 'Test',
  auth: 'secret',
  account: { label: 'Account' },
  pace: { perMinute: 600, ...(perDay ? { perDay } : {}) },
})

function host(account = `a${Math.random()}`): Host {
  return {
    account,
    secret: async () => null,
    cursor: () => null,
    setCursor: () => {},
    land: () => ({ added: 0, changed: 0, same: 0 }),
    journal: (words, data) => {
      lines.push({ words, ...(data ? { data } : {}) })
    },
  }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'alpha-sdk-'))
  lines = []
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('a connection’s calls', () => {
  it('retry what fails in passing, and journal each call once', async () => {
    const c = makeCall(manifest(), host(), { judgements, sleep: async () => {} })
    let tries = 0
    const out = await c.call('fetch', { since: 1 }, async () => {
      tries++
      if (tries < 3) throw new Error('read ECONNRESET')
      return 'ok'
    })
    expect(out).toBe('ok')
    expect(tries).toBe(3)
    expect(lines).toEqual([{ words: 'Test: fetch', data: { call: 'fetch', ok: true, attempt: 2 } }])
  })

  it('do not retry a problem the person must act on', async () => {
    const c = makeCall(manifest(), host(), { judgements, sleep: async () => {} })
    let tries = 0
    await expect(
      c.call('login', {}, async () => {
        tries++
        throw new Problem('The app password was not accepted.', 'sign_in')
      }),
    ).rejects.toThrow(/not accepted/)
    expect(tries).toBe(1)
    expect(lines[0]?.words).toBe('Test: login did not work')
  })

  it('never try again a call that changes something, when its fate is unknown', async () => {
    const c = makeCall(manifest(), host(), { judgements, sleep: async () => {}, once: true })
    let tries = 0
    await expect(
      c.call('send', { to: 'a@b.example' }, async () => {
        tries++
        throw new Error('Connection timed out')
      }),
    ).rejects.toThrow(/timed out/)
    expect(tries).toBe(1)
  })

  it('wait out a service that asks to wait, as long as it asked, a send too', async () => {
    const slept: number[] = []
    const c = makeCall(manifest(), host(), {
      judgements,
      sleep: async (ms) => {
        slept.push(ms)
      },
      once: true,
    })
    let tries = 0
    const out = await c.call('send', {}, async () => {
      tries++
      if (tries === 1)
        throw Object.assign(new Error('Too Many Requests'), {
          status: 429,
          headers: new Headers({ 'retry-after': '12' }),
        })
      if (tries === 2) throw new Problem('Try again later.', 'busy')
      return 'sent'
    })
    expect([out, tries, slept]).toEqual(['sent', 3, [12_000, 10_000]])
    // past the bound, it says so and stops
    const d = makeCall(manifest(), host(), { judgements, sleep: async () => {} })
    await expect(
      d.call('read', {}, async () => {
        throw new Problem('Slow down.', 'busy', { retryAfterMs: 400_000 })
      }),
    ).rejects.toThrow(
      'Test asked Alpha to wait longer than 5 minutes, so read was not done. Try again later.',
    )
  })

  it('stop for the day when the day’s budget is used', async () => {
    const c = makeCall(manifest(2), host(), { judgements })
    await c.call('a', 1, async () => 1)
    await c.call('a', 2, async () => 2)
    await expect(c.call('a', 3, async () => 3)).rejects.toThrow(/carries on tomorrow/)
  })

  it('record answers, then replay them without the service', async () => {
    const fixtures = { dir }
    const rec = makeCall(manifest(), host(), {
      judgements,
      fixtures: { ...fixtures, mode: 'record' },
    })
    await rec.call('search', { from: 'broker' }, async () => [{ subject: 'Deal' }])
    const rep = makeCall(manifest(), host(), {
      judgements,
      fixtures: { ...fixtures, mode: 'replay' },
    })
    const out = await rep.call('search', { from: 'broker' }, async () => {
      throw new Error('the service was reached')
    })
    expect(out).toEqual([{ subject: 'Deal' }])
    await expect(rep.call('search', { from: 'someone else' }, async () => [])).rejects.toThrow(
      /No recorded answer/,
    )
  })
})

describe('the health judgement', () => {
  const now = new Date('2026-10-19T12:00:00Z')
  it('says when a sync holds far fewer rows than last time', () => {
    expect(
      judgeHealth({ rows: 100, lastNewAt: null }, { rows: 40, sawNew: true }, judgements, now),
    ).toBe('Fewer rows than last time: 40, where there were 100.')
    expect(
      judgeHealth({ rows: 100, lastNewAt: null }, { rows: 60, sawNew: true }, judgements, now),
    ).toBeNull()
    expect(
      judgeHealth({ rows: 4, lastNewAt: null }, { rows: 0, sawNew: false }, judgements, now),
    ).toBeNull()
  })

  it('says when nothing new has come for a week', () => {
    expect(
      judgeHealth(
        { rows: 10, lastNewAt: '2026-10-10T12:00:00Z' },
        { rows: 10, sawNew: false },
        judgements,
        now,
      ),
    ).toBe('Nothing new for 9 days.')
    expect(
      judgeHealth(
        { rows: 10, lastNewAt: '2026-10-15T12:00:00Z' },
        { rows: 10, sawNew: false },
        judgements,
        now,
      ),
    ).toBeNull()
  })
})
