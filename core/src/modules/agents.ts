// Agents (design §11): an agent is a file `agents/<name>.md` in its module, with front matter
// (its trigger, what it runs, what it may touch, whether it takes tasks) and its brief. The world
// keeps each agent's state (on or paused) and its trigger as read; the file stays the truth. An
// agent that takes tasks is on call for the tasks given to it, and needs no trigger (Q92).
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Cron } from 'croner'
import { parse } from 'yaml'
import { z } from 'zod'
import { all, json, newId, run } from '../world/db.ts'
import { Refused } from '../world/kinds.ts'
import type { Module } from '../world/shape.ts'
import type { World } from '../world/world.ts'

export const Trigger = z.union([
  z.object({
    every: z.enum(['hour', 'day', 'week']),
    at: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
  }),
  z.object({ cron: z.string() }),
  z.object({ changes: z.union([z.string(), z.array(z.string())]) }), // a row added or changed in a table
  z.object({ filed: z.literal(true) }), // a document filed and read (an export dropped, say)
])
export type Trigger = z.infer<typeof Trigger>

// A trigger as the person reads it; an agent with none runs only for the tasks given to it.
export function whenWords(t: Trigger | null): string {
  if (!t) return 'when given a task'
  if ('every' in t) return `every ${t.every}${t.at ? ` at ${t.at}` : ''}`
  if ('cron' in t) return `on the schedule ${t.cron}`
  if ('filed' in t) return 'when a document is filed'
  const tables = Array.isArray(t.changes) ? t.changes : [t.changes]
  return `when ${tables.join(' or ')} change${tables.length === 1 ? 's' : ''}`
}

// When a trigger on the clock next fires, after its last run; a trigger on changes has no time.
// The same rule as the runner's (runs.ts `due`): a day's run is due once its hour has passed.
export function nextRun(t: Trigger | null, lastRunAt: string | null, nowMs: number): Date | null {
  if (!t) return null
  const last = lastRunAt ? Date.parse(lastRunAt) : 0
  if ('every' in t) {
    if (t.every === 'hour') return new Date(Math.max(nowMs, last + 3_600_000))
    const days = t.every === 'week' ? 7 : 1
    const gap = (days - 1) * 86_400_000 + 3_600_000
    const [h, m] = (t.at ?? '00:00').split(':').map(Number)
    const recent = new Date(nowMs)
    recent.setHours(h ?? 0, m ?? 0, 0, 0)
    if (recent.getTime() > nowMs) recent.setDate(recent.getDate() - 1)
    if (last < recent.getTime() && nowMs - last >= gap) return new Date(nowMs) // due now
    const earliest = Math.max(nowMs, last + gap)
    const at = new Date(earliest)
    at.setHours(h ?? 0, m ?? 0, 0, 0)
    if (at.getTime() < earliest) at.setDate(at.getDate() + 1)
    return at
  }
  if ('cron' in t) return new Cron(t.cron).nextRun(new Date(Math.max(nowMs, last))) ?? null
  return null
}

// The script it runs, and what it is handed as `alpha.input` (a reader's page and settings).
export const Runs = z.object({
  script: z.string(),
  input: z.record(z.string(), z.unknown()).optional(),
})
export type Runs = z.infer<typeof Runs>

const Front = z
  .object({
    name: z.string().optional(),
    trigger: Trigger.optional(),
    runs: Runs,
    touches: z.array(z.string()).default([]),
    tasks: z.boolean().default(false), // takes the tasks given to it: alpha.input.task
  })
  .refine((f) => f.trigger || f.tasks, {
    message: 'An agent needs a trigger, or tasks: true to be on call for the tasks given to it.',
  })

export interface Agent {
  id: string
  module: string
  name: string
  file: string
  state: 'on' | 'paused'
  trigger: Trigger | null // none: on call for tasks only
  tasks: boolean // takes the tasks given to it
  runs: Runs
  cursor: string | null
  lastRunAt: string | null
}

export interface AgentFile {
  name: string
  trigger: Trigger | null
  tasks: boolean
  runs: Runs
  touches: string[]
  brief: string
}

export function readAgent(file: string): AgentFile {
  return parseAgent(readFileSync(file, 'utf8'), file)
}

export function parseAgent(text: string, file: string): AgentFile {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text)
  if (!m) throw new Refused(`${file} has no front matter.`)
  const front = Front.safeParse(parse(m[1] as string))
  if (!front.success)
    throw new Refused(`The agent ${file} is not right: ${z.prettifyError(front.error)}`)
  const name = front.data.name ?? (file.split('/').pop() as string).replace(/\.md$/, '')
  return {
    name,
    trigger: front.data.trigger ?? null,
    tasks: front.data.tasks,
    runs: front.data.runs,
    touches: front.data.touches,
    brief: (m[2] as string).trim(),
  }
}

// The module's agents as its files say: new ones start in `state`, known ones keep theirs, and
// one whose file is gone goes. Returns how many there are.
export function syncAgents(world: World, module: Module, state: 'on' | 'paused'): number {
  const dir = join(module.dir, 'agents')
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')) : []
  const seen = new Set<string>()
  for (const f of files) {
    const a = readAgent(join(dir, f))
    seen.add(a.name)
    const known = all<{ id: string }>(
      world.db,
      'SELECT id FROM agents WHERE module_id = ? AND name = ?',
      module.id,
      a.name,
    )[0]
    if (known)
      run(
        world.db,
        'UPDATE agents SET file = ?, trigger = ?, runs = ?, tasks = ? WHERE id = ?',
        `agents/${f}`,
        json(a.trigger),
        json(a.runs),
        a.tasks ? 1 : 0,
        known.id,
      )
    else
      run(
        world.db,
        'INSERT INTO agents (id, module_id, name, file, state, trigger, runs, tasks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        newId('a'),
        module.id,
        a.name,
        `agents/${f}`,
        state,
        json(a.trigger),
        json(a.runs),
        a.tasks ? 1 : 0,
      )
  }
  for (const a of all<{ id: string; name: string }>(
    world.db,
    'SELECT id, name FROM agents WHERE module_id = ?',
    module.id,
  ))
    if (!seen.has(a.name)) run(world.db, 'DELETE FROM agents WHERE id = ?', a.id)
  return seen.size
}

interface AgentRow {
  id: string
  module_id: string
  name: string
  file: string
  state: 'on' | 'paused'
  trigger: string
  runs: string
  tasks: number
  cursor: string | null
  last_run_at: string | null
}

export function agents(world: World, moduleId?: string): Agent[] {
  return all<AgentRow>(
    world.db,
    `SELECT * FROM agents ${moduleId ? 'WHERE module_id = ?' : ''} ORDER BY name`,
    ...(moduleId ? [moduleId] : []),
  ).map((r) => ({
    id: r.id,
    module: r.module_id,
    name: r.name,
    file: r.file,
    state: r.state,
    trigger: JSON.parse(r.trigger) as Trigger | null,
    tasks: r.tasks === 1,
    runs: JSON.parse(r.runs) as Runs,
    cursor: r.cursor,
    lastRunAt: r.last_run_at,
  }))
}

export function setAgentState(
  world: World,
  id: string,
  state: 'on' | 'paused',
  user: string,
): void {
  const a = agents(world).find((x) => x.id === id)
  if (!a) throw new Refused('That agent is not there.')
  if (a.state === state) return
  run(world.db, 'UPDATE agents SET state = ? WHERE id = ?', state, id)
  world.line({
    actor: { kind: 'person', id: user },
    kind: 'agent',
    words: state === 'on' ? `Turned on ${a.name}.` : `Paused ${a.name}.`,
    data: { agent: id, state },
    user,
    module: a.module,
  })
}
