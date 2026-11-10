// Making and changing agents (clean base step 7): the row in the world, and the folder that holds
// its instructions (AGENT.md), skills and files. The folder is a git repository, so every change
// shows, and a change to its instructions or a skill can be undone.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { parse } from 'yaml'
import { config } from '../config.ts'
import { type Agent, CHIEF, CHIEF_CARD } from '../world/agents/index.ts'
import { newId, one, run } from '../world/db.ts'
import { Refused } from '../world/kinds.ts'
import type { WriteCtx } from '../world/shape/index.ts'
import type { World } from '../world/world.ts'
import { commitAll, restoreFile } from './git.ts'
import { agentSchedules, syncAgentSchedules } from './schedules.ts'

export const INSTRUCTIONS = 'AGENT.md'
const BUILDER_MADE = 'builder_made'
const PLACES = ['skills/', 'files/']

export interface AgentDefinition {
  name?: string | undefined // to rename it
  title?: string | undefined
  description?: string | undefined
  instructions?: string | undefined
  model?: string | null | undefined
}

export function instructionsOf(world: World, id: string): string {
  const f = join(world.agents.dirOf(id), INSTRUCTIONS)
  return existsSync(f) ? readFileSync(f, 'utf8').trim() : ''
}

export function modelOf(model: string | null | undefined): string | null | undefined {
  if (model === undefined || model === null) return model
  const known = config.models().agents
  if (!known.includes(model))
    throw new Refused(`${model} is not a model an agent can use: ${known.join(', ')}.`)
  return model
}

// Reserved so nothing else can be taken for the Chief of staff.
function nameOf(name: string): string {
  const n = name.trim()
  if (!n) throw new Refused('An agent needs a name.')
  if (/^chief( of staff)?$/i.test(n)) throw new Refused('The Chief of staff already has that name.')
  return n
}

// Who may change an agent: itself, or the Chief of staff. Only the Chief of staff makes one.
function mayChange(by: string | null, target: Agent | undefined): void {
  if (!by) return
  if (!target) throw new Refused('Only the Chief of staff makes a new agent.')
  if (by !== target.id) throw new Refused('Only the Chief of staff changes another agent.')
}

// Makes the agent when no agent has that name, changes it when one does.
export async function keepAgent(
  world: World,
  name: string,
  def: AgentDefinition,
  ctx: WriteCtx,
  by: string | null, // the agent asking; none is the Chief of staff or a person
): Promise<string> {
  const known = world.agents.byName(name)
  mayChange(by, known)
  const model = modelOf(def.model)
  if (!known) {
    const title = def.title?.trim()
    const description = def.description?.trim()
    const instructions = def.instructions?.trim()
    if (!title || !description || !instructions)
      throw new Refused('A new agent needs a title, a description and its instructions.')
    const agent = world.agents.add({
      id: newId('ag'),
      name: nameOf(name),
      title,
      description,
      model: model ?? null,
      madeBy: ctx.user ?? null,
    })
    const dir = world.agents.dirOf(agent.id)
    writeFileSync(join(dir, INSTRUCTIONS), `${instructions}\n`)
    const commit = await commitAll(dir, `Made ${agent.name}`)
    world.line({
      actor: ctx.actor,
      kind: 'agent_made',
      words: `Made the agent ${agent.name}: ${title}.`,
      data: { made: agent.id, commit },
      user: ctx.user ?? null,
      turn: ctx.turn ?? null,
    })
    return `${agent.name} is made. It starts on its next message.`
  }
  const renamed = def.name?.trim() ? nameOf(def.name) : undefined
  if (renamed && renamed.toLowerCase() !== known.name.toLowerCase() && world.agents.byName(renamed))
    throw new Refused(`An agent is already called ${renamed}.`)
  world.agents.change(known.id, {
    ...(renamed ? { name: renamed } : {}),
    ...(def.title?.trim() ? { title: def.title.trim() } : {}),
    ...(def.description?.trim() ? { description: def.description.trim() } : {}),
    ...(model !== undefined ? { model } : {}),
  })
  const dir = world.agents.dirOf(known.id)
  let commit: string | null = null
  if (def.instructions?.trim()) {
    writeFileSync(join(dir, INSTRUCTIONS), `${def.instructions.trim()}\n`)
    commit = await commitAll(dir, 'Changed its instructions')
    if (commit) world.agents.touch(known.id)
  }
  world.line({
    actor: ctx.actor,
    kind: 'agent_changed',
    words: commit ? `Updated ${known.name}'s instructions.` : `Updated ${known.name}.`,
    data: { changed: known.id, ...(commit ? { commit, path: INSTRUCTIONS } : {}) },
    user: ctx.user ?? null,
    turn: ctx.turn ?? null,
  })
  return `${renamed ?? known.name} is updated. Its next message starts from this.`
}

// A skill or a file in the agent's own folder.
export async function keepAgentFile(
  world: World,
  name: string,
  path: string,
  content: string,
  ctx: WriteCtx,
  by: string | null,
): Promise<string> {
  const agent = name.trim() ? world.agents.byName(name) : undefined
  if (!agent) throw new Refused(`There is no agent called ${name}.`)
  mayChange(by, agent)
  const rel = normalize(path.trim()).replace(/^\.\//, '')
  if (
    rel.startsWith('/') ||
    rel.split('/').includes('..') ||
    rel.includes('/.git') ||
    !PLACES.some((p) => rel.startsWith(p) && rel.length > p.length)
  )
    throw new Refused(`An agent keeps files under ${PLACES.join(', ')}; ${path} is none of these.`)
  if (/^skills\/[^/]+\/SKILL\.md$/.test(rel)) {
    const front = /^---\n([\s\S]*?)\n---/.exec(content)
    const f = (front ? parse(front[1] as string) : null) as {
      name?: unknown
      description?: unknown
    } | null
    if (!f?.name || !f.description)
      throw new Refused(`${rel} needs front matter with a name and a description.`)
  }
  const dir = world.agents.dirOf(agent.id)
  const full = join(dir, rel)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
  const commit = await commitAll(dir, `Kept ${rel}`)
  const words = commit
    ? `Kept ${rel} in ${agent.name}'s folder.`
    : `${rel} was already kept as it is.`
  world.line({
    actor: ctx.actor,
    kind: 'agent_changed',
    words,
    data: { changed: agent.id, ...(commit ? { commit, path: rel } : {}) },
    user: ctx.user ?? null,
    turn: ctx.turn ?? null,
  })
  return words
}

// Undo of a change to its instructions or a skill: the file goes back to how it was before.
export async function undoAgentChange(
  world: World,
  id: string,
  commit: string,
  path: string,
  ctx: WriteCtx,
): Promise<string> {
  const agent = id === CHIEF ? CHIEF_CARD : world.agents.get(id)
  if (!agent) throw new Refused('That agent is not there.')
  const dir = world.agents.dirOf(id)
  await restoreFile(dir, commit, path)
  const done = await commitAll(dir, `Undid a change to ${path}`)
  if (!done) throw new Refused('That change is already undone.')
  if (path === INSTRUCTIONS) world.agents.touch(id)
  if (path.startsWith('schedules/')) syncAgentSchedules(world, id, ctx.user ?? null)
  const words = `Undid a change to ${agent.name}'s ${path === INSTRUCTIONS ? 'instructions' : path}.`
  world.line({
    actor: ctx.actor,
    kind: 'agent_changed',
    words,
    data: { changed: id, undid: commit, path },
    user: ctx.user ?? null,
    ...(id === CHIEF ? {} : { agent: id }),
  })
  return words
}

export function removeAgent(world: World, id: string, ctx: WriteCtx): void {
  if (id === CHIEF) throw new Refused('The Chief of staff is always here.')
  const agent = world.agents.get(id)
  if (!agent) throw new Refused('That agent is not there.')
  // what a module's schedule woke it for goes to the Chief of staff; its own go with it
  run(
    world.db,
    'UPDATE schedules SET agent = ? WHERE agent = ? AND module_id IS NOT NULL',
    CHIEF,
    id,
  )
  for (const s of agentSchedules(world, id)) {
    run(world.db, 'UPDATE runs SET schedule_id = NULL WHERE schedule_id = ?', s.id)
    run(world.db, 'DELETE FROM schedules WHERE id = ?', s.id)
    world.rules.removeScoped({ schedule: s.name }, { actor: ctx.actor })
  }
  world.agents.remove(id)
  rmSync(world.agents.dirOf(id), { recursive: true, force: true })
  world.line({
    actor: ctx.actor,
    kind: 'agent_removed',
    words: `Deleted the agent ${agent.name}. Its conversations stay in Activity.`,
    data: { removed: id },
    user: ctx.user ?? null,
  })
}

// The Module builder (Kenil, 10 Nov): made once in a world, from core/config/module-builder.md, and
// the person's to change or delete like any agent after that, so it never comes back on its own.
export async function keepBuilder(world: World, user: string): Promise<string | null> {
  if (one(world.db, 'SELECT 1 FROM meta WHERE key = ?', BUILDER_MADE)) return null
  const b = config.builder()
  if (!world.agents.byName(b.name))
    await keepAgent(
      world,
      b.name,
      { title: b.title, description: b.description, instructions: b.instructions },
      { actor: { kind: 'system' }, user },
      null,
    )
  // its id, so New module finds it whatever it is renamed to
  const id = world.agents.byName(b.name)?.id ?? ''
  run(world.db, 'INSERT INTO meta (key, value) VALUES (?, ?)', BUILDER_MADE, id)
  return `${b.name} is one of your agents.`
}

// The Module builder's id while it is there; none once the person deleted it.
export function builderId(world: World): string | null {
  const id = one<{ value: string }>(
    world.db,
    'SELECT value FROM meta WHERE key = ?',
    BUILDER_MADE,
  )?.value
  return id && world.agents.get(id) ? id : null
}
