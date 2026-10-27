// Modules, tables and fields (design §4, §10). A module is also a directory: module.yaml mirrors
// its tables from the world on every change, and NOTES.md is the module's notes. The shape:
// modules and where they sit, tables and their fields made; changing fields is in fields.ts,
// removing in removal.ts, the folder's manifest and the check in manifest.ts, as functions of it.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { all, type Db, json, newId, now, one, parse, run, tx } from '../db.ts'
import { addFieldSql, columnsOf, createTableSql, OWN_COLUMNS, quote } from '../ddl.ts'
import { append } from '../journal.ts'
import { FIELD_KINDS, type FieldKind, Refused } from '../kinds.ts'
import {
  describe,
  rename,
  setChoices,
  setDocuments,
  setHidden,
  setKey,
  setMany,
  setPeople,
  setTones,
  tonesSetByOthers,
} from './fields.ts'
import { check, slugTaken, writeManifest } from './manifest.ts'
import { partRows, partsOf, setPartOf, setSetup } from './parts.ts'
import {
  clearPointers,
  hiddenFields,
  hideField,
  pointersAt,
  removeField,
  removeHiddenField,
  removeTable,
  tombstone,
  tombstoned,
} from './removal.ts'
import type {
  AboutBy,
  Field,
  FieldInput,
  Module,
  ModuleRow,
  PeopleMap,
  PlacedBy,
  Table,
  Tone,
  WriteCtx,
} from './types.ts'
import { actorName, freeSlug, slugify, spec } from './types.ts'

export class Shape {
  db: Db
  modulesDir: string
  // Told the rows a removed table took with it, before they go: the people they named.
  onGone: ((ids: string[]) => void) | null = null

  constructor(db: Db, modulesDir: string) {
    this.db = db
    this.modulesDir = modulesDir
  }

  asModule(m: ModuleRow): Module {
    return {
      id: m.id,
      name: m.name,
      slug: m.slug,
      dir: join(this.modulesDir, m.slug),
      parent: m.parent_id,
    }
  }

  modules(): Module[] {
    return all<ModuleRow>(
      this.db,
      'SELECT id, name, slug, parent_id FROM modules ORDER BY created_at',
    ).map((m) => this.asModule(m))
  }

  module(idOrName: string): Module | undefined {
    const m = one<ModuleRow>(
      this.db,
      'SELECT id, name, slug, parent_id FROM modules WHERE id = ? OR slug = ? OR lower(name) = lower(?)',
      idOrName,
      slugify(idOrName),
      idOrName,
    )
    return m ? this.asModule(m) : undefined
  }

  placedBy(moduleId: string): PlacedBy | null {
    return (
      one<{ placed_by: PlacedBy | null }>(
        this.db,
        'SELECT placed_by FROM modules WHERE id = ?',
        moduleId,
      )?.placed_by ?? null
    )
  }

  // A module inside another, or at the top level (within: null). Never inside itself or inside one
  // of its own modules. Who placed it is kept from the actor: a kit, the person or Alpha.
  place(moduleId: string, within: string | null, ctx: WriteCtx): Module {
    return tx(this.db, () => {
      const m = this.module(moduleId)
      if (!m) throw new Refused('That module is not there.')
      const parent = within ? this.module(within) : null
      if (within && !parent) throw new Refused(`There is no module called ${within}.`)
      if (parent?.id === m.id) throw new Refused(`${m.name} cannot sit inside itself.`)
      for (let p = parent; p?.parent; p = this.module(p.parent) ?? null)
        if (p.parent === m.id)
          throw new Refused(
            `${parent?.name} is inside ${m.name}, so ${m.name} cannot sit inside it.`,
          )
      const by: PlacedBy =
        ctx.actor.kind === 'person' ? 'person' : ctx.actor.kind === 'system' ? 'kit' : 'alpha'
      const was = m.parent ? this.module(m.parent) : undefined
      run(
        this.db,
        'UPDATE modules SET parent_id = ?, placed_by = ? WHERE id = ?',
        parent?.id ?? null,
        by,
        m.id,
      )
      if ((was?.id ?? null) !== (parent?.id ?? null))
        append(this.db, {
          actor: ctx.actor,
          kind: 'shaped',
          words: parent
            ? `Put ${m.name} inside ${parent.name}.`
            : `Moved ${m.name} out of ${was?.name}, to the top level.`,
          data: { module: m.id, within: parent?.id ?? null, was: was?.id ?? null },
          user: ctx.user ?? null,
          turn: ctx.turn ?? null,
          module: m.id,
          run: ctx.run ?? null,
        })
      const placed = this.module(m.id) as Module
      this.writeManifest(placed)
      return placed
    })
  }

  // A module and every module inside it, at any depth.
  within(moduleId: string): string[] {
    const all = this.modules()
    const out = [moduleId]
    for (let i = 0; i < out.length; i++)
      for (const m of all) if (m.parent === out[i] && !out.includes(m.id)) out.push(m.id)
    return out
  }

  makeModule(name: string, ctx: WriteCtx): Module {
    if (!name.trim()) throw new Refused('A module needs a name.')
    return tx(this.db, () => {
      if (this.module(name)) throw new Refused(`There is already a module called ${name}.`)
      const id = newId('m')
      const slug = freeSlug(
        slugify(name),
        (s) => !!one(this.db, 'SELECT 1 FROM modules WHERE slug = ?', s),
      )
      run(
        this.db,
        'INSERT INTO modules (id, name, slug, made_by, created_at) VALUES (?, ?, ?, ?, ?)',
        id,
        name.trim(),
        slug,
        actorName(ctx.actor),
        now(),
      )
      append(this.db, {
        actor: ctx.actor,
        kind: 'made',
        words: `Made the module ${name.trim()}.`,
        data: { module: id },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        module: id,
        run: ctx.run ?? null,
      })
      const m = { id, name: name.trim(), slug, dir: join(this.modulesDir, slug), parent: null }
      mkdirSync(m.dir, { recursive: true })
      const notes = join(m.dir, 'NOTES.md')
      if (!existsSync(notes)) writeFileSync(notes, `# ${m.name}\n`)
      this.writeManifest(m)
      return m
    })
  }

  tables(moduleId?: string): Table[] {
    const rows = all<{ id: string }>(
      this.db,
      `SELECT id FROM tables ${moduleId ? 'WHERE module_id = ?' : ''} ORDER BY created_at`,
      ...(moduleId ? [moduleId] : []),
    )
    return rows.map((r) => this.table(r.id) as Table)
  }

  table(idOrName: string): Table | undefined {
    const t = one<{
      id: string
      module_id: string
      name: string
      slug: string
      hidden: number
      setup: number
      documents: string | null
      people: string | null
      about: string | null
      about_by: AboutBy | null
    }>(
      this.db,
      'SELECT id, module_id, name, slug, hidden, setup, documents, people, about, about_by FROM tables WHERE id = ? OR slug = ? OR lower(name) = lower(?)',
      idOrName,
      slugify(idOrName),
      idOrName,
    )
    if (!t) return undefined
    const module = this.module(t.module_id) as Module
    // a field a kit no longer uses is hidden: its column stays, the table does not show it
    const fields = all<{
      id: string
      name: string
      slug: string
      kind: FieldKind
      options: string
      key: string | null
      about: string | null
      about_by: AboutBy | null
    }>(
      this.db,
      'SELECT id, name, slug, kind, options, key, about, about_by FROM fields WHERE table_id = ? AND hidden = 0 ORDER BY position',
      t.id,
    ).map((f) => {
      const o = parse<{
        choices?: string[]
        tones?: Record<string, Tone>
        relatesTo?: string
        many?: boolean
        partOf?: boolean
        indexed?: boolean
      }>(f.options, {})
      return {
        id: f.id,
        name: f.name,
        slug: f.slug,
        kind: f.kind,
        choices: o.choices ?? [],
        tones: o.tones ?? {},
        relatesTo: o.relatesTo ?? null,
        many: f.kind === 'relation' && !!o.many,
        partOf: f.kind === 'relation' && !o.many && !!o.partOf,
        indexed: !!o.indexed,
        key: f.key,
        about: f.about,
        aboutBy: f.about_by,
      }
    })
    return {
      id: t.id,
      module,
      name: t.name,
      slug: t.slug,
      hidden: t.hidden === 1,
      setup: t.setup === 1,
      fields,
      documents: t.documents ? parse<string[]>(t.documents, []) : null,
      people: t.people ? parse<PeopleMap | null>(t.people, null) : null,
      about: t.about,
      aboutBy: t.about_by,
    }
  }

  makeTable(
    moduleId: string,
    name: string,
    fields: FieldInput[],
    ctx: WriteCtx,
    options: { hidden?: boolean; setup?: boolean; about?: string; aboutBy?: AboutBy } = {},
  ): Table {
    if (!name.trim()) throw new Refused('A table needs a name.')
    return tx(this.db, () => {
      const module = this.module(moduleId)
      if (!module) throw new Refused('That module is not there.')
      if (one(this.db, 'SELECT 1 FROM tables WHERE lower(name) = lower(?)', name.trim()))
        throw new Refused(`There is already a table called ${name.trim()}.`)
      const id = newId('t')
      const slug = freeSlug(slugify(name), (s) => this.slugTaken(s))
      run(
        this.db,
        'INSERT INTO tables (id, module_id, name, slug, made_by, created_at, hidden, setup, about, about_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        id,
        module.id,
        name.trim(),
        slug,
        actorName(ctx.actor),
        now(),
        options.hidden ? 1 : 0,
        options.setup ? 1 : 0,
        options.about?.trim() || null,
        options.about?.trim() ? (options.aboutBy ?? 'person') : null,
      )
      for (const f of fields) this.insertField(id, f, false)
      const table = this.table(id) as Table
      for (const sql of createTableSql(table.slug, table.id, table.fields.map(spec)))
        this.db.exec(sql)
      append(this.db, {
        actor: ctx.actor,
        kind: 'made',
        words: `Made the table ${table.name} in ${module.name}${
          table.fields.length ? `, with ${table.fields.map((f) => f.name).join(', ')}` : ''
        }.`,
        data: { table: id, fields: table.fields.map((f) => ({ name: f.name, kind: f.kind })) },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        module: module.id,
        run: ctx.run ?? null,
      })
      this.writeManifest(module)
      return table
    })
  }

  addFields(tableId: string, fields: FieldInput[], ctx: WriteCtx): Table {
    return tx(this.db, () => {
      const table = this.table(tableId)
      if (!table) throw new Refused('That table is not there.')
      for (const f of fields) this.insertField(table.id, f)
      append(this.db, {
        actor: ctx.actor,
        kind: 'shaped',
        words: `Added ${fields.map((f) => f.name).join(', ')} to ${table.name}.`,
        data: { table: table.id, added: fields },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        module: table.module.id,
        run: ctx.run ?? null,
      })
      this.writeManifest(table.module)
      return this.table(table.id) as Table
    })
  }

  // A field: its catalogue row, then its column (or its junction table) on the real table; on a
  // table being made, the columns come with the CREATE TABLE instead.
  insertField(tableId: string, f: FieldInput, ddl = true): void {
    if (!f.name?.trim()) throw new Refused('Every field needs a name.')
    if (!(FIELD_KINDS as readonly string[]).includes(f.kind))
      throw new Refused(
        `"${f.kind}" is not a kind of field; the kinds are ${FIELD_KINDS.join(', ')}.`,
      )
    if (f.kind === 'relation' && (!f.relatesTo || !this.table(f.relatesTo)))
      throw new Refused(`${f.name} relates to a table that is not there.`)
    const table = this.table(tableId) as Table
    const many = f.kind === 'relation' && !!f.many
    if (f.partOf && (f.kind !== 'relation' || many))
      throw new Refused(`${f.name} can be part of a row only as a relation to one row.`)
    // a part is never without its row: on a table that has rows, an existing relation is made
    // part of with part_of, once every row has its row
    if (f.partOf && ddl && one(this.db, `SELECT 1 FROM ${quote(table.slug)} LIMIT 1`))
      throw new Refused(
        `${table.name} has rows already; add ${f.name} as a relation, fill it in, then make it part of.`,
      )
    if (table.fields.some((x) => x.slug === slugify(f.name)))
      throw new Refused(`There is already a field called ${f.name}.`)
    const slug = this.freeFieldSlug(table, f.name, f.kind, many, null)
    const position = Number(
      one<{ n: number }>(
        this.db,
        'SELECT coalesce(max(position), -1) + 1 AS n FROM fields WHERE table_id = ?',
        tableId,
      )?.n ?? 0,
    )
    const options = {
      ...(f.choices?.length ? { choices: f.choices } : {}),
      ...(f.tones && Object.keys(f.tones).length ? { tones: f.tones } : {}),
      ...(f.relatesTo ? { relatesTo: (this.table(f.relatesTo) as Table).id } : {}),
      ...(many ? { many: true } : {}),
      ...(f.partOf ? { partOf: true } : {}),
      ...(f.indexed && f.kind !== 'relation' ? { indexed: true } : {}),
    }
    const id = newId('f')
    run(
      this.db,
      'INSERT INTO fields (id, table_id, name, slug, kind, options, position, key, about, about_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      tableId,
      f.name.trim(),
      slug,
      f.kind,
      json(options),
      position,
      f.key ?? null,
      f.about?.trim() || null,
      f.about?.trim() ? (f.aboutBy ?? 'person') : null,
    )
    if (ddl)
      for (const sql of addFieldSql(table.slug, table.id, {
        id,
        slug,
        kind: f.kind,
        many,
        indexed: !!options.indexed,
      }))
        this.db.exec(sql)
  }

  // A slug no column of the table has: not a column every table has, not another field's, not
  // a money field's currency column. A name that is one steps aside as `<slug>_field`.
  freeFieldSlug(
    table: Table,
    name: string,
    kind: FieldKind,
    many: boolean,
    exceptId: string | null,
  ): string {
    const used = new Set<string>(OWN_COLUMNS)
    for (const x of table.fields)
      if (x.id !== exceptId) for (const c of columnsOf(spec(x))) used.add(c.name)
    const names = (slug: string) =>
      columnsOf({ id: '', slug, kind, many, indexed: false }).map((c) => c.name)
    const base = slugify(name)
    return freeSlug(OWN_COLUMNS.has(base) ? `${base}_field` : base, (s) =>
      names(s).some((n) => used.has(n)),
    )
  }

  rename(what: { table: string; field?: string }, to: string, ctx: WriteCtx): Table {
    return rename(this, what, to, ctx)
  }
  setChoices(tableId: string, field: string, choices: string[], ctx: WriteCtx): Table {
    return setChoices(this, tableId, field, choices, ctx)
  }
  setTones(tableId: string, field: string, tones: Record<string, Tone>, ctx: WriteCtx): void {
    setTones(this, tableId, field, tones, ctx)
  }
  tonesSetByOthers(fieldId: string): boolean {
    return tonesSetByOthers(this, fieldId)
  }
  describe(
    where: { table: string; field?: string },
    about: string | null,
    by: AboutBy,
    ctx: WriteCtx,
  ): boolean {
    return describe(this, where, about, by, ctx)
  }
  setDocuments(tableId: string, kinds: string[] | null, ctx: WriteCtx): Table {
    return setDocuments(this, tableId, kinds, ctx)
  }
  setPeople(tableId: string, map: PeopleMap | null, ctx: WriteCtx): Table {
    return setPeople(this, tableId, map, ctx)
  }
  setHidden(tableId: string, hidden: boolean, ctx: WriteCtx): Table {
    return setHidden(this, tableId, hidden, ctx)
  }
  setMany(tableId: string, field: string, ctx: WriteCtx): Table {
    return setMany(this, tableId, field, ctx)
  }
  setSetup(tableId: string, setup: boolean, ctx: WriteCtx): Table {
    return setSetup(this, tableId, setup, ctx)
  }
  setPartOf(tableId: string, field: string, partOf: boolean, ctx: WriteCtx): Table {
    return setPartOf(this, tableId, field, partOf, ctx)
  }
  partsOf(tableId: string): { table: Table; field: string }[] {
    return partsOf(this, tableId)
  }
  partRows(tableId: string, ids: string[]): { table: Table; ids: string[] }[] {
    return partRows(this, tableId, ids)
  }
  setKey(fieldId: string, key: string): void {
    setKey(this, fieldId, key)
  }
  removeTable(tableId: string, ctx: WriteCtx): void {
    removeTable(this, tableId, ctx)
  }
  removeField(tableId: string, field: string, ctx: WriteCtx): Table {
    return removeField(this, tableId, field, ctx)
  }
  hideField(tableId: string, field: string, ctx: WriteCtx): Table {
    return hideField(this, tableId, field, ctx)
  }
  hiddenFields(tableId: string): (Field & { rows: number })[] {
    return hiddenFields(this, tableId)
  }
  removeHiddenField(tableId: string, fieldId: string, ctx: WriteCtx): void {
    removeHiddenField(this, tableId, fieldId, ctx)
  }
  tombstone(
    moduleId: string,
    kind: 'field' | 'table' | 'row' | 'view',
    key: string,
    ctx: WriteCtx,
  ): void {
    tombstone(this, moduleId, kind, key, ctx)
  }
  tombstoned(moduleId: string, kind: 'field' | 'table' | 'row' | 'view', key: string): boolean {
    return tombstoned(this, moduleId, kind, key)
  }
  clearPointers(tableId: string, ids: string): number {
    return clearPointers(this, tableId, ids)
  }
  pointersAt(tableId: string, ids: string[]): number {
    return pointersAt(this, tableId, ids)
  }
  check(): string[] {
    return check(this)
  }
  slugTaken(slug: string): boolean {
    return slugTaken(this, slug)
  }
  writeManifest(m: Module): void {
    writeManifest(this, m)
  }
}
