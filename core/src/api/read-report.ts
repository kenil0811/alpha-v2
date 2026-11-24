// What Alpha read: per source, who allowed it and when, how many reads it had, what they met, kept,
// left out and passed over, from its running totals (world/read-totals.ts), a read under way adding
// its counts so far; the rows its reads made, newest first, from its landed lines; and what each
// person did with Get to know you's lines. A member sees only their own sources; the owner every one.
import type { Tally } from '../connectors/tally.ts'
import type { Connection } from '../world/connections.ts'
import { readsOf, totalsOf } from '../world/read-totals.ts'
import type { BaseCtx } from './ctx.ts'
import type { LearnedView, ReadReportView, ReadSourceView, ReadTableView } from './read-types.ts'

const LANDED = 2000 // the newest landed lines looked through for the rows a source made
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

// The sources this person may see: their own, or every one for the owner.
function sourcesOf(ctx: BaseCtx, rows: boolean): ReadSourceView[] {
  const { world, engine, user } = ctx
  const owner = user.role === 'owner'
  const nameOf = (madeBy: string) => {
    const [kind, id] = madeBy.split(/:(.*)/s)
    if (kind !== 'person') return 'Alpha'
    return id === user.id ? 'You' : (world.user(id ?? '')?.name ?? 'Someone')
  }
  const landed = rows ? world.lines({ kinds: ['landed'], limit: LANDED }) : []
  return world.connections
    .list()
    .filter((k) => owner || k.madeBy === `person:${user.id}`)
    .map((k): ReadSourceView => {
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
      const live: Tally = engine.connectors?.tallyOf(k.id) ?? {}
      const counts = [
        ...totalsOf(world.db, k.id),
        ...Object.entries(live).map(([tbl, c]) => ({ tbl, ...c })),
      ]
      for (const c of counts) {
        const t = at(c.tbl, world.shape.table(c.tbl)?.name ?? c.name)
        t.read += c.read
        t.kept += c.added + c.changed + c.same
        t.added += c.added
        t.changed += c.changed
        t.leftOut += c.leftOut
        t.skipped += c.skipped
      }
      // the rows its reads made, newest first, to open beside the page
      for (const l of [...landed].reverse()) {
        if (l.data.connector !== k.connector || l.data.account !== k.account) continue
        const t = tables.get(String(l.data.table))
        const ids = (l.data.ids ?? {}) as { added?: string[]; changed?: string[] }
        if (t)
          for (const r of [...(ids.added ?? []), ...(ids.changed ?? [])])
            if (t.rows.length < ROWS && !t.rows.includes(r)) t.rows.push(r)
      }
      const { reads, failed } = readsOf(world.db, k.id)
      return {
        connection: k.id,
        title: engine.connectors?.find(k.connector)?.manifest.title ?? k.connector,
        account: k.account,
        off: OFF[k.state] ?? (k.state === 'connected' ? null : k.health),
        allowed: { by: nameOf(k.madeBy), at: k.createdAt },
        reads,
        lastReadAt: k.lastSyncAt,
        reading: !!engine.connectors?.tallyOf(k.id),
        failed,
        tables: [...tables.values()],
      }
    })
}

// The live line alone, for the window as a read goes on.
export function readLine(ctx: BaseCtx): { says: string | null; reading: boolean } {
  const sources = sourcesOf(ctx, false)
  const reading = sources.some((s) => s.reading)
  return { says: said(sources, reading), reading }
}

export function readReport(ctx: BaseCtx): ReadReportView {
  const sources = sourcesOf(ctx, true)
  const reading = sources.some((s) => s.reading)
  return { says: said(sources, reading), reading, sources, learned: learned(ctx) }
}

// Get to know you, per person: its newest read's sources on and off, and their decisions since.
function learned(ctx: BaseCtx): LearnedView[] {
  const { world, user } = ctx
  const all = world.lines({ kinds: ['plugin', 'remembered'], limit: 5000 })
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
