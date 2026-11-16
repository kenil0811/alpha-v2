// Where a connector's items land: its module and tables, made when it is first
// connected, any field a newer version adds, and how their rows name people. Each is found by the
// lasting key it was made with, so one the person renamed keeps taking the rows; a module or
// table found by its name is keyed from then on.
import type { Connector } from '@alpha/connector-sdk'
import type { Table } from '../world/shape/index.ts'
import { markMirror } from '../world/shape/keys.ts'
import type { World } from '../world/world.ts'

export function landIn(world: World, c: Connector): Table[] {
  const actor = { kind: 'connector' as const, id: c.manifest.name }
  if (!c.tables.length) return []
  // each table in its own module when it names one (a shared Events), else the connector's
  const modules = new Map<string, ReturnType<typeof world.shape.makeModule>>()
  const moduleOf = (name: string) => {
    const had = modules.get(name)
    if (had) return had
    const known = world.shape.ownModule(name)
    if (known) world.shape.claimModule(known.id, name)
    const m = known ?? world.shape.makeModule(name, { actor }, name)
    modules.set(name, m)
    return m
  }
  return c.tables.map((spec) => {
    const module = moduleOf(spec.module ?? c.module)
    const found = world.shape.ownTable(module.id, spec.name)
    if (found) world.shape.claimTable(found, module.id, spec.name)
    // its fields keyed with the connector's names for them (rules M5), so one the person renamed
    // keeps taking its values; a field made before keys is keyed by its name when first met
    const keyed = spec.fields.map((f) => ({ ...f, key: f.name }))
    const same = (x: { key: string | null; name: string }, name: string) =>
      x.key === name || (x.key === null && x.name.toLowerCase() === name.toLowerCase())
    for (const f of spec.fields) {
      const x = found?.fields.find((y) => y.key === null && same(y, f.name))
      if (x) world.shape.setKey(x.id, f.name)
    }
    const missing = found ? keyed.filter((f) => !found.fields.some((x) => same(x, f.name))) : []
    // Alpha's working memory, out of the sidebar until the person shows it.
    const t = !found
      ? world.shape.makeTable(
          module.id,
          spec.name,
          keyed,
          { actor },
          { hidden: true, key: spec.name },
        )
      : missing.length
        ? world.shape.addFields(found.id, missing, { actor })
        : found
    // a mirror of the connector's system: its rows come and go with it (rules D1, D8)
    markMirror(world.shape, t.id, c.manifest.title)
    return world.people.mapTable(t.id, spec.people ?? null, { actor })
  })
}

// A table the connector fills, by the name it gives it: its lasting key in its module.
export function tableOf(world: World, c: Connector, name: string): Table | undefined {
  const spec = c.tables.find((t) => t.name === name)
  const module = world.shape.ownModule(spec?.module ?? c.module)
  return module ? world.shape.ownTable(module.id, name) : undefined
}
