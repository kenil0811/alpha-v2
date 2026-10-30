// Keeping a file in a module (design §5, `keep`): a skill, an agent, a page or the module's notes.
// Each keep is a commit in the module's folder, so its versions can be read back; a new agent
// starts paused, and runs once the person presses Activate (Vikas, 28 Oct).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { triggersOf } from '@alpha/kit-sdk'
import { parse, parseDocument } from 'yaml'
import { Refused } from '../world/kinds.ts'
import type { Module, WriteCtx } from '../world/shape/index.ts'
import type { World } from '../world/world.ts'
import { type Agent, agents, parseAgent, syncAgents, type Trigger, whenWords } from './agents.ts'
import { commitAll } from './git.ts'

const PLACES = ['skills/', 'agents/', 'pages/', 'files/']

// A path inside the module, in one of its places; module.yaml and setup rows change by other ways.
export function placeOf(path: string): string {
  const rel = normalize(path.trim()).replace(/^\.\//, '')
  if (rel.startsWith('/') || rel.split('/').includes('..') || rel.includes('/.git'))
    throw new Refused(`${path} is not a place in a module.`)
  if (rel !== 'NOTES.md' && !PLACES.some((p) => rel.startsWith(p) && rel.length > p.length))
    throw new Refused(
      `A module keeps NOTES.md and files under ${PLACES.join(', ')}; ${path} is none of these.`,
    )
  return rel
}

function check(world: World, module: Module, rel: string, text: string): string | null {
  if (/^agents\/[^/]+\.md$/.test(rel)) {
    const a = parseAgent(text, rel)
    if (!existsSync(join(module.dir, a.runs.script)))
      throw new Refused(`${a.name} runs ${a.runs.script}, which is not kept yet: keep it first.`)
    // a wall: an agent that takes tasks says when one is done, or no task of its could ever be
    if (a.tasks && !readFileSync(join(module.dir, a.runs.script), 'utf8').includes('task.done'))
      throw new Refused(
        `${a.name} takes tasks, but ${a.runs.script} never calls alpha.task.done(words): only that makes a task Done, with what was done (a returned done: true does nothing). Its task is alpha.input.task: place.row is the row's id, values that row's values by field name.`,
      )
    const what = !a.trigger
      ? 'on call for the tasks given to it'
      : `${whenWords(a.trigger)}${a.tasks ? ', and takes tasks' : ''}`
    const known = agents(world, module.id).find((x) => x.file === rel || x.name === a.name)
    if (!known)
      return `${a.name} is new and paused: it runs ${what} once the person presses Activate on its card or page`
    return `${a.name} is ${known.state === 'on' ? 'on' : 'paused'}, ${what}`
  }
  if (/^skills\/[^/]+\/SKILL\.md$/.test(rel)) {
    const m = /^---\n([\s\S]*?)\n---/.exec(text)
    const front = (m ? parse(m[1] as string) : null) as { name?: unknown; description?: unknown }
    if (!front?.name || !front.description)
      throw new Refused(`${rel} needs front matter with a name and a description.`)
  }
  return null
}

// The file's words, given or already written in the folder; checked, committed, and the module's
// agents read again.
export async function keep(
  world: World,
  module: Module,
  path: string,
  content: string | undefined,
  ctx: WriteCtx,
): Promise<string> {
  const rel = placeOf(path)
  const full = join(module.dir, rel)
  const text = content ?? (existsSync(full) ? readFileSync(full, 'utf8') : null)
  if (text === null) throw new Refused(`${rel} is not in ${module.name} yet: give its words.`)
  const agent = check(world, module, rel, text)
  if (content !== undefined) {
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  const commit = await commitAll(module.dir, `Kept ${rel}`)
  // a new agent starts paused, with Activate in view (Vikas, 28 Oct); a known one keeps its state
  syncAgents(world, module, 'paused')
  const words = commit
    ? `Kept ${rel} in ${module.name}${agent ? `; ${agent}` : ''}.`
    : `${rel} in ${module.name} was already kept as it is.`
  world.line({
    actor: ctx.actor,
    kind: 'kept',
    words,
    data: { module: module.id, path: rel, commit },
    module: module.id,
    user: ctx.user ?? null,
    turn: ctx.turn ?? null,
  })
  return words
}

// How often an agent runs, as the person picks it in the Agents list (Vikas, 29 Oct): written into
// its file's trigger, which stays the truth, and kept like any other keep. Its times on the clock
// become the one picked; what it waits on (a filing, a change) stays.
export async function keepWhen(
  world: World,
  module: Module,
  agent: Agent,
  when: { every: 'hour' | 'day' | 'week'; at?: string | undefined },
  ctx: WriteCtx,
): Promise<string> {
  const text = readFileSync(join(module.dir, agent.file), 'utf8')
  const m = /^---\n([\s\S]*?)\n---(\n?[\s\S]*)$/.exec(text)
  if (!m) throw new Refused(`${agent.file} has no front matter.`)
  const doc = parseDocument(m[1] as string)
  const events = triggersOf(doc.toJS().trigger as Trigger | Trigger[] | undefined).filter(
    (t) => !('every' in t) && !('cron' in t),
  )
  const time: Trigger =
    when.every === 'hour' ? { every: 'hour' } : { every: when.every, at: when.at ?? '08:00' }
  doc.set('trigger', doc.createNode(events.length ? [time, ...events] : time, { flow: true }))
  return keep(world, module, agent.file, `---\n${String(doc).trimEnd()}\n---${m[2]}`, ctx)
}
