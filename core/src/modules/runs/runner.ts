// The agent runner (design §11): an agent's script run in its sandbox, serving its module. A run is
// a row; its steps are journal lines carrying its id; it reaches the person's stream only as a
// card. The runner's pieces are the files beside this one: the walls, what a script may reach,
// the `alpha` it is handed, agents on tasks, what is due.
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { BrowserEngine } from '@alpha/connector-sdk'
import type { Trigger } from '@alpha/kit-sdk'
import { config } from '../../config.ts'
import { askModel } from '../../engine/ask.ts'
import type { Ask } from '../../files/reading.ts'
import { runScript, type ScriptRun } from '../../scripts/run.ts'
import type { Card } from '../../world/cards.ts'
import { all, run as exec, json, newId, now, one } from '../../world/db.ts'
import { Refused } from '../../world/kinds.ts'
import type { Module } from '../../world/shape/index.ts'
import type { Task, TaskInput } from '../../world/tasks/index.ts'
import type { World } from '../../world/world.ts'
import { type Agent, type AgentFile, agents } from '../agents.ts'
import type { Drafts } from '../drafts.ts'
import { Reviews } from '../reviews.ts'
import * as apiOf from './api.ts'
import * as dueOf from './due.ts'
import * as reachOf from './reach.ts'
import * as tasksOf from './tasks.ts'
import {
  type Filed,
  type ProposedTask,
  type RunFor,
  type RunOutcome,
  type RunRow,
  type RunRowDb,
  toRun,
} from './types.ts'
import * as wallsOf from './walls.ts'
import { unmetNeeds, type Walls } from './walls.ts'

export class AgentRunner {
  world: World
  engine: () => BrowserEngine
  running = new Map<string, AbortController>()
  notify: () => void
  owner: string | null
  ask: Ask
  judgeAsk: Ask
  tokens = new Map<string, number>() // a run's model tokens, while it runs
  budgetSaid = new Map<string, number>() // when an agent's runs budget was last said
  // the agents' own lane (item 15): the minute tick starts the due runs and goes on; while they
  // run, the next tick leaves them alone, so reminders and the backup keep the minute
  lane: Promise<void> | null = null
  failures = new Map<string, number>() // an agent's runs that did not finish, in a row
  held = new Map<string, string>() // agents waiting on a Try again card, by the card's id
  drafts: Drafts | null = null // an agent's drafts, sent from the person's mail on their yes
  readonly reviews: Reviews // rows an agent puts to the person, on a card

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

  reach(module: Module, url: string, runId: string, who: RunFor): void {
    reachOf.reach(this, module, url, runId, who)
  }

  wantsSignIn(
    module: Module,
    url: string,
    label: string,
    runId: string,
    agentId: string | null,
    who: RunFor,
  ): void {
    reachOf.wantsSignIn(this, module, url, label, runId, agentId, who)
  }

  async browse<T>(
    module: Module,
    url: string,
    label: string,
    runId: string,
    agentId: string | null,
    who: RunFor,
    read: () => Promise<T>,
  ): Promise<T> {
    return reachOf.browse(this, module, url, label, runId, agentId, who, read)
  }

  api(
    module: Module,
    label: string,
    runId: string,
    who: RunFor,
    agentId: string | null,
    walls: Walls | null = null,
  ) {
    return apiOf.api(this, module, label, runId, who, agentId, walls)
  }

  serving(who: RunFor): Task | null {
    return tasksOf.serving(this, who)
  }

  asInput(p: ProposedTask, agentId: string | null): TaskInput {
    return tasksOf.asInput(this, p, agentId)
  }

  settle(
    task: string,
    state: RunOutcome['state'],
    words: string,
    label: string,
    runId: string,
  ): void {
    tasksOf.settle(this, task, state, words, label, runId)
  }

  taskInput(t: Task) {
    return tasksOf.taskInput(this, t)
  }

  startTask(id: string, who: RunFor): { run: Promise<RunOutcome> } {
    return tasksOf.startTask(this, id, who)
  }

  resumeTasks(): void {
    tasksOf.resumeTasks(this)
  }

  proposedView(card: Card): {
    agent: string
    tasks: {
      title: string
      notes: string | null
      due: string | null
      priority: 'high' | 'normal' | 'low'
      place: string
      owner: string
    }[]
  } | null {
    return tasksOf.proposedView(this, card)
  }

  adopt(cardId: string, take: number[] | 'all', user: string): Card {
    return tasksOf.adopt(this, cardId, take, user)
  }

  runsOf(task: string): RunRow[] {
    return tasksOf.runsOf(this, task)
  }

  fileOf(agentId: string, module: Module): AgentFile | null {
    return wallsOf.fileOf(this, agentId, module)
  }

  wallsFor(module: Module, file: AgentFile): Walls {
    return wallsOf.wallsFor(this, module, file)
  }

  overRuns(a: Agent, file: AgentFile, nowMs: number): boolean {
    return wallsOf.overRuns(this, a, file, nowMs)
  }

  async runDue(nowMs = Date.now()): Promise<void> {
    return dueOf.runDue(this, nowMs)
  }
  // The due runs started in the agents' own lane: back at once, the runs going on behind.
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
  async retry(agentId: string, who: RunFor): Promise<RunOutcome> {
    const a = agents(this.world).find((x) => x.id === agentId)
    if (!a) throw new Refused('That agent is not there any more.')
    this.failures.delete(a.id)
    this.held.delete(a.id)
    return this.runAgent(a, who, {}, { asked: true })
  }
  // The person's Leave it: what the agent was handed is left behind, as if it had run.
  leave(agentId: string, cursor: string | null): void {
    this.failures.delete(agentId)
    this.held.delete(agentId)
    exec(
      this.world.db,
      'UPDATE agents SET cursor = coalesce(?, cursor), last_run_at = ? WHERE id = ?',
      cursor,
      now(),
      agentId,
    )
  }

  due(a: Agent, nowMs: number): false | { filed?: Filed[] } {
    return dueOf.due(this, a, nowMs)
  }

  isDue(a: Agent, nowMs: number): boolean | { filed: Filed[] } {
    return dueOf.isDue(this, a, nowMs)
  }

  isDueBy(a: Agent, t: Trigger, nowMs: number, seen: number): boolean | { filed: Filed[] } {
    return dueOf.isDueBy(this, a, t, nowMs, seen)
  }
  // One script of a module, run now: an agent's, or a skill's when trying it out.
  async runScript(
    module: Module,
    script: string,
    input: unknown,
    label: string,
    agentId: string | null,
    who: RunFor = { user: null, turn: null },
  ): Promise<RunOutcome> {
    const path = resolve(module.dir, script)
    if (!path.startsWith(`${module.dir}/`) || !existsSync(path))
      throw new Refused(`${module.name} has no script ${script}.`)
    const runId = newId('n')
    // an agent's run keeps to its file: what it touches, reads and may do, within its budget
    const file = agentId ? this.fileOf(agentId, module) : null
    const walls = file ? this.wallsFor(module, file) : null
    exec(
      this.world.db,
      "INSERT INTO runs (id, agent_id, module_id, started_at, state, task_id) VALUES (?, ?, ?, ?, 'running', ?)",
      runId,
      agentId,
      module.id,
      now(),
      who.task ?? null,
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
        actor: { kind: 'agent', id: label },
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
      actor: { kind: 'agent', id: label },
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
        moduleDir: module.dir,
        input,
        api: this.api(module, label, runId, who, agentId, walls),
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
    // a run that did not finish leaves the agent due, so it is tried again (item 16)
    if (agentId && state === 'ok')
      exec(this.world.db, 'UPDATE agents SET last_run_at = ? WHERE id = ?', now(), agentId)
    this.world.line({
      actor: { kind: 'agent', id: label },
      kind: 'run_ended',
      words,
      data: { state, ...(who.task ? { task: who.task } : {}) },
      run: runId,
      module: module.id,
    })
    if (who.task) this.settle(who.task, state, words, label, runId)
    this.notify()
    return { id: runId, state, words, result: out.result }
  }

  // One run of an agent at a time, whoever asks (two could send the same email twice); a paused
  // agent runs only when the person asked for it now (Run now, the desk's run), never on its own
  // or on a follow-up (items 9 and 10 of the problems list, 24 Oct).
  async runAgent(
    agent: Agent,
    who?: RunFor,
    given: object = {},
    options: { asked?: boolean } = {},
  ): Promise<RunOutcome> {
    const module = this.world.shape.module(agent.module)
    if (!module) throw new Refused('That agent’s module is not there.')
    if (one(this.world.db, "SELECT 1 FROM runs WHERE agent_id = ? AND state = 'running'", agent.id))
      throw new Refused(`${agent.name} is busy with another run; it runs again when that one ends.`)
    if (agent.state !== 'on' && !options.asked)
      throw new Refused(`${agent.name} is paused; turn it on in Settings, or run it now yourself.`)
    // what became of its drafts since its last run
    const decided = this.drafts?.outcomes(agent.name, module.id, agent.lastRunAt) ?? []
    return this.runScript(
      module,
      agent.runs.script,
      {
        ...(agent.runs.input ?? {}),
        ...given,
        ...(decided.length ? { decided } : {}),
        // when it last ran, so it can look at what is new since
        lastRun: agent.lastRunAt,
      },
      agent.name,
      agent.id,
      who,
    )
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
    const a = row.agent
      ? all<{ name: string }>(this.world.db, 'SELECT name FROM agents WHERE id = ?', row.agent)[0]
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
      actor: { kind: 'agent', id: this.labelOf(row) },
      kind: 'run_ended',
      words,
      data: { state },
      run: row.id,
      module: row.module,
    })
    this.notify()
  }

  runs(limit = 50): RunRow[] {
    return all<RunRowDb>(
      this.world.db,
      'SELECT * FROM runs ORDER BY started_at DESC LIMIT ?',
      limit,
    ).map(toRun)
  }
}
