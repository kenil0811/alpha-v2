// Modules, tables and fields (design §4, §10). A module is also a directory: module.yaml mirrors
// its tables from the world on every change, and NOTES.md is the module's notes.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { stringify } from 'yaml'
import { all, type Db, json, newId, now, one, parse, run, tx } from './db.ts'
import { type Actor, append } from './journal.ts'
import { FIELD_KINDS, type FieldKind, Refused } from './kinds.ts'

export interface Module {
  id: string
  name: string
  slug: string
  dir: string
}

export interface Field {
  id: string
  name: string
  slug: string
  kind: FieldKind
  choices: string[]
  relatesTo: string | null
}

export interface Table {
  id: string
  module: Module
  name: string
  slug: string
  hidden: boolean // out of the sidebar
  fields: Field[]
}

export interface FieldInput {
  name: string
  kind: FieldKind
  choices?: string[]
  relatesTo?: string // a table, for a relation
}

export interface WriteCtx {
  actor: Actor
  user?: string | null
  turn?: string | null
  run?: string | null
}

// Names the model and SQL can both use: lower case, words joined by underscores.
export function slugify(name: string): string {
  const s = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return s && /^[a-z]/.test(s) ? s : `t_${s || 'unnamed'}`
}

// Names no table may take: the world's own tables and SQL's words.
const RESERVED = new Set([
  'journal',
  'users',
  'modules',
  'tables',
  'fields',
  'records',
  'record_versions',
  'cards',
  'files',
  'documents',
  'chunks',
  'desk_sessions',
  'meta',
  'select',
  'from',
  'where',
  'table',
  'order',
  'group',
  'id',
])

function freeSlug(base: string, taken: (slug: string) => boolean): string {
  let slug = RESERVED.has(base) ? `${base}_table` : base
  for (let n = 2; taken(slug); n++) slug = `${base}_${n}`
  return slug
}

export class Shape {
  private db: Db
  private modulesDir: string

  constructor(db: Db, modulesDir: string) {
    this.db = db
    this.modulesDir = modulesDir
  }

  modules(): Module[] {
    return all<{ id: string; name: string; slug: string }>(
      this.db,
      'SELECT id, name, slug FROM modules ORDER BY created_at',
    ).map((m) => ({ ...m, dir: join(this.modulesDir, m.slug) }))
  }

  module(idOrName: string): Module | undefined {
    const m = one<{ id: string; name: string; slug: string }>(
      this.db,
      'SELECT id, name, slug FROM modules WHERE id = ? OR slug = ? OR lower(name) = lower(?)',
      idOrName,
      slugify(idOrName),
      idOrName,
    )
    return m ? { ...m, dir: join(this.modulesDir, m.slug) } : undefined
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
      const m = { id, name: name.trim(), slug, dir: join(this.modulesDir, slug) }
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
    const t = one<{ id: string; module_id: string; name: string; slug: string; hidden: number }>(
      this.db,
      'SELECT id, module_id, name, slug, hidden FROM tables WHERE id = ? OR slug = ? OR lower(name) = lower(?)',
      idOrName,
      slugify(idOrName),
      idOrName,
    )
    if (!t) return undefined
    const module = this.module(t.module_id) as Module
    const fields = all<{
      id: string
      name: string
      slug: string
      kind: FieldKind
      options: string
    }>(
      this.db,
      'SELECT id, name, slug, kind, options FROM fields WHERE table_id = ? ORDER BY position',
      t.id,
    ).map((f) => {
      const o = parse<{ choices?: string[]; relatesTo?: string }>(f.options, {})
      return {
        id: f.id,
        name: f.name,
        slug: f.slug,
        kind: f.kind,
        choices: o.choices ?? [],
        relatesTo: o.relatesTo ?? null,
      }
    })
    return { id: t.id, module, name: t.name, slug: t.slug, hidden: t.hidden === 1, fields }
  }

  makeTable(
    moduleId: string,
    name: string,
    fields: FieldInput[],
    ctx: WriteCtx,
    options: { hidden?: boolean } = {},
  ): Table {
    if (!name.trim()) throw new Refused('A table needs a name.')
    return tx(this.db, () => {
      const module = this.module(moduleId)
      if (!module) throw new Refused('That module is not there.')
      if (one(this.db, 'SELECT 1 FROM tables WHERE lower(name) = lower(?)', name.trim()))
        throw new Refused(`There is already a table called ${name.trim()}.`)
      const id = newId('t')
      const slug = freeSlug(
        slugify(name),
        (s) => !!one(this.db, 'SELECT 1 FROM tables WHERE slug = ?', s),
      )
      run(
        this.db,
        'INSERT INTO tables (id, module_id, name, slug, made_by, created_at, hidden) VALUES (?, ?, ?, ?, ?, ?, ?)',
        id,
        module.id,
        name.trim(),
        slug,
        actorName(ctx.actor),
        now(),
        options.hidden ? 1 : 0,
      )
      for (const f of fields) this.insertField(id, f)
      const table = this.table(id) as Table
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

  rename(what: { table: string; field?: string }, to: string, ctx: WriteCtx): Table {
    if (!to.trim()) throw new Refused('A new name is needed.')
    return tx(this.db, () => {
      const table = this.table(what.table)
      if (!table) throw new Refused('That table is not there.')
      let words: string
      if (what.field) {
        const field = findField(table, what.field)
        const slug = freeSlug(slugify(to), (s) =>
          table.fields.some((f) => f.slug === s && f.id !== field.id),
        )
        run(this.db, 'UPDATE fields SET name = ?, slug = ? WHERE id = ?', to.trim(), slug, field.id)
        words = `Renamed ${field.name} to ${to.trim()} in ${table.name}.`
      } else {
        const slug = freeSlug(
          slugify(to),
          (s) => !!one(this.db, 'SELECT 1 FROM tables WHERE slug = ? AND id != ?', s, table.id),
        )
        run(this.db, 'UPDATE tables SET name = ?, slug = ? WHERE id = ?', to.trim(), slug, table.id)
        words = `Renamed the table ${table.name} to ${to.trim()}.`
      }
      append(this.db, {
        actor: ctx.actor,
        kind: 'shaped',
        words,
        data: { table: table.id, field: what.field ?? null, to },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        module: table.module.id,
        run: ctx.run ?? null,
      })
      this.writeManifest(table.module)
      return this.table(table.id) as Table
    })
  }

  setChoices(tableId: string, field: string, choices: string[], ctx: WriteCtx): Table {
    return tx(this.db, () => {
      const table = this.table(tableId)
      if (!table) throw new Refused('That table is not there.')
      const f = findField(table, field)
      if (f.kind !== 'choice') throw new Refused(`${f.name} is not a choice field.`)
      run(this.db, 'UPDATE fields SET options = ? WHERE id = ?', json({ choices }), f.id)
      append(this.db, {
        actor: ctx.actor,
        kind: 'shaped',
        words: `${f.name} in ${table.name} now offers ${choices.join(', ')}.`,
        data: { table: table.id, field: f.id, choices },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        module: table.module.id,
        run: ctx.run ?? null,
      })
      this.writeManifest(table.module)
      return this.table(table.id) as Table
    })
  }

  // In the sidebar or out of it; the person's choice, journaled.
  setHidden(tableId: string, hidden: boolean, ctx: WriteCtx): Table {
    return tx(this.db, () => {
      const table = this.table(tableId)
      if (!table) throw new Refused('That table is not there.')
      if (table.hidden === hidden) return table
      run(this.db, 'UPDATE tables SET hidden = ? WHERE id = ?', hidden ? 1 : 0, table.id)
      append(this.db, {
        actor: ctx.actor,
        kind: 'shaped',
        words: hidden
          ? `Took ${table.name} out of the sidebar.`
          : `Put ${table.name} in the sidebar.`,
        data: { table: table.id, hidden },
        user: ctx.user ?? null,
        module: table.module.id,
      })
      return this.table(table.id) as Table
    })
  }

  // Removing a table removes its rows and their versions; the journal keeps that they were here.
  removeTable(tableId: string, ctx: WriteCtx): void {
    tx(this.db, () => {
      const table = this.table(tableId)
      if (!table) throw new Refused('That table is not there.')
      const count = Number(
        one<{ n: number }>(
          this.db,
          'SELECT count(*) AS n FROM records WHERE table_id = ?',
          table.id,
        )?.n ?? 0,
      )
      run(
        this.db,
        'DELETE FROM record_versions WHERE record_id IN (SELECT id FROM records WHERE table_id = ?)',
        table.id,
      )
      run(this.db, 'DELETE FROM records_fts WHERE table_id = ?', table.id)
      run(this.db, 'DELETE FROM records WHERE table_id = ?', table.id)
      run(this.db, 'DELETE FROM fields WHERE table_id = ?', table.id)
      run(this.db, 'DELETE FROM tables WHERE id = ?', table.id)
      append(this.db, {
        actor: ctx.actor,
        kind: 'removed',
        words: `Removed the table ${table.name}${count ? ` and its ${count} row${count === 1 ? '' : 's'}` : ''}.`,
        data: { table: table.id, name: table.name, rows: count },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        module: table.module.id,
        run: ctx.run ?? null,
      })
      this.writeManifest(table.module)
    })
  }

  private insertField(tableId: string, f: FieldInput): void {
    if (!f.name?.trim()) throw new Refused('Every field needs a name.')
    if (!(FIELD_KINDS as readonly string[]).includes(f.kind))
      throw new Refused(
        `"${f.kind}" is not a kind of field; the kinds are ${FIELD_KINDS.join(', ')}.`,
      )
    if (f.kind === 'relation' && (!f.relatesTo || !this.table(f.relatesTo)))
      throw new Refused(`${f.name} relates to a table that is not there.`)
    const taken = (s: string) =>
      !!one(this.db, 'SELECT 1 FROM fields WHERE table_id = ? AND slug = ?', tableId, s)
    if (taken(slugify(f.name))) throw new Refused(`There is already a field called ${f.name}.`)
    const slug = freeSlug(slugify(f.name), taken)
    const position = Number(
      one<{ n: number }>(
        this.db,
        'SELECT coalesce(max(position), -1) + 1 AS n FROM fields WHERE table_id = ?',
        tableId,
      )?.n ?? 0,
    )
    const options = {
      ...(f.choices?.length ? { choices: f.choices } : {}),
      ...(f.relatesTo ? { relatesTo: (this.table(f.relatesTo) as Table).id } : {}),
    }
    run(
      this.db,
      'INSERT INTO fields (id, table_id, name, slug, kind, options, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
      newId('f'),
      tableId,
      f.name.trim(),
      slug,
      f.kind,
      json(options),
      position,
    )
  }

  // module.yaml mirrors the module's tables from the world; the world is the truth.
  private writeManifest(m: Module): void {
    mkdirSync(m.dir, { recursive: true })
    const manifest = {
      name: m.name,
      tables: this.tables(m.id).map((t) => ({
        name: t.name,
        fields: t.fields.map((f) => ({
          name: f.name,
          kind: f.kind,
          ...(f.choices.length ? { choices: f.choices } : {}),
          ...(f.relatesTo ? { relates_to: this.table(f.relatesTo)?.name } : {}),
        })),
      })),
      network: [],
    }
    writeFileSync(join(m.dir, 'module.yaml'), stringify(manifest))
  }
}

export function findField(table: Table, nameOrSlug: string): Field {
  const f = table.fields.find(
    (x) =>
      x.id === nameOrSlug ||
      x.slug === slugify(nameOrSlug) ||
      x.name.toLowerCase() === nameOrSlug.toLowerCase(),
  )
  if (!f)
    throw new Refused(
      `${table.name} has no field called ${nameOrSlug}; it has ${table.fields.map((x) => x.name).join(', ') || 'none yet'}.`,
    )
  return f
}

export function actorName(a: Actor): string {
  return a.id ? `${a.kind}:${a.id}` : a.kind
}
