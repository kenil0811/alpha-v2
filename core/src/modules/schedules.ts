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
} from '@alpha/kit-sdk'
import { Cron } from 'croner'
import { parse } from 'yaml'
import { z } from 'zod'
import { all, json, newId, run } from '../world/db.ts'
import { Refused } from '../world/kinds.ts'
import type { Module } from '../world/shape/index.ts'
import type { World } from '../world/world.ts'

// The trigger, the script and the front matter are the kit API's (kit-sdk).
export type { Runs, Trigger }

// A trigger as the person reads it.
export function whenWords(t: Trigger | Trigger[] | null): string {
  return triggersOf(t).map(oneWhen).join(', and ')
}

function oneWhen(t: Trigger): string {
  if ('every' in t) return `every ${t.every}${t.at ? ` at ${t.at}` : ''}`
  if ('cron' in t) return `at the times ${t.cron}`
  if ('filed' in t) return 'when a document is filed'
  const tables = Array.isArray(t.changes) ? t.changes : [t.changes]
  return `when ${tables.join(' or ')} change${tables.length === 1 ? 's' : ''}`
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

export interface Schedule {
  id: string
  module: string
  name: string
  description: string | null
  file: string
  state: 'on' | 'paused'
  trigger: Trigger | Trigger[]
  runs: Runs
  cursor: string | null
  lastRunAt: string | null
}

export interface ScheduleFile {
  name: string
  description: string | null
  trigger: Trigger | Trigger[] | null
  runs: Runs
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
    runs: front.data.runs,
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
  const dir = join(module.dir, 'schedules')
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')) : []
  const kept = new Set<string>() // the ids of the schedules still there
  for (const f of files) {
    const a = readSchedule(join(dir, f))
    const byFile = all<{ id: string; name: string }>(
      world.db,
      'SELECT id, name FROM schedules WHERE module_id = ? AND file = ?',
      module.id,
      `schedules/${f}`,
    )[0]
    const known =
      (byFile && !kept.has(byFile.id) ? byFile : undefined) ??
      all<{ id: string; name: string }>(
        world.db,
        'SELECT id, name FROM schedules WHERE module_id = ? AND name = ?',
        module.id,
        a.name,
      ).find((x) => !kept.has(x.id))
    if (known) {
      kept.add(known.id)
      run(
        world.db,
        'UPDATE schedules SET name = ?, file = ?, trigger = ?, runs = ?, description = ? WHERE id = ?',
        a.name,
        `schedules/${f}`,
        json(a.trigger),
        json(a.runs),
        a.description,
        known.id,
      )
      if (known.name !== a.name)
        world.line({
          actor: { kind: 'system' },
          kind: 'shaped',
          words: `${known.name} is now called ${a.name}.`,
          data: { schedule: known.id, from: known.name, to: a.name },
          module: module.id,
        })
    } else {
      const id = newId('a')
      kept.add(id)
      run(
        world.db,
        'INSERT INTO schedules (id, module_id, name, file, state, trigger, runs, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        id,
        module.id,
        a.name,
        `schedules/${f}`,
        state,
        json(a.trigger),
        json(a.runs),
        a.description,
      )
    }
  }
  for (const a of all<{ id: string; name: string }>(
    world.db,
    'SELECT id, name FROM schedules WHERE module_id = ?',
    module.id,
  ))
    if (!kept.has(a.id)) {
      run(world.db, 'DELETE FROM schedules WHERE id = ?', a.id)
      // its rules go with it (core step 2); the journal keeps them
      world.rules.removeScoped({ schedule: a.name }, { actor: { kind: 'system' } })
    }
  return kept.size
}

interface ScheduleRow {
  id: string
  module_id: string
  name: string
  description: string | null
  file: string
  state: 'on' | 'paused'
  trigger: string
  runs: string
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
    name: r.name,
    file: r.file,
    state: r.state,
    description: r.description,
    trigger: JSON.parse(r.trigger) as Trigger | Trigger[],
    runs: JSON.parse(r.runs) as Runs,
    cursor: r.cursor,
    lastRunAt: r.last_run_at,
  }))
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
