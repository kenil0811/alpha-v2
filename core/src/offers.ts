// The extra permissions Alpha offers after Set up Alpha (Vikas, 23 Nov; proposed for Kenil's
// review), one list in core/config/offers.yaml: each offered only once its prerequisite is met,
// one at a time, never while the person is in Set up Alpha, and one they said not now to waits
// declined_wait_days before it comes again. A wall in code: nextOffer decides, never the window.
import type { OffersConfig } from './config.ts'
import { type Db, one, run } from './world/db.ts'

export type Offer = OffersConfig['offers'][number]

export interface Decided {
  answer: 'yes' | 'not now'
  at: string
}

// What the prerequisites are judged on, about one person.
export interface Facts {
  setUpAt: string | null // when they finished Set up Alpha; none while they are in it
  apps: string[] // the apps Alpha Bridge's Apps reader found on their computer
  bridgeSince: string | null // since when a computer of theirs with Alpha Bridge is connected
  decided: Record<string, Decided>
  now: number
}

const DAY = 86_400_000

// The one offer to make now, or none.
export function nextOffer(cfg: OffersConfig, f: Facts): Offer | null {
  if (!f.setUpAt) return null
  for (const o of cfg.offers) {
    const d = f.decided[o.key]
    if (d?.answer === 'yes') continue
    if (d && f.now - Date.parse(d.at) < cfg.declined_wait_days * DAY) continue
    const { app, bridge, bridge_days: days } = o.after
    if (app && !f.apps.some((a) => a.toLowerCase() === app.toLowerCase())) continue
    if ((bridge || days !== undefined) && !f.bridgeSince) continue
    // ponytail: since the pairing or the setup, whichever is later, while connected now; a gap in
    // between is not seen (keep the Bridge's uptime if that matters)
    const on = Math.max(Date.parse(f.bridgeSince ?? ''), Date.parse(f.setUpAt))
    if (days !== undefined && f.now - on < days * DAY) continue
    return o
  }
  return null
}

const key = (offer: string) => `offer:${offer}`

export function decidedOf(db: Db, user: string, cfg: OffersConfig): Record<string, Decided> {
  const out: Record<string, Decided> = {}
  for (const o of cfg.offers) {
    const r = one<{ value: string }>(
      db,
      'SELECT value FROM preferences WHERE user_id = ? AND key = ?',
      user,
      key(o.key),
    )
    try {
      if (r) out[o.key] = JSON.parse(r.value) as Decided
    } catch {
      // a value that does not read is as good as none
    }
  }
  return out
}

export function decide(db: Db, user: string, offer: string, answer: Decided['answer']): void {
  run(
    db,
    'INSERT INTO preferences (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value',
    user,
    key(offer),
    JSON.stringify({ answer, at: new Date().toISOString() }),
  )
}

// The readers an offer brings, never offered in Alpha Bridge before its offer is taken.
export const PHASED_READERS = ['safari']
