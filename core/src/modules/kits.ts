// Kits (design §10): a module's folder with no person's rows, carrying setup rows. Install makes
// the tables empty, lands the setup rows as the kit's, and leaves the agents paused. Update keeps
// the ownership rule: what was installed and nobody changed is replaced; what the person (or
// Alpha) changed is theirs and kept; nothing is deleted. Kits live outside alpha-v2, in a client's
// own repository, and are installed from a folder.
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { checkKit, type KitManifest, Manifest, Setup } from '@alpha/kit-sdk'
import { parse } from 'yaml'
import { z } from 'zod'
import { all, newId, now, one, run, tx } from '../world/db.ts'
import { Refused } from '../world/kinds.ts'
import type { FieldInput, Module, PeopleMap, Table, WriteCtx } from '../world/shape.ts'
import { hashOf, resolveConfig } from '../world/views.ts'
import type { World } from '../world/world.ts'
import { syncAgents } from './agents.ts'
import { commitAll } from './git.ts'

// module.yaml and setup.yaml are read by the kit API's own schema (kit-sdk), the same the
// checker and a kit author's editor use.
export type { KitManifest }

// What a kit carries besides its manifest and setup rows.
const SKIP = new Set(['module.yaml', 'setup.yaml', '.git', '.DS_Store', 'node_modules'])

function walk(root: string, dir = root, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(root, p, out)
    else if (e.isFile()) out.push(relative(root, p))
  }
  return out.sort()
}

const sha = (bytes: Buffer | string) =>
  createHash('sha256').update(bytes).digest('hex').slice(0, 16)

function rowHash(values: Record<string, unknown>): string {
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
  return { manifest: parsed.data, setup, files: walk(dir) }
}

// What the checker finds wrong, as one refusal; a missing api is taken as 1 for now (from the
// first public release it is required) and said in the install's words.
function checked(dir: string, world: World): { note: string } {
  const problems = checkKit(dir, {
    kits: installedKits(world).map((k) => ({ name: k.kit, version: k.version })),
  }).filter((p) => !p.startsWith('module.yaml says no api'))
  if (problems.length) throw new Refused(`The kit is not right: ${problems.join(' ')}`)
  const { manifest } = readKit(dir)
  return { note: manifest.api === undefined ? ' (module.yaml says no api; taken as 1)' : '' }
}

export interface KitInfo {
  module: string
  kit: string
  version: string
  source: string
  api: number
  maintainer: { name: string; address: string } | null
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
  }))
}

function fieldsOf(spec: KitManifest['tables'][number], withRelations: boolean): FieldInput[] {
  return spec.fields
    .filter((f) => (f.kind === 'relation') === withRelations)
    .map((f) => ({
      name: f.name,
      kind: f.kind,
      ...(f.choices ? { choices: f.choices } : {}),
      ...(f.tones ? { tones: f.tones } : {}),
      ...(f.relates_to ? { relatesTo: f.relates_to } : {}),
      ...(f.many ? { many: true } : {}),
      ...(f.indexed ? { indexed: true } : {}),
      key: f.key ?? f.name,
    }))
}

// Tables first without their relations, then the relations, so a table can point at one made
// after it. A kit's field is matched by its key (decision 3), so a rename the kit declares in
// its history is a rename in place; what the person removed stays removed (tombstones); a field
// the kit no longer uses is hidden, its rows kept. A newer version never removes data.
function shapeTables(world: World, module: Module, manifest: KitManifest, ctx: WriteCtx): void {
  const lower = (s: string) => s.toLowerCase()
  const tablesNamed = (name: string | undefined): Table[] =>
    name
      ? [world.shape.table(name)].filter((t): t is Table => !!t && t.module.id === module.id)
      : world.shape.tables(module.id)
  const byKey = (t: Table, key: string) =>
    t.fields.find((x) => lower(x.key ?? x.name) === lower(key))
  // the renames the kit declares, by key, before anything is matched
  for (const r of manifest.history?.renamed ?? [])
    for (const t of tablesNamed(r.table)) {
      const f = byKey(t, r.from)
      if (!f) continue
      if (lower(f.name) !== lower(r.to)) world.shape.rename({ table: t.id, field: f.id }, r.to, ctx)
      // its key follows the kit's field as it is now named: an explicit key, else the new name
      const spec = manifest.tables
        .find((x) => lower(x.name) === lower(t.name))
        ?.fields.find((x) => lower(x.name) === lower(r.to))
      run(world.db, 'UPDATE fields SET key = ? WHERE id = ?', spec?.key ?? r.to, f.id)
    }
  for (const spec of manifest.tables) {
    const t = world.shape.table(spec.name)
    if (!t) {
      if (world.shape.tombstoned(module.id, 'table', spec.name)) continue
      world.shape.makeTable(module.id, spec.name, fieldsOf(spec, false), ctx)
    } else if (t.module.id !== module.id)
      throw new Refused(`There is already a table called ${spec.name} in ${t.module.name}.`)
  }
  for (const spec of manifest.tables) {
    const before = world.shape.table(spec.name)
    if (!before) continue
    // a field from before keys is matched by its name once, and keyed from then on
    for (const f of before.fields)
      if (!f.key) {
        const sf = spec.fields.find((x) => lower(x.name) === lower(f.name))
        if (sf) world.shape.setKey(f.id, sf.key ?? sf.name)
      }
    const t = world.shape.table(before.id) as Table
    const missing = [...fieldsOf(spec, false), ...fieldsOf(spec, true)].filter(
      (f) =>
        !byKey(t, f.key as string) && !world.shape.tombstoned(module.id, 'field', f.key as string),
    )
    if (missing.length) world.shape.addFields(t.id, missing, ctx)
    // a relation the kit now says holds a list
    for (const f of spec.fields) {
      if (f.kind !== 'relation' || !f.many) continue
      const was = byKey(world.shape.table(t.id) as Table, f.key ?? f.name)
      if (was && !was.many) world.shape.setMany(t.id, was.name, ctx)
    }
    for (const f of spec.fields) {
      if (f.kind !== 'choice') continue
      // a newer version's new choices go in where the kit has them, after the choice before them;
      // none is taken away
      const was = byKey(world.shape.table(t.id) as Table, f.key ?? f.name)
      const kit = f.choices ?? []
      if (was && kit.some((c) => !was.choices.includes(c))) {
        const merged = [...was.choices]
        kit.forEach((c, i) => {
          if (merged.includes(c)) return
          const after = kit
            .slice(0, i)
            .reverse()
            .find((k) => merged.includes(k))
          merged.splice(after ? merged.indexOf(after) + 1 : 0, 0, c)
        })
        world.shape.setChoices(t.id, was.name, merged, ctx)
      }
      // a choice's colours come with the kit's version of it
      if (was && f.tones) world.shape.setTones(t.id, was.name, f.tones)
    }
    // the kinds of document its rows take: a newer version's new kinds join them, none goes
    if (spec.documents?.length) {
      const was = world.shape.table(t.id)?.documents ?? []
      const kinds = [...was, ...spec.documents.filter((k) => !was.includes(k))]
      if (kinds.length !== was.length) world.shape.setDocuments(t.id, kinds, ctx)
    }
    // how its rows name people, as the kit says; its rows are read for them again when it changes
    if (spec.people) world.people.mapTable(t.id, spec.people as PeopleMap, ctx)
  }
  // the fields the kit no longer uses: hidden, their rows kept
  for (const r of manifest.history?.removed ?? [])
    for (const t of tablesNamed(r.table)) {
      const f = byKey(t, r.key)
      if (f) world.shape.hideField(t.id, f.id, ctx)
    }
}

// A kit's views: made when the table has none by that name; on update, replaced while nobody has
// changed the kit's version (its hash is still there), else left as theirs.
function shapeViews(world: World, manifest: KitManifest, ctx: WriteCtx): void {
  for (const spec of manifest.tables) {
    const t = world.shape.table(spec.name)
    if (!t) continue
    for (const { name, default: isDefault, ...given } of spec.views) {
      const config = resolveConfig(t, given)
      const hash = hashOf(config)
      const was = world.views.list(t.id).find((v) => v.name.toLowerCase() === name.toLowerCase())
      if (!was && world.shape.tombstoned(t.module.id, 'view', `${t.name}:${name}`)) continue
      if (!was)
        world.views.save(
          { table: t.id, name, config, isDefault: !!isDefault, madeBy: 'kit', kitHash: hash },
          ctx,
        )
      else if (was.kitHash && was.kitHash !== hash)
        world.views.save({ table: t.id, id: was.id, name, config, kitHash: hash }, ctx)
    }
  }
}

function landSetup(
  world: World,
  moduleId: string,
  setup: z.infer<typeof Setup>,
  kit: string,
  ctx: WriteCtx,
  replaceable: (recordId: string) => boolean,
) {
  let landed = 0
  let kept = 0
  for (const [tableName, rows] of Object.entries(setup)) {
    const t = world.shape.table(tableName)
    if (!t && world.shape.tombstoned(moduleId, 'table', tableName)) {
      kept += rows.length // the person removed the table: its rows stay out
      continue
    }
    if (!t)
      throw new Refused(`The kit's setup rows are for a table it does not make: ${tableName}.`)
    for (const row of rows) {
      const key = `setup:${row.key}`
      const existing = world.records.byKey(t.id, key)
      if (existing && !replaceable(existing)) {
        kept++
        continue
      }
      if (!existing && world.shape.tombstoned(t.module.id, 'row', key)) {
        kept++ // removed by the person: stays removed
        continue
      }
      world.records.land(
        t.id,
        [{ key, values: row.values }],
        { connector: 'kit', account: kit },
        ctx,
      )
      const r = world.records.byKey(t.id, key)
      const assumed = Object.entries(row.assumed ?? {}).filter(([f]) => f in row.values)
      if (r && assumed.length) {
        world.records.change(
          t.id,
          [
            {
              id: r,
              values: Object.fromEntries(assumed.map(([f]) => [f, row.values[f]])),
              provenance: { kind: 'assumed', basis: assumed[0]?.[1] ?? '' },
              per_field: Object.fromEntries(
                assumed.map(([f, basis]) => [f, { kind: 'assumed' as const, basis }]),
              ),
            },
          ],
          ctx,
        )
      }
      if (r) {
        run(
          world.db,
          'INSERT OR REPLACE INTO kit_rows (record_id, installed_hash) VALUES (?, ?)',
          r,
          rowHash(world.records.rawValues(r)?.vals ?? {}),
        )
        landed++
      }
    }
  }
  return { landed, kept }
}

// Where the kit puts its module: inside the module it names, made empty when there is none. On
// update the kit's place stands only while nobody else has placed the module.
function placeModule(world: World, module: Module, within: string | undefined, ctx: WriteCtx) {
  const by = world.shape.placedBy(module.id)
  if (by === 'person' || by === 'alpha') return
  if (!within && by !== 'kit') return
  const parent = within ? (world.shape.module(within) ?? world.shape.makeModule(within, ctx)) : null
  if ((parent?.id ?? null) !== module.parent || by !== 'kit')
    world.shape.place(module.id, parent?.id ?? null, ctx)
}

function currentRowHash(world: World, recordId: string): string | null {
  const r = world.records.rawValues(recordId)
  return r ? rowHash(r.vals) : null
}

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
    syncAgents(world, module, 'paused')
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
