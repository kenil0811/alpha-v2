import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { all, newId, now, one, run, tx } from '../../world/db.ts'
import { Refused } from '../../world/kinds.ts'
import type { WriteCtx } from '../../world/shape/index.ts'
import { hashOf, resolveConfig } from '../../world/views.ts'
import type { World } from '../../world/world.ts'
import { commitAll } from '../git.ts'
import { syncSchedules } from '../schedules.ts'
import { installedKits, readKit, sha } from './read.ts'
import { currentRowHash, landSetup } from './shape.ts'

// What of a kit is the person's now (decision 3): the files, setup rows, views and fields they
// changed, added or removed, and the fields the kit no longer uses with the rows still under them.
export interface Yours {
  files: { path: string; state: 'changed' | 'removed' }[]
  rows: { table: string; tableId: string; key: string; id: string; name: string }[]
  views: { table: string; tableId: string; id: string; name: string }[]
  fields: { table: string; tableId: string; id: string; name: string }[]
  removed: { table: string; tableId: string; fieldId: string; name: string; rows: number }[]
}

export function yours(world: World, moduleId: string): Yours {
  const module = world.shape.module(moduleId)
  if (!module) throw new Refused('That module is not there.')
  const out: Yours = { files: [], rows: [], views: [], fields: [], removed: [] }
  for (const f of all<{ path: string; installed_hash: string }>(
    world.db,
    'SELECT path, installed_hash FROM module_files WHERE module_id = ? ORDER BY path',
    module.id,
  )) {
    const target = join(module.dir, f.path)
    if (!existsSync(target)) out.files.push({ path: f.path, state: 'removed' })
    else if (sha(readFileSync(target)) !== f.installed_hash)
      out.files.push({ path: f.path, state: 'changed' })
  }
  for (const t of world.shape.tables(module.id)) {
    for (const [id, key] of world.records.itemKeys(t.id)) {
      if (!key?.startsWith('setup:')) continue
      const installed = one<{ installed_hash: string }>(
        world.db,
        'SELECT installed_hash FROM kit_rows WHERE record_id = ?',
        id,
      )
      if (installed && installed.installed_hash !== currentRowHash(world, id)) {
        const rec = world.records.get(id)
        out.rows.push({
          table: t.name,
          tableId: t.id,
          key: key.slice('setup:'.length),
          id,
          name: rec ? world.rowName(t, rec.record.values) : key,
        })
      }
    }
    for (const v of world.views.list(t.id))
      if (!v.kitHash) out.views.push({ table: t.name, tableId: t.id, id: v.id, name: v.name })
    for (const f of t.fields)
      if (!f.key) out.fields.push({ table: t.name, tableId: t.id, id: f.id, name: f.name })
    for (const f of world.shape.hiddenFields(t.id))
      out.removed.push({ table: t.name, tableId: t.id, fieldId: f.id, name: f.name, rows: f.rows })
  }
  return out
}

// The kit's version of one thing back, from the folder it was installed from: a file, a setup
// row or a view; the person's version stays in the module's git history.
export async function takeBack(
  world: World,
  moduleId: string,
  what:
    | { kind: 'file'; path: string }
    | { kind: 'row'; table: string; key: string }
    | { kind: 'view'; table: string; name: string },
  ctx: WriteCtx,
): Promise<string> {
  const module = world.shape.module(moduleId)
  const kit = installedKits(world).find((k) => k.module === moduleId)
  if (!module || !kit) throw new Refused('That module did not come from a kit.')
  if (!existsSync(join(kit.source, 'module.yaml')))
    throw new Refused(
      `The kit's folder is not where it was (${kit.source}); update the kit from a folder first.`,
    )
  const kitCtx: WriteCtx = { ...ctx, actor: { kind: 'system', id: `kit:${kit.kit}` } }
  if (what.kind === 'file') {
    const from = join(kit.source, what.path)
    if (!existsSync(from) || what.path.includes('..'))
      throw new Refused(`The kit has no file ${what.path}.`)
    mkdirSync(dirname(join(module.dir, what.path)), { recursive: true })
    copyFileSync(from, join(module.dir, what.path))
    run(
      world.db,
      'INSERT OR REPLACE INTO module_files (module_id, path, installed_hash) VALUES (?, ?, ?)',
      module.id,
      what.path,
      sha(readFileSync(from)),
    )
    syncSchedules(world, module, 'paused')
    world.line({
      actor: ctx.actor,
      kind: 'installed',
      words: `Took the kit's ${what.path} back in ${module.name}.`,
      data: { module: module.id, path: what.path },
      user: ctx.user ?? null,
      module: module.id,
    })
    await commitAll(module.dir, `Took the kit's ${what.path} back`)
    return `${what.path} is the kit's again.`
  }
  const { manifest, setup } = readKit(kit.source)
  if (what.kind === 'row') {
    const rows = (setup[what.table] ?? []).filter((r) => r.key === what.key)
    if (!rows.length) throw new Refused(`The kit has no setup row ${what.key} in ${what.table}.`)
    tx(world.db, () =>
      landSetup(
        world,
        module.id,
        { [what.table]: rows },
        `${kit.kit} ${kit.version}`,
        kitCtx,
        () => true,
      ),
    )
    return `${what.key} in ${what.table} is the kit's again.`
  }
  const spec = manifest.tables.find((t) => t.name.toLowerCase() === what.table.toLowerCase())
  const view = spec?.views.find((v) => v.name.toLowerCase() === what.name.toLowerCase())
  const t = world.shape.table(what.table)
  if (!spec || !view || !t) throw new Refused(`The kit has no view ${what.name} on ${what.table}.`)
  const { name, default: isDefault, ...given } = view
  const config = resolveConfig(t, given)
  const was = world.views.list(t.id).find((v) => v.name.toLowerCase() === name.toLowerCase())
  world.views.save(
    {
      table: t.id,
      ...(was ? { id: was.id } : {}),
      name,
      config,
      isDefault: !!isDefault,
      madeBy: 'kit',
      kitHash: hashOf(config),
    },
    kitCtx,
  )
  return `The view ${name} on ${t.name} is the kit's again.`
}

// A change of the person's to a maintained kit (decision 3b) the maintainer has not seen.
export function recordChange(
  world: World,
  moduleId: string,
  words: string,
  call: unknown,
  by: string,
): void {
  run(
    world.db,
    'INSERT INTO kit_changes (id, module_id, words, call, at, by) VALUES (?, ?, ?, ?, ?, ?)',
    newId('g'),
    moduleId,
    words,
    call === undefined ? null : JSON.stringify(call),
    now(),
    by,
  )
}

export function unseenChanges(world: World, moduleId: string): number {
  return Number(
    one<{ n: number }>(
      world.db,
      'SELECT count(*) AS n FROM kit_changes WHERE module_id = ? AND seen_at IS NULL',
      moduleId,
    )?.n ?? 0,
  )
}
