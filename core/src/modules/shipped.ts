// Agents that ship: Alpha's own, from core/agents/, and a kit's, from its agents/ folder (kit API
// 3). One comes in by its lasting key and changes only with its source, since the next update
// would undo a change made here (docs/rules.md G1). An update keeps what is the firm's: its
// memories, conversations, the files it kept itself and the model the person picked (G2). One the
// firm deleted stays deleted.
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { readAgents, type ShippedAgent } from '@alpha/kit-sdk'
import { config } from '../config.ts'
import type { Agent } from '../world/agents/index.ts'
import { newId, one, run } from '../world/db.ts'
import { Refused } from '../world/kinds.ts'
import type { WriteCtx } from '../world/shape/index.ts'
import type { World } from '../world/world.ts'
import { commitAll } from './git.ts'
import { walk } from './kits/read.ts'
import { syncAgentSchedules } from './schedules.ts'

export const ALPHA = 'alpha'
export const CORE_AGENTS = join(import.meta.dirname, '..', '..', 'agents')
export const BUILDER_KEY = 'module-builder'
// the files under files/ its source brought, so an update can take back what it drops
const SHIPPED = '.shipped.json'
const gone = (source: string, key: string) => `agent_gone:${source}:${key}`

export interface Source {
  id: string // ALPHA, or the kit's module id
  label: string // "Alpha", or the kit's name and version
  on: boolean // whether a schedule it brings starts on
}

export interface From {
  kind: 'alpha' | 'kit' | 'here'
  label: string // "Alpha", "Sourcing 0.2.0", "Made here"
  name: string | null // the kit's name, or Alpha
}

// Where an agent came from, as the person reads it.
export function fromOf(world: World, agent: Pick<Agent, 'source'> | undefined): From {
  if (!agent?.source) return { kind: 'here', label: 'Made here', name: null }
  if (agent.source === ALPHA) return { kind: 'alpha', label: 'Alpha', name: 'Alpha' }
  const k = one<{ kit: string; version: string }>(
    world.db,
    'SELECT kit, version FROM kits WHERE module_id = ?',
    agent.source,
  )
  return k
    ? { kind: 'kit', label: `${k.kit} ${k.version}`, name: k.kit }
    : { kind: 'here', label: 'Made here', name: null }
}

// The same, with the kit's module, as the window reads it; the Chief of staff is Alpha's.
export function fromView(world: World, a: Pick<Agent, 'source'> | undefined | 'chief') {
  if (a === 'chief')
    return { kind: 'alpha' as const, label: 'Alpha', name: 'Alpha', module: null as string | null }
  return { ...fromOf(world, a), module: a?.source && a.source !== ALPHA ? a.source : null }
}

// Why a shipped agent's definition cannot change here, or nothing for one made here.
export function shippedRefusal(world: World, agent: Agent | undefined): string | null {
  const from = fromOf(world, agent)
  if (!agent || from.kind === 'here') return null
  return `${agent.name} comes with ${from.name}, so its instructions, skills and schedules change only with ${from.name}'s updates, which would undo a change made here. Add to it through its memories or How to work, or make an agent of your own from it.`
}

export function refuseShipped(world: World, agent: Agent | undefined): void {
  const why = shippedRefusal(world, agent)
  if (why) throw new Refused(why)
}

// A shipped agent the firm deleted: remembered by its key, so its source does not bring it back.
export function markGone(world: World, agent: Agent): void {
  if (!agent.source || !agent.key) return
  run(
    world.db,
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING',
    gone(agent.source, agent.key),
    agent.id,
  )
}

// What a source's agents would clash with, before anything is installed: a name taken by an
// agent that is not this source's, refused in words naming both.
export function refuseClashes(world: World, root: string, source: string | null, label: string) {
  for (const a of readAgents(root)) {
    if (typeof a === 'string') throw new Refused(a)
    const known = source ? world.agents.shipped(source, a.key) : undefined
    const other = world.agents.byName(a.head.name)
    if (other && other.id !== known?.id)
      throw new Refused(
        `${label} brings an agent called ${a.head.name}, and ${other.name} is already here: rename yours first.`,
      )
  }
}

// Every agent a source carries, made or brought up to date; what happened, in words.
export async function keepShippedAgents(
  world: World,
  root: string,
  source: Source,
  ctx: WriteCtx,
): Promise<string[]> {
  const said: string[] = []
  for (const a of readAgents(root)) {
    if (typeof a === 'string') throw new Refused(a)
    if (one(world.db, 'SELECT 1 FROM meta WHERE key = ?', gone(source.id, a.key))) continue
    const known = world.agents.shipped(source.id, a.key)
    const out = known
      ? await refresh(world, known, a, source, ctx)
      : await bring(world, a, source, ctx)
    if (out) said.push(out)
  }
  return said
}

// Alpha's own agents, at every start: made where missing, brought up to date where changed.
export function keepAlphaAgents(world: World, ctx: WriteCtx, dir = CORE_AGENTS) {
  return keepShippedAgents(world, dir, { id: ALPHA, label: 'Alpha', on: true }, ctx)
}

function modelOf(model: string | undefined): string | null {
  if (!model) return null
  if (!config.models().agents.includes(model))
    throw new Refused(`${model} is not a model an agent can use.`)
  return model
}

async function bring(world: World, a: ShippedAgent, source: Source, ctx: WriteCtx) {
  if (world.agents.byName(a.head.name))
    throw new Refused(
      `${source.label} brings an agent called ${a.head.name}, and one is already here: rename yours first.`,
    )
  const agent = world.agents.add({
    id: newId('ag'),
    name: a.head.name,
    title: a.head.title,
    description: a.head.description,
    model: modelOf(a.head.model),
    madeBy: null,
    source: source.id,
    key: a.key,
  })
  const dir = copyIn(world, agent.id, a)
  syncAgentSchedules(world, agent.id, ctx.user ?? null, source.on ? 'on' : 'paused')
  const commit = await commitAll(dir, `From ${source.label}`)
  world.line({
    actor: ctx.actor,
    kind: 'agent_made',
    words: `${agent.name} came with ${source.label}: ${agent.title}.`,
    data: { made: agent.id, commit, source: source.id, key: a.key },
    user: ctx.user ?? null,
    turn: ctx.turn ?? null,
  })
  return `${agent.name} came with ${source.label}.`
}

async function refresh(
  world: World,
  known: Agent,
  a: ShippedAgent,
  source: Source,
  ctx: WriteCtx,
): Promise<string | null> {
  // its name follows the source unless that name is taken here; its model stays the person's
  const free =
    !world.agents.byName(a.head.name) || a.head.name.toLowerCase() === known.name.toLowerCase()
  world.agents.change(known.id, {
    ...(free ? { name: a.head.name } : {}),
    title: a.head.title,
    description: a.head.description,
  })
  const dir = copyIn(world, known.id, a)
  syncAgentSchedules(world, known.id, ctx.user ?? null, source.on ? 'on' : 'paused')
  const commit = await commitAll(dir, `From ${source.label}`)
  if (!commit) return null
  world.agents.touch(known.id)
  const name = free ? a.head.name : known.name
  world.line({
    actor: ctx.actor,
    kind: 'agent_changed',
    words: `Updated ${name} from ${source.label}.`,
    data: { changed: known.id, commit, source: source.id, key: a.key },
    user: ctx.user ?? null,
    turn: ctx.turn ?? null,
  })
  return `Updated ${name} from ${source.label}.`
}

// The source's instructions, skills and schedules in place of what was there; under files/, what
// it brought before and dropped goes, and what the agent kept itself stays.
function copyIn(world: World, id: string, a: ShippedAgent): string {
  const dir = world.agents.dirOf(id)
  writeFileSync(join(dir, 'AGENT.md'), `${a.instructions}\n`)
  for (const sub of ['skills', 'schedules']) {
    rmSync(join(dir, sub), { recursive: true, force: true })
    if (existsSync(join(a.dir, sub))) cpSync(join(a.dir, sub), join(dir, sub), { recursive: true })
  }
  const shipped = join(dir, SHIPPED)
  const was = existsSync(shipped) ? (JSON.parse(readFileSync(shipped, 'utf8')) as string[]) : []
  const from = join(a.dir, 'files')
  const now = existsSync(from) ? walk(from) : []
  for (const f of was) if (!now.includes(f)) rmSync(join(dir, 'files', f), { force: true })
  for (const f of now) {
    mkdirSync(dirname(join(dir, 'files', f)), { recursive: true })
    copyFileSync(join(from, f), join(dir, 'files', f))
  }
  writeFileSync(shipped, `${JSON.stringify(now)}\n`)
  return dir
}
