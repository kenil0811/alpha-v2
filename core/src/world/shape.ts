// Modules, tables and fields (design §4, §10). A module is also a directory: module.yaml mirrors
// its tables from the world on every change, and NOTES.md is the module's notes.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseYaml, stringify } from 'yaml'
import { all, type Db, json, newId, now, one, parse, run, tx } from './db.ts'
import { type Actor, append } from './journal.ts'
import { FIELD_KINDS, type FieldKind, Refused } from './kinds.ts'
import { namedConfig, ViewConfig } from './views.ts'

export interface Module {
  id: string
  name: string
  slug: string
  dir: string
  parent: string | null // the module it sits inside, or none at the top level
}

// Who put a module where it is: a kit's place gives way to the person's or Alpha's on update.
export type PlacedBy = 'kit' | 'person' | 'alpha'

type ModuleRow = { id: string; name: string; slug: string; parent_id: string | null }

export interface Field {
  id: string
  name: string
  slug: string
  kind: FieldKind
  choices: string[]
  tones: Record<string, Tone> // a choice's colour where it means a state (Fits, Does not fit)
  relatesTo: string | null
}

// The colours a choice may take: the window's state colours, nothing else.
export type Tone = 'good' | 'warn' | 'bad' | 'accent'
export const TONES = ['good', 'warn', 'bad', 'accent'] as const

export interface Table {
  id: string
  module: Module
  name: string
  slug: string
  hidden: boolean // out of the sidebar
  fields: Field[]
  documents: string[] | null // the kinds of document its rows take, as its kit names them
  people: PeopleMap | null // how its rows name people
}

// How a table's rows name people (design §4), by its fields' names: each row is a person (a
// contact card, a LinkedIn connection), or an exchange with people (a message, a meeting), whose
// fields hold addresses as a message writes them: Name <address>, another@address.
export type PeopleMap =
  | {
      each: 'person'
      name?: string // none: their name comes from wherever else they are known
      emails?: string
      phones?: string
      profile?: string
      company?: string
      title?: string
      you?: { field: string; is: string } // the person's own card: Is you is yes
    }
  | {
      each: 'exchange'
      channel: string // mail, meeting
      at: string
      from?: string // who wrote it
      to?: string[] // whom it went to
      with?: string[] // everyone at it: a meeting's attendees
      sent?: { field: string; is: string } // the person's own: Direction is sent
      by?: string // who started it: a meeting's organizer
      about?: string // what it was about: a message's subject, a meeting's title
      you?: string // the person's own address in it
    }

export interface FieldInput {
  name: string
  kind: FieldKind
  choices?: string[]
  tones?: Record<string, Tone>
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
  'row_files',
  'permissions',
  'people',
  'companies',
  'people_keys',
  'people_sources',
  'people_links',
  'people_pairs',
  'exchanges',
  'tasks',
  'task_refs',
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
  // Told the rows a removed table took with it, before they go: the people they named.
  onGone: ((ids: string[]) => void) | null = null

  constructor(db: Db, modulesDir: string) {
    this.db = db
    this.modulesDir = modulesDir
  }

  private asModule(m: ModuleRow): Module {
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
      documents: string | null
      people: string | null
    }>(
      this.db,
      'SELECT id, module_id, name, slug, hidden, documents, people FROM tables WHERE id = ? OR slug = ? OR lower(name) = lower(?)',
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
      const o = parse<{ choices?: string[]; tones?: Record<string, Tone>; relatesTo?: string }>(
        f.options,
        {},
      )
      return {
        id: f.id,
        name: f.name,
        slug: f.slug,
        kind: f.kind,
        choices: o.choices ?? [],
        tones: o.tones ?? {},
        relatesTo: o.relatesTo ?? null,
      }
    })
    return {
      id: t.id,
      module,
      name: t.name,
      slug: t.slug,
      hidden: t.hidden === 1,
      fields,
      documents: t.documents ? parse<string[]>(t.documents, []) : null,
      people: t.people ? parse<PeopleMap | null>(t.people, null) : null,
    }
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
      run(
        this.db,
        'UPDATE fields SET options = ? WHERE id = ?',
        json({ choices, ...(Object.keys(f.tones).length ? { tones: f.tones } : {}) }),
        f.id,
      )
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

  // The colours of a choice field's choices (a kit's: Fits in green). Only the state colours.
  setTones(tableId: string, field: string, tones: Record<string, Tone>): void {
    const table = this.table(tableId)
    if (!table) throw new Refused('That table is not there.')
    const f = findField(table, field)
    if (f.kind !== 'choice') throw new Refused(`${f.name} is not a choice field.`)
    for (const t of Object.values(tones))
      if (!TONES.includes(t)) throw new Refused(`${t} is not one of ${TONES.join(', ')}.`)
    run(
      this.db,
      'UPDATE fields SET options = ? WHERE id = ?',
      json({ choices: f.choices, ...(Object.keys(tones).length ? { tones } : {}) }),
      f.id,
    )
    this.writeManifest(table.module)
  }

  // The kinds of document a table's rows take (a deal's teaser, CIM, NDA), or none named.
  setDocuments(tableId: string, kinds: string[] | null, ctx: WriteCtx): Table {
    return tx(this.db, () => {
      const table = this.table(tableId)
      if (!table) throw new Refused('That table is not there.')
      const clean = kinds ? [...new Set(kinds.map((k) => k.trim()).filter(Boolean))] : null
      if (JSON.stringify(clean) === JSON.stringify(table.documents)) return table
      run(
        this.db,
        'UPDATE tables SET documents = ? WHERE id = ?',
        clean ? json(clean) : null,
        table.id,
      )
      append(this.db, {
        actor: ctx.actor,
        kind: 'shaped',
        words: clean?.length
          ? `${table.name}'s rows take these documents: ${clean.join(', ')}.`
          : `${table.name}'s rows take documents of any kind.`,
        data: { table: table.id, documents: clean },
        user: ctx.user ?? null,
        turn: ctx.turn ?? null,
        module: table.module.id,
        run: ctx.run ?? null,
      })
      this.writeManifest(table.module)
      return this.table(table.id) as Table
    })
  }

  // How a table's rows name people, by its fields' names; a field it names must be there. The
  // people the rows name are derived again by the caller (People.mapTable).
  setPeople(tableId: string, map: PeopleMap | null, ctx: WriteCtx): Table {
    return tx(this.db, () => {
      const table = this.table(tableId)
      if (!table) throw new Refused('That table is not there.')
      if (map) {
        const named =
          map.each === 'person'
            ? [
                map.name,
                map.emails,
                map.phones,
                map.profile,
                map.company,
                map.title,
                map.you?.field,
              ]
            : [
                map.at,
                map.from,
                ...(map.to ?? []),
                ...(map.with ?? []),
                map.sent?.field,
                map.by,
                map.you,
                map.about,
              ]
        for (const n of named.filter((x): x is string => !!x)) findField(table, n)
        if (map.each === 'exchange' && !map.from && !map.with?.length)
          throw new Refused('An exchange names who wrote it (from) or who was at it (with).')
      }
      if (JSON.stringify(map) === JSON.stringify(table.people)) return table
      run(this.db, 'UPDATE tables SET people = ? WHERE id = ?', map ? json(map) : null, table.id)
      append(this.db, {
        actor: ctx.actor,
        kind: 'shaped',
        words: !map
          ? `${table.name}'s rows name no one now.`
          : map.each === 'person'
            ? `Each row of ${table.name} is a person.`
            : `Each row of ${table.name} is a ${map.channel} with people.`,
        data: { table: table.id, people: map },
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
      this.onGone?.(
        all<{ id: string }>(this.db, 'SELECT id FROM records WHERE table_id = ?', table.id).map(
          (r) => r.id,
        ),
      )
      run(
        this.db,
        'DELETE FROM record_versions WHERE record_id IN (SELECT id FROM records WHERE table_id = ?)',
        table.id,
      )
      run(this.db, 'DELETE FROM records_fts WHERE table_id = ?', table.id)
      run(
        this.db,
        'DELETE FROM row_files WHERE record_id IN (SELECT id FROM records WHERE table_id = ?)',
        table.id,
      )
      run(this.db, 'DELETE FROM records WHERE table_id = ?', table.id)
      run(this.db, 'DELETE FROM views WHERE table_id = ?', table.id)
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
      ...(f.tones && Object.keys(f.tones).length ? { tones: f.tones } : {}),
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

  // module.yaml mirrors the module's tables from the world; everything else in it (a kit's
  // version, its network allowlist) is kept as it is.
  // A table's saved views as module.yaml keeps them: by field name, so the module stays portable.
  private viewsOf(t: Table): { views?: unknown[] } {
    const rows = all<{ name: string; config: string; is_default: number }>(
      this.db,
      'SELECT name, config, is_default FROM views WHERE table_id = ? ORDER BY created_at',
      t.id,
    )
    if (!rows.length) return {}
    return {
      views: rows.map((v) => ({
        name: v.name,
        ...(v.is_default ? { default: true } : {}),
        ...given(namedConfig(t, ViewConfig.parse(parse(v.config, {})))),
      })),
    }
  }

  writeManifest(m: Module): void {
    mkdirSync(m.dir, { recursive: true })
    const file = join(m.dir, 'module.yaml')
    const kept = existsSync(file)
      ? ((parseYaml(readFileSync(file, 'utf8')) ?? {}) as Record<string, unknown>)
      : {}
    // where it sits, by the other module's name, so the folder says it too
    const { within: _within, ...rest } = kept
    const parent = m.parent ? this.module(m.parent) : undefined
    const manifest = {
      name: m.name,
      ...(parent ? { within: parent.name } : {}),
      ...rest,
      tables: this.tables(m.id).map((t) => ({
        name: t.name,
        fields: t.fields.map((f) => ({
          name: f.name,
          kind: f.kind,
          ...(f.choices.length ? { choices: f.choices } : {}),
          ...(Object.keys(f.tones).length ? { tones: f.tones } : {}),
          ...(f.relatesTo ? { relates_to: this.table(f.relatesTo)?.name } : {}),
        })),
        ...(t.documents ? { documents: t.documents } : {}),
        ...(t.people ? { people: t.people } : {}),
        ...this.viewsOf(t),
      })),
      network: Array.isArray(kept.network) ? kept.network : [],
    }
    writeFileSync(file, stringify(manifest))
  }
}

// Only the parts of a view that say something, so module.yaml stays short to read.
function given(c: ViewConfig): Partial<ViewConfig> {
  const plain = ViewConfig.parse({})
  return Object.fromEntries(
    Object.entries(c).filter(
      ([k, v]) =>
        JSON.stringify(v) !== JSON.stringify(plain[k as keyof ViewConfig]) &&
        !(k === 'filters' && !c.filters.rules.length),
    ),
  )
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

// A row as a person names it: its first text value.
export function rowName(t: Table, values: Record<string, unknown>): string {
  for (const f of t.fields)
    if (f.kind === 'text' && typeof values[f.slug] === 'string' && values[f.slug])
      return String(values[f.slug])
  return 'a row'
}

export function actorName(a: Actor): string {
  return a.id ? `${a.kind}:${a.id}` : a.kind
}
