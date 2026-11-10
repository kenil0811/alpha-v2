// Deleting a module (Kenil, 10 Nov), on an owner's word, in one of two ways. Keeping its data
// deletes what runs or draws in it and the modules inside it (their schedules, scripts, skills and
// pages) and leaves their tables and rows. All of it deletes the modules too: their tables and
// rows, their folders, schedules and runs, and what Alpha kept about them. Either way, cards
// waiting on them are withdrawn, tasks and documents about them stay without a place, and the
// journal keeps every line, with one more saying what went.
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { all, run, tx } from '../world/db.ts'
import { Refused } from '../world/kinds.ts'
import type { WriteCtx } from '../world/shape/index.ts'
import type { World } from '../world/world.ts'
import { commitAll } from './git.ts'
import { schedules } from './schedules.ts'

// What runs or draws in a module: deleted when its data is kept.
const MACHINERY = ['schedules', 'skills', 'pages']

export async function deleteModule(
  world: World,
  id: string,
  keepData: boolean,
  ctx: WriteCtx,
  discard: (dir: string) => void = (dir) => rmSync(dir, { recursive: true, force: true }),
): Promise<string> {
  const top = world.shape.module(id)
  if (!top) throw new Refused('That module is not there.')
  const ids = world.shape.within(top.id)
  const mods = ids.flatMap((m) => world.shape.module(m) ?? [])
  // a removal the person asked for outright: no card in between (rules M4's "do it now")
  const now: WriteCtx = { ...ctx, anyway: true }
  let tablesGone = 0
  let rowsGone = 0
  tx(world.db, () => {
    for (const m of mods) {
      for (const a of schedules(world, m.id)) {
        run(world.db, 'UPDATE runs SET schedule_id = NULL WHERE schedule_id = ?', a.id)
        run(world.db, 'DELETE FROM schedules WHERE id = ?', a.id)
      }
      for (const c of all<{ id: string }>(
        world.db,
        "SELECT id FROM cards WHERE module_id = ? AND state = 'waiting'",
        m.id,
      ))
        world.cards.withdraw(c.id, ctx.actor, `${top.name} was deleted.`)
      const files = keepData ? MACHINERY.map((d) => `${d}/%`) : ['%']
      for (const f of files)
        run(world.db, 'DELETE FROM module_files WHERE module_id = ? AND path LIKE ?', m.id, f)
    }
    if (keepData) return
    // the tables, a part before the table it is part of
    let left = ids.flatMap((m) => world.shape.tables(m))
    while (left.length) {
      const free = left.filter(
        (t) =>
          !world.shape
            .partsOf(t.id)
            .some((p) => p.table.id !== t.id && left.some((l) => l.id === p.table.id)),
      )
      if (!free.length) throw new Refused(`${top.name}'s tables could not be taken apart.`)
      for (const t of free) {
        rowsGone += world.records.list(t.id).length
        world.shape.removeTable(t.id, now)
        tablesGone++
      }
      left = left.filter((t) => !free.includes(t))
    }
    for (const m of [...ids].reverse()) {
      run(world.db, 'DELETE FROM runs WHERE module_id = ?', m)
      for (const side of ['tombstones', 'kits', 'kit_changes', 'module_files'])
        run(world.db, `DELETE FROM ${side} WHERE module_id = ?`, m)
      run(world.db, 'DELETE FROM rules WHERE module_id = ?', m)
      run(
        world.db,
        'UPDATE tasks SET module_id = NULL, table_id = NULL, record_id = NULL WHERE module_id = ?',
        m,
      )
      run(world.db, 'UPDATE documents SET module_id = NULL WHERE module_id = ?', m)
      run(world.db, 'DELETE FROM modules WHERE id = ?', m)
    }
  })
  // the folders, once the world no longer names them
  for (const m of mods) {
    if (keepData) {
      for (const d of MACHINERY) rmSync(join(m.dir, d), { recursive: true, force: true })
      if (existsSync(join(m.dir, '.git')))
        await commitAll(m.dir, 'Deleted its schedules, scripts and pages').catch(() => null)
    } else if (existsSync(m.dir)) discard(m.dir)
  }
  const inside = mods.length - 1
  const words = keepData
    ? `Deleted what runs in ${top.name}${inside ? ` and the ${inside} module${inside === 1 ? '' : 's'} inside it` : ''}: its schedules, scripts and pages. Its tables and rows are kept.`
    : `Deleted the module ${top.name}${inside ? ` and the ${inside} module${inside === 1 ? '' : 's'} inside it` : ''}, with ${tablesGone} table${tablesGone === 1 ? '' : 's'} and ${rowsGone} row${rowsGone === 1 ? '' : 's'}.`
  world.line({
    actor: ctx.actor,
    kind: 'removed',
    words,
    data: {
      module: top.id,
      name: top.name,
      modules: ids,
      keptData: keepData,
      tables: tablesGone,
      rows: rowsGone,
    },
    user: ctx.user ?? null,
    turn: ctx.turn ?? null,
    module: keepData ? top.id : null,
  })
  return words
}
