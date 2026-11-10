// Make this a kit: a module made in a conversation leaves as a kit in one action. Its module.yaml already mirrors its shape (shape.writeManifest: tables,
// fields, choices, relations, keys, views, documents, people, where it sits, its network); the kit
// adds a version, the kit API it was written for, a description from its notes and what it uses
// of other kits and connectors. Its notes, schedules, skills and pages go with it; its rows never.
// The folder is checked as `pnpm kit check` does and packed as `pnpm kit pack` does. On a module
// that came from a kit the same action packs the kit as it is now, its version kept.
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { API_VERSIONS_SERVED, checkKit } from '@alpha/kit-sdk'
import { parse, stringify } from 'yaml'
import { one } from '../world/db.ts'
import { append } from '../world/journal.ts'
import { Refused } from '../world/kinds.ts'
import type { Module, WriteCtx } from '../world/shape/index.ts'
import type { World } from '../world/world.ts'
import { installedKits } from './kits/index.ts'
import { pack } from './packs.ts'
import { parseSchedule } from './schedules.ts'

// What of a module's folder goes with the kit: never its git history or a tool's own folder.
const TAKEN = ['NOTES.md', 'schedules', 'skills', 'pages']
const FIRST_VERSION = '0.1.0'

export interface MadeKit {
  name: string
  version: string
  file: string
  words: string
}

// The first paragraph of the module's notes after its title, as the kit's description.
function describedIn(notes: string): string | undefined {
  const paragraphs = notes
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith('#'))
  const first = paragraphs[0]?.replace(/\s+/g, ' ')
  return first && !first.startsWith('-') ? first : undefined
}

// A `uses` entry per module whose tables the kit reaches: a kit by name with the version there,
// a connector by name. A module that is neither cannot be used by a kit, and the action says so.
function usesOf(world: World, module: Module, dir: string): Record<string, unknown>[] {
  const own = new Set(world.shape.tables(module.id).map((t) => t.name))
  const reached = new Map<string, Set<string>>() // other module id: its tables reached
  const reach = (tableName: string, by: string) => {
    if (own.has(tableName)) return
    const t = world.shape.table(tableName)
    if (!t) throw new Refused(`${by} names ${tableName}, which is no table here.`)
    const list = reached.get(t.module.id) ?? new Set()
    list.add(t.name)
    reached.set(t.module.id, list)
  }
  for (const t of world.shape.tables(module.id))
    for (const f of t.fields) {
      if (f.kind !== 'relation' || !f.relatesTo) continue
      const target = world.shape.table(f.relatesTo)
      if (target) reach(target.name, `${t.name}'s ${f.name}`)
    }
  const schedulesDir = join(dir, 'schedules')
  if (existsSync(schedulesDir))
    for (const f of readdirSync(schedulesDir).filter((x) => x.endsWith('.md'))) {
      const a = parseSchedule(readFileSync(join(schedulesDir, f), 'utf8'), `schedules/${f}`)
      for (const t of [...(a.touches ?? []), ...a.needs.tables]) reach(t, a.name)
    }
  const kits = installedKits(world)
  return [...reached].map(([id, tables]) => {
    const other = world.shape.module(id)
    const madeBy = one<{ made_by: string }>(
      world.db,
      'SELECT made_by FROM modules WHERE id = ?',
      id,
    )
    const kit = kits.find((k) => k.module === id)
    if (kit) return { kit: kit.kit, min: kit.version, tables: [...tables] }
    const connector = /^connector:(.+)$/.exec(madeBy?.made_by ?? '')?.[1]
    if (connector) return { connector, tables: [...tables] }
    throw new Refused(
      `It reaches ${[...tables].join(', ')} in ${other?.name ?? 'another module'}, which was not installed from a pack or a connector: a pack can only use those. Pack ${other?.name ?? 'that module'} first.`,
    )
  })
}

// The module's folder as a kit: module.yaml completed, the taken files beside it, nothing else.
function stage(world: World, module: Module, fromKit: boolean): string {
  world.shape.writeManifest(module)
  const dir = mkdtempSync(join(tmpdir(), 'alpha-makekit-'))
  for (const name of TAKEN) {
    const from = join(module.dir, name)
    if (!existsSync(from)) continue
    cpSync(from, join(dir, name), {
      recursive: true,
      filter: (src) => !/(^|\/)(\.git|\.claude|\.DS_Store|node_modules)(\/|$)/.test(src),
    })
  }
  const kept = (parse(readFileSync(join(module.dir, 'module.yaml'), 'utf8')) ?? {}) as Record<
    string,
    unknown
  >
  if (fromKit) {
    writeFileSync(join(dir, 'module.yaml'), stringify(kept))
    return dir
  }
  const { name, version, api, description, within, uses, tables, network, ...rest } = kept
  const notes = join(module.dir, 'NOTES.md')
  const manifest = {
    name,
    version: version ?? FIRST_VERSION,
    api: api ?? API_VERSIONS_SERVED.at(-1),
    ...(description ? { description } : {}),
    ...(within ? { within } : {}),
    ...rest,
    tables: tables ?? [],
    network: network ?? [],
  }
  const said =
    description ?? (existsSync(notes) ? describedIn(readFileSync(notes, 'utf8')) : undefined)
  if (said) manifest.description = said
  const used = Array.isArray(uses) && uses.length ? uses : usesOf(world, module, dir)
  const out = { ...manifest, ...(used.length ? { uses: used } : {}) }
  writeFileSync(join(dir, 'module.yaml'), stringify(out))
  return dir
}

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// The module packed as a kit into outDir: <name>-<version>.alphakit, checked first.
export function makeKit(world: World, moduleId: string, outDir: string, ctx: WriteCtx): MadeKit {
  const module = world.shape.module(moduleId)
  if (!module) throw new Refused('That module is not there.')
  const fromKit = installedKits(world).some((k) => k.module === module.id)
  const dir = stage(world, module, fromKit)
  try {
    const problems = checkKit(dir, {
      kits: installedKits(world).map((k) => ({ name: k.kit, version: k.version })),
    })
    if (problems.length)
      throw new Refused(`This module is not ready to pack: ${problems.join(' ')}`)
    const manifest = parse(readFileSync(join(dir, 'module.yaml'), 'utf8')) as {
      name: string
      version: string
      tables: unknown[]
    }
    const file = pack(dir, outDir)
    const schedules = existsSync(join(dir, 'schedules'))
      ? readdirSync(join(dir, 'schedules')).filter((f) => f.endsWith('.md')).length
      : 0
    const skills = existsSync(join(dir, 'skills'))
      ? readdirSync(join(dir, 'skills'), { withFileTypes: true }).filter((e) => e.isDirectory())
          .length
      : 0
    const pages = existsSync(join(dir, 'pages')) ? readdirSync(join(dir, 'pages')).length : 0
    const parts = [
      count(manifest.tables?.length ?? 0, 'table'),
      schedules ? count(schedules, 'schedule') : '',
      skills ? count(skills, 'skill') : '',
      pages ? count(pages, 'page') : '',
    ].filter(Boolean)
    const words = `${fromKit ? 'Packed' : 'Made'} ${manifest.name} ${manifest.version}: ${parts.join(', ')}, no rows. It is at ${file}.`
    append(world.db, {
      actor: ctx.actor,
      kind: 'packed',
      words,
      data: { module: module.id, file, version: manifest.version },
      user: ctx.user ?? null,
      turn: ctx.turn ?? null,
      module: module.id,
    })
    return { name: manifest.name, version: manifest.version, file, words }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
