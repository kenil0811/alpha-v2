// Alpha's own modules: kits shipped in core/kits,
// installed at start where they are missing and updated where a newer version ships, under the
// ownership rule (what the person changed is kept). Being Alpha's own, their schedules start on.
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { run } from '../world/db.ts'
import type { Module, WriteCtx } from '../world/shape/index.ts'
import type { World } from '../world/world.ts'
import { install, installedKits, readKit, titleOf, update } from './kits/index.ts'
import { schedules } from './schedules.ts'

export const DEFAULT_KITS = join(import.meta.dirname, '..', '..', 'kits')

// Whether version a is newer than b, part by part: 0.10.0 over 0.9.1.
export function newer(a: string, b: string): boolean {
  const pa = a.split('.').map((x) => Number.parseInt(x, 10) || 0)
  const pb = b.split('.').map((x) => Number.parseInt(x, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d > 0
  }
  return false
}

export async function keepDefaults(
  world: World,
  ctx: WriteCtx,
  dir = DEFAULT_KITS,
): Promise<string[]> {
  if (!existsSync(dir)) return []
  const said: string[] = []
  for (const name of readdirSync(dir).sort()) {
    const folder = join(dir, name)
    if (!existsSync(join(folder, 'module.yaml'))) continue
    // one that does not go in says so, and the others still do
    try {
      const out = await keepKit(world, folder, ctx)
      if (out) said.push(out)
    } catch (err) {
      said.push(`${name} did not go in: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return said
}

// One of Alpha's own modules, installed where it is missing and updated where a newer version
// ships (a plugin's own module too, onboarding 4a); what it did, in words, or nothing.
export async function keepKit(
  world: World,
  folder: string,
  ctx: WriteCtx,
  options: { managed?: boolean } = {},
): Promise<string | null> {
  const out = await keptKit(world, folder, ctx)
  // Alpha's own kit and a plugin's module are managed by Alpha, which comes with them (rules M1)
  const { manifest } = readKit(folder)
  const m = world.shape.ownModule(manifest.name) ?? world.shape.module(manifest.name)
  if (m && (manifest.core || options.managed))
    run(world.db, "UPDATE kits SET managed = 'Alpha' WHERE module_id = ?", m.id)
  return out
}

// The module a connector made for the rows an Alpha's own kit now keeps (Contacts, before People):
// one no kit holds, whose tables are all mirrors and hold every table the kit names.
function formerHome(world: World, tables: string[]): Module | undefined {
  const kits = new Set(installedKits(world).map((k) => k.module))
  return world.shape.modules().find((m) => {
    if (kits.has(m.id)) return false
    const there = world.shape.tables(m.id)
    return (
      there.length > 0 &&
      there.every((t) => !!t.mirror) &&
      tables.every((name) => there.some((t) => (t.key ?? t.name) === name))
    )
  })
}

// A kit's schedules: its module's, and those of the agents it carries (in an agent's own folder).
const kitSchedules = (world: World, module: string) =>
  schedules(world).filter(
    (a) => a.module === module || (!!a.agent && world.agents.get(a.agent)?.source === module),
  )

async function keptKit(world: World, folder: string, ctx: WriteCtx): Promise<string | null> {
  const { manifest } = readKit(folder)
  let m = world.shape.ownModule(manifest.name) ?? world.shape.module(manifest.name)
  // Alpha's own kit takes the module its rows were kept in before, under its own name
  if (!m && manifest.core) {
    const home = formerHome(
      world,
      manifest.tables.map((t) => t.name),
    )
    if (home) {
      world.shape.renameModule(home.id, titleOf(world, manifest), ctx)
      world.shape.rekeyModule(home.id, manifest.name)
      m = world.shape.ownModule(manifest.name)
    }
  }
  const k = m ? installedKits(world).find((x) => x.module === m.id) : undefined
  // none yet, or one a connector made for its rows (Calendar), which Alpha's own kit adopts; a
  // module of that name the person made themselves is theirs, and left alone
  const connectors = !!m && world.shape.tables(m.id).every((t) => !!t.mirror)
  if (!m || (!k && connectors)) {
    const made = await install(world, folder, ctx, { adopt: true })
    for (const a of kitSchedules(world, made.id)) {
      run(world.db, "UPDATE schedules SET state = 'on' WHERE id = ?", a.id)
      world.line({
        actor: ctx.actor,
        kind: 'schedule',
        words: `Turned on ${a.name}: ${manifest.name} is Alpha's own.`,
        data: { schedule: a.id, state: 'on' },
        module: made.id,
      })
    }
    return `Installed ${manifest.name} ${manifest.version}, Alpha's own.`
  } else if (k?.kit === manifest.name && newer(manifest.version, k.version)) {
    // a schedule the newer version brings starts on, being Alpha's own; one the person paused
    // stays paused (the ownership rule)
    const before = new Set(kitSchedules(world, m.id).map((a) => a.id))
    await update(world, manifest.name, folder, ctx)
    for (const a of kitSchedules(world, m.id).filter((x) => !before.has(x.id))) {
      run(world.db, "UPDATE schedules SET state = 'on' WHERE id = ?", a.id)
      world.line({
        actor: ctx.actor,
        kind: 'schedule',
        words: `Turned on ${a.name}: ${manifest.name} is Alpha's own.`,
        data: { schedule: a.id, state: 'on' },
        module: m.id,
      })
    }
    return `Updated ${manifest.name} to ${manifest.version}, Alpha's own.`
  }
  return null
}
