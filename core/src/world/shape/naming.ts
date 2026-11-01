// Names (Batch B, picks 7 and 14a, Kenil's yes 1 Nov). A table is never named for a period: the
// builder's wall (core step 3e) sits in the core rename, so the person's double-click and Alpha's
// tool meet the same one. A module is renamed by its name alone: its id, its lasting key and its
// folder stay, so kits, connectors and links still find it.
import { config } from '../../config.ts'
import { one, run, tx } from '../db.ts'
import { append } from '../journal.ts'
import { Refused } from '../kinds.ts'
import { writeManifest } from './manifest.ts'
import type { Shape } from './shape.ts'
import type { Module, WriteCtx } from './types.ts'

// A table's name holding a period, as a whole word: one table for every period instead, with a
// date on each row.
export function notAPeriod(name: string) {
  const p = config.words().periods
  const words = new Set(name.toLowerCase().split(/[^a-z0-9]+/))
  const hit =
    p.words.find((w) => words.has(w.toLowerCase())) ??
    p.patterns.map((x) => name.match(new RegExp(x, 'i'))?.[0]).find(Boolean)
  if (!hit) return
  throw new Refused(
    `${name} names a period (${hit}): make one table for every period, with a date on each row, and read ${hit} with a filter, by month in a grouped view, or as a summary.`,
  )
}

// A table's new name: not one another table has, and not a period's.
export function tableNameFree(shape: Shape, tableId: string, to: string) {
  const other = one<{ name: string }>(
    shape.db,
    'SELECT name FROM tables WHERE lower(name) = lower(?) AND id != ?',
    to.trim(),
    tableId,
  )
  if (other) throw new Refused(`There is already a table called ${other.name}.`)
  notAPeriod(to.trim())
}

export function renameModule(shape: Shape, moduleId: string, to: string, ctx: WriteCtx): Module {
  const name = to.trim()
  if (!name) throw new Refused('A new name is needed.')
  return tx(shape.db, () => {
    const m = shape.module(moduleId)
    if (!m) throw new Refused('That module is not there.')
    if (name === m.name) return m
    // a name another module answers to, by its name or the folder its first name gave it
    const other = shape.module(name)
    if (other && other.id !== m.id)
      throw new Refused(
        other.name.toLowerCase() === name.toLowerCase()
          ? `There is already a module called ${other.name}.`
          : `${other.name} was first called ${name}: choose another name.`,
      )
    run(shape.db, 'UPDATE modules SET name = ? WHERE id = ?', name, m.id)
    append(shape.db, {
      actor: ctx.actor,
      kind: 'shaped',
      words: `Renamed the module ${m.name} to ${name}.`,
      data: { module: m.id, to: name },
      user: ctx.user ?? null,
      turn: ctx.turn ?? null,
      module: m.id,
      run: ctx.run ?? null,
    })
    const now = shape.module(m.id) as Module
    // its own folder says its name, and the folders of the modules inside it say where they sit
    writeManifest(shape, now)
    for (const kid of shape.modules().filter((x) => x.parent === m.id)) writeManifest(shape, kid)
    return now
  })
}
