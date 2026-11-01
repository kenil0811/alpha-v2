// Where a connector's items land (design §4): its module and tables, made when it is first
// connected, any field a newer version adds, and how their rows name people. Each is found by the
// lasting key it was made with (Batch B, call 6), so one the person renamed keeps taking the rows;
// a module or table found by its name is keyed from then on.
import type { Connector } from '@alpha/connector-sdk'
import type { Table } from '../world/shape/index.ts'
import type { World } from '../world/world.ts'

export function landIn(world: World, c: Connector): Table[] {
  const actor = { kind: 'connector' as const, id: c.manifest.name }
  if (!c.tables.length) return []
  const known = world.shape.ownModule(c.module)
  if (known) world.shape.claimModule(known.id, c.module)
  const module = known ?? world.shape.makeModule(c.module, { actor }, c.module)
  return c.tables.map((spec) => {
    const found = world.shape.ownTable(module.id, spec.name)
    if (found) world.shape.claimTable(found, module.id, spec.name)
    const missing = found
      ? spec.fields.filter(
          (f) => !found.fields.some((x) => x.name.toLowerCase() === f.name.toLowerCase()),
        )
      : []
    // Alpha's working memory, out of the sidebar until the person shows it (Kenil, 19 Oct).
    const t = !found
      ? world.shape.makeTable(
          module.id,
          spec.name,
          spec.fields,
          { actor },
          { hidden: true, key: spec.name },
        )
      : missing.length
        ? world.shape.addFields(found.id, missing, { actor })
        : found
    return world.people.mapTable(t.id, spec.people ?? null, { actor })
  })
}

// A table the connector fills, by the name it gives it: its lasting key in its module.
export function tableOf(world: World, c: Connector, name: string): Table | undefined {
  const module = world.shape.ownModule(c.module)
  return module ? world.shape.ownTable(module.id, name) : undefined
}
