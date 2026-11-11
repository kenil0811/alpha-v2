// Reading a kit's folder: module.yaml and setup.yaml by the kit API's own schema
// (kit-sdk), the files it carries, the hashes the ownership rule judges by, and the kits
// installed in a world with whether each is Alpha's own.
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { checkKit, type KitManifest, Manifest, Setup } from '@alpha/kit-sdk'
import { parse } from 'yaml'
import { z } from 'zod'
import { config } from '../../config.ts'
import { all } from '../../world/db.ts'
import { Refused } from '../../world/kinds.ts'
import type { World } from '../../world/world.ts'

// module.yaml and setup.yaml are read by the kit API's own schema (kit-sdk), the same the
// checker and a kit author's editor use.
export type { KitManifest }

// What a kit carries besides its manifest and setup rows.
const SKIP = new Set(['module.yaml', 'setup.yaml', '.git', '.DS_Store', 'node_modules'])

export function walk(root: string, dir = root, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(root, p, out)
    else if (e.isFile()) out.push(relative(root, p))
  }
  return out.sort()
}

export const sha = (bytes: Buffer | string) =>
  createHash('sha256').update(bytes).digest('hex').slice(0, 16)

export function rowHash(values: Record<string, unknown>): string {
  return sha(JSON.stringify(Object.entries(values).sort(([a], [b]) => a.localeCompare(b))))
}

export function readKit(dir: string): {
  manifest: KitManifest
  setup: z.infer<typeof Setup>
  files: string[]
} {
  const file = join(dir, 'module.yaml')
  if (!existsSync(file)) throw new Refused(`There is no kit at ${dir}: it has no module.yaml.`)
  const parsed = Manifest.safeParse(parse(readFileSync(file, 'utf8')))
  if (!parsed.success)
    throw new Refused(`The kit's module.yaml is not right: ${z.prettifyError(parsed.error)}`)
  const setupFile = join(dir, 'setup.yaml')
  const setup = existsSync(setupFile)
    ? Setup.parse(parse(readFileSync(setupFile, 'utf8')) ?? {})
    : {}
  // the agents it carries go to their own folders, not the module's
  return { manifest: parsed.data, setup, files: walk(dir).filter((f) => !f.startsWith('agents/')) }
}

// What the checker finds wrong, as one refusal.
export function checked(dir: string, world: World): void {
  const problems = checkKit(dir, {
    kits: installedKits(world).map((k) => ({ name: k.kit, version: k.version })),
    models: config.models().agents,
  })
  if (problems.length) throw new Refused(`The kit is not right: ${problems.join(' ')}`)
}

export interface KitInfo {
  module: string
  kit: string
  version: string
  source: string
  api: number
  maintainer: { name: string; address: string } | null
  core: boolean // Alpha's own: installed and kept by the core, never uninstalled
}

// Whether a kit is Alpha's own, from its folder's manifest (the folder the core ships).
function isCore(source: string): boolean {
  try {
    return existsSync(join(source, 'module.yaml')) && !!readKit(source).manifest.core
  } catch {
    return false
  }
}

export function installedKits(world: World): KitInfo[] {
  return all<{
    module_id: string
    kit: string
    version: string
    source: string
    api: number
    maintainer: string | null
  }>(
    world.db,
    'SELECT module_id, kit, version, source, api, maintainer FROM kits ORDER BY installed_at',
  ).map((k) => ({
    module: k.module_id,
    kit: k.kit,
    version: k.version,
    source: k.source,
    api: k.api,
    maintainer: k.maintainer
      ? (JSON.parse(k.maintainer) as { name: string; address: string })
      : null,
    core: isCore(k.source),
  }))
}
