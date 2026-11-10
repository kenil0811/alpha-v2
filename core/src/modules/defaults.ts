// Alpha's own modules: kits shipped in core/kits,
// installed at start where they are missing and updated where a newer version ships, under the
// ownership rule (what the person changed is kept). Being Alpha's own, their schedules start on.
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { run } from '../world/db.ts'
import type { WriteCtx } from '../world/shape/index.ts'
import type { World } from '../world/world.ts'
import { install, installedKits, readKit, update } from './kits/index.ts'
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
    const out = await keepKit(world, folder, ctx)
    if (out) said.push(out)
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

async function keptKit(world: World, folder: string, ctx: WriteCtx): Promise<string | null> {
  const { manifest } = readKit(folder)
  const m = world.shape.ownModule(manifest.name) ?? world.shape.module(manifest.name)
  const k = m ? installedKits(world).find((x) => x.module === m.id) : undefined
  if (!m) {
    const made = await install(world, folder, ctx)
    for (const a of schedules(world, made.id)) {
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
    const before = new Set(schedules(world, m.id).map((a) => a.id))
    await update(world, manifest.name, folder, ctx)
    for (const a of schedules(world, m.id).filter((x) => !before.has(x.id))) {
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
