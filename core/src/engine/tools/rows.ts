import { z } from 'zod'
import { importRows, readDocument } from '../../files/documents.ts'
import { Refused } from '../../world/kinds.ts'
import type { Table } from '../../world/shape/index.ts'
import { findField } from '../../world/shape/index.ts'
import { firstTouch } from '../context.ts'
import type { ToolEntry } from '../registry.ts'
import type { Tooling } from './common.ts'
import { cardsCited, guard, ok, Provenance, tableOf, tool } from './common.ts'

export function rowTools({ world, here, ctx }: Tooling): ToolEntry[] {
  // a table's fields and meanings, the first time this session touches it
  const briefed = (tables: Table[], result: ReturnType<typeof ok>) => {
    const brief = firstTouch(world, here, tables)
    if (brief) result.content.unshift({ type: 'text', text: brief })
    return result
  }
  return [
    tool(
      'query',
      'Read the world in SQL (SQLite). Each table is a view named as the table, with columns id, added and one per field; the journal is the view `journal` (id, at, actor, kind, words, module). Returns rows, their total and the offset; pass offset for the next page. The first read of a table this session comes with its fields and what each means.',
      { sql: z.string(), offset: z.number().int().optional() },
      async ({ sql, offset }) =>
        guard(() => {
          const { tables, ...result } = world.sql.query(sql, offset ?? 0)
          return briefed(
            tables.map((id) => world.shape.table(id)).filter((t): t is Table => !!t),
            ok(result),
          )
        }),
      { alwaysLoad: true },
    ),
    tool(
      'search',
      'Search the journal, the tables and the documents by words. Returns the best hits with where each was found.',
      { words: z.string() },
      async ({ words }) => guard(() => ok(world.search(words))),
      { alwaysLoad: true },
    ),
    tool(
      'write',
      'Add rows to a table. Values are keyed by field name. Every row carries the provenance of its values: kind is stated (the person said it, or answered it on a card: source.card), looked_up (with source: url, document and page, file with sheet and cell, or record), computed (source.inputs or source.formula), estimated or assumed (with basis, a few words on what it rests on). per_field gives a field its own provenance. Money is {"amount": 12.5, "currency": "USD"}; a date is like 2026-10-19.',
      {
        table: z.string(),
        rows: z.array(
          z.object({
            values: z.record(z.string(), z.unknown()),
            provenance: Provenance,
            per_field: z.record(z.string(), Provenance).optional(),
          }),
        ),
      },
      async ({ table, rows }) =>
        guard(() => {
          const t = tableOf(world, table)
          cardsCited(world, rows)
          const ids = world.records.add(
            t.id,
            rows.map((r) => ({
              values: r.values,
              provenance: r.provenance,
              ...(r.per_field ? { per_field: r.per_field } : {}),
            })) as never,
            ctx(),
          )
          return briefed(
            [t],
            ok(
              `Added ${ids.length} row${ids.length === 1 ? '' : 's'} to ${t.name}: ${ids.join(', ')}.`,
            ),
          )
        }),
      { alwaysLoad: true },
    ),
    tool(
      'change',
      'Change rows of a table (rows: id, values by field name, provenance as for write), or remove rows (remove: their ids). When removing the person’s own entries because they asked, asked_in quotes their words asking for it.',
      {
        table: z.string(),
        rows: z
          .array(
            z.object({
              id: z.string(),
              values: z.record(z.string(), z.unknown()),
              provenance: Provenance,
              per_field: z.record(z.string(), Provenance).optional(),
            }),
          )
          .optional(),
        remove: z.array(z.string()).optional(),
        asked_in: z.string().optional(),
      },
      async ({ table, rows, remove }) =>
        guard(() => {
          const t = tableOf(world, table)
          const said: string[] = []
          if (rows?.length) {
            cardsCited(world, rows)
            world.records.change(t.id, rows as never, ctx())
            said.push(`Changed ${rows.length} row${rows.length === 1 ? '' : 's'} in ${t.name}.`)
          }
          if (remove?.length) {
            const n = world.records.remove(t.id, remove, ctx())
            said.push(`Removed ${n} row${n === 1 ? '' : 's'} from ${t.name}.`)
          }
          if (!said.length) throw new Refused('Nothing to change: give rows or remove.')
          return briefed([t], ok(said.join(' ')))
        }),
      { alwaysLoad: true },
    ),
    tool(
      'file',
      'Files the person dropped in. read: a file’s contents with each piece’s place (sheet and cell, or line), from offset. import: a sheet’s rows into a table, with columns mapping each header to a field; every value keeps its cell as its source. place: put the file on the row it belongs to (a deal’s CIM on that deal), by table and row id, with kind one of the kinds that table’s rows take when it names them; the module’s readers then read it there. off: take it off that row; the file stays.',
      {
        action: z.enum(['read', 'import', 'place', 'off']),
        file: z.string(),
        offset: z.number().int().optional(),
        table: z.string().optional(),
        columns: z.record(z.string(), z.string()).optional(),
        sheet: z.string().optional(),
        row: z.string().optional(),
        kind: z.string().optional(),
      },
      async (a) =>
        guard(() => {
          const f = world.files.findFile(a.file)
          if (!f) throw new Refused(`There is no file called ${a.file}.`)
          if (a.action === 'read') return ok(readDocument(world, f.hash, a.offset ?? 0))
          if (a.action === 'place' || a.action === 'off') {
            if (!a.table || !a.row) throw new Refused(`${a.action} needs table and row.`)
            const t = tableOf(world, a.table)
            const rec = world.records.get(a.row)
            if (rec?.table.id !== t.id) throw new Refused(`${t.name} has no row ${a.row}.`)
            if (a.action === 'off') {
              world.unplaceFile(f.hash, a.row, ctx())
              return ok(`Took ${f.name} off that row.`)
            }
            const on = world.placeFile(f.hash, a.row, a.kind ?? null, ctx())
            return ok(
              `Filed ${f.name} on that row of ${t.name}${on.kind ? `, as a ${on.kind}` : ''}.`,
            )
          }
          if (!a.table || !a.columns) throw new Refused('import needs table and columns.')
          const t = tableOf(world, a.table)
          for (const field of Object.values(a.columns)) findField(t, field)
          return ok(importRows(world, f.hash, t, a.columns, a.sheet ?? null, ctx()))
        }),
      { alwaysLoad: true },
    ),
  ]
}
