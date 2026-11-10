// The one-row-per-person tables of the module People lives in, as People's grid and
// a person's page show them: their fields join People's own columns, and a value the person types
// there is written to that person's row, made if there isn't one yet. Nothing is copied: the
// columns are read from those tables each time.
import { Refused } from '../world/kinds.ts'
import type { RecordOut } from '../world/records/index.ts'
import type { Field, Table } from '../world/shape/index.ts'
import { peopleTables, perField } from '../world/shape/per.ts'
import type { User, World } from '../world/world.ts'
import { fieldViews } from './routes/rows.ts'
import type { FieldView } from './types.ts'

// What can be typed in a cell: as the window's own list, and never a summary.
const TYPED = new Set(['text', 'number', 'money', 'date', 'choice', 'email', 'link', 'phone'])
export const typed = (f: Field) => TYPED.has(f.kind) && !f.summary

export interface PerColumn {
  table: Table
  field: Field
  view: FieldView // named for People's grid: its table's name in front only where two would clash
}

const OWN = ['name', 'organization', 'email', 'phone', 'last', 'talks']

export function perColumns(world: World): PerColumn[] {
  const tables = peopleTables(world.shape)
  const shown = (t: Table) => t.fields.filter((f) => f.id !== perField(t)?.id && f.kind !== 'notes')
  const all = tables.flatMap((t) => shown(t).map((f) => f.name.toLowerCase()))
  const view = fieldViews(world.shape)
  return tables.flatMap((t) =>
    shown(t).map((f) => {
      const name = f.name.toLowerCase()
      const clash = OWN.includes(name) || all.filter((x) => x === name).length > 1
      return {
        table: t,
        field: f,
        view: {
          ...view(f),
          id: `${t.id}:${f.id}`,
          slug: `${t.slug}__${f.slug}`,
          name: clash ? `${t.name} · ${f.name}` : f.name,
        },
      }
    }),
  )
}

// Each table's rows by the person they name, as that person is now.
export function perRows(world: World, tables: Table[]): Map<string, Map<string, RecordOut>> {
  const out = new Map<string, Map<string, RecordOut>>()
  for (const t of tables) {
    const f = perField(t)
    const by = new Map<string, RecordOut>()
    if (f)
      for (const r of world.records.list(t.id)) {
        const who = r.values[f.slug]
        if (typeof who === 'string') by.set(world.people.root(who), r)
      }
    out.set(t.id, by)
  }
  return out
}

// A value the person typed for someone in a one-row-per-person table: on their row, or a new one.
export function setForPerson(
  world: World,
  user: User,
  table: Table,
  personId: string,
  field: Field,
  value: unknown,
): void {
  const per = perField(table)
  if (!per) throw new Refused(`${table.name} is not one row per person.`)
  if (!typed(field)) throw new Refused(`${field.name} is set by asking Alpha, not from here.`)
  const id = world.people.root(personId)
  const row = perRows(world, [table]).get(table.id)?.get(id)
  // one line, the change's own, in the person's words (rules A1)
  const words = `Set ${field.name} to ${String(value ?? 'nothing')} for ${world.people.names([id])[id] ?? 'them'} in ${table.name}`
  const ctx = { actor: { kind: 'person' as const, id: user.id }, user: user.id, byHand: { words } }
  const provenance = { kind: 'stated' as const }
  if (row)
    world.records.change(
      table.id,
      [{ id: row.id, values: { [field.name]: value }, provenance }],
      ctx,
    )
  else if (value !== null && value !== '')
    world.records.add(
      table.id,
      [{ values: { [per.name]: id, [field.name]: value }, provenance }],
      ctx,
    )
}
