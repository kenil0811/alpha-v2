// The walls on a schedule's run: what its file lets it touch, read and do, and its budget.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Manifest } from '@alpha/kit-sdk'
import { parse } from 'yaml'
import { one } from '../../world/db.ts'
import type { Module } from '../../world/shape/index.ts'
import type { World } from '../../world/world.ts'
import { readSchedule, type Schedule, type ScheduleFile, schedules } from '../schedules.ts'
import type { ScheduleRunner } from './runner.ts'

// Who a run serves: the person, and the desk's turn when the desk started it, so a card it
// opens shows in that turn; and the task it works on, when it was started on one.
// What a schedule's file lets its run do (decisions 6 and 8), enforced where each call lands: the
// tables it may write (touches), the tables it may read (its module's and its kit's uses), and
// the calls with an effect it may make (effects; a file that says nothing is an older one,
// allowed and said).
export interface Walls {
  kind: 'file' | 'try' // a schedule's file, or a try of a script from the chat (its module's walls)
  touches: Set<string> // table names, lower case
  reads: Set<string>
  effects: Set<string> | null
}

// A connector or a table a schedule needs that is not there (needs), in words.
export function unmetNeeds(world: World, file: ScheduleFile): string[] {
  const out: string[] = []
  const connected = new Set(
    world.connections
      .list()
      .filter((c) => c.state === 'connected')
      .map((c) => c.connector.toLowerCase()),
  )
  for (const c of file.needs.connectors)
    if (!connected.has(c.toLowerCase())) out.push(`${c} connected`)
  // a kit's table by its lasting key too, whatever the person calls it now (rules M5)
  const keys = new Set(world.shape.tables().flatMap((t) => (t.key ? [t.key.toLowerCase()] : [])))
  for (const t of file.needs.tables)
    if (!world.shape.table(t) && !keys.has(t.toLowerCase())) out.push(`a table called ${t}`)
  return out.length ? out : []
}

// A schedule's file, read again at each run, so an edit counts at once.
export function fileOf(
  runner: ScheduleRunner,
  scheduleId: string,
  module: Module,
): ScheduleFile | null {
  const a = schedules(runner.world).find((x) => x.id === scheduleId)
  if (!a) return null
  const path = join(module.dir, a.file)
  return existsSync(path) ? readSchedule(path) : null
}

const lower = (names: string[]) => new Set(names.map((n) => n.toLowerCase()))

// The module's own tables and those of the modules inside it, and its kit's uses; a run's walls
// take a table by its name or its lasting key (api.ts).
function reach(runner: ScheduleRunner, module: Module): { own: string[]; uses: string[] } {
  const own = runner.world.shape
    .within(module.id)
    .flatMap((id) => runner.world.shape.tables(id).map((t) => t.name))
  const manifest = join(module.dir, 'module.yaml')
  const uses = existsSync(manifest)
    ? (Manifest.safeParse(parse(readFileSync(manifest, 'utf8'))).data?.uses ?? [])
    : []
  return { own, uses: uses.flatMap((u) => u.tables) }
}

// A try of a script from the chat has no schedule file, so its module is its wall (item 40 of the
// problems list, 25 Oct): it writes the module's own tables and reads those and its kit's uses.
// Its effects are not walled here: a try is how a reader is tried before it runs on its own, and
// a site not on the module's list waits on the person's card as ever.
export function wallsForTry(runner: ScheduleRunner, module: Module): Walls {
  const { own, uses } = reach(runner, module)
  return { kind: 'try', touches: lower(own), reads: lower([...own, ...uses]), effects: null }
}

export function wallsFor(runner: ScheduleRunner, module: Module, file: ScheduleFile): Walls {
  const { own, uses } = reach(runner, module)
  return {
    kind: 'file',
    touches: lower(file.touches),
    reads: lower([...own, ...uses]),
    effects: file.effects ? lower(file.effects) : null,
  }
}

// The runs a schedule has started in the last day, against the runs of its budget.
export function overRuns(
  runner: ScheduleRunner,
  a: Schedule,
  file: ScheduleFile,
  nowMs: number,
): boolean {
  const n = Number(
    one<{ n: number }>(
      runner.world.db,
      'SELECT count(*) AS n FROM runs WHERE schedule_id = ? AND started_at >= ? AND (data IS NULL OR data NOT LIKE \'%"skipped":true%\')',
      a.id,
      new Date(nowMs - 86_400_000).toISOString(),
    )?.n ?? 0,
  )
  return n >= file.budget.runs
}
