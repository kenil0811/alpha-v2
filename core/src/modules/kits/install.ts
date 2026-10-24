import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { now, one, run, tx } from '../../world/db.ts'
import { Refused } from '../../world/kinds.ts'
import type { Module, WriteCtx } from '../../world/shape.ts'
import type { World } from '../../world/world.ts'
import { syncAgents } from '../agents.ts'
import { commitAll } from '../git.ts'
import { checked, readKit, sha } from './read.ts'
import { currentRowHash, landSetup, placeModule, shapeTables, shapeViews } from './shape.ts'

export async function install(world: World, kitDir: string, ctx: WriteCtx): Promise<Module> {
  const { note } = checked(kitDir, world)
  const { manifest, setup, files } = readKit(kitDir)
  const known = world.shape.module(manifest.name)
  if (known) {
    const isKit = one(world.db, 'SELECT 1 FROM kits WHERE module_id = ?', known.id)
    throw new Refused(
      isKit
        ? `${manifest.name} is already installed: update it instead.`
        : `There is already a module called ${manifest.name}.`,
    )
  }
  const kitName = `${manifest.name} ${manifest.version}`
  const kitCtx: WriteCtx = { ...ctx, actor: { kind: 'system', id: `kit:${manifest.name}` } }
  const module = tx(world.db, () => {
    const m = world.shape.makeModule(manifest.name, kitCtx)
    for (const f of files) {
      mkdirSync(dirname(join(m.dir, f)), { recursive: true })
      copyFileSync(join(kitDir, f), join(m.dir, f))
      run(
        world.db,
        'INSERT INTO module_files (module_id, path, installed_hash) VALUES (?, ?, ?)',
        m.id,
        f,
        sha(readFileSync(join(kitDir, f))),
      )
    }
    copyFileSync(join(kitDir, 'module.yaml'), join(m.dir, 'module.yaml'))
    placeModule(world, m, manifest.within, kitCtx)
    shapeTables(world, m, manifest, kitCtx)
    shapeViews(world, manifest, kitCtx)
    const rows = landSetup(world, m.id, setup, kitName, kitCtx, () => true)
    run(
      world.db,
      'INSERT INTO kits (module_id, kit, version, source, installed_at, updated_at, api, maintainer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      m.id,
      manifest.name,
      manifest.version,
      kitDir,
      now(),
      now(),
      manifest.api ?? 1,
      manifest.maintainer ? JSON.stringify(manifest.maintainer) : null,
    )
    const agents = syncAgents(world, m, 'paused')
    world.line({
      actor: ctx.actor,
      kind: 'installed',
      words: `Installed ${kitName}: ${manifest.tables.length} table${manifest.tables.length === 1 ? '' : 's'}, ${rows.landed} setup row${rows.landed === 1 ? '' : 's'}${agents ? `, ${agents} agent${agents === 1 ? '' : 's'} (paused)` : ''}${note}.`,
      data: { module: m.id, kit: manifest.name, version: manifest.version },
      user: ctx.user ?? null,
      module: m.id,
    })
    return m
  })
  world.shape.writeManifest(world.shape.module(module.id) as Module)
  await commitAll(module.dir, `Installed ${kitName}`)
  return module
}

export interface UpdateReport {
  replaced: string[]
  kept: string[]
  added: string[]
  rowsLanded: number
  rowsKept: number
}

export async function update(
  world: World,
  moduleName: string,
  kitDir: string,
  ctx: WriteCtx,
): Promise<UpdateReport> {
  checked(kitDir, world)
  const { manifest, setup, files } = readKit(kitDir)
  const module = world.shape.module(moduleName)
  if (!module) throw new Refused(`There is no module called ${moduleName}.`)
  const kit = one<{ kit: string; version: string }>(
    world.db,
    'SELECT kit, version FROM kits WHERE module_id = ?',
    module.id,
  )
  if (!kit) throw new Refused(`${module.name} was not installed from a kit.`)
  if (kit.kit !== manifest.name)
    throw new Refused(`That folder holds the kit ${manifest.name}, not ${kit.kit}.`)
  // What is in the folder now, committed first, so the update itself is one change in history.
  await commitAll(module.dir, 'Before the kit update')
  const kitName = `${manifest.name} ${manifest.version}`
  const kitCtx: WriteCtx = { ...ctx, actor: { kind: 'system', id: `kit:${manifest.name}` } }
  // the files are copied only once the tables and setup rows have gone in, so an update that
  // fails there (a table name another module has) leaves the folder as it was, and the next try
  // sees no change of the person's where there is none
  const copies: string[] = []
  const report: UpdateReport = tx(world.db, () => {
    const out: UpdateReport = { replaced: [], kept: [], added: [], rowsLanded: 0, rowsKept: 0 }
    for (const f of files) {
      const target = join(module.dir, f)
      const installed = one<{ installed_hash: string }>(
        world.db,
        'SELECT installed_hash FROM module_files WHERE module_id = ? AND path = ?',
        module.id,
        f,
      )
      const fresh = sha(readFileSync(join(kitDir, f)))
      if (!installed) {
        if (existsSync(target)) {
          out.kept.push(f) // someone made a file of that name: theirs
          continue
        }
        out.added.push(f)
      } else {
        if (!existsSync(target)) {
          out.kept.push(f) // removed by the person: their change stands
          continue
        }
        if (sha(readFileSync(target)) !== installed.installed_hash) {
          out.kept.push(f)
          continue
        }
        if (fresh === installed.installed_hash) continue
        out.replaced.push(f)
      }
      copies.push(f)
      run(
        world.db,
        'INSERT OR REPLACE INTO module_files (module_id, path, installed_hash) VALUES (?, ?, ?)',
        module.id,
        f,
        fresh,
      )
    }
    placeModule(world, module, manifest.within, kitCtx)
    shapeTables(world, module, manifest, kitCtx)
    shapeViews(world, manifest, kitCtx)
    const rows = landSetup(world, module.id, setup, kitName, kitCtx, (recordId) => {
      const installed = one<{ installed_hash: string }>(
        world.db,
        'SELECT installed_hash FROM kit_rows WHERE record_id = ?',
        recordId,
      )
      return !!installed && installed.installed_hash === currentRowHash(world, recordId)
    })
    out.rowsLanded = rows.landed
    out.rowsKept = rows.kept
    run(
      world.db,
      'UPDATE kits SET version = ?, source = ?, updated_at = ?, api = ?, maintainer = ? WHERE module_id = ?',
      manifest.version,
      kitDir,
      now(),
      manifest.api ?? 1,
      manifest.maintainer ? JSON.stringify(manifest.maintainer) : null,
      module.id,
    )
    for (const f of copies) {
      mkdirSync(dirname(join(module.dir, f)), { recursive: true })
      copyFileSync(join(kitDir, f), join(module.dir, f))
    }
    syncAgents(world, module, 'paused')
    world.line({
      actor: ctx.actor,
      kind: 'installed',
      words: `Updated ${module.name} from ${kit.version} to ${manifest.version}: ${out.replaced.length + out.added.length} file${out.replaced.length + out.added.length === 1 ? '' : 's'} new or replaced${out.kept.length ? `, ${out.kept.length} of your changes kept` : ''}${out.rowsKept ? `, ${out.rowsKept} changed setup row${out.rowsKept === 1 ? '' : 's'} kept` : ''}.`,
      data: { module: module.id, ...out, from: kit.version, to: manifest.version },
      user: ctx.user ?? null,
      module: module.id,
    })
    return out
  })
  world.shape.writeManifest(world.shape.module(module.id) as Module)
  await commitAll(module.dir, `Updated ${kitName}`)
  return report
}
