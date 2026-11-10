// An agent's own schedules: a file each in its folder, with a small check beside it when the job
// is watching something. Made by the agent's tool or on its page. Each change is a commit in the
// agent's folder, so Undo works, and the journal says who made it.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Trigger } from '@alpha/kit-sdk'
import { Cron } from 'croner'
import { stringify } from 'yaml'
import { Refused } from '../world/kinds.ts'
import type { WriteCtx } from '../world/shape/index.ts'
import type { World } from '../world/world.ts'
import { commitAll } from './git.ts'
import type { ScheduleRunner } from './runs/index.ts'
import { checkAnswer, NOT_AN_ANSWER } from './runs/wake.ts'
import {
  agentName,
  agentSchedules,
  nextRun,
  readSchedule,
  type Schedule,
  syncAgentSchedules,
  whenWords,
} from './schedules.ts'

export interface ScheduleDef {
  name?: string | undefined
  when?: Trigger | undefined
  what?: string | undefined
  check?: string | null | undefined // its script; null takes it away
}

const slugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'schedule'

const scriptOf = (slug: string) => `checks/${slug}/check.js`

function fileText(name: string, when: Trigger | Trigger[], what: string, script: string | null) {
  const front = { name, trigger: when, wakes: true, ...(script ? { runs: { script } } : {}) }
  return `---\n${stringify(front)}---\n${what}\n`
}

function refuseWhen(world: World, when: Trigger): void {
  const read = Trigger.safeParse(when)
  if (!read.success) throw new Refused('That is not a time Alpha reads.')
  if ('cron' in when)
    try {
      new Cron(when.cron)
    } catch {
      throw new Refused(`"${when.cron}" is not a pattern Alpha reads.`)
    }
  if ('changes' in when)
    for (const t of Array.isArray(when.changes) ? when.changes : [when.changes])
      if (!world.shape.table(t)) throw new Refused(`There is no table called ${t}.`)
}

// The check kept in its own box and tried once: one that does not work is not kept.
async function keepCheck(
  world: World,
  runner: ScheduleRunner,
  agent: string,
  slug: string,
  name: string,
  code: string,
  ctx: WriteCtx,
): Promise<unknown> {
  const dir = world.agents.dirOf(agent)
  const box = join(dir, 'checks', slug)
  const script = join(dir, scriptOf(slug))
  const was = existsSync(script) ? readFileSync(script, 'utf8') : null
  mkdirSync(box, { recursive: true })
  // what a check remembers between runs is its own, and no version of it is kept
  writeFileSync(join(box, '.gitignore'), '*\n!check.js\n!.gitignore\n')
  writeFileSync(script, code)
  const undo = () => {
    if (was === null) rmSync(box, { recursive: true, force: true })
    else writeFileSync(script, was)
  }
  const place = { id: null, name: agentName(world, agent), dir, box }
  const out = await runner
    .runScript(place, scriptOf(slug), { lastRun: null }, name, null, {
      user: ctx.user ?? null,
      turn: ctx.turn ?? null,
    })
    .catch((err: unknown) => {
      undo()
      throw err
    })
  if (out.state !== 'ok') {
    undo()
    throw new Refused(`The check did not work, so nothing was kept. ${out.words}`)
  }
  const said = checkAnswer(out.result)
  if (!said) {
    undo()
    throw new Refused(`The check did not work, so nothing was kept: ${NOT_AN_ANSWER}.`)
  }
  return said
}

// The new state written down: its commit, its row, and a line that says so with Undo beside it.
async function saved(
  world: World,
  agent: string,
  rel: string,
  message: string,
  words: string,
  ctx: WriteCtx,
): Promise<void> {
  const commit = await commitAll(world.agents.dirOf(agent), message)
  syncAgentSchedules(world, agent, ctx.user ?? null)
  world.line({
    actor: ctx.actor,
    kind: 'agent_changed',
    words,
    data: { changed: agent, ...(commit ? { commit, path: rel } : {}) },
    user: ctx.user ?? null,
    turn: ctx.turn ?? null,
  })
}

export async function makeSchedule(
  world: World,
  runner: ScheduleRunner,
  agent: string,
  def: ScheduleDef,
  ctx: WriteCtx,
): Promise<{ name: string; when: string; next: string | null; check?: unknown }> {
  const name = def.name?.trim()
  const what = def.what?.trim()
  if (!name || !def.when || !what)
    throw new Refused('A schedule needs a name, when it runs and what to do.')
  refuseWhen(world, def.when)
  const mine = agentSchedules(world, agent)
  if (mine.some((a) => a.name.toLowerCase() === name.toLowerCase()))
    throw new Refused(`${agentName(world, agent)} already has a schedule called ${name}.`)
  let slug = slugOf(name)
  for (let n = 2; mine.some((a) => a.file === `schedules/${slug}.md`); n++)
    slug = `${slugOf(name)}-${n}`
  const tried = def.check
    ? await keepCheck(world, runner, agent, slug, name, def.check, ctx)
    : undefined
  const dir = world.agents.dirOf(agent)
  mkdirSync(join(dir, 'schedules'), { recursive: true })
  const rel = `schedules/${slug}.md`
  writeFileSync(join(dir, rel), fileText(name, def.when, what, def.check ? scriptOf(slug) : null))
  const when = whenWords(def.when)
  await saved(
    world,
    agent,
    rel,
    `Made the schedule ${name}`,
    `Made a schedule for ${agentName(world, agent)}: ${name}, ${when}.`,
    ctx,
  )
  return {
    name,
    when,
    next: nextRun(def.when, new Date().toISOString(), Date.now())?.toISOString() ?? null,
    ...(tried !== undefined ? { check: tried } : {}),
  }
}

export async function changeSchedule(
  world: World,
  runner: ScheduleRunner,
  s: Schedule,
  def: ScheduleDef,
  ctx: WriteCtx,
): Promise<{ name: string; when: string; check?: unknown }> {
  const agent = s.agent as string
  const dir = world.agents.dirOf(agent)
  const was = readSchedule(join(dir, s.file))
  if (def.when) refuseWhen(world, def.when)
  const name = def.name?.trim() || was.name
  const when = def.when ?? (was.trigger as Trigger | Trigger[])
  const what = def.what?.trim() || was.brief
  const slug = s.file.replace(/^schedules\/|\.md$/g, '')
  const tried = def.check
    ? await keepCheck(world, runner, agent, slug, name, def.check, ctx)
    : undefined
  if (def.check === null) rmSync(join(dir, 'checks', slug), { recursive: true, force: true })
  const script = def.check ? scriptOf(slug) : def.check === null ? null : (was.runs?.script ?? null)
  writeFileSync(join(dir, s.file), fileText(name, when, what, script))
  await saved(
    world,
    agent,
    s.file,
    `Changed the schedule ${name}`,
    `Changed ${agentName(world, agent)}'s schedule ${name}: ${whenWords(when)}.`,
    ctx,
  )
  return { name, when: whenWords(when), ...(tried !== undefined ? { check: tried } : {}) }
}

export async function removeSchedule(world: World, s: Schedule, ctx: WriteCtx): Promise<void> {
  const agent = s.agent as string
  const dir = world.agents.dirOf(agent)
  rmSync(join(dir, s.file), { force: true })
  const slug = s.file.replace(/^schedules\/|\.md$/g, '')
  rmSync(join(dir, 'checks', slug), { recursive: true, force: true })
  await saved(
    world,
    agent,
    s.file,
    `Removed the schedule ${s.name}`,
    `Removed ${agentName(world, agent)}'s schedule ${s.name}.`,
    ctx,
  )
}
