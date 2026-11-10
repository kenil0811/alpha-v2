// Schedules (design §11): a schedule is a file `schedules/<name>.md` in its module, with front matter
// (its trigger, what it runs, what it may touch) and its brief. The world keeps each schedule's state
// (on or paused) and its trigger as read; the file stays the truth.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  type Runs,
  ScheduleFront,
  type ScheduleFrontMatter,
  type Trigger,
  triggersOf,
  WEEK_DAYS,
} from '@alpha/kit-sdk'
import { Cron } from 'croner'
import { parse } from 'yaml'
import { z } from 'zod'
import { CHIEF, CHIEF_CARD } from '../world/agents/index.ts'
import { all, json, newId, now, run } from '../world/db.ts'
import { Refused } from '../world/kinds.ts'
import type { Module } from '../world/shape/index.ts'
import type { World } from '../world/world.ts'

// The trigger, the script and the front matter are the kit API's (kit-sdk).
export type { Runs, Trigger }

// A trigger as the person reads it.
export function whenWords(t: Trigger | Trigger[] | null): string {
  return triggersOf(t).map(oneWhen).join(', and ')
}

const dayName = (d: string) => d.charAt(0).toUpperCase() + d.slice(1)

function oneWhen(t: Trigger): string {
  if ('every' in t) {
    const named = (WEEK_DAYS as readonly string[]).includes(t.every)
    return `every ${named ? dayName(t.every) : t.every}${t.at ? ` at ${t.at}` : ''}`
  }
  if ('cron' in t) return cronWords(t.cron)
  if ('filed' in t) return 'when a document is filed'
  const tables = Array.isArray(t.changes) ? t.changes : [t.changes]
  return `when ${tables.join(' or ')} change${tables.length === 1 ? 's' : ''}`
}

// A pattern as the person reads it, the common ones in words and any other as it is.
function cronWords(cron: string): string {
  const [min = '', hour = '', dom = '', mon = '', dow = ''] = cron.trim().split(/\s+/)
  const each = /^\*\/(\d+)$/.exec(min)
  if (each && hour === '*' && dom === '*' && mon === '*' && dow === '*')
    return `every ${each[1]} minutes`
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && mon === '*') {
    const at = `at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`
    if (dom === '*' && dow === '*') return `every day ${at}`
    if (dom === '*' && dow === '1-5') return `every weekday ${at}`
    if (dom === '*' && /^[0-6]$/.test(dow))
      return `every ${dayName(WEEK_DAYS[Number(dow)] as string)} ${at}`
    if (/^\d+$/.test(dom) && dow === '*') return `on day ${dom} of each month ${at}`
  }
  return `on the pattern ${cron}`
}

const HOUR = 3_600_000
const DAY = 86_400_000
type Every = Extract<Trigger, { every: string }>

function onItsDay(every: Every['every'], d: Date): boolean {
  if (every === 'weekday') return d.getDay() !== 0 && d.getDay() !== 6
  const day = (WEEK_DAYS as readonly string[]).indexOf(every)
  return day < 0 || d.getDay() === day
}

// The least time between two runs of a daily or weekly trigger, so Run now does not bring on the
// next one by itself.
export const gapOf = (every: Every['every']) => (every === 'week' ? 6 * DAY + HOUR : HOUR)

// The latest moment at or before now that a daily or weekly trigger names.
export function latestAt(t: Every, nowMs: number): Date {
  const [h, m] = (t.at ?? '00:00').split(':').map(Number)
  const at = new Date(nowMs)
  at.setHours(h ?? 0, m ?? 0, 0, 0)
  if (at.getTime() > nowMs) at.setDate(at.getDate() - 1)
  while (!onItsDay(t.every, at)) at.setDate(at.getDate() - 1)
  return at
}

// When a schedule on the clock came due, so a run that starts late can be told so.
export function cameDue(
  t: Trigger | Trigger[] | null,
  lastRunAt: string | null,
  nowMs: number,
): Date | null {
  const last = lastRunAt ? Date.parse(lastRunAt) : 0
  for (const x of triggersOf(t)) {
    if ('every' in x)
      return x.every === 'hour'
        ? new Date(last ? Math.min(nowMs, last + HOUR) : nowMs)
        : latestAt(x, nowMs)
    if ('cron' in x && last) return new Cron(x.cron).nextRun(new Date(last)) ?? null
  }
  return null
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
    if (t.every === 'hour') return new Date(Math.max(nowMs, last + HOUR))
    const gap = gapOf(t.every)
    if (last < latestAt(t, nowMs).getTime() && nowMs - last >= gap) return new Date(nowMs) // due now
    const [h, m] = (t.at ?? '00:00').split(':').map(Number)
    const earliest = Math.max(nowMs, last + gap)
    const at = new Date(earliest)
    at.setHours(h ?? 0, m ?? 0, 0, 0)
    if (at.getTime() < earliest) at.setDate(at.getDate() + 1)
    while (!onItsDay(t.every, at)) at.setDate(at.getDate() + 1)
    return at
  }
  if ('cron' in t) return new Cron(t.cron).nextRun(new Date(Math.max(nowMs, last))) ?? null
  return null
}

export interface Schedule {
  id: string
  module: string | null // none: it sits in an agent's own folder
  agent: string | null // who it wakes; none: a module's script alone
  by: string | null // who asked for an agent's own
  name: string
  description: string | null
  file: string
  state: 'on' | 'paused'
  trigger: Trigger | Trigger[]
  runs: Runs | null // its script; none: it wakes the agent every time
  cursor: string | null
  lastRunAt: string | null
}

export interface ScheduleFile {
  name: string
  description: string | null
  trigger: Trigger | Trigger[] | null
  runs: Runs | null
  wakes: boolean
  touches: string[]
  effects: string[] | null // null: the file says nothing, an older one
  needs: { connectors: string[]; tables: string[] }
  input: ScheduleFrontMatter['input'] | null
  budget: { minutes: number; runs: number }
  brief: string
}

export function readSchedule(file: string): ScheduleFile {
  return parseSchedule(readFileSync(file, 'utf8'), file)
}

export function parseSchedule(text: string, file: string): ScheduleFile {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text)
  if (!m) throw new Refused(`${file} has no front matter.`)
  const front = ScheduleFront.safeParse(parse(m[1] as string))
  if (!front.success)
    throw new Refused(`The schedule ${file} is not right: ${z.prettifyError(front.error)}`)
  const name = front.data.name ?? (file.split('/').pop() as string).replace(/\.md$/, '')
  return {
    name,
    description: front.data.description ?? null,
    trigger: front.data.trigger,
    runs: front.data.runs ?? null,
    wakes: front.data.wakes,
    touches: front.data.touches,
    effects: front.data.effects ?? null,
    needs: front.data.needs,
    input: front.data.input ?? null,
    budget: front.data.budget,
    brief: (m[2] as string).trim(),
  }
}

// The module's schedules as its files say: new ones start in `state`, known ones keep theirs, and
// one whose file is gone goes. A schedule is known by its file first, then its name, so a rename
// in the file keeps it whole: its state, last run and history (item 47, 25 Oct). Returns how
// many there are.
export function syncSchedules(world: World, module: Module, state: 'on' | 'paused'): number {
  return syncFiles(world, { module, agent: null, by: null }, module.dir, state)
}

// An agent's own schedules, from its folder. A new one waits for its first time to come round.
export function syncAgentSchedules(world: World, agent: string, by: string | null): number {
  return syncFiles(world, { module: null, agent, by }, world.agents.dirOf(agent), 'on')
}

type Home =
  | { module: Module; agent: null; by: null }
  | { module: null; agent: string; by: string | null }

function syncFiles(world: World, home: Home, root: string, state: 'on' | 'paused'): number {
  const dir = join(root, 'schedules')
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')) : []
  const kept = new Set<string>() // the ids of the schedules still there
  const of = home.module ? 'module_id = ?' : 'module_id IS NULL AND agent = ?'
  const key = home.module ? home.module.id : home.agent
  const module = home.module?.id ?? null
  for (const f of files) {
    const a = readSchedule(join(dir, f))
    type Known = { id: string; name: string; agent: string | null }
    const byFile = all<Known>(
      world.db,
      `SELECT id, name, agent FROM schedules WHERE ${of} AND file = ?`,
      key,
      `schedules/${f}`,
    )[0]
    const known =
      (byFile && !kept.has(byFile.id) ? byFile : undefined) ??
      all<Known>(
        world.db,
        `SELECT id, name, agent FROM schedules WHERE ${of} AND name = ?`,
        key,
        a.name,
      ).find((x) => !kept.has(x.id))
    // a module's file says only that it wakes an agent; which one is the person's choice
    const wakes = (was: string | null) =>
      home.module ? (a.wakes ? (was ?? CHIEF) : null) : home.agent
    if (known) {
      kept.add(known.id)
      run(
        world.db,
        'UPDATE schedules SET name = ?, file = ?, trigger = ?, runs = ?, description = ?, agent = ? WHERE id = ?',
        a.name,
        `schedules/${f}`,
        json(a.trigger),
        a.runs ? json(a.runs) : null,
        a.description,
        wakes(known.agent),
        known.id,
      )
      if (known.name !== a.name)
        world.line({
          actor: { kind: 'system' },
          kind: 'shaped',
          words: `${known.name} is now called ${a.name}.`,
          data: { schedule: known.id, from: known.name, to: a.name },
          module,
        })
    } else {
      const id = newId('sch')
      kept.add(id)
      run(
        world.db,
        'INSERT INTO schedules (id, module_id, agent, made_by, name, file, state, trigger, runs, description, last_run_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        id,
        module,
        wakes(null),
        home.by,
        a.name,
        `schedules/${f}`,
        state,
        json(a.trigger),
        a.runs ? json(a.runs) : null,
        a.description,
        home.module ? null : now(),
      )
    }
  }
  for (const a of all<{ id: string; name: string }>(
    world.db,
    `SELECT id, name FROM schedules WHERE ${of}`,
    key,
  ))
    if (!kept.has(a.id)) {
      // its runs stay in the history, no longer tied to it
      run(world.db, 'UPDATE runs SET schedule_id = NULL WHERE schedule_id = ?', a.id)
      run(world.db, 'DELETE FROM schedules WHERE id = ?', a.id)
      // its rules go with it (core step 2); the journal keeps them
      world.rules.removeScoped({ schedule: a.name }, { actor: { kind: 'system' } })
    }
  return kept.size
}

interface ScheduleRow {
  id: string
  module_id: string | null
  agent: string | null
  made_by: string | null
  name: string
  description: string | null
  file: string
  state: 'on' | 'paused'
  trigger: string
  runs: string | null
  cursor: string | null
  last_run_at: string | null
}

export function schedules(world: World, moduleId?: string): Schedule[] {
  return all<ScheduleRow>(
    world.db,
    `SELECT * FROM schedules ${moduleId ? 'WHERE module_id = ?' : ''} ORDER BY name`,
    ...(moduleId ? [moduleId] : []),
  ).map((r) => ({
    id: r.id,
    module: r.module_id,
    agent: r.agent,
    by: r.made_by,
    name: r.name,
    file: r.file,
    state: r.state,
    description: r.description,
    trigger: JSON.parse(r.trigger) as Trigger | Trigger[],
    runs: r.runs ? (JSON.parse(r.runs) as Runs) : null,
    cursor: r.cursor,
    lastRunAt: r.last_run_at,
  }))
}

export const agentName = (world: World, agent: string): string =>
  agent === CHIEF ? CHIEF_CARD.name : (world.agents.get(agent)?.name ?? 'An agent')

// One agent's own schedules.
export const agentSchedules = (world: World, agent: string): Schedule[] =>
  schedules(world).filter((a) => a.module === null && a.agent === agent)

// Which agent a module's schedule wakes: the person's choice, on the module's Setup.
export function setScheduleAgent(world: World, id: string, agent: string, user: string): void {
  const a = schedules(world).find((x) => x.id === id)
  if (!a?.module || !a.agent) throw new Refused('That schedule does not wake an agent.')
  if (agent !== CHIEF && !world.agents.get(agent)) throw new Refused('That agent is not there.')
  if (a.agent === agent) return
  run(world.db, 'UPDATE schedules SET agent = ? WHERE id = ?', agent, id)
  world.line({
    actor: { kind: 'person', id: user },
    kind: 'schedule',
    words: `${a.name} now wakes ${agentName(world, agent)}.`,
    data: { schedule: id, agent },
    user,
    module: a.module,
  })
}

export function setScheduleState(
  world: World,
  id: string,
  state: 'on' | 'paused',
  user: string,
): void {
  const a = schedules(world).find((x) => x.id === id)
  if (!a) throw new Refused('That schedule is not there.')
  if (a.state === state) return
  run(world.db, 'UPDATE schedules SET state = ? WHERE id = ?', state, id)
  world.line({
    actor: { kind: 'person', id: user },
    kind: 'schedule',
    words: state === 'on' ? `Turned on ${a.name}.` : `Paused ${a.name}.`,
    data: { schedule: id, state },
    user,
    module: a.module,
  })
}
