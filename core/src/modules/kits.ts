// Kits (design §10): a module's folder with no person's rows, carrying setup rows. Install makes
// the tables empty, lands the setup rows as the kit's, and leaves the agents paused. Update keeps
// the ownership rule: what was installed and nobody changed is replaced; what the person (or
// Alpha) changed is theirs and kept; nothing is deleted. Kits live outside alpha-v2, in a client's
// own repository, and are installed from a folder.
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { parse } from 'yaml'
import { z } from 'zod'
import { all, now, one, run, tx } from '../world/db.ts'
import { FIELD_KINDS, Refused } from '../world/kinds.ts'
import {
  type FieldInput,
  type Module,
  type PeopleMap,
  TONES,
  type WriteCtx,
} from '../world/shape.ts'
import { hashOf, resolveConfig } from '../world/views.ts'
import type { World } from '../world/world.ts'
import { syncAgents } from './agents.ts'
import { commitAll } from './git.ts'

const Field = z.object({
  name: z.string(),
  kind: z.enum(FIELD_KINDS),
  choices: z.array(z.string()).optional(),
  tones: z.record(z.string(), z.enum(TONES)).optional(),
  relates_to: z.string().optional(),
})

const Manifest = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  // the module it sits inside, by name; made empty when there is none (Kenil, 20 Oct)
  within: z.string().min(1).optional(),
  tables: z
    .array(
      z.object({
        name: z.string(),
        fields: z.array(Field),
        // the kinds of document its rows take (a deal's teaser, CIM, NDA), filed on a row
        documents: z.array(z.string().min(1)).optional(),
        // how its rows name people, by its fields' names (world/shape.ts PeopleMap)
        people: z
          .union([
            z.object({
              each: z.literal('person'),
              name: z.string().optional(),
              emails: z.string().optional(),
              phones: z.string().optional(),
              profile: z.string().optional(),
              company: z.string().optional(),
              title: z.string().optional(),
              you: z.object({ field: z.string(), is: z.string() }).optional(),
            }),
            z.object({
              each: z.literal('exchange'),
              channel: z.string(),
              at: z.string(),
              from: z.string().optional(),
              to: z.array(z.string()).optional(),
              with: z.array(z.string()).optional(),
              sent: z.object({ field: z.string(), is: z.string() }).optional(),
              by: z.string().optional(),
              about: z.string().optional(),
              you: z.string().optional(),
            }),
          ])
          .optional(),
        // saved views by field name: name, default, then the view (world/views.ts ViewConfig)
        views: z
          .array(z.looseObject({ name: z.string(), default: z.boolean().optional() }))
          .default([]),
      }),
    )
    .default([]),
  network: z.array(z.string()).default([]),
})

// A setup row: its values by field name, and the ones the kit only assumes, each with what the
// assumption rests on (a thesis's financing, say), so they show as assumed until the person says.
const Setup = z.record(
  z.string(),
  z.array(
    z.object({
      key: z.string(),
      values: z.record(z.string(), z.unknown()),
      assumed: z.record(z.string(), z.string()).optional(),
    }),
  ),
)

export type KitManifest = z.infer<typeof Manifest>

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

export interface KitInfo {
  module: string
  kit: string
  version: string
  source: string
}

export function installedKits(world: World): KitInfo[] {
  return all<{ module_id: string; kit: string; version: string; source: string }>(
    world.db,
    'SELECT module_id, kit, version, source FROM kits ORDER BY installed_at',
  ).map((k) => ({ module: k.module_id, kit: k.kit, version: k.version, source: k.source }))
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
    }))
}

// Tables first without their relations, then the relations, so a table can point at one made
// after it. A newer version only adds: tables and fields are never removed by an update.
function shapeTables(world: World, module: Module, manifest: KitManifest, ctx: WriteCtx): void {
  for (const spec of manifest.tables) {
    const t = world.shape.table(spec.name)
    if (!t) world.shape.makeTable(module.id, spec.name, fieldsOf(spec, false), ctx)
    else if (t.module.id !== module.id)
      throw new Refused(`There is already a table called ${spec.name} in ${t.module.name}.`)
  }
  for (const spec of manifest.tables) {
    const t = world.shape.table(spec.name)
    if (!t) continue
    const missing = [...fieldsOf(spec, false), ...fieldsOf(spec, true)].filter(
      (f) => !t.fields.some((x) => x.name.toLowerCase() === f.name.toLowerCase()),
    )
    if (missing.length) world.shape.addFields(t.id, missing, ctx)
    for (const f of spec.fields) {
      if (f.kind !== 'choice') continue
      // a newer version's new choices go in where the kit has them, after the choice before them;
      // none is taken away
      const was = world.shape
        .table(t.id)
        ?.fields.find((x) => x.name.toLowerCase() === f.name.toLowerCase())
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
      if (f.tones) world.shape.setTones(t.id, f.name, f.tones)
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
  setup: z.infer<typeof Setup>,
  kit: string,
  ctx: WriteCtx,
  replaceable: (recordId: string) => boolean,
) {
  let landed = 0
  let kept = 0
  for (const [tableName, rows] of Object.entries(setup)) {
    const t = world.shape.table(tableName)
    if (!t)
      throw new Refused(`The kit's setup rows are for a table it does not make: ${tableName}.`)
    for (const row of rows) {
      const key = `setup:${row.key}`
      const existing = one<{ id: string }>(
        world.db,
        'SELECT id FROM records WHERE table_id = ? AND item_key = ?',
        t.id,
        key,
      )
      if (existing && !replaceable(existing.id)) {
        kept++
        continue
      }
      world.records.land(
        t.id,
        [{ key, values: row.values }],
        { connector: 'kit', account: kit },
        ctx,
      )
      const r = one<{ id: string; vals: string }>(
        world.db,
        'SELECT id, vals FROM records WHERE table_id = ? AND item_key = ?',
        t.id,
        key,
      )
      const assumed = Object.entries(row.assumed ?? {}).filter(([f]) => f in row.values)
      if (r && assumed.length) {
        world.records.change(
          t.id,
          [
            {
              id: r.id,
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
          r.id,
          rowHash(JSON.parse(r.vals)),
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
  const r = one<{ vals: string }>(world.db, 'SELECT vals FROM records WHERE id = ?', recordId)
  return r ? rowHash(JSON.parse(r.vals)) : null
}

export async function install(world: World, kitDir: string, ctx: WriteCtx): Promise<Module> {
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
    const rows = landSetup(world, setup, kitName, kitCtx, () => true)
    run(
      world.db,
      'INSERT INTO kits (module_id, kit, version, source, installed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      m.id,
      manifest.name,
      manifest.version,
      kitDir,
      now(),
      now(),
    )
    const agents = syncAgents(world, m, 'paused')
    world.line({
      actor: ctx.actor,
      kind: 'installed',
      words: `Installed ${kitName}: ${manifest.tables.length} table${manifest.tables.length === 1 ? '' : 's'}, ${rows.landed} setup row${rows.landed === 1 ? '' : 's'}${agents ? `, ${agents} agent${agents === 1 ? '' : 's'} (paused)` : ''}.`,
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
    const rows = landSetup(world, setup, kitName, kitCtx, (recordId) => {
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
      'UPDATE kits SET version = ?, source = ?, updated_at = ? WHERE module_id = ?',
      manifest.version,
      kitDir,
      now(),
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
