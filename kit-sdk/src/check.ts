// `alpha kit check <dir>`: what is wrong with a kit, in plain sentences, before anything
// installs. The core runs it at install and update; a kit author runs it from the command line;
// CI runs it on the standard kits.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { z } from 'zod'
import { AgentFront, triggersOf } from './agent.ts'
import { CALLS } from './index.ts'
import { API_VERSIONS_SERVED } from './kinds.ts'
import { type KitManifest, Manifest, Setup } from './manifest.ts'

export interface CheckOptions {
  // the kits a `uses` may name, with their versions, when known (the installed ones, or the
  // bundle's); none given means `uses` is not checked against them
  kits?: { name: string; version: string }[]
}

// "1.2.3" against "1.2": at least that.
export function atLeast(version: string, min: string): boolean {
  const a = version.split('.').map(Number)
  const b = min.split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y
  }
  return true
}

export function checkKit(dir: string, options: CheckOptions = {}): string[] {
  const problems: string[] = []
  const file = join(dir, 'module.yaml')
  if (!existsSync(file)) return [`There is no kit at ${dir}: it has no module.yaml.`]
  let raw: unknown
  try {
    raw = parse(readFileSync(file, 'utf8'))
  } catch (err) {
    return [`module.yaml is not YAML: ${err instanceof Error ? err.message : String(err)}`]
  }
  const parsed = Manifest.safeParse(raw)
  if (!parsed.success) return [`module.yaml is not right: ${z.prettifyError(parsed.error)}`]
  const m: KitManifest = parsed.data
  if (m.api === undefined)
    problems.push(
      `module.yaml says no api: the kit API it was written for (api: ${API_VERSIONS_SERVED.at(-1)}).`,
    )
  else if (!(API_VERSIONS_SERVED as readonly number[]).includes(m.api))
    problems.push(
      `module.yaml says api: ${m.api}; this Alpha serves ${API_VERSIONS_SERVED.join(', ')}.`,
    )
  const own = new Set(m.tables.map((t) => t.name))
  const usedTables = new Set(m.uses.flatMap((u) => u.tables))
  const keys = new Set<string>()
  for (const t of m.tables) {
    for (const f of t.fields) {
      const key = `${t.name}:${f.key ?? f.name}`
      if (keys.has(key)) problems.push(`${t.name} has two fields keyed ${f.key ?? f.name}.`)
      keys.add(key)
      if (f.kind === 'relation') {
        if (!f.relates_to) problems.push(`${t.name}'s ${f.name} is a relation with no relates_to.`)
        else if (!own.has(f.relates_to) && !usedTables.has(f.relates_to))
          problems.push(
            `${t.name}'s ${f.name} relates to ${f.relates_to}, which is neither the kit's own table nor one named in uses.`,
          )
      }
    }
  }
  if (options.kits)
    for (const u of m.uses) {
      if (!u.kit) continue
      const k = options.kits.find((x) => x.name === u.kit)
      if (!k) problems.push(`The kit uses ${u.kit}, which is not there.`)
      else if (u.min && !atLeast(k.version, u.min))
        problems.push(`The kit uses ${u.kit} ${u.min} or newer; ${k.version} is there.`)
    }
  const setupFile = join(dir, 'setup.yaml')
  if (existsSync(setupFile)) {
    const s = Setup.safeParse(parse(readFileSync(setupFile, 'utf8')) ?? {})
    if (!s.success) problems.push(`setup.yaml is not right: ${z.prettifyError(s.error)}`)
    else
      for (const table of Object.keys(s.data))
        if (!own.has(table))
          problems.push(`setup.yaml has rows for ${table}, which the kit has no table called.`)
  }
  const gated = new Set(CALLS.filter((c) => c.effect).map((c) => c.name))
  const agentsDir = join(dir, 'agents')
  const agentFiles = existsSync(agentsDir)
    ? readdirSync(agentsDir).filter((f) => f.endsWith('.md'))
    : []
  for (const f of agentFiles) {
    const text = readFileSync(join(agentsDir, f), 'utf8')
    const fm = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text)
    if (!fm) {
      problems.push(`agents/${f} has no front matter.`)
      continue
    }
    const front = AgentFront.safeParse(parse(fm[1] as string))
    if (!front.success) {
      problems.push(`agents/${f} is not right: ${z.prettifyError(front.error)}`)
      continue
    }
    const a = front.data
    const name = a.name ?? f.replace(/\.md$/, '')
    if (!existsSync(join(dir, a.runs.script)))
      problems.push(`${name} runs ${a.runs.script}, which is not in the kit.`)
    for (const t of a.touches)
      if (!own.has(t) && !usedTables.has(t))
        problems.push(
          `${name} touches ${t}, which is neither the kit's own table nor one named in uses.`,
        )
    for (const e of a.effects ?? [])
      if (!gated.has(e))
        problems.push(
          `${name} names the effect ${e}; the calls with an effect are ${[...gated].join(', ')}.`,
        )
    for (const t of a.needs.tables)
      if (!own.has(t) && !usedTables.has(t))
        problems.push(
          `${name} needs ${t}, which is neither the kit's own table nor one named in uses.`,
        )
    for (const t of triggersOf(a.trigger))
      if ('changes' in t)
        for (const table of Array.isArray(t.changes) ? t.changes : [t.changes])
          if (!own.has(table) && !usedTables.has(table))
            problems.push(
              `${name} runs when ${table} changes, which is neither the kit's own table nor one named in uses.`,
            )
    if (!(fm[2] as string).trim()) problems.push(`${name} has no brief under its front matter.`)
  }
  return problems
}
