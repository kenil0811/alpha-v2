// The extra permissions offered after setup (core/config/offers.yaml; proposed, Vikas 23 Nov):
// each only once its prerequisite is met, one at a time, never in setup, a not now waiting.
import { expect, it } from 'vitest'
import { config } from './config.ts'
import { type Facts, nextOffer } from './offers.ts'

const DAY = 86_400_000
const NOW = Date.parse('2026-12-01T12:00:00Z')
const cfg = config.offers()
const facts = (f: Partial<Facts>): Facts => ({
  setUpAt: new Date(NOW - 10 * DAY).toISOString(),
  apps: [],
  bridgeSince: null,
  decided: {},
  now: NOW,
  ...f,
})
const ago = (days: number) => new Date(NOW - days * DAY).toISOString()

it('offers nothing in setup, nor before its prerequisite is met', () => {
  // in Set up Alpha: nothing, whatever is met
  expect(
    nextOffer(cfg, facts({ setUpAt: null, apps: ['Safari'], bridgeSince: ago(30) })),
  ).toBeNull()
  // Safari used, but no Alpha Bridge connected
  expect(nextOffer(cfg, facts({ apps: ['Safari'] }))).toBeNull()
  // Alpha Bridge connected two days: not yet long enough to watch
  expect(nextOffer(cfg, facts({ bridgeSince: ago(2) }))).toBeNull()
})

it('offers one at a time, in order, and a not now waits before it comes again', () => {
  const both = { apps: ['Safari'], bridgeSince: ago(30) }
  expect(nextOffer(cfg, facts(both))?.key).toBe('safari')
  // taken: the next one
  const yes = { safari: { answer: 'yes' as const, at: ago(1) } }
  expect(nextOffer(cfg, facts({ ...both, decided: yes }))?.key).toBe('watch')
  // not now, lately: the next, and Safari again only after the wait
  const notNow = { safari: { answer: 'not now' as const, at: ago(1) } }
  expect(nextOffer(cfg, facts({ ...both, decided: notNow }))?.key).toBe('watch')
  const long = { safari: { answer: 'not now' as const, at: ago(cfg.declined_wait_days + 1) } }
  expect(nextOffer(cfg, facts({ ...both, decided: long }))?.key).toBe('safari')
  // watching counts its days from setup when Alpha Bridge was paired before it
  expect(
    nextOffer(cfg, facts({ bridgeSince: ago(30), setUpAt: ago(2), decided: yes }))?.key,
  ).toBeUndefined()
})
