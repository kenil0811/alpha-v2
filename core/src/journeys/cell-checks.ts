// A journey's checks on one row's value: what it holds, by the row's own key or its name as the
// window shows it, and what is kept beside the person's value on it (rules D3, D6).
import { z } from 'zod'
import type { World } from '../world/world.ts'

const Field = z.object({
  table: z.string(),
  key: z.string().optional(), // the row's own key, as a connection or a reader landed it
  row: z.string().optional(), // or its name, as the window shows it
  field: z.string(),
  equals: z.string().optional(),
  count: z.number().optional(), // a relation's rows
})
// what is kept beside the person's value on a row (D3, D6): a machine's newer
// value, or the source's, by the row's own key; any at all when no value is named
const Beside = z.object({
  table: z.string(),
  key: z.string().optional(),
  row: z.string().optional(),
  field: z.string(),
  equals: z.string().optional(),
})

export const CellChecks = [z.object({ field: Field }), z.object({ beside: Beside })] as const

// A row's value and where it came from, by the row's own key or its name as the window shows it.
function cellOf(
  world: World,
  c: { table: string; key?: string | undefined; row?: string | undefined; field: string },
) {
  const t = world.shape.table(c.table)
  if (!t) return undefined
  const rows = world.records.list(t.id)
  const id = c.key ? world.records.byKey(t.id, c.key) : undefined
  const r = rows.find((x) => (id ? x.id === id : world.rowName(t, x.values) === c.row))
  const slug = t.fields.find((x) => x.name === c.field)?.slug ?? ''
  return r ? { value: r.values[slug], provenance: r.provenance[slug] } : undefined
}

type Saw = { check: string; ok: boolean; saw: string }

export function cellCheck(check: object, world: World): Saw | null {
  if ('field' in check) {
    const f = check.field as z.infer<typeof Field>
    const value = cellOf(world, f)?.value
    const ok =
      f.equals !== undefined
        ? value === f.equals
        : f.count !== undefined
          ? Array.isArray(value) && value.length === f.count
          : value !== undefined
    return {
      check: `${f.field} of ${f.row ?? f.key} in ${f.table} ${f.equals !== undefined ? `is ${f.equals}` : `has ${f.count}`}`,
      ok,
      saw: JSON.stringify(value ?? null),
    }
  }
  if ('beside' in check) {
    const b = check.beside as z.infer<typeof Beside>
    const kept = cellOf(world, b)?.provenance?.beside
    return {
      check: `beside ${b.field} of ${b.row ?? b.key} in ${b.table}: ${b.equals ?? 'a value'}`,
      ok: b.equals !== undefined ? kept?.value === b.equals : kept !== undefined,
      saw: JSON.stringify(kept?.value ?? null),
    }
  }
  return null
}
