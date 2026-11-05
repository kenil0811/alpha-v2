// Undo (design §4, core step 1, Kenil 26 Oct): what a run, a turn or one line did to rows, put
// back in one transaction, newest line first. Rows it added go to the trash, values it changed
// return from the version its line replaced (only where they are still what it wrote), rows it
// removed come back from the trash. One "reverted" line says what came back and what was left
// alone; its own writes carry its id, so a revert can be reverted. What else it did (a table
// made, a task, a question put to the person) stays, and the words say so. A preview runs the
// same work and rolls it back, so what the pop-up says is what Revert does.
import { type Db, now, one, parse, tx } from '../db.ts'
import { append, type Line, lines, read } from '../journal.ts'
import { type Provenance, Refused } from '../kinds.ts'
import { actorName, type Table, type WriteCtx } from '../shape/index.ts'
import type { Records } from './records.ts'
import { bringBack, inTrash, type Kept, putInTrash, tagVersions, takeOutAll } from './trash.ts'
import type { Snapshot } from './types.ts'

export type UndoTarget = { run: string } | { turn: string } | { line: number }

export interface Undo {
  can: boolean // something changes
  words: string // what it does: "In Deals, 2 rows go and 5 values return."
  left: string[] // what it leaves alone, a sentence each
  // what it did outside Alpha that Revert takes back (step 2, part 2): each the line that said
  // the call was done, and the take-back's words; whoever reverts runs them through the connector
  takeBacks: { line: number; words: string }[]
}

const ROW_KINDS = ['wrote', 'changed', 'landed', 'removed', 'reverted']

// What else a run or a turn may have done, in the words that say it stays.
const ELSE: Record<string, string> = {
  made: 'tables and fields',
  shaped: 'tables and fields',
  removed: 'tables and fields',
  task: 'tasks',
  card_opened: 'questions put to you',
  filed: 'files',
  noted: 'notes',
  folded: 'people merged',
}

// What a run or a turn did outside Alpha (step 2, part 2): the lines that say a connector's
// write or send was done, each with what it is once done.
interface Done {
  kind: 'final' | 'undoable' | 'counter'
  did: string
  words: string | null
}
function actionLines(records: Records, target: UndoTarget): Line[] {
  if ('line' in target) return []
  return lines(records.db, { ...forTarget(target), kinds: ['called'] }).filter(
    (l) => l.data.ok === true && !!l.data.undo,
  )
}
const doneOf = (l: Line) => l.data.undo as Done

// A line that wrote rows: a removal of a table or a field is a shape change, not one.
const isRowLine = (l: Line) =>
  ROW_KINDS.includes(l.kind) &&
  !l.data.unfold &&
  ((l.kind !== 'removed' && l.kind !== 'wrote') || Array.isArray(l.data.records))

const forTarget = (t: UndoTarget) =>
  'run' in t ? { run: t.run } : { turn: (t as { turn: string }).turn }

function rowLines(records: Records, target: UndoTarget): Line[] {
  if ('line' in target) {
    const l = read(records.db, target.line)
    return l && isRowLine(l) ? [l] : []
  }
  return lines(records.db, { ...forTarget(target), kinds: ROW_KINDS }).filter(isRowLine)
}

// The last journal line from before undo existed: nothing up to it can be reverted.
const undoSince = (db: Db) =>
  Number(one<{ value: string }>(db, "SELECT value FROM meta WHERE key = 'undo_since'")?.value ?? 0)

// Whether Activity offers Revert (or Bring back) on it: it wrote rows, all since undo exists.
export function undoable(records: Records, target: UndoTarget): boolean {
  const ls = rowLines(records, target)
  const since = undoSince(records.db)
  const back = actionLines(records, target).some((l) => doneOf(l).kind !== 'final')
  return (ls.length > 0 || back) && ls.every((l) => l.id > since)
}

// The same value or provenance, whatever order its keys were written in.
function stable(v: unknown): string {
  return JSON.stringify(v ?? null, (_k, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  )
}
const eq = (a: unknown, b: unknown) => stable(a) === stable(b)
const n = (k: number, word: string) => `${k} ${word}${k === 1 ? '' : 's'}`
const and = (xs: string[]) =>
  xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`
const ids = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map((x) => (typeof x === 'string' ? x : String((x as { id: string }).id)))
    : []

export function revert(
  records: Records,
  target: UndoTarget,
  ctx: WriteCtx,
  what: string, // "what Watson did at 07:43", for the line's words
  // unfold: an unmerge reverting its merge's fold (core step 3d), which nothing else reverts
  options: { preview?: boolean; unfold?: boolean } = {},
): Undo {
  const db = records.db
  const work = (): Undo => {
    const one_ = 'line' in target && options.unfold ? read(db, target.line) : undefined
    const ls = one_?.kind === 'folded' ? [one_] : rowLines(records, target)
    // what it did outside Alpha: taken back where it can be, named where it cannot
    const actions = options.unfold ? [] : actionLines(records, target)
    const takeBacks = actions
      .filter((l) => doneOf(l).kind !== 'final')
      .map((l) => ({ line: l.id, words: doneOf(l).words ?? 'Takes it back' }))
    const finals = actions.filter((l) => doneOf(l).kind === 'final').map((l) => doneOf(l).did)
    if (!ls.length && !takeBacks.length)
      throw new Refused(
        finals.length
          ? `That changed no rows, and what it did outside Alpha cannot be called back: ${and(finals.map((f) => `“${f}”`))}.`
          : 'That changed no rows, so there is nothing to revert.',
      )
    if (ls.some((l) => l.id <= undoSince(db)))
      throw new Refused('That happened before Alpha could undo, so it can’t be reverted.')
    const inSet = ls.map((l) => l.id).join(', ')
    const at = now()
    const by = actorName(ctx.actor)
    const tableOf = new Map<string, Table>()
    // each with the line it goes back under, when it is the trash it came from
    const trash: { table: Table; id: string; kept: Kept; to?: { id: number; at: string } }[] = []
    const versions: [string, number, Snapshot][] = []
    const back: string[] = []
    const backFrom = new Map<string, { id: number; at: string }>() // the line it was removed by
    const changed = new Set<string>()
    const values = new Map<string, number>() // by table id
    const left = new Map<string, number>()
    const leave = (key: string) => left.set(key, (left.get(key) ?? 0) + 1)
    const nameOf = (l: Line) =>
      records.shape.table(String(l.data.table ?? ''))?.name ?? 'a table deleted since'

    // A row added since that someone outside this revert changed stays.
    const changedSince = (id: string, lineId: number) =>
      !!one(
        db,
        `SELECT 1 FROM versions WHERE record_id = ? AND line_id > ? AND line_id NOT IN (${inSet})`,
        id,
        lineId,
      )

    // `from`: a revert's rows it brought back, by the removal they came from
    const goAway = (rowIds: string[], l: Line, from: Record<string, number> = {}) => {
      for (const id of rowIds) {
        const table = records.tableOf(id)
        if (!table) continue // gone already
        // a mirror's rows come and go only with its source (rules D8)
        if (table.mirror) {
          leave(`mirror\t${table.name}\t${table.mirror}`)
          continue
        }
        if (changedSince(id, l.id)) {
          leave(`added\t${table.name}`)
          continue
        }
        // with the rows that are part of it (core step 3a), into the trash on the same line
        const out = takeOutAll(records, table, [id], ctx)
        const removal = from[id] !== undefined ? read(db, from[id]) : undefined
        for (const k of out.kept) {
          trash.push({
            table: k.table,
            id: k.id,
            kept: k.kept,
            ...(removal ? { to: { id: removal.id, at: removal.at } } : {}),
          })
          tableOf.set(k.id, k.table)
        }
      }
    }

    const putBack = (rowIds: string[], l: Line) => {
      for (const id of rowIds) {
        const v = one<{ vals: string; provenance: string; wrote: string | null }>(
          db,
          'SELECT vals, provenance, wrote FROM versions WHERE record_id = ? AND line_id = ?',
          id,
          l.id,
        )
        if (!v?.wrote) continue
        const table = records.tableOf(id)
        const row = table ? records.readRow(table, id) : undefined
        if (!table || !row) {
          leave(`removed\t${nameOf(l)}`)
          continue
        }
        const current = records.snapshot(table, row)
        // only the values that line wrote, and only where they are still what it wrote
        const wrote = parse<Snapshot>(v.wrote, { vals: {}, prov: {} })
        const before: Snapshot = { vals: parse(v.vals, {}), prov: parse(v.provenance, {}) }
        const vals: Record<string, unknown> = {}
        const prov: Record<string, Provenance> = {}
        for (const f of table.fields) {
          if (!(f.id in wrote.vals) || eq(before.vals[f.id], wrote.vals[f.id])) continue
          if (
            !eq(current.vals[f.id], wrote.vals[f.id]) ||
            !eq(current.prov[f.id], wrote.prov[f.id])
          ) {
            leave(`changed\t${table.name}\t${f.name}`)
            continue
          }
          let value = before.vals[f.id] ?? null
          // a link goes back only to a row that is there
          if (f.kind === 'relation' && Array.isArray(value))
            value = value.filter((other) => records.tableOf(String(other)))
          else if (f.kind === 'relation' && value !== null && !records.tableOf(String(value)))
            value = null
          vals[f.id] = value
          const p = before.prov[f.id]
          if (p && value !== null) prov[f.id] = p
        }
        if (!Object.keys(vals).length) continue
        records.keepVersion(row, current, at, by)
        versions.push([id, row.version, { vals, prov }])
        records.update(table, id, vals, prov, at)
        records.index(table, id, { ...current.vals, ...vals })
        changed.add(id)
        tableOf.set(id, table)
        values.set(table.id, (values.get(table.id) ?? 0) + Object.keys(vals).length)
      }
    }

    const comeBack = (rowIds: string[], l: Line) => {
      const waiting = inTrash(records, l.id)
      const there = new Set(waiting.map((w) => w.id))
      for (const id of rowIds)
        if (!there.has(id) && !records.tableOf(id))
          leave(`${l.kind === 'folded' ? 'unfolded' : 'forgood'}\t${nameOf(l)}`)
      const { back: came, leftOut } = bringBack(
        records,
        waiting.map((w) => w.id),
      )
      for (const [tableId, xs] of came)
        for (const id of xs) {
          back.push(id)
          backFrom.set(id, { id: l.id, at: waiting.find((w) => w.id === id)?.at ?? at })
          tableOf.set(id, records.shape.table(tableId) as Table)
        }
      for (const name of leftOut) leave(`field\t${name}`)
    }

    for (const l of [...ls].reverse()) {
      const d = l.data
      if (l.kind === 'folded') {
        // the folded rows first, so the links moved off them can go back to them; a folded row
        // gone for good leaves what it held, and what pointed at it, on the row it went into
        comeBack(ids(d.gone), l)
        const lost = new Set(
          ((d.folds ?? []) as { keep: string; other: string; links: string[] }[])
            .filter((f) => !records.tableOf(f.other))
            .flatMap((f) => [f.keep, ...f.links]),
        )
        putBack(
          ids(d.changed).filter((id) => !lost.has(id)),
          l,
        )
      } else if (l.kind === 'wrote') goAway(ids(d.records), l)
      else if (l.kind === 'changed') putBack(ids(d.records), l)
      else if (l.kind === 'removed') comeBack(ids(d.records), l)
      else if (l.kind === 'landed') {
        const x = (d.ids ?? {}) as { added?: string[]; changed?: string[] }
        putBack(x.changed ?? [], l)
        goAway(x.added ?? [], l)
      } else {
        // a revert reverted: its values return, the rows it brought back go back where they
        // were, and its removals come back
        putBack(ids(d.changed), l)
        goAway(ids(d.back), l, (d.from ?? {}) as Record<string, number>)
        comeBack(ids(d.gone), l)
      }
    }

    // a row brought back and taken out again here is where it was: in the trash under its own
    // removal, and in neither count
    const gone = trash.filter((t) => !backFrom.has(t.id))
    const returned = back.filter((id) => !trash.some((t) => t.id === id))
    const per = new Map<string, { name: string; gone: number; values: number; back: number }>()
    const tally = (id: string, k: 'gone' | 'back') => {
      const t = tableOf.get(id) as Table
      const p = per.get(t.id) ?? { name: t.name, gone: 0, values: 0, back: 0 }
      p[k]++
      per.set(t.id, p)
    }
    for (const t of gone) tally(t.id, 'gone')
    for (const id of returned) tally(id, 'back')
    for (const [tableId, k] of values) {
      const t = records.shape.table(tableId) as Table
      const p = per.get(tableId) ?? { name: t.name, gone: 0, values: 0, back: 0 }
      p.values = k
      per.set(tableId, p)
    }

    const leftWords = [...left].map(([key, c]) => {
      const [kind, table, field] = key.split('\t')
      if (kind === 'changed')
        return `${field} on ${n(c, 'row')} of ${table} changed since; ${c === 1 ? 'it stays as it is' : 'those stay as they are'}.`
      if (kind === 'added')
        return `${n(c, 'row')} of ${table} it added ${c === 1 ? 'was' : 'were'} changed since; ${c === 1 ? 'it stays' : 'they stay'}.`
      if (kind === 'removed')
        return `${n(c, 'row')} of ${table} it changed ${c === 1 ? 'was' : 'were'} deleted since.`
      if (kind === 'mirror')
        return `${n(c, 'row')} of ${table} ${c === 1 ? 'stays' : 'stay'}: its rows come and go with ${field}.`
      if (kind === 'forgood')
        return `${n(c, 'row')} of ${table} it deleted ${c === 1 ? 'is' : 'are'} gone for good.`
      if (kind === 'unfolded')
        return `${n(c, 'row')} of ${table} folded in ${c === 1 ? 'is' : 'are'} gone for good; what ${c === 1 ? 'it' : 'they'} held stays on the row ${c === 1 ? 'it was' : 'they were'} folded into.`
      return `${table} was deleted since, so it is left out.`
    })
    if (!('line' in target)) {
      const others = new Set(
        lines(db, forTarget(target))
          .filter((l) => !isRowLine(l) && ELSE[l.kind])
          .map((l) => ELSE[l.kind] as string),
      )
      if (others.size) leftWords.push(`What else it did stays as it is: ${and([...others])}.`)
      for (const f of finals)
        leftWords.push(`“${f}” was done outside Alpha and cannot be called back.`)
    }

    const say = (past: boolean) =>
      [...per.values()]
        .map((p) => {
          const bits = [
            p.gone ? `${n(p.gone, 'row')} ${past ? 'went' : p.gone === 1 ? 'goes' : 'go'}` : '',
            p.values
              ? `${n(p.values, 'value')} ${past ? 'returned' : p.values === 1 ? 'returns' : 'return'}`
              : '',
            p.back
              ? `${n(p.back, 'row')} ${past ? 'came back' : p.back === 1 ? 'comes back' : 'come back'}`
              : '',
          ].filter(Boolean)
          return `in ${p.name}, ${and(bits)}`
        })
        .join('; ')
    const can = per.size > 0 || takeBacks.length > 0
    const doing = [per.size ? say(false) : '', ...takeBacks.map((t) => t.words)]
      .filter(Boolean)
      .join('; ')
    const words = can ? `${doing.replace(/^i/, 'I')}.` : 'Nothing is left to put back.'
    if (options.preview) return { can, words, left: leftWords, takeBacks }
    if (!can) throw new Refused(`Nothing is left to put back. ${leftWords.join(' ')}`.trim())

    const bringing = 'line' in target && ls[0]?.kind === 'removed'
    const tables = [...per.keys()]
    const modules = new Set(tables.map((t) => records.shape.table(t)?.module.id))
    const line = append(db, {
      actor: ctx.actor,
      kind: 'reverted',
      words: `${
        bringing
          ? `Brought back ${n(returned.length, 'row')} to ${and([...per.values()].map((p) => p.name))}.`
          : `Reverted ${what}: ${[per.size ? say(true) : '', ...takeBacks.map((t) => t.words)].filter(Boolean).join('; ')}.`
      }${leftWords.length ? ` ${leftWords.join(' ')}` : ''}`,
      data: {
        target,
        ...(options.unfold ? { unfold: true } : {}),
        ...(tables.length === 1 ? { table: tables[0] } : {}),
        tables,
        gone: gone.map((t) => t.id),
        changed: [...changed],
        back: returned,
        from: Object.fromEntries(returned.map((id) => [id, backFrom.get(id)?.id])),
        takeBacks: takeBacks.map((t) => t.line),
      },
      user: ctx.user ?? null,
      turn: ctx.turn ?? null,
      run: ctx.run ?? null,
      module: modules.size === 1 ? ([...modules][0] ?? null) : null,
    })
    for (const t of trash)
      putInTrash(records, t.table, t.id, t.kept, t.to ?? backFrom.get(t.id) ?? line)
    tagVersions(records, versions, line.id)
    // the people they name, and the agents that wake on rows, hear of what changed and came back
    const heard = new Map<string, string[]>()
    for (const id of [...changed, ...returned].filter((id) => records.tableOf(id))) {
      const t = tableOf.get(id) as Table
      heard.set(t.id, [...(heard.get(t.id) ?? []), id])
    }
    for (const [tableId, xs] of heard)
      records.watch?.rows(records.shape.table(tableId) as Table, xs, ctx)
    return { can, words, left: leftWords, takeBacks }
  }
  if (!options.preview) return tx(db, work)
  // the same work, rolled back
  db.exec('SAVEPOINT undo_preview')
  try {
    return work()
  } finally {
    db.exec('ROLLBACK TO undo_preview')
    db.exec('RELEASE undo_preview')
  }
}
