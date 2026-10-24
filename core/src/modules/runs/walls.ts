// The walls on an agent's run: what its file lets it touch, read and do, and its budget.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Manifest } from '@alpha/kit-sdk'
import { parse } from 'yaml'
import { one } from '../../world/db.ts'
import type { Module } from '../../world/shape/index.ts'
import type { World } from '../../world/world.ts'
import { type Agent, type AgentFile, agents, readAgent } from '../agents.ts'
import type { AgentRunner } from './runner.ts'

// Who a run serves: the person, and the desk's turn when the desk started it, so a card it
// opens shows in that turn; and the task it works on, when it was started on one.
// What an agent's file lets its run do (decisions 6 and 8), enforced where each call lands: the
// tables it may write (touches), the tables it may read (its module's and its kit's uses), and
// the calls with an effect it may make (effects; a file that says nothing is an older one,
// allowed and said).
export interface Walls {
  touches: Set<string> // table names, lower case
  reads: Set<string>
  effects: Set<string> | null
}

// A connector or a table an agent needs that is not there (needs), in words.
export function unmetNeeds(world: World, file: AgentFile): string[] {
  const out: string[] = []
  const connected = new Set(
    world.connections
      .list()
      .filter((c) => c.state === 'connected')
      .map((c) => c.connector.toLowerCase()),
  )
  for (const c of file.needs.connectors)
    if (!connected.has(c.toLowerCase())) out.push(`${c} connected`)
  for (const t of file.needs.tables) if (!world.shape.table(t)) out.push(`a table called ${t}`)
  return out.length ? out : []
}

// An agent's file, read again at each run, so an edit counts at once.
export function fileOf(runner: AgentRunner, agentId: string, module: Module): AgentFile | null {
  const a = agents(runner.world).find((x) => x.id === agentId)
  if (!a) return null
  const path = join(module.dir, a.file)
  return existsSync(path) ? readAgent(path) : null
}

export function wallsFor(runner: AgentRunner, module: Module, file: AgentFile): Walls {
  const lower = (names: string[]) => new Set(names.map((n) => n.toLowerCase()))
  // the module's own tables and those of the modules inside it, plus its kit's uses
  const own = runner.world.shape
    .within(module.id)
    .flatMap((id) => runner.world.shape.tables(id).map((t) => t.name))
  const manifest = join(module.dir, 'module.yaml')
  const uses = existsSync(manifest)
    ? (Manifest.safeParse(parse(readFileSync(manifest, 'utf8'))).data?.uses ?? [])
    : []
  return {
    touches: lower(file.touches),
    reads: lower([...own, ...uses.flatMap((u) => u.tables)]),
    effects: file.effects ? lower(file.effects) : null,
  }
}

// The runs an agent has started in the last day, against the runs of its budget.
export function overRuns(runner: AgentRunner, a: Agent, file: AgentFile, nowMs: number): boolean {
  const n = Number(
    one<{ n: number }>(
      runner.world.db,
      'SELECT count(*) AS n FROM runs WHERE agent_id = ? AND started_at >= ? AND (data IS NULL OR data NOT LIKE \'%"skipped":true%\')',
      a.id,
      new Date(nowMs - 86_400_000).toISOString(),
    )?.n ?? 0,
  )
  return n >= file.budget.runs
}
