// Agents (design §11): an agent is a file `agents/<name>.md` in its module, with front matter
// (its trigger, what it runs, what it may touch, whether it takes tasks) and its brief. The world
// keeps each agent's state (on or paused) and its trigger as read; the file stays the truth. An
// agent that takes tasks is on call for the tasks given to it, and needs no trigger (Q92).
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  AgentFront,
  type AgentFrontMatter,
  type Runs,
  type Trigger,
  triggersOf,
} from '@alpha/kit-sdk'
import { Cron } from 'croner'
import { parse } from 'yaml'
import { z } from 'zod'
import { all, json, newId, one, run } from '../world/db.ts'
import { Refused } from '../world/kinds.ts'
import type { Module } from '../world/shape/index.ts'
import type { World } from '../world/world.ts'

// The trigger, the script and the front matter are the kit API's (kit-sdk), schema version 1.
export type { Runs, Trigger }

// A trigger as the person reads it; an agent with none runs only for the tasks given to it.
export function whenWords(t: Trigger | Trigger[] | null): string {
  const list = triggersOf(t)
  if (!list.length) return 'when given a task'
  return list.map(oneWhen).join(', and ')
}

function oneWhen(t: Trigger): string {
  if ('every' in t) return `every ${t.every}${t.at ? ` at ${t.at}` : ''}`
  if ('cron' in t) return `on the schedule ${t.cron}`
  if ('filed' in t) return 'when a document is filed'
  const tables = Array.isArray(t.changes) ? t.changes : [t.changes]
  return `when ${tables.join(' or ')} change${tables.length === 1 ? 's' : ''}`
}

// Each trigger as the Agents list reads it, said whole and marked on a time or on an event:
// "Weekdays 07:30", "When a row is added or changed in Leads". `table` names a table as the
// module calls it.
export function triggerWords(
  t: Trigger | Trigger[] | null,
  table: (name: string) => string,
  module: string,
): { words: string; on: 'time' | 'event' }[] {
  return triggersOf(t).map((x) => {
    if ('every' in x)
      return {
        words:
          x.every === 'hour'
            ? 'Every hour'
            : `${x.every === 'day' ? 'Daily' : 'Weekly'}${x.at ? ` ${x.at}` : ''}`,
        on: 'time',
      }
    if ('cron' in x) return { words: cronWords(x.cron), on: 'time' }
    if ('filed' in x) return { words: `When a document is filed in ${module}`, on: 'event' }
    const tables = (Array.isArray(x.changes) ? x.changes : [x.changes]).map(table)
    const names =
      tables.length > 1 ? `${tables.slice(0, -1).join(', ')} or ${tables.at(-1)}` : tables[0]
    return { words: `When a row is added or changed in ${names}`, on: 'event' }
  })
}

// A plain five-part schedule in words where it is one a person says ("30 7 * * 1-5" is
// "Weekdays 07:30"); anything else as written.
// ponytail: only minute-hour-day-of-week schedules are put in words; add more when one shows
function cronWords(cron: string): string {
  const m = /^(\d{1,2}) (\d{1,2}) \* \* (\*|1-5|0,6|6,0|[0-6])$/.exec(cron.trim())
  if (!m) return `On the schedule ${cron}`
  const at = `${m[2]?.padStart(2, '0')}:${m[1]?.padStart(2, '0')}`
  const days: Record<string, string> = { '*': 'Daily', '1-5': 'Weekdays', '0,6': 'Weekends' }
  const dayNames = [
    'Sundays',
    'Mondays',
    'Tuesdays',
    'Wednesdays',
    'Thursdays',
    'Fridays',
    'Saturdays',
  ]
  const d = m[3] as string
  return `${days[d] ?? (d === '6,0' ? 'Weekends' : dayNames[Number(d)])} ${at}`
}

// How an agent's last run ended: what it did, or since when it has failed (every run since then
// failed). Read from its runs; a running one is not an end yet.
export function lastResult(
  world: World,
  agent: string,
): { words: string; ok: boolean; at: string; failedSince: string | null } | null {
  const ended = all<{ state: string; words: string | null; started_at: string }>(
    world.db,
    "SELECT state, words, started_at FROM runs WHERE agent_id = ? AND state != 'running' ORDER BY started_at DESC LIMIT 50",
    agent,
  )
  const last = ended[0]
  if (!last) return null
  if (last.state !== 'failed')
    return {
      words: last.words ?? (last.state === 'stopped' ? 'Stopped' : 'Done'),
      ok: true,
      at: last.started_at,
      failedSince: null,
    }
  let since = last.started_at
  for (const r of ended) {
    if (r.state !== 'failed') break
    since = r.started_at
  }
  return { words: last.words ?? 'Failed', ok: false, at: last.started_at, failedSince: since }
}

// What an agent does, as the Agents list groups it (Vikas, 29 Oct): its file's `function:`, or
// read from its name and words with a plain keyword map; never the model.
// ponytail: a keyword map; a kit that groups wrongly says `function:` in its file
const FUNCTION_WORDS: [string, RegExp][] = [
  ['Outreach', /outreach|e-?mail|draft|follow.?up|reach out|letter/i],
  ['Sourcing', /listing|broker|marketplace|sourc|deal search/i],
  ['Intake', /intake|filed|document|application|onboard|new client|export|import|reader/i],
  ['Finance', /financ|invoice|payment|accounting|ledger|billing/i],
  ['Analysis & insights', /figure|analy|insight|benchmark|measur|score|report|thesis|metric/i],
]
export function functionOf(a: {
  name: string
  description: string | null
  brief: string
  function: string | null
}): string {
  if (a.function) return a.function
  // its name and one line first: a brief says much in passing
  for (const words of [`${a.name} ${a.description ?? ''}`, a.brief]) {
    const hit = FUNCTION_WORDS.find(([, re]) => re.test(words))
    if (hit) return hit[0]
  }
  return 'Admin'
}

// The cards an agent's runs opened that still wait on the person: past the limit in
// limits.yaml its runs wait for them rather than add more (Vikas, 29 Oct).
export function cardsWaiting(world: World, agent: string): number {
  return (
    one<{ n: number }>(
      world.db,
      "SELECT count(*) AS n FROM cards WHERE state = 'waiting' AND run_id IN (SELECT id FROM runs WHERE agent_id = ?)",
      agent,
    )?.n ?? 0
  )
}

// Whether the person has ever turned the agent on: one never turned on shows Activate.
export function everOn(world: World, agent: string): boolean {
  return (
    all(
      world.db,
      "SELECT 1 FROM journal WHERE kind = 'agent' AND json_extract(data, '$.agent') = ? AND json_extract(data, '$.state') = 'on' LIMIT 1",
      agent,
    ).length > 0
  )
}

// When a trigger on the clock next fires, after its last run; a trigger on changes has no time.
// The same rule as the runner's (runs.ts `due`): a day's run is due once its hour has passed.
// Of a list, the earliest.
export function nextRun(
  t: Trigger | Trigger[] | null,
  lastRunAt: string | null,
  nowMs: number,
): Date | null {
  const times = triggersOf(t)
    .map((x) => nextRunOf(x, lastRunAt, nowMs))
    .filter((d): d is Date => d !== null)
  return times.length ? new Date(Math.min(...times.map((d) => d.getTime()))) : null
}

function nextRunOf(t: Trigger, lastRunAt: string | null, nowMs: number): Date | null {
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

export interface Agent {
  id: string
  module: string
  name: string
  description: string | null
  file: string
  state: 'on' | 'paused'
  trigger: Trigger | Trigger[] | null // none: on call for tasks only
  tasks: boolean // takes the tasks given to it
  runs: Runs
  cursor: string | null
  lastRunAt: string | null
}

export interface AgentFile {
  name: string
  description: string | null
  trigger: Trigger | Trigger[] | null
  tasks: boolean
  runs: Runs
  touches: string[]
  effects: string[] | null // null: the file says nothing, an older one
  needs: { connectors: string[]; tables: string[] }
  input: AgentFrontMatter['input'] | null
  budget: { minutes: number; runs: number }
  brief: string
  function: string | null // what it does, as the Agents list groups it: Sourcing, Outreach…
}

export function readAgent(file: string): AgentFile {
  return parseAgent(readFileSync(file, 'utf8'), file)
}

export function parseAgent(text: string, file: string): AgentFile {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text)
  if (!m) throw new Refused(`${file} has no front matter.`)
  const front = AgentFront.safeParse(parse(m[1] as string))
  if (!front.success)
    throw new Refused(`The agent ${file} is not right: ${z.prettifyError(front.error)}`)
  const name = front.data.name ?? (file.split('/').pop() as string).replace(/\.md$/, '')
  // `function:` is read as written; the kit API's schema does not hold it yet
  const fn = (parse(m[1] as string) as { function?: unknown } | null)?.function
  return {
    function: typeof fn === 'string' && fn.trim() ? fn.trim() : null,
    name,
    description: front.data.description ?? null,
    trigger: front.data.trigger ?? null,
    tasks: front.data.tasks,
    runs: front.data.runs,
    touches: front.data.touches,
    effects: front.data.effects ?? null,
    needs: front.data.needs,
    input: front.data.input ?? null,
    budget: front.data.budget,
    brief: (m[2] as string).trim(),
  }
}

// The module's agents as its files say: new ones start in `state`, known ones keep theirs, and
// one whose file is gone goes. An agent is known by its file first, then its name, so a rename
// in the file keeps it whole: its state, last run and history (item 47, 25 Oct). Returns how
// many there are.
export function syncAgents(world: World, module: Module, state: 'on' | 'paused'): number {
  const dir = join(module.dir, 'agents')
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')) : []
  const kept = new Set<string>() // the ids of the agents still there
  for (const f of files) {
    const a = readAgent(join(dir, f))
    const byFile = all<{ id: string; name: string }>(
      world.db,
      'SELECT id, name FROM agents WHERE module_id = ? AND file = ?',
      module.id,
      `agents/${f}`,
    )[0]
    const known =
      (byFile && !kept.has(byFile.id) ? byFile : undefined) ??
      all<{ id: string; name: string }>(
        world.db,
        'SELECT id, name FROM agents WHERE module_id = ? AND name = ?',
        module.id,
        a.name,
      ).find((x) => !kept.has(x.id))
    if (known) {
      kept.add(known.id)
      run(
        world.db,
        'UPDATE agents SET name = ?, file = ?, trigger = ?, runs = ?, tasks = ?, description = ? WHERE id = ?',
        a.name,
        `agents/${f}`,
        json(a.trigger),
        json(a.runs),
        a.tasks ? 1 : 0,
        a.description,
        known.id,
      )
      if (known.name !== a.name)
        world.line({
          actor: { kind: 'system' },
          kind: 'shaped',
          words: `${known.name} is now called ${a.name}.`,
          data: { agent: known.id, from: known.name, to: a.name },
          module: module.id,
        })
    } else {
      const id = newId('a')
      kept.add(id)
      run(
        world.db,
        'INSERT INTO agents (id, module_id, name, file, state, trigger, runs, tasks, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        id,
        module.id,
        a.name,
        `agents/${f}`,
        state,
        json(a.trigger),
        json(a.runs),
        a.tasks ? 1 : 0,
        a.description,
      )
    }
  }
  for (const a of all<{ id: string; name: string }>(
    world.db,
    'SELECT id, name FROM agents WHERE module_id = ?',
    module.id,
  ))
    if (!kept.has(a.id)) {
      // its runs stay in Activity, under its module, with no agent to point at
      run(world.db, 'UPDATE runs SET agent_id = NULL WHERE agent_id = ?', a.id)
      run(world.db, 'DELETE FROM agents WHERE id = ?', a.id)
      // its rules go with it (core step 2); the journal keeps them
      world.rules.removeScoped({ agent: a.name }, { actor: { kind: 'system' } })
    }
  return kept.size
}

interface AgentRow {
  id: string
  module_id: string
  name: string
  description: string | null
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
    description: r.description,
    trigger: JSON.parse(r.trigger) as Trigger | Trigger[] | null,
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
