import type { KitManifest, Setup } from '@alpha/kit-sdk'
import type { z } from 'zod'
import { run } from '../../world/db.ts'
import { Refused } from '../../world/kinds.ts'
import type { FieldInput, Module, PeopleMap, Table, WriteCtx } from '../../world/shape/index.ts'
import { hashOf, resolveConfig } from '../../world/views.ts'
import type { World } from '../../world/world.ts'
import { rowHash } from './read.ts'

// A table's fields of one sort: plain, relations, or summaries (which read the relations).
function fieldsOf(
  spec: KitManifest['tables'][number],
  sort: 'plain' | 'relation' | 'summary',
): FieldInput[] {
  const sortOf = (k: string) => (k === 'relation' || k === 'summary' ? k : 'plain')
  return spec.fields
    .filter((f) => sortOf(f.kind) === sort)
    .map((f) => ({
      name: f.name,
      kind: f.kind,
      ...(f.choices ? { choices: f.choices } : {}),
      ...(f.tones ? { tones: f.tones } : {}),
      ...(f.relates_to ? { relatesTo: f.relates_to } : {}),
      ...(f.many ? { many: true } : {}),
      ...(f.part_of ? { partOf: true } : {}),
      ...(f.summary ? { summary: f.summary } : {}),
      ...(f.indexed ? { indexed: true } : {}),
      key: f.key ?? f.name,
      ...(f.about ? { about: f.about, aboutBy: 'kit' as const } : {}),
    }))
}

// Tables first without their relations, then the relations, so a table can point at one made
// after it, then the summaries, which read the relations (core step 3c). A kit's field is matched by its key (decision 3), so a rename the kit declares in
// its history is a rename in place; what the person removed stays removed (tombstones); a field
// the kit no longer uses is hidden, its rows kept. A newer version removes only a table its
// history names as removed.
export function shapeTables(
  world: World,
  module: Module,
  manifest: KitManifest,
  ctx: WriteCtx,
): void {
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
      world.shape.makeTable(module.id, spec.name, fieldsOf(spec, 'plain'), ctx, {
        ...(spec.about ? { about: spec.about, aboutBy: 'kit' } : {}),
        ...(spec.setup ? { setup: true } : {}),
      })
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
    const missing = [...fieldsOf(spec, 'plain'), ...fieldsOf(spec, 'relation')].filter(
      (f) =>
        !byKey(t, f.key as string) && !world.shape.tombstoned(module.id, 'field', f.key as string),
    )
    if (missing.length) world.shape.addFields(t.id, missing, ctx)
    // a relation the kit now says holds a list, a choice that it holds several
    for (const f of spec.fields) {
      if ((f.kind !== 'relation' && f.kind !== 'choice') || !f.many) continue
      const was = byKey(world.shape.table(t.id) as Table, f.key ?? f.name)
      if (was && !was.many && !was.tags) world.shape.setMany(t.id, was.name, ctx)
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
      // a choice's colours come with the kit's version of it, unless someone else set them since
      // (item 42 of the problems list, 25 Oct): those are theirs, and stand
      if (was && f.tones && !world.shape.tonesSetByOthers(was.id))
        world.shape.setTones(t.id, was.name, f.tones, ctx)
    }
    // a relation the kit now says is part of its row (core step 3a); one whose rows don't all have
    // their row yet stays as it is, and says why
    for (const f of spec.fields) {
      if (f.kind !== 'relation' || !f.part_of) continue
      const was = byKey(world.shape.table(t.id) as Table, f.key ?? f.name)
      if (!was || was.partOf) continue
      try {
        world.shape.setPartOf(t.id, was.id, true, ctx)
      } catch (err) {
        if (!(err instanceof Refused)) throw err
        world.line({
          actor: ctx.actor,
          kind: 'noted',
          words: `${t.name} keeps its own tab for now: ${err.message}`,
          module: module.id,
        })
      }
    }
    // a new version's setup tables move under Agents and notes; where a table shows is the
    // person's after that, so a kit never takes one back out
    if (spec.setup && !(world.shape.table(t.id) as Table).setup)
      world.shape.setSetup(t.id, true, ctx)
    // what each means, as the kit says it; a sentence the person wrote stands (describe says so)
    if (spec.about) world.shape.describe({ table: t.id }, spec.about, 'kit', ctx)
    for (const f of spec.fields) {
      const was = byKey(world.shape.table(t.id) as Table, f.key ?? f.name)
      if (was && f.about) world.shape.describe({ table: t.id, field: was.id }, f.about, 'kit', ctx)
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
  // the summaries, once every table has its relations
  for (const spec of manifest.tables) {
    const t = world.shape.table(spec.name)
    if (!t || t.module.id !== module.id) continue
    const missing = fieldsOf(spec, 'summary').filter(
      (f) =>
        !byKey(t, f.key as string) && !world.shape.tombstoned(module.id, 'field', f.key as string),
    )
    if (missing.length) world.shape.addFields(t.id, missing, ctx)
  }
  // the fields the kit no longer uses: hidden, their rows kept
  for (const r of manifest.history?.removed ?? [])
    for (const t of tablesNamed(r.table)) {
      if (!r.key) continue
      const f = byKey(t, r.key)
      if (f) world.shape.hideField(t.id, f.id, ctx)
    }
  // the tables the kit no longer ships (a removal naming a table and no key): removed the way a
  // person removes one, rows and all, journaled and tombstoned (Vikas, 30 Oct; for Kenil's review)
  for (const r of manifest.history?.removed ?? []) {
    if (r.key || !r.table) continue
    const t = tablesNamed(r.table)[0]
    if (t) world.shape.removeTable(t.id, ctx)
  }
}

// A kit's views: made when the table has none by that name; on update, replaced while nobody has
// changed the kit's version (its hash is still there), else left as theirs.
export function shapeViews(world: World, manifest: KitManifest, ctx: WriteCtx): void {
  for (const spec of manifest.tables) {
    const t = world.shape.table(spec.name)
    if (!t) continue
    for (const { name, default: isDefault, about, ...given } of spec.views) {
      const config = resolveConfig(t, given)
      const hash = hashOf(config)
      const was = world.views.list(t.id).find((v) => v.name.toLowerCase() === name.toLowerCase())
      if (!was && world.shape.tombstoned(t.module.id, 'view', `${t.name}:${name}`)) continue
      const said = about ? { about } : {}
      if (!was)
        world.views.save(
          {
            table: t.id,
            name,
            config,
            isDefault: !!isDefault,
            madeBy: 'kit',
            kitHash: hash,
            ...said,
          },
          ctx,
        )
      else if (was.kitHash && (was.kitHash !== hash || (about && was.about !== about)))
        world.views.save({ table: t.id, id: was.id, name, config, kitHash: hash, ...said }, ctx)
    }
  }
}

export function landSetup(
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
export function placeModule(
  world: World,
  module: Module,
  within: string | undefined,
  ctx: WriteCtx,
) {
  const by = world.shape.placedBy(module.id)
  if (by === 'person' || by === 'alpha') return
  if (!within && by !== 'kit') return
  const parent = within ? (world.shape.module(within) ?? world.shape.makeModule(within, ctx)) : null
  if ((parent?.id ?? null) !== module.parent || by !== 'kit')
    world.shape.place(module.id, parent?.id ?? null, ctx)
}

export function currentRowHash(world: World, recordId: string): string | null {
  const r = world.records.rawValues(recordId)
  return r ? rowHash(r.vals) : null
}
