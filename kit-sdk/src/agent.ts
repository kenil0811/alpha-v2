// An agent a kit carries (api 3), in agents/<key>/: AGENT.md with its name, title, description
// and model on top and its instructions below, beside skills/, files/ and schedules/, the same
// folder an agent has in a firm. Alpha's own agents ship in the same format.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { z } from 'zod'
import { ScheduleFront } from './schedule.ts'

export const AgentHead = z.object({
  // its lasting name in its source, so an update finds it; the folder's name when none is given
  key: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/)
    .optional(),
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1), // when to use it: every agent reads this to decide whom to ask
  model: z.string().optional(), // one Alpha knows; none is the desk's
})
export type AgentHead = z.infer<typeof AgentHead>

export interface ShippedAgent {
  key: string
  dir: string
  head: AgentHead
  instructions: string
}

// AGENT.md read: its head and its instructions, or what is wrong with it.
export function readAgent(dir: string, folder: string): ShippedAgent | string {
  const file = join(dir, 'AGENT.md')
  if (!existsSync(file)) return `${folder} has no AGENT.md.`
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(readFileSync(file, 'utf8'))
  if (!m)
    return `${folder}/AGENT.md has no head: its name, title and description between --- lines.`
  let raw: unknown
  try {
    raw = parse(m[1] as string)
  } catch (err) {
    return `${folder}/AGENT.md's head is not YAML: ${err instanceof Error ? err.message : String(err)}`
  }
  const head = AgentHead.safeParse(raw)
  if (!head.success) return `${folder}/AGENT.md's head is not right: ${z.prettifyError(head.error)}`
  const instructions = (m[2] as string).trim()
  if (!instructions) return `${folder}/AGENT.md has no instructions under its head.`
  return { key: head.data.key ?? folder, dir, head: head.data, instructions }
}

// Every agent in a folder of agent folders (a kit's agents/, or Alpha's own), each read.
export function readAgents(root: string): (ShippedAgent | string)[] {
  if (!existsSync(root)) return []
  return readdirSync(root)
    .filter((f) => !f.startsWith('.') && statSync(join(root, f)).isDirectory())
    .sort()
    .map((f) => readAgent(join(root, f), f))
}

// What is wrong with the agents in a folder: each one's head, a model Alpha knows (when the list
// is given), a name and a key once each, and its skills' and schedules' heads.
export function agentProblems(root: string, models?: string[]): string[] {
  const problems: string[] = []
  const names = new Set<string>()
  const keys = new Set<string>()
  for (const a of readAgents(root)) {
    if (typeof a === 'string') {
      problems.push(a)
      continue
    }
    const at = `The agent ${a.head.name}`
    if (names.has(a.head.name.toLowerCase())) problems.push(`Two agents are called ${a.head.name}.`)
    names.add(a.head.name.toLowerCase())
    if (keys.has(a.key)) problems.push(`Two agents are keyed ${a.key}.`)
    keys.add(a.key)
    if (/^chief( of staff)?$/i.test(a.head.name))
      problems.push(`${at}: the Chief of staff's name is taken.`)
    if (a.head.model && models && !models.includes(a.head.model))
      problems.push(`${at} runs on ${a.head.model}, which is not one of ${models.join(', ')}.`)
    const skills = join(a.dir, 'skills')
    for (const s of existsSync(skills) ? readdirSync(skills) : []) {
      const f = join(skills, s, 'SKILL.md')
      const front = existsSync(f) ? /^---\n([\s\S]*?)\n---/.exec(readFileSync(f, 'utf8')) : null
      const head = front ? (parse(front[1] as string) as Record<string, unknown> | null) : null
      if (!head?.name || !head.description)
        problems.push(`${at}'s skill ${s} needs a SKILL.md with a name and a description.`)
    }
    const schedules = join(a.dir, 'schedules')
    for (const s of existsSync(schedules) ? readdirSync(schedules) : []) {
      if (!s.endsWith('.md')) continue
      const fm = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(readFileSync(join(schedules, s), 'utf8'))
      const front = fm ? ScheduleFront.safeParse(parse(fm[1] as string)) : null
      if (!front?.success) problems.push(`${at}'s schedule ${s} is not right.`)
      else if (!(fm?.[2] ?? '').trim()) problems.push(`${at}'s schedule ${s} has no brief.`)
    }
  }
  return problems
}
