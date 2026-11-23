// What one read brought, by table: what it met, what it added, changed or found the same, what it
// passed over (rows the person removed before, or a read that adds none), and what the never-use
// list left out (rules N1). Counted in the host every connector's read goes through, wherever the
// connector runs, so every connector is counted alike; kept on the read's journal line, which
// What Alpha read sums (api/read-report.ts).
import { type Connection, ownerOf } from '../world/connections.ts'
import type { World } from '../world/world.ts'

export interface Count {
  name: string // the table's name as the read found it
  read: number
  added: number
  changed: number
  same: number
  skipped: number
  leftOut: number
}

// by table id ('files' for the files a read kept)
export type Tally = Record<string, Count>

const NUMBERS = ['read', 'added', 'changed', 'same', 'skipped', 'leftOut'] as const

export function count(t: Tally, table: string, name: string, c: Partial<Count>): void {
  const was = t[table] ?? { name, read: 0, added: 0, changed: 0, same: 0, skipped: 0, leftOut: 0 }
  for (const k of NUMBERS) was[k] += c[k] ?? 0
  t[table] = was
}

export function totals(t: Tally): Omit<Count, 'name'> {
  const out = { read: 0, added: 0, changed: 0, same: 0, skipped: 0, leftOut: 0 }
  for (const c of Object.values(t)) for (const k of NUMBERS) out[k] += c[k]
  return out
}

const n = (x: number) => x.toLocaleString('en-GB')

// The read's line in Activity, in counts alone, never what was read.
export function tallyWords(account: string, t: Tally): string {
  const s = totals(t)
  const made = [s.added && `${n(s.added)} new`, s.changed && `${n(s.changed)} changed`]
    .filter(Boolean)
    .join(' and ')
  return [
    `Read ${account}: ${s.read ? `${n(s.read)} items` : 'nothing'}${made ? `, ${made}` : s.read ? ', nothing new' : ''}.`,
    s.leftOut ? `Left out ${n(s.leftOut)} on the never-use list.` : '',
    s.skipped
      ? `Passed over ${n(s.skipped)} it does not bring in (deleted before, or only kept up to date here).`
      : '',
  ]
    .filter(Boolean)
    .join(' ')
}

// A read's line for Activity and What Alpha read: how long it took, whether it brought anything,
// what it counted, and who allowed the connection (its owner, the line's person).
export function readLine(
  world: World,
  connector: string,
  title: string,
  conn: Connection,
  r: { ms: number; state: 'ok' | 'failed'; quiet: boolean; words: string; tally: Tally },
): void {
  world.line({
    actor: { kind: 'connector', id: connector },
    kind: 'connection_read',
    words: r.words,
    data: {
      connection: conn.id,
      name: title,
      ms: r.ms,
      state: r.state,
      quiet: r.quiet,
      tally: r.tally,
      allowedBy: conn.madeBy,
    },
    user: conn.madeBy.startsWith('person:') ? ownerOf(conn) : null,
  })
}
