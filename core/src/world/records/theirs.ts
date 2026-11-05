// The person's value beats every machine (docs/rules.md, D2). A value they typed, answered on a
// card or stated on their words changes only by their hand: in the window, or from Alpha in a turn
// where they spoke, stated on their message (Kenil's calls, 5 Nov). Alpha on its own, a subagent,
// an agent's script and a kit are refused, in words that say whose it is; a reader's and a
// connection's landing leave it before this (records.land).
import { isPersonsOwn, type Provenance, Refused } from '../kinds.ts'
import type { Table } from '../shape/index.ts'
import type { RecordCtx } from './types.ts'

export function mustBeTheirs(
  table: Table,
  row: string,
  was: Record<string, Provenance>,
  vals: Record<string, unknown>,
  prov: Record<string, Provenance>,
  ctx: RecordCtx,
): void {
  if (ctx.actor.kind === 'person') return
  for (const id of Object.keys(vals)) {
    const p = was[id]
    if (p?.kind !== 'stated' || !isPersonsOwn(p)) continue
    if (ctx.said && (vals[id] === null || prov[id]?.kind === 'stated')) continue
    const name = table.fields.find((f) => f.id === id)?.name ?? 'A value'
    throw new Refused(
      `${name} on ${row} in ${table.name} is the person's own value, so it changes only when they ask for it in their message, stated on their words. It is left as it is: tell them what you would change it to, and why.`,
    )
  }
}
