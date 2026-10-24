import { TONES } from '@alpha/kit-sdk'
import { json, one, parse, run, tx } from '../db.ts'
import { columnsOf, dropFieldSql, junctionName, junctionSql, quote } from '../ddl.ts'
import { append } from '../journal.ts'
import { Refused } from '../kinds.ts'
import { slugTaken, writeManifest } from './manifest.ts'
import type { Shape } from './shape.ts'
import type { AboutBy, PeopleMap, Table, Tone, WriteCtx } from './types.ts'
import { findField, freeSlug, slugify, spec } from './types.ts'

export function rename(
  shape: Shape,
  what: { table: string; field?: string },
  to: string,
  ctx: WriteCtx,
): Table {
  if (!to.trim()) throw new Refused('A new name is needed.')
  return tx(shape.db, () => {
    const table = shape.table(what.table)
    if (!table) throw new Refused('That table is not there.')
    let words: string
    if (what.field) {
      const field = findField(table, what.field)
      const slug = shape.freeFieldSlug(table, to, field.kind, field.many, field.id)
      run(shape.db, 'UPDATE fields SET name = ?, slug = ? WHERE id = ?', to.trim(), slug, field.id)
      if (slug !== field.slug) {
        if (field.kind === 'relation' && field.many)
          shape.db.exec(
            `ALTER TABLE ${quote(junctionName(table.slug, field.slug))} RENAME TO ${quote(junctionName(table.slug, slug))}`,
          )
        else
          for (const [was, is] of columnsOf(spec(field)).map((c, i): [string, string] => [
            c.name,
            columnsOf(spec({ ...field, slug })).map((x) => x.name)[i] as string,
          ]))
            shape.db.exec(
              `ALTER TABLE ${quote(table.slug)} RENAME COLUMN ${quote(was)} TO ${quote(is)}`,
            )
      }
      words = `Renamed ${field.name} to ${to.trim()} in ${table.name}.`
    } else {
      const slug = freeSlug(slugify(to), (s) => s !== table.slug && slugTaken(shape, s))
      run(shape.db, 'UPDATE tables SET name = ?, slug = ? WHERE id = ?', to.trim(), slug, table.id)
      if (slug !== table.slug) {
        shape.db.exec(`ALTER TABLE ${quote(table.slug)} RENAME TO ${quote(slug)}`)
        for (const f of table.fields)
          if (f.kind === 'relation' && f.many)
            shape.db.exec(
              `ALTER TABLE ${quote(junctionName(table.slug, f.slug))} RENAME TO ${quote(junctionName(slug, f.slug))}`,
            )
      }
      words = `Renamed the table ${table.name} to ${to.trim()}.`
    }
    append(shape.db, {
      actor: ctx.actor,
      kind: 'shaped',
      words,
      data: { table: table.id, field: what.field ?? null, to },
      user: ctx.user ?? null,
      turn: ctx.turn ?? null,
      module: table.module.id,
      run: ctx.run ?? null,
    })
    writeManifest(shape, table.module)
    return shape.table(table.id) as Table
  })
}

export function setChoices(
  shape: Shape,
  tableId: string,
  field: string,
  choices: string[],
  ctx: WriteCtx,
): Table {
  return tx(shape.db, () => {
    const table = shape.table(tableId)
    if (!table) throw new Refused('That table is not there.')
    const f = findField(table, field)
    if (f.kind !== 'choice') throw new Refused(`${f.name} is not a choice field.`)
    run(
      shape.db,
      'UPDATE fields SET options = ? WHERE id = ?',
      json({ choices, ...(Object.keys(f.tones).length ? { tones: f.tones } : {}) }),
      f.id,
    )
    append(shape.db, {
      actor: ctx.actor,
      kind: 'shaped',
      words: `${f.name} in ${table.name} now offers ${choices.join(', ')}.`,
      data: { table: table.id, field: f.id, choices },
      user: ctx.user ?? null,
      turn: ctx.turn ?? null,
      module: table.module.id,
      run: ctx.run ?? null,
    })
    writeManifest(shape, table.module)
    return shape.table(table.id) as Table
  })
}

// The colours of a choice field's choices (a kit's: Fits in green). Only the state colours.
export function setTones(
  shape: Shape,
  tableId: string,
  field: string,
  tones: Record<string, Tone>,
): void {
  const table = shape.table(tableId)
  if (!table) throw new Refused('That table is not there.')
  const f = findField(table, field)
  if (f.kind !== 'choice') throw new Refused(`${f.name} is not a choice field.`)
  for (const t of Object.values(tones))
    if (!TONES.includes(t)) throw new Refused(`${t} is not one of ${TONES.join(', ')}.`)
  run(
    shape.db,
    'UPDATE fields SET options = ? WHERE id = ?',
    json({ choices: f.choices, ...(Object.keys(tones).length ? { tones } : {}) }),
    f.id,
  )
  writeManifest(shape, table.module)
}

// One sentence on what a table or a field means (the semantic layer, Kenil, 24 Oct), and whose it
// is: the person's stands, so a kit's update or Alpha's guess never writes over it; the kit's and
// Alpha's give way to anyone. Says whether anything changed.
export function describe(
  shape: Shape,
  where: { table: string; field?: string },
  about: string | null,
  by: AboutBy,
  ctx: WriteCtx,
): boolean {
  const table = shape.table(where.table)
  if (!table) throw new Refused('That table is not there.')
  const f = where.field ? findField(table, where.field) : null
  const was = f ? { about: f.about, by: f.aboutBy } : { about: table.about, by: table.aboutBy }
  const text = about?.trim().replace(/\s+/g, ' ') || null
  if (text && text.length > 300)
    throw new Refused('An about is one sentence: under 300 characters.')
  if (was.by === 'person' && by !== 'person') return false
  if (was.about === text) return false
  run(
    shape.db,
    f
      ? 'UPDATE fields SET about = ?, about_by = ? WHERE id = ?'
      : 'UPDATE tables SET about = ?, about_by = ? WHERE id = ?',
    text,
    text ? by : null,
    f ? f.id : table.id,
  )
  append(shape.db, {
    actor: ctx.actor,
    kind: 'shaped',
    words: text
      ? `${f ? `${f.name} in ${table.name}` : table.name}: ${text}`
      : `Took the sentence off ${f ? `${f.name} in ${table.name}` : table.name}.`,
    data: { table: table.id, ...(f ? { field: f.id } : {}), about: text, by },
    user: ctx.user ?? null,
    turn: ctx.turn ?? null,
    module: table.module.id,
    run: ctx.run ?? null,
  })
  writeManifest(shape, table.module)
  return true
}

// The kinds of document a table's rows take (a deal's teaser, CIM, NDA), or none named.
export function setDocuments(
  shape: Shape,
  tableId: string,
  kinds: string[] | null,
  ctx: WriteCtx,
): Table {
  return tx(shape.db, () => {
    const table = shape.table(tableId)
    if (!table) throw new Refused('That table is not there.')
    const clean = kinds ? [...new Set(kinds.map((k) => k.trim()).filter(Boolean))] : null
    if (JSON.stringify(clean) === JSON.stringify(table.documents)) return table
    run(
      shape.db,
      'UPDATE tables SET documents = ? WHERE id = ?',
      clean ? json(clean) : null,
      table.id,
    )
    append(shape.db, {
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
    writeManifest(shape, table.module)
    return shape.table(table.id) as Table
  })
}

// How a table's rows name people, by its fields' names; a field it names must be there. The
// people the rows name are derived again by the caller (People.mapTable).
export function setPeople(
  shape: Shape,
  tableId: string,
  map: PeopleMap | null,
  ctx: WriteCtx,
): Table {
  return tx(shape.db, () => {
    const table = shape.table(tableId)
    if (!table) throw new Refused('That table is not there.')
    if (map) {
      const named =
        map.each === 'person'
          ? [map.name, map.emails, map.phones, map.profile, map.company, map.title, map.you?.field]
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
    run(shape.db, 'UPDATE tables SET people = ? WHERE id = ?', map ? json(map) : null, table.id)
    append(shape.db, {
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
    writeManifest(shape, table.module)
    return shape.table(table.id) as Table
  })
}

// In the sidebar or out of it; the person's choice, journaled.
export function setHidden(shape: Shape, tableId: string, hidden: boolean, ctx: WriteCtx): Table {
  return tx(shape.db, () => {
    const table = shape.table(tableId)
    if (!table) throw new Refused('That table is not there.')
    if (table.hidden === hidden) return table
    run(shape.db, 'UPDATE tables SET hidden = ? WHERE id = ?', hidden ? 1 : 0, table.id)
    append(shape.db, {
      actor: ctx.actor,
      kind: 'shaped',
      words: hidden
        ? `Took ${table.name} out of the sidebar.`
        : `Put ${table.name} in the sidebar.`,
      data: { table: table.id, hidden },
      user: ctx.user ?? null,
      module: table.module.id,
    })
    return shape.table(table.id) as Table
  })
}

// A relation that held one row comes to hold a list (a kit's newer version says many): its
// junction table is made, each row's one pointer becomes its first entry, the column goes.
export function setMany(shape: Shape, tableId: string, field: string, ctx: WriteCtx): Table {
  return tx(shape.db, () => {
    const table = shape.table(tableId)
    if (!table) throw new Refused('That table is not there.')
    const f = findField(table, field)
    if (f.kind !== 'relation') throw new Refused(`${f.name} is not a relation.`)
    if (f.many) return table
    const next = { ...spec(f), many: true }
    for (const sql of junctionSql(table.slug, next, table.id)) shape.db.exec(sql)
    run(
      shape.db,
      `INSERT INTO ${quote(junctionName(table.slug, f.slug))} (record_id, other_id, position)
       SELECT id, ${quote(f.slug)}, 0 FROM ${quote(table.slug)} WHERE ${quote(f.slug)} IS NOT NULL`,
    )
    for (const sql of dropFieldSql(table.slug, table.id, spec(f))) shape.db.exec(sql)
    const o = parse<Record<string, unknown>>(
      one<{ options: string }>(shape.db, 'SELECT options FROM fields WHERE id = ?', f.id)?.options,
      {},
    )
    run(shape.db, 'UPDATE fields SET options = ? WHERE id = ?', json({ ...o, many: true }), f.id)
    append(shape.db, {
      actor: ctx.actor,
      kind: 'shaped',
      words: `${f.name} in ${table.name} now holds a list of rows.`,
      data: { table: table.id, field: f.id, many: true },
      user: ctx.user ?? null,
      turn: ctx.turn ?? null,
      module: table.module.id,
      run: ctx.run ?? null,
    })
    writeManifest(shape, table.module)
    return shape.table(table.id) as Table
  })
}

// A kit field's stable name, set once on a field that had none (a world from before keys).
export function setKey(shape: Shape, fieldId: string, key: string): void {
  run(shape.db, 'UPDATE fields SET key = ? WHERE id = ? AND key IS NULL', key, fieldId)
}
