// A managed kit's files as they were signed (docs/rules.md, M3): each compared with its hash at
// every start. One changed since stops the kit's agents, and a card says which, until a newer
// signed pack puts them right. The kit's own install and update keep the hashes.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { all, run } from '../../world/db.ts'
import type { World } from '../../world/world.ts'
import { agents } from '../agents.ts'
import { sha } from './read.ts'

export function checkSigned(world: World, user: string | null = null): string[] {
  const said: string[] = []
  for (const k of all<{ module_id: string; kit: string }>(
    world.db,
    "SELECT module_id, kit FROM kits WHERE managed = 'Kenil'",
  )) {
    const m = world.shape.module(k.module_id)
    if (!m) continue
    const changed = all<{ path: string; installed_hash: string }>(
      world.db,
      'SELECT path, installed_hash FROM module_files WHERE module_id = ?',
      k.module_id,
    )
      .filter((f) => {
        const p = join(m.dir, f.path)
        return !existsSync(p) || sha(readFileSync(p)) !== f.installed_hash
      })
      .map((f) => f.path)
    if (!changed.length) continue
    for (const a of agents(world, m.id))
      run(world.db, "UPDATE agents SET state = 'paused' WHERE id = ?", a.id)
    const words = `${m.name}'s agents are stopped: ${changed.join(', ')} changed since ${k.kit} was signed. A newer signed pack puts it right.`
    if (!world.cards.waiting().some((c) => c.words === words))
      world.cards.open({
        kind: 'suggestion',
        words,
        options: ['Understood'],
        actor: { kind: 'system' },
        user,
        module: m.id,
      })
    said.push(words)
  }
  return said
}
