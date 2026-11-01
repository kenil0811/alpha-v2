import { TONES } from '@alpha/kit-sdk'
import { json, one, parse, run, tx } from '../db.ts'
import { addFieldSql, columnsOf, dropFieldSql, junctionName, junctionSql, quote } from '../ddl.ts'
import { append } from '../journal.ts'
import { Refused } from '../kinds.ts'
import { slugTaken, writeManifest } from './manifest.ts'
import { tableNameFree } from './naming.ts'
import type { Shape } from './shape.ts'
import { summariesReading } from './summary.ts'
import type { AboutBy, Field, PeopleMap, Table, Tone, WriteCtx } from './types.ts'
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
      tableNameFree(shape, table.id, to)
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
    // the rest of its options stay: whether it holds several, an index
    const o = parse<Record<string, unknown>>(
      one<{ options: string }>(shape.db, 'SELECT options FROM fields WHERE id = ?', f.id)?.options,
      {},
    )
    run(shape.db, 'UPDATE fields SET options = ? WHERE id = ?', json({ ...o, choices }), f.id)
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
// A choice field's colours, set by whoever sets them and journalled as theirs, so a kit's
// update leaves colours someone else set alone (item 42 of the problems list, 25 Oct).
export function setTones(
  shape: Shape,
  tableId: string,
  field: string,
  tones: Record<string, Tone>,
  ctx: WriteCtx,
): void {
  const table = shape.table(tableId)
  if (!table) throw new Refused('That table is not there.')
  const f = findField(table, field)
  if (f.kind !== 'choice') throw new Refused(`${f.name} is not a choice field.`)
  for (const t of Object.values(tones))
    if (!TONES.includes(t)) throw new Refused(`${t} is not one of ${TONES.join(', ')}.`)
  const same = (a: Record<string, Tone>, b: Record<string, Tone>) =>
    JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort())
  if (same(f.tones, tones)) return
  tx(shape.db, () => {
    run(
      shape.db,
      'UPDATE fields SET options = ? WHERE id = ?',
      json({ choices: f.choices, ...(Object.keys(tones).length ? { tones } : {}) }),
      f.id,
    )
    append(shape.db, {
      actor: ctx.actor,
      kind: 'shaped',
      words: `${f.name} in ${table.name} now shows its choices in new colours.`,
      data: { table: table.id, field: f.id, tones },
      user: ctx.user ?? null,
      turn: ctx.turn ?? null,
      module: table.module.id,
      run: ctx.run ?? null,
    })
  })
  writeManifest(shape, table.module)
}

// Whether a field's colours were last set by someone other than a kit (the person, Alpha): then
// they are theirs, and a kit's update keeps them.
export function tonesSetByOthers(shape: Shape, fieldId: string): boolean {
  const last = one<{ actor_kind: string; actor_id: string | null }>(
    shape.db,
    `SELECT actor_kind, actor_id FROM journal WHERE kind = 'shaped'
       AND json_extract(data, '$.field') = ? AND json_extract(data, '$.tones') IS NOT NULL
     ORDER BY id DESC LIMIT 1`,
    fieldId,
  )
  return !!last && !(last.actor_kind === 'system' && (last.actor_id ?? '').startsWith('kit:'))
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
// junction table is made, each row's one pointer becomes its first entry, the column goes. A
// choice comes to hold several (tags, core step 3c): each row's one choice becomes a list of it.
export function setMany(shape: Shape, tableId: string, field: string, ctx: WriteCtx): Table {
  return tx(shape.db, () => {
    const table = shape.table(tableId)
    if (!table) throw new Refused('That table is not there.')
    const f = findField(table, field)
    if (f.kind === 'choice') return setTags(shape, table, f, ctx)
    if (f.kind !== 'relation') throw new Refused(`${f.name} is not a relation or a choice.`)
    if (f.many) return table
    if (f.partOf) throw new Refused(`${f.name} makes ${table.name} part of a row: it holds one.`)
    const sums = summariesReading(shape, table.id, f.id).filter(
      (x) => x.field.summary?.through === f.id,
    )
    if (sums.length)
      throw new Refused(
        `${sums.map((x) => `${x.field.name} in ${x.table.name}`).join(' and ')} sum${sums.length === 1 ? 's' : ''} up ${table.name} through ${f.name}, so it holds one row.`,
      )
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

// A relation that held a list comes back to holding one row (a kit says one where an installed copy
// holds a list, core plan step 4): only when no row holds more than one, so nothing is lost; each
// row's one entry becomes its pointer, the junction table goes.
export function setOne(shape: Shape, tableId: string, field: string, ctx: WriteCtx): Table {
  return tx(shape.db, () => {
    const table = shape.table(tableId)
    if (!table) throw new Refused('That table is not there.')
    const f = findField(table, field)
    if (f.kind !== 'relation') throw new Refused(`${f.name} is not a relation.`)
    if (!f.many) return table
    const junction = quote(junctionName(table.slug, f.slug))
    const two = one<{ n: number }>(
      shape.db,
      `SELECT count(*) AS n FROM (SELECT record_id FROM ${junction} GROUP BY record_id HAVING count(*) > 1)`,
    )?.n
    if (two)
      throw new Refused(
        `${two} row${two === 1 ? '' : 's'} of ${table.name} name${two === 1 ? 's' : ''} more than one in ${f.name}, so it keeps its list.`,
      )
    const next = { ...spec(f), many: false }
    for (const sql of addFieldSql(table.slug, table.id, next)) shape.db.exec(sql)
    run(
      shape.db,
      `UPDATE ${quote(table.slug)} SET ${quote(f.slug)} =
         (SELECT other_id FROM ${junction} j WHERE j.record_id = ${quote(table.slug)}.id)`,
    )
    for (const sql of dropFieldSql(table.slug, table.id, spec(f))) shape.db.exec(sql)
    const { many: _, ...o } = parse<Record<string, unknown>>(
      one<{ options: string }>(shape.db, 'SELECT options FROM fields WHERE id = ?', f.id)?.options,
      {},
    )
    run(shape.db, 'UPDATE fields SET options = ? WHERE id = ?', json(o), f.id)
    append(shape.db, {
      actor: ctx.actor,
      kind: 'shaped',
      words: `${f.name} in ${table.name} holds one row again.`,
      data: { table: table.id, field: f.id, many: false },
      user: ctx.user ?? null,
      turn: ctx.turn ?? null,
      module: table.module.id,
      run: ctx.run ?? null,
    })
    writeManifest(shape, table.module)
    return shape.table(table.id) as Table
  })
}

function setTags(shape: Shape, table: Table, f: Field, ctx: WriteCtx): Table {
  if (f.tags) return table
  run(
    shape.db,
    `UPDATE ${quote(table.slug)} SET ${quote(f.slug)} = json_array(${quote(f.slug)}) WHERE ${quote(f.slug)} IS NOT NULL`,
  )
  const o = parse<Record<string, unknown>>(
    one<{ options: string }>(shape.db, 'SELECT options FROM fields WHERE id = ?', f.id)?.options,
    {},
  )
  run(shape.db, 'UPDATE fields SET options = ? WHERE id = ?', json({ ...o, many: true }), f.id)
  append(shape.db, {
    actor: ctx.actor,
    kind: 'shaped',
    words: `${f.name} in ${table.name} now holds several of its choices.`,
    data: { table: table.id, field: f.id, many: true },
    user: ctx.user ?? null,
    turn: ctx.turn ?? null,
    module: table.module.id,
    run: ctx.run ?? null,
  })
  writeManifest(shape, table.module)
  return shape.table(table.id) as Table
}

// A text field becomes the row's notes (core plan step 4, DealPilot's Notes): the same column,
// its values kept, now Markdown on the row's page and out of the grid. No other kind ever changes.
export function toNotes(shape: Shape, tableId: string, field: string, ctx: WriteCtx): Table {
  return tx(shape.db, () => {
    const table = shape.table(tableId)
    if (!table) throw new Refused('That table is not there.')
    const f = findField(table, field)
    if (f.kind === 'notes') return table
    if (f.kind !== 'text')
      throw new Refused(`${f.name} is ${f.kind}: only a text field becomes notes.`)
    if (table.fields.some((x) => x.kind === 'notes'))
      throw new Refused(`${table.name} has its notes already; a table has one place for notes.`)
    const sums = summariesReading(shape, table.id, f.id)
    if (sums.length)
      throw new Refused(
        `${sums.map((x) => `${x.field.name} in ${x.table.name}`).join(' and ')} read ${f.name}, and a summary never reads notes.`,
      )
    run(shape.db, "UPDATE fields SET kind = 'notes' WHERE id = ?", f.id)
    append(shape.db, {
      actor: ctx.actor,
      kind: 'shaped',
      words: `${f.name} in ${table.name} is the row's notes now: written on its page, out of the grid.`,
      data: { table: table.id, field: f.id, kind: { from: 'text', to: 'notes' } },
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
