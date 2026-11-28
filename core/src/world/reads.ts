// What a module reads of other modules, and who reads a table (the definitions, 27 Nov, call 9).
// A module names what it reads in its module.yaml's uses: a kit's by the other kit's name, one
// made here by the other module's name, each with the tables it reads; its scripts may read only
// those besides its own (runs/walls.ts). A change that deletes or renames a table, or a field of
// one, that another module reads goes on a card first, by any door: CRM never breaks silently.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'
import { one } from './db.ts'
import { Refused } from './kinds.ts'
import type { Module, Redo, Table, WriteCtx } from './shape/index.ts'
import type { World } from './world.ts'

export const READ_BY_SHAPE = 'read_by_shape'

interface Use {
  kit?: string
  module?: string
  connector?: string
  tables?: string[]
}

function usesIn(m: Module): Use[] {
  const file = join(m.dir, 'module.yaml')
  if (!existsSync(file)) return []
  try {
    const y = parse(readFileSync(file, 'utf8')) as { uses?: unknown }
    return Array.isArray(y?.uses) ? (y.uses as Use[]) : []
  } catch {
    return []
  }
}

// The module a use points at: a kit by its kit's name, or one made here by its own name.
function usedModule(world: World, u: Use): Module | null {
  if (u.kit) {
    const k = one<{ module_id: string }>(
      world.db,
      'SELECT module_id FROM kits WHERE kit = ?',
      u.kit,
    )
    return k ? (world.shape.module(k.module_id) ?? null) : null
  }
  return u.module ? (world.shape.module(u.module) ?? null) : null
}

export interface Read {
  module: Module | null // none: not on this Alpha
  name: string // as module.yaml names it
  tables: string[]
}

// The other modules a module reads, each with its tables.
export function readsOf(world: World, m: Module): Read[] {
  return usesIn(m).flatMap((u) =>
    u.kit || u.module
      ? [
          {
            module: usedModule(world, u),
            name: (u.kit ?? u.module) as string,
            tables: u.tables ?? [],
          },
        ]
      : [],
  )
}

// The modules that read a module, each with the tables of it they read.
export function readersOf(world: World, m: Module): { module: Module; tables: string[] }[] {
  return world.shape.modules().flatMap((other) => {
    if (other.id === m.id) return []
    const tables = readsOf(world, other)
      .filter((r) => r.module?.id === m.id)
      .flatMap((r) => r.tables)
    return tables.length ? [{ module: other, tables }] : []
  })
}

// Who reads this table, by its name or the lasting key a kit's code names it by.
function readersOfTable(world: World, t: Table): Module[] {
  const names = new Set([t.name.toLowerCase(), ...(t.key ? [t.key.toLowerCase()] : [])])
  return readersOf(world, t.module)
    .filter((r) => r.tables.some((x) => names.has(x.toLowerCase())))
    .map((r) => r.module)
}

// A module made here names what it reads of another: its tables, or none to stop. What it said.
export function setReads(
  world: World,
  m: Module,
  from: Module,
  tables: string[],
  ctx: WriteCtx,
): string {
  if (from.id === m.id) throw new Refused(`${m.name} reads its own tables already.`)
  const own = new Set(world.shape.tables(from.id).map((t) => t.name.toLowerCase()))
  const missing = tables.filter((t) => !own.has(t.toLowerCase()))
  if (missing.length) throw new Refused(`${from.name} has no table called ${missing.join(' or ')}.`)
  const file = join(m.dir, 'module.yaml')
  const y = (existsSync(file) ? (parse(readFileSync(file, 'utf8')) ?? {}) : {}) as Record<
    string,
    unknown
  >
  const kept = (Array.isArray(y.uses) ? (y.uses as Use[]) : []).filter(
    (u) => usedModule(world, u)?.id !== from.id,
  )
  const kit = one<{ kit: string }>(world.db, 'SELECT kit FROM kits WHERE module_id = ?', from.id)
  const use: Use = kit ? { kit: kit.kit, tables } : { module: from.name, tables }
  const uses = tables.length ? [...kept, use] : kept
  writeFileSync(file, stringify({ ...y, uses }))
  const words = tables.length
    ? `${m.name} reads ${tables.join(', ')} of ${from.name}.`
    : `${m.name} no longer reads ${from.name}.`
  world.line({
    actor: ctx.actor,
    kind: 'shaped',
    words,
    data: { module: m.id, reads: from.id, tables },
    user: ctx.user ?? null,
    turn: ctx.turn ?? null,
    module: m.id,
  })
  return words
}

// The table a change would break for its readers: a rename of a table or a field, a field or a
// table removed.
function brokenTable(world: World, redo: Redo): Table | undefined {
  switch (redo.method) {
    case 'rename':
      return world.shape.table(redo.args[0].table)
    case 'removeField':
      return world.shape.table(redo.args[0])
    case 'removeTable':
      return world.shape.table(redo.args[0])
    default:
      return undefined
  }
}

// Asked before a change, by any door: one that would break a module reading this one is on a card
// for the person, Do it now anyway or Leave it, and refused in the card's words until then.
export function askReaders(world: World, redo: Redo, ctx: WriteCtx): void {
  if (ctx.actor.kind === 'system' || ctx.anyway) return
  const t = brokenTable(world, redo)
  if (!t) return
  const readers = readersOfTable(world, t)
  if (!readers.length) return
  const who = readers.map((r) => r.name).join(' and ')
  const card = world.cards.open({
    kind: 'suggestion',
    words: `${who} ${readers.length === 1 ? 'reads' : 'read'} ${t.name}: to ${redo.words} may stop ${readers.length === 1 ? 'its' : 'their'} scripts working until ${readers.length === 1 ? 'it is' : 'they are'} changed too.`,
    restsOn: readers.map((r) => `${r.name} names ${t.name} among what it reads`),
    options: ['Do it now anyway', 'Leave it'],
    call: { tool: READ_BY_SHAPE, input: redo as unknown as Record<string, unknown> },
    actor: ctx.actor,
    user: ctx.user ?? null,
    turn: ctx.turn ?? null,
    module: t.module.id,
  })
  throw new Refused(
    `${who} ${readers.length === 1 ? 'reads' : 'read'} ${t.name}, so this change is on a card for the person: do it now anyway, or leave it (card ${card.id}). Nothing changed yet.`,
  )
}
