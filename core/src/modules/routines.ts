// Routines: what a person asked an agent to do on a clock, for themselves ("each Monday, tell me
// what came in"), kept in the agent's own folder with the person who asked. When an agent made here
// is deleted, its routines pass to the Chief of staff, still for the people who asked; a kit's
// agent's routines are its kit's, and go with it.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { CHIEF } from '../world/agents/index.ts'
import { run } from '../world/db.ts'
import type { World } from '../world/world.ts'
import { agentSchedules, syncAgentSchedules } from './schedules.ts'

// A name not yet taken among `taken`: as it is, else with "-2", "-3"… before its extension.
function free(name: string, taken: (n: string) => boolean): string {
  if (!taken(name)) return name
  const dot = name.lastIndexOf('.')
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, '']
  for (let i = 2; ; i++) if (!taken(`${stem}-${i}${ext}`)) return `${stem}-${i}${ext}`
}

// The file's front matter with its name set (a routine of the same name is the Chief of staff's).
function named(text: string, name: string): string {
  const m = /^---\n([\s\S]*?)\n---/.exec(text)
  if (!m) return text
  const head = (m[1] as string).split('\n').filter((l) => !/^name:/.test(l))
  return text.replace(m[0], `---\nname: ${JSON.stringify(name)}\n${head.join('\n')}\n---`)
}

// Every routine of an agent about to be deleted, moved to the Chief of staff's folder with its
// script, its runs and the person who asked kept. What passed, by name.
export function passRoutines(world: World, agent: { id: string; name: string }): string[] {
  const from = world.agents.dirOf(agent.id)
  const to = world.agents.dirOf(CHIEF)
  const chiefs = () => agentSchedules(world, CHIEF)
  const passed: string[] = []
  for (const s of agentSchedules(world, agent.id)) {
    const text = existsSync(join(from, s.file)) ? readFileSync(join(from, s.file), 'utf8') : null
    if (text === null) continue
    let out = text
    // its script's folder, beside the Chief of staff's own under a name not yet taken there
    if (s.runs) {
      const folder = dirname(s.runs.script)
      const target = join(
        dirname(folder),
        free(basename(folder), (n) => existsSync(join(to, dirname(folder), n))),
      )
      const was = join(from, folder)
      if (existsSync(was)) {
        mkdirSync(join(to, dirname(folder)), { recursive: true })
        cpSync(was, join(to, target), { recursive: true })
        if (target !== folder) out = out.split(`${folder}/`).join(`${target}/`)
      }
    }
    const name = chiefs().some((c) => c.name === s.name) ? `${s.name} (from ${agent.name})` : s.name
    if (name !== s.name) out = named(out, name)
    const file = join(
      'schedules',
      free(basename(s.file), (n) => existsSync(join(to, 'schedules', n))),
    )
    mkdirSync(join(to, 'schedules'), { recursive: true })
    writeFileSync(join(to, file), out)
    run(
      world.db,
      'UPDATE schedules SET agent = ?, file = ?, name = ? WHERE id = ?',
      CHIEF,
      file,
      name,
      s.id,
    )
    passed.push(name)
  }
  if (passed.length) syncAgentSchedules(world, CHIEF, null)
  return passed
}
