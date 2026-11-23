// What Alpha read (Vikas, 23 Nov): per source, when it was read, what it met, kept, left out and
// why, and what was made from it, summed from the journal alone: each read's line with its counts
// (connectors/tally.ts), the rows each landed line names, who connected it, and what a person did
// with the lines Get to know you proposed. A read under way adds its counts so far. A member sees
// only their own sources; the owner sees every one.
import type { Tally } from '../connectors/tally.ts'
import type { Connection } from '../world/connections.ts'
import type { Line } from '../world/journal.ts'
import type { BaseCtx } from './ctx.ts'
import type { LearnedView, ReadReportView, ReadSourceView, ReadTableView } from './read-types.ts'

// ponytail: the newest 5000 lines of these kinds; a source read for years needs a count kept on
// the connection instead
const LINES = 5000
const ROWS = 200 // rows to open beside the page, per table

// What a table's items are called in the live line; any other table by its own name.
const NOUNS: Record<string, string> = {
  Mail: 'emails',
  Events: 'events',
  Contacts: 'contacts',
  Files: 'files',
  Sites: 'sites',
  Apps: 'apps',
  'AI requests': 'AI requests',
}

const n = (x: number) => x.toLocaleString('en-GB')

export function said(sources: ReadSourceView[], reading: boolean): string | null {
  const by = new Map<string, number>()
  for (const s of sources)
    for (const t of s.tables) {
      const noun = NOUNS[t.name] ?? t.name.toLowerCase()
      by.set(noun, (by.get(noun) ?? 0) + t.read)
    }
  const parts = [...by].filter(([, x]) => x > 0).map(([noun, x]) => `${n(x)} ${noun}`)
  if (!parts.length) return null
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]
  return `I've read ${list}${reading ? ' so far' : ''}`
}

const OFF: Partial<Record<Connection['state'], string>> = {
  paused: 'Switched off: it reads nothing until it is turned on again.',
  needs_sign_in: 'Waiting for you to sign in again.',
}

export function readReport(ctx: BaseCtx): ReadReportView {
  const { world, engine, user } = ctx
  const owner = user.role === 'owner'
  const all = world.lines({
    kinds: ['connection_read', 'connected', 'landed', 'remembered', 'plugin'],
    limit: LINES,
  })
  const nameOf = (l: Line) =>
    l.actor.kind === 'person'
      ? l.actor.id === user.id
        ? 'You'
        : (world.user(l.actor.id ?? '')?.name ?? 'Someone')
      : 'Alpha'
  const mine = (k: Connection) => owner || k.madeBy === `person:${user.id}`
  const sources = world.connections
    .list()
    .filter(mine)
    .map((k): ReadSourceView => {
      const reads = all.filter((l) => l.kind === 'connection_read' && l.data.connection === k.id)
      const tables = new Map<string, ReadTableView>()
      const at = (id: string, name: string) => {
        const t = tables.get(id) ?? {
          table: id === 'files' ? null : id,
          name,
          read: 0,
          kept: 0,
          added: 0,
          changed: 0,
          leftOut: 0,
          skipped: 0,
          rows: [],
        }
        tables.set(id, t)
        return t
      }
      const live = engine.connectors?.tallyOf(k.id) ?? null
      for (const tally of [...reads.map((l) => (l.data.tally ?? {}) as Tally), live ?? {}])
        for (const [id, c] of Object.entries(tally)) {
          const t = at(id, world.shape.table(id)?.name ?? c.name)
          t.read += c.read
          t.kept += c.read - c.leftOut - c.skipped
          t.leftOut += c.leftOut
          t.skipped += c.skipped
        }
      // what was made: the rows each of its landed lines names, newest first
      for (const l of all
        .filter(
          (x) =>
            x.kind === 'landed' && x.data.connector === k.connector && x.data.account === k.account,
        )
        .reverse()) {
        const id = String(l.data.table)
        const t = at(id, world.shape.table(id)?.name ?? 'A table')
        const ids = (l.data.ids ?? {}) as { added?: string[]; changed?: string[] }
        t.added += Number(l.data.added ?? 0)
        t.changed += Number(l.data.changed ?? 0)
        for (const r of [...(ids.added ?? []), ...(ids.changed ?? [])])
          if (t.rows.length < ROWS && !t.rows.includes(r)) t.rows.push(r)
      }
      const allowed = all.findLast((l) => l.kind === 'connected' && l.data.connection === k.id)
      return {
        connection: k.id,
        title: engine.connectors?.find(k.connector)?.manifest.title ?? k.connector,
        account: k.account,
        off: OFF[k.state] ?? (k.state === 'connected' ? null : k.health),
        allowed: allowed ? { by: nameOf(allowed), at: allowed.at } : null,
        reads: reads.length,
        lastReadAt: k.lastSyncAt,
        reading: !!live,
        failed: reads.filter((l) => l.data.state === 'failed').length,
        tables: [...tables.values()],
      }
    })
  const reading = sources.some((s) => s.reading)
  return { says: said(sources, reading), reading, sources, learned: learned(ctx, all) }
}

// Get to know you, per person: its newest read's sources on and off, and their decisions since.
function learned(ctx: BaseCtx, all: Line[]): LearnedView[] {
  const { world, user } = ctx
  const out: LearnedView[] = []
  for (const u of world.users()) {
    if (user.role !== 'owner' && u.id !== user.id) continue
    const ofThem = all.filter((l) => l.kind === 'plugin' && l.data.person === u.id)
    const read = ofThem.findLast((l) => Array.isArray(l.data.read))
    if (!read) continue
    const decided = ofThem.map((l) => (l.data.learned ?? {}) as Record<string, unknown>)
    out.push({
      person: u.id === user.id ? 'You' : u.name,
      at: read.at,
      read: read.data.read as string[],
      off: (read.data.off ?? []) as string[],
      kept: all.filter((l) => l.kind === 'remembered' && l.user === u.id && l.data.plugin).length,
      dropped: decided.reduce((s, d) => s + Number(d.dropped ?? 0), 0),
      yes: decided.filter((d) => d.answer === 'yes').length,
      no: decided.filter((d) => d.answer === 'no').length,
    })
  }
  return out
}
