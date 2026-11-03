// Alpha's own modules (Kenil, 21 Oct: Network, for every client): kits shipped in core/kits,
// installed at start where they are missing and updated where a newer version ships, under the
// ownership rule (what the person changed is kept). Being Alpha's own, their agents start on.
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { run } from '../world/db.ts'
import type { WriteCtx } from '../world/shape/index.ts'
import type { World } from '../world/world.ts'
import { agents } from './agents.ts'
import { install, installedKits, readKit, update } from './kits/index.ts'

export const DEFAULT_KITS = join(import.meta.dirname, '..', '..', 'kits')

// a kit of Alpha's own under its earlier name: kept as it is, never installed twice
// ponytail: no module rename in the core yet; an install from before 3 Nov keeps "Knowledge Base"
const FORMERLY: Record<string, string> = { Documents: 'Knowledge Base' }

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
  // installed in the rail's order: Calendar, Network, then Documents (Vikas, 3 Nov)
  const first = ['alpha', 'calendar', 'network', 'documents']
  const rank = (n: string) => (first.includes(n) ? first.indexOf(n) : first.length)
  for (const name of readdirSync(dir).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))) {
    const folder = join(dir, name)
    if (!existsSync(join(folder, 'module.yaml'))) continue
    const { manifest } = readKit(folder)
    const was = FORMERLY[manifest.name]
    if (!world.shape.module(manifest.name) && was && world.shape.module(was)) continue
    const m = world.shape.module(manifest.name)
    const k = m ? installedKits(world).find((x) => x.module === m.id) : undefined
    if (!m) {
      const made = await install(world, folder, ctx)
      for (const a of agents(world, made.id)) {
        run(world.db, "UPDATE agents SET state = 'on' WHERE id = ?", a.id)
        world.line({
          actor: ctx.actor,
          kind: 'agent',
          words: `Turned on ${a.name}: ${manifest.name} is Alpha's own.`,
          data: { agent: a.id, state: 'on' },
          module: made.id,
        })
      }
      said.push(`Installed ${manifest.name} ${manifest.version}, Alpha's own.`)
    } else if (k?.kit === manifest.name && newer(manifest.version, k.version)) {
      // an agent the newer version brings starts on, being Alpha's own; one the person paused
      // stays paused (the ownership rule)
      const before = new Set(agents(world, m.id).map((a) => a.id))
      await update(world, manifest.name, folder, ctx)
      for (const a of agents(world, m.id).filter((x) => !before.has(x.id))) {
        run(world.db, "UPDATE agents SET state = 'on' WHERE id = ?", a.id)
        world.line({
          actor: ctx.actor,
          kind: 'agent',
          words: `Turned on ${a.name}: ${manifest.name} is Alpha's own.`,
          data: { agent: a.id, state: 'on' },
          module: m.id,
        })
      }
      said.push(`Updated ${manifest.name} to ${manifest.version}, Alpha's own.`)
    }
  }
  return said
}
