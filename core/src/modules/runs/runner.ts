// The schedule runner: a schedule's script run in its sandbox, serving its module. A run is
// a row; its steps are journal lines carrying its id; it reaches the person's stream only as a
// card. The runner's pieces are the files beside this one: the walls, what a script may reach,
// the `alpha` it is handed, what is due.
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type { BrowserEngine } from '@alpha/connector-sdk'
import type { Trigger } from '@alpha/kit-sdk'
import { config } from '../../config.ts'
import { askModel } from '../../engine/ask.ts'
import type { Ask } from '../../files/reading.ts'
import { runScript, type ScriptRun } from '../../scripts/run.ts'
import { CHIEF, CHIEF_CARD } from '../../world/agents/index.ts'
import { all, run as exec, json, newId, now, one, parse } from '../../world/db.ts'
import { Refused } from '../../world/kinds.ts'
import type { World } from '../../world/world.ts'
import type { Drafts } from '../drafts.ts'
import { Reviews } from '../reviews.ts'
import { type Runs, type Schedule, type ScheduleFile, schedules } from '../schedules.ts'
import * as apiOf from './api.ts'
import * as dueOf from './due.ts'
import * as reachOf from './reach.ts'
import {
  type Filed,
  type RunFor,
  type RunOutcome,
  type RunPlace,
  type RunRow,
  type RunRowDb,
  toRun,
} from './types.ts'
import { wake } from './wake.ts'
import * as wallsOf from './walls.ts'
import { unmetNeeds, type Walls } from './walls.ts'

export class ScheduleRunner {
  world: World
  engine: () => BrowserEngine
  running = new Map<string, AbortController>()
  notify: () => void
  owner: string | null
  ask: Ask
  judgeAsk: Ask
  tokens = new Map<string, number>() // a run's model tokens, while it runs
  budgetSaid = new Map<string, number>() // when a schedule's runs budget was last said
  // the schedules' own lane (item 15): the minute tick starts the due runs and goes on; while they
  // run, the next tick leaves them alone, so reminders and the backup keep the minute
  lane: Promise<void> | null = null
  failures = new Map<string, number>() // a schedule's runs that did not finish, in a row
  held = new Map<string, string>() // schedules waiting on a Try again card, by the card's id
  drafts: Drafts | null = null // a schedule's drafts, sent from the person's mail on their yes
  give: ((by: string, task: string) => void) | null = null // a task handed to its agent
  readonly reviews: Reviews // rows a schedule puts to the person, on a card

  constructor(
    world: World,
    engine: () => BrowserEngine,
    options: {
      notify?: () => void
      owner?: string | null
      ask?: Ask // the model reading a document
      judge?: Ask // the model sorting items into the person's groups
    } = {},
  ) {
    this.world = world
    this.engine = engine
    this.notify = options.notify ?? (() => {})
    this.owner = options.owner ?? null
    this.ask = options.ask ?? askModel(world.paths.dir)
    this.judgeAsk =
      options.judge ?? options.ask ?? askModel(world.paths.dir, undefined, () => config.judging())
    this.reviews = new Reviews(world, this.owner)
    this.endOrphans()
  }

  // The rest of the runner lives in the files beside this one, each a function of it.

  reach(module: RunPlace, url: string, runId: string, who: RunFor): void {
    reachOf.reach(this, module, url, runId, who)
  }

  wantsSignIn(
    module: RunPlace,
    url: string,
    label: string,
    runId: string,
    scheduleId: string | null,
    who: RunFor,
  ): void {
    reachOf.wantsSignIn(this, module, url, label, runId, scheduleId, who)
  }

  async browse<T>(
    module: RunPlace,
    url: string,
    label: string,
    runId: string,
    scheduleId: string | null,
    who: RunFor,
    read: () => Promise<T>,
  ): Promise<T> {
    return reachOf.browse(this, module, url, label, runId, scheduleId, who, read)
  }

  api(
    module: RunPlace,
    label: string,
    runId: string,
    who: RunFor,
    scheduleId: string | null,
    walls: Walls | null = null,
  ) {
    return apiOf.api(this, module, label, runId, who, scheduleId, walls)
  }

  fileOf(scheduleId: string, module: RunPlace): ScheduleFile | null {
    return wallsOf.fileOf(this, scheduleId, module)
  }

  wallsFor(module: RunPlace, file: ScheduleFile): Walls {
    return wallsOf.wallsFor(this, module, file)
  }

  wallsForTry(module: RunPlace): Walls {
    return wallsOf.wallsForTry(this, module)
  }

  overRuns(a: Schedule, file: ScheduleFile, nowMs: number): boolean {
    return wallsOf.overRuns(this, a, file, nowMs)
  }

  async runDue(nowMs = Date.now()): Promise<void> {
    return dueOf.runDue(this, nowMs)
  }
  // The due runs started in the schedules' own lane: back at once, the runs going on behind.
  startDue(nowMs = Date.now()): void {
    if (this.lane) return
    this.lane = dueOf
      .runDue(this, nowMs)
      .catch(() => undefined)
      .finally(() => {
        this.lane = null
      })
  }
  // The person's Try again on the card: one more run now, the count reset.
  async retry(scheduleId: string, who: RunFor): Promise<RunOutcome> {
    const a = schedules(this.world).find((x) => x.id === scheduleId)
    if (!a) throw new Refused('That schedule is not there any more.')
    this.failures.delete(a.id)
    this.held.delete(a.id)
    return this.runSchedule(a, who, {}, { asked: true })
  }
  // The person's Leave it: what the schedule was handed is left behind, as if it had run.
  leave(scheduleId: string, cursor: string | null): void {
    this.failures.delete(scheduleId)
    this.held.delete(scheduleId)
    exec(
      this.world.db,
      'UPDATE schedules SET cursor = coalesce(?, cursor), last_run_at = ? WHERE id = ?',
      cursor,
      now(),
      scheduleId,
    )
  }

  due(a: Schedule, nowMs: number): false | { filed?: Filed[] } {
    return dueOf.due(this, a, nowMs)
  }

  isDue(a: Schedule, nowMs: number): boolean | { filed: Filed[] } {
    return dueOf.isDue(this, a, nowMs)
  }

  isDueBy(a: Schedule, t: Trigger, nowMs: number, seen: number): boolean | { filed: Filed[] } {
    return dueOf.isDueBy(this, a, t, nowMs, seen)
  }
  // One script of a module, run now: a schedule's, or a skill's when trying it out.
  async runScript(
    module: RunPlace,
    script: string,
    input: unknown,
    label: string,
    scheduleId: string | null,
    who: RunFor = { user: null, turn: null },
  ): Promise<RunOutcome> {
    const path = resolve(module.dir, script)
    if (!path.startsWith(`${module.dir}/`) || !existsSync(path))
      throw new Refused(`${module.name} has no script ${script}.`)
    const runId = newId('n')
    // a schedule's run keeps to its file: what it touches, reads and may do, within its budget; a
    // try from the chat keeps to its module (item 40, 25 Oct)
    const file = scheduleId ? this.fileOf(scheduleId, module) : null
    const walls = file ? this.wallsFor(module, file) : scheduleId ? null : this.wallsForTry(module)
    exec(
      this.world.db,
      "INSERT INTO runs (id, schedule_id, module_id, started_at, state) VALUES (?, ?, ?, ?, 'running')",
      runId,
      scheduleId,
      module.id,
      now(),
    )
    const missing = file ? unmetNeeds(this.world, file) : []
    if (missing.length) {
      const words = `${label} did not run: it needs ${missing.join(' and ')}.`
      exec(
        this.world.db,
        'UPDATE runs SET ended_at = ?, state = ?, words = ?, data = ? WHERE id = ?',
        now(),
        'failed',
        words,
        json({ skipped: true }),
        runId,
      )
      this.world.line({
        actor: { kind: 'schedule', id: label },
        kind: 'run_ended',
        words,
        data: { state: 'failed', skipped: true },
        run: runId,
        module: module.id,
      })
      this.notify()
      return { id: runId, state: 'failed', words, result: null }
    }
    this.world.line({
      actor: { kind: 'schedule', id: label },
      kind: 'run_started',
      words: `${label} started.`,
      run: runId,
      module: module.id,
    })
    this.notify()
    const stop = new AbortController()
    this.running.set(runId, stop)
    // the minutes of its budget: past them the script is killed and the run says so
    let overBudget = false
    const minutes = file?.budget.minutes ?? null
    const timer =
      minutes !== null
        ? setTimeout(() => {
            overBudget = true
            stop.abort()
          }, minutes * 60_000)
        : null
    let out: ScriptRun
    try {
      out = await runScript({
        script: path,
        moduleDir: module.box ?? module.dir,
        input,
        api: this.api(module, label, runId, who, scheduleId, walls),
        signal: stop.signal,
      })
    } catch (err) {
      // a throw before or around the script (the sandbox not starting, a folder gone) ends the
      // run as failed, never leaves it running (item 14 of the problems list, 25 Oct)
      out = {
        result: null,
        error: err instanceof Error ? err.message : String(err),
        stderr: '',
        stopped: false,
      }
    } finally {
      if (timer) clearTimeout(timer)
      this.running.delete(runId)
    }
    const state: RunOutcome['state'] = out.stopped ? 'stopped' : out.error ? 'failed' : 'ok'
    const said =
      out.result && typeof out.result === 'object' && 'words' in out.result
        ? String((out.result as { words: unknown }).words)
        : null
    const words =
      state === 'stopped'
        ? overBudget
          ? `${label} was stopped at ${minutes} minute${minutes === 1 ? '' : 's'}, its budget.`
          : `${label} was stopped.`
        : out.error
          ? `${label} did not finish: ${out.error}`
          : said
            ? `${label}: ${said}`
            : `${label} finished.`
    const tokens = this.tokens.get(runId) ?? null
    this.tokens.delete(runId)
    exec(
      this.world.db,
      'UPDATE runs SET ended_at = ?, state = ?, words = ?, data = ? WHERE id = ?',
      now(),
      state,
      words,
      json({ result: out.result, stderr: out.stderr.slice(-4000), tokens }),
      runId,
    )
    // a run that did not finish leaves the schedule due, so it is tried again (item 16)
    if (scheduleId && state === 'ok')
      exec(this.world.db, 'UPDATE schedules SET last_run_at = ? WHERE id = ?', now(), scheduleId)
    this.world.line({
      actor: { kind: 'schedule', id: label },
      kind: 'run_ended',
      words,
      data: { state },
      run: runId,
      module: module.id,
    })
    this.notify()
    return { id: runId, state, words, result: out.result }
  }

  // One run of a schedule at a time, whoever asks (two could send the same email twice); a paused
  // schedule runs only when the person asked for it now (Run now, the desk's run), never on its own
  // or on a follow-up (items 9 and 10 of the problems list, 24 Oct).
  // Why a schedule cannot run now, as a refusal: asked before a run starts (Run now says it at
  // once), and again by the run itself.
  refuseRun(schedule: Schedule, options: { asked?: boolean } = {}): RunPlace {
    const module = this.placeOf(schedule)
    if (!module) throw new Refused('That schedule’s module is not there.')
    if (this.world.tasks.openOfSchedule(schedule.id))
      throw new Refused(
        `${schedule.name} is still on its last run; it runs again when that one is finished.`,
      )
    if (
      one(
        this.world.db,
        "SELECT 1 FROM runs WHERE schedule_id = ? AND state = 'running'",
        schedule.id,
      )
    )
      throw new Refused(
        `${schedule.name} is busy with another run; it runs again when that one ends.`,
      )
    if (schedule.state !== 'on' && !options.asked)
      throw new Refused(
        `${schedule.name} is paused; turn it on in Settings, or run it now yourself.`,
      )
    return module
  }

  async runSchedule(
    schedule: Schedule,
    who?: RunFor,
    given: object = {},
    options: { asked?: boolean } = {},
  ): Promise<RunOutcome> {
    const module = this.refuseRun(schedule, options)
    if (schedule.agent) return wake(this, schedule, module, who, given, options)
    const runs = schedule.runs as Runs
    // what became of its drafts since its last run
    const decided =
      this.drafts?.outcomes(schedule.name, module.id as string, schedule.lastRunAt) ?? []
    return this.runScript(
      module,
      runs.script,
      {
        ...(runs.input ?? {}),
        ...given,
        ...(decided.length ? { decided } : {}),
        // when it last ran, so it can look at what is new since
        lastRun: schedule.lastRunAt,
      },
      schedule.name,
      schedule.id,
      who,
    )
  }

  // Where a schedule's script runs from: its module, or its agent's folder.
  placeOf(s: Schedule): RunPlace | null {
    if (s.module) return this.world.shape.module(s.module) ?? null
    if (!s.agent) return null
    const name = s.agent === CHIEF ? CHIEF_CARD.name : this.world.agents.get(s.agent)?.name
    if (!name) return null
    const dir = this.world.agents.dirOf(s.agent)
    return { id: null, name, dir, ...(s.runs ? { box: dirname(join(dir, s.runs.script)) } : {}) }
  }

  // A run with no script of its own, already over: its schedule woke the agent straight away.
  openRun(s: Schedule, words: string): string {
    const id = newId('n')
    const at = now()
    exec(
      this.world.db,
      "INSERT INTO runs (id, schedule_id, module_id, started_at, ended_at, state, words) VALUES (?, ?, ?, ?, ?, 'ok', ?)",
      id,
      s.id,
      s.module,
      at,
      at,
      words,
    )
    exec(this.world.db, 'UPDATE schedules SET last_run_at = ? WHERE id = ?', at, s.id)
    return id
  }

  // What a finished run came to: its words and a little more in its row.
  noteRun(id: string, words: string, data: Record<string, unknown>, state?: 'failed'): void {
    const was = one<RunRowDb>(this.world.db, 'SELECT * FROM runs WHERE id = ?', id)
    exec(
      this.world.db,
      'UPDATE runs SET words = ?, data = ?, state = coalesce(?, state) WHERE id = ?',
      words,
      json({ ...parse<Record<string, unknown>>(was?.data ?? '{}', {}), ...data }),
      state ?? null,
      id,
    )
    this.notify()
  }

  // A run stopped by the person: the one running here is told; a row left running by a core
  // that stopped (nothing runs it now) is ended as stopped, so Stop always does what it says.
  stop(runId: string): boolean {
    const c = this.running.get(runId)
    if (c) {
      c.abort()
      return true
    }
    const row = this.runs(1000).find((r) => r.id === runId && r.state === 'running')
    if (!row) return false
    this.end(row, 'stopped', `${this.labelOf(row)} was stopped.`)
    return true
  }

  // The runs a core that stopped left running (a crash, a restore): nothing runs them now, so
  // each ends as failed with its words, at the next start, rather than showing as running for ever.
  private endOrphans(): void {
    for (const row of this.runs(1000).filter((r) => r.state === 'running'))
      this.end(row, 'failed', `${this.labelOf(row)} was cut short when the core stopped.`)
  }

  private labelOf(row: RunRow): string {
    const a = row.schedule
      ? all<{ name: string }>(
          this.world.db,
          'SELECT name FROM schedules WHERE id = ?',
          row.schedule,
        )[0]
      : undefined
    return a?.name ?? 'A try'
  }

  private end(row: RunRow, state: 'failed' | 'stopped', words: string): void {
    exec(
      this.world.db,
      'UPDATE runs SET ended_at = ?, state = ?, words = ? WHERE id = ? AND state = ?',
      now(),
      state,
      words,
      row.id,
      'running',
    )
    this.world.line({
      actor: { kind: 'schedule', id: this.labelOf(row) },
      kind: 'run_ended',
      words,
      data: { state },
      run: row.id,
      module: row.module,
    })
    this.notify()
  }

  runsOf(schedule: string, limit: number): RunRow[] {
    return all<RunRowDb>(
      this.world.db,
      'SELECT * FROM runs WHERE schedule_id = ? ORDER BY started_at DESC LIMIT ?',
      schedule,
      limit,
    ).map(toRun)
  }

  runs(limit = 50): RunRow[] {
    return all<RunRowDb>(
      this.world.db,
      'SELECT * FROM runs ORDER BY started_at DESC LIMIT ?',
      limit,
    ).map(toRun)
  }
}
