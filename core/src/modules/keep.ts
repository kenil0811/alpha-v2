// Keeping a file in a module (`keep`): a skill, a schedule, a page or the module's notes.
// Each keep is a commit in the module's folder, so its versions can be read back; a schedule kept
// from the desk starts on, since the person asked for it.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { parse } from 'yaml'
import { Refused } from '../world/kinds.ts'
import { refuseManaged } from '../world/maintained.ts'
import { asks } from '../world/shape/asks.ts'
import type { Module, WriteCtx } from '../world/shape/index.ts'
import type { World } from '../world/world.ts'
import { commitAll } from './git.ts'
import { installedKits } from './kits/index.ts'
import { parseSchedule, syncSchedules, whenWords } from './schedules.ts'

const PLACES = ['skills/', 'schedules/', 'pages/', 'files/']

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

function check(module: Module, rel: string, text: string): string | null {
  if (/^schedules\/[^/]+\.md$/.test(rel)) {
    const a = parseSchedule(text, rel)
    if (a.runs && !existsSync(join(module.dir, a.runs.script)))
      throw new Refused(`${a.name} runs ${a.runs.script}, which is not kept yet: keep it first.`)
    return `${a.name} is on, ${whenWords(a.trigger)}`
  }
  if (/^skills\/[^/]+\/SKILL\.md$/.test(rel)) {
    const m = /^---\n([\s\S]*?)\n---/.exec(text)
    const front = (m ? parse(m[1] as string) : null) as { name?: unknown; description?: unknown }
    if (!front?.name || !front.description)
      throw new Refused(`${rel} needs front matter with a name and a description.`)
  }
  return null
}

// Whether the module's kit shipped this file; when its folder is not on this Mac, taken as shipped.
function shipped(world: World, module: Module, rel: string): boolean {
  const kit = installedKits(world).find((k) => k.module === module.id)
  if (!kit) return false
  return !existsSync(kit.source) || existsSync(join(kit.source, rel))
}

// The file's words, given or already written in the folder; checked, committed, and the module's
// schedules read again.
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
  const schedule = check(module, rel, text)
  // nothing is kept in a managed module (rules M2); a file a kit someone else maintains shipped
  // asks the person first (M4), and one the firm adds to its module, as a source's own reader,
  // is theirs
  refuseManaged(world, module.id, `keep ${rel}`, ctx)
  if (shipped(world, module, rel))
    asks(
      world.shape,
      { module: module.id },
      () => ({ words: `keep ${rel}`, method: 'keep', args: [module.id, rel, text] }),
      ctx,
    )
  if (content !== undefined) {
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  const commit = await commitAll(module.dir, `Kept ${rel}`)
  syncSchedules(world, module, 'on')
  const words = commit
    ? `Kept ${rel} in ${module.name}${schedule ? `; ${schedule}` : ''}.`
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
