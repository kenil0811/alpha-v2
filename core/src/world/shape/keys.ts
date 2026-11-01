// A kit's or connector's own tables and module (Batch B, call 6, Kenil's yes 1 Nov): found by the
// lasting key they were made with, so a name the person changes splits nothing; else by name, one
// with no key (the person's or Alpha's, taken as before keys). A lookup never writes: a kit or
// connector that takes one found by name keys it with a claim.
import { one, run } from '../db.ts'
import type { Shape } from './shape.ts'
import type { Module, Table } from './types.ts'

export function ownModule(shape: Shape, key: string): Module | undefined {
  const m =
    one<{ id: string }>(shape.db, 'SELECT id FROM modules WHERE key = ?', key) ??
    one<{ id: string }>(
      shape.db,
      'SELECT id FROM modules WHERE key IS NULL AND lower(name) = lower(?)',
      key.trim(),
    )
  return m ? shape.module(m.id) : undefined
}

// Within its module by key; by name anywhere, as a table's name is unique.
export function ownTable(shape: Shape, moduleId: string, key: string): Table | undefined {
  const t =
    one<{ id: string }>(
      shape.db,
      'SELECT id FROM tables WHERE module_id = ? AND key = ?',
      moduleId,
      key,
    ) ??
    one<{ id: string }>(
      shape.db,
      'SELECT id FROM tables WHERE key IS NULL AND lower(name) = lower(?)',
      key.trim(),
    )
  return t ? shape.table(t.id) : undefined
}

// A table or module a kit or connector took by its name, keyed from then on; one that has a key
// keeps it, and a table in another module stays found by its name only.
export function claimTable(shape: Shape, table: Table, moduleId: string, key: string): void {
  if (table.module.id === moduleId)
    run(shape.db, 'UPDATE tables SET key = ? WHERE id = ? AND key IS NULL', key, table.id)
}

export function claimModule(shape: Shape, id: string, key: string): void {
  run(shape.db, 'UPDATE modules SET key = ? WHERE id = ? AND key IS NULL', key, id)
}
