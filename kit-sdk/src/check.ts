// `alpha kit check <dir>`: what is wrong with a kit, in plain sentences, before anything
// installs. The core runs it at install and update; a kit author runs it from the command line;
// CI runs it on the standard kits.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { z } from 'zod'
import { CALLS } from './index.ts'
import { API_VERSIONS_SERVED } from './kinds.ts'
import { type KitManifest, Manifest, Setup } from './manifest.ts'
import { ScheduleFront, triggersOf } from './schedule.ts'

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

// What a kit could say better, in plain sentences: never a refusal. A table or field with no
// about leaves the model guessing what it means (the semantic layer, decision of 24 Oct).
export function kitNotes(dir: string): string[] {
  const file = join(dir, 'module.yaml')
  if (!existsSync(file)) return []
  let parsed: ReturnType<typeof Manifest.safeParse>
  try {
    parsed = Manifest.safeParse(parse(readFileSync(file, 'utf8')))
  } catch {
    return []
  }
  if (!parsed.success) return []
  const notes: string[] = []
  if (!parsed.data.business_case)
    notes.push(
      'module.yaml has no business_case: say who the module is for, what it keeps track of, and the decisions it serves.',
    )
  for (const t of parsed.data.tables) {
    if (!t.about) notes.push(`${t.name} has no about: say in a sentence what a row of it is.`)
    const bare = t.fields.filter((f) => !f.about).map((f) => f.name)
    if (bare.length)
      notes.push(
        `${t.name}'s ${bare.join(', ')} ${bare.length === 1 ? 'has' : 'have'} no about: say what each means.`,
      )
  }
  return notes
}

// A summary field (core step 3c) names its table's rows and their fields as the kit has them:
// the core checks the rest (the relation points here, a sum takes a number) when it installs.
function summaryProblems(
  m: KitManifest,
  table: string,
  f: KitManifest['tables'][number]['fields'][number],
): string[] {
  const at = `${table}'s ${f.name}`
  if ((f.kind === 'summary') !== !!f.summary)
    return [`${at}: a summary field has a summary, and only a summary field does.`]
  const s = f.summary
  if (!s) return []
  const of = m.tables.find((x) => x.name === s.of)
  if (!of)
    return m.uses.some((u) => u.tables.includes(s.of))
      ? []
      : [`${at} sums up ${s.of}, which is neither the kit's own table nor one named in uses.`]
  const out: string[] = []
  for (const name of [s.through, s.field, s.by, s.where?.field]) {
    const x = name ? of.fields.find((y) => y.name === name) : undefined
    if (name && !x) out.push(`${at} names ${name}, which ${s.of} does not have.`)
    if (x?.kind === 'summary')
      out.push(`${at} reads ${name}, a summary: a summary takes a stored value.`)
  }
  if (!s.through && !of.fields.some((y) => y.kind === 'relation' && y.relates_to === table))
    out.push(`${at}: no field of ${s.of} relates to ${table}, so it has nothing to sum up.`)
  if (s.op !== 'count' && !s.field) out.push(`${at}: ${s.op} needs the field it takes.`)
  return out
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
    // a tab kept is a part's or a setup table's: a main table is a tab already
    if (t.tab && !t.setup && !t.fields.some((f) => f.part_of))
      problems.push(
        `${t.name} is one of the module's tabs already: tab is for a part or a setup table.`,
      )
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
      if (f.many && f.kind !== 'relation' && f.kind !== 'choice')
        problems.push(`${t.name}'s ${f.name}: only a relation or a choice holds several (many).`)
      problems.push(...summaryProblems(m, t.name, f))
      if (f.per && f.kind !== 'person')
        problems.push(`${t.name}'s ${f.name}: only a person field holds one row per person (per).`)
      // a part belongs to one row of a table, never to a list or to itself (core step 3a)
      if (f.part_of && (f.kind !== 'relation' || f.many || f.relates_to === t.name))
        problems.push(
          `${t.name}'s ${f.name} can be part_of only as a relation to one row of another table.`,
        )
    }
    if (t.fields.filter((f) => f.per).length > 1)
      problems.push(`${t.name} says per on more than one field; a table is one row per one person.`)
    if (t.fields.filter((f) => f.part_of).length > 1)
      problems.push(`${t.name} is part of more than one table; a row is part of one row.`)
    if (t.setup && t.fields.some((f) => f.part_of))
      problems.push(`${t.name} is both setup and part of a row; it is one or the other.`)
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
  const schedulesDir = join(dir, 'schedules')
  const scheduleFiles = existsSync(schedulesDir)
    ? readdirSync(schedulesDir).filter((f) => f.endsWith('.md'))
    : []
  for (const f of scheduleFiles) {
    const text = readFileSync(join(schedulesDir, f), 'utf8')
    const fm = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text)
    if (!fm) {
      problems.push(`schedules/${f} has no front matter.`)
      continue
    }
    const front = ScheduleFront.safeParse(parse(fm[1] as string))
    if (!front.success) {
      problems.push(`schedules/${f} is not right: ${z.prettifyError(front.error)}`)
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
