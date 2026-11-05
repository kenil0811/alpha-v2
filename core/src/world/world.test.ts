import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTableSql } from './ddl.ts'
import { Refused } from './kinds.ts'
import { lastingKeys } from './migrate30.ts'
import { MIGRATIONS } from './schema.ts'
import { World } from './world.ts'

let home: string
let world: World
const alpha = { kind: 'alpha' as const }
const person = { kind: 'person' as const, id: 'u_test' }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-world-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

function meals() {
  const m = world.shape.makeModule('Food', { actor: alpha })
  return world.shape.makeTable(
    m.id,
    'Meals',
    [
      { name: 'Food', kind: 'text' },
      { name: 'Quantity', kind: 'number' },
      { name: 'Meal', kind: 'choice', choices: ['breakfast', 'lunch', 'dinner'] },
    ],
    { actor: alpha },
  )
}

function said(words: string) {
  const owner = world.owner('Kenil')
  const line = world.line({
    actor: { kind: 'person', id: owner.id },
    kind: 'said',
    words,
    user: owner.id,
  })
  return { message: line.id, user: owner.id }
}

describe('the world', () => {
  it('makes its owner once', () => {
    const a = world.owner('Kenil')
    const b = world.owner('Someone else')
    expect(b).toEqual(a)
    expect(world.users()).toHaveLength(1)
  })

  it('reopens a world without running its migrations again', async () => {
    meals()
    world.close()
    world = await World.open(join(home, 'tenants', 't_test'))
    expect(world.shape.tables().map((t) => t.name)).toEqual(['Meals'])
  })

  it('makes a module as a directory with its manifest and notes', () => {
    const t = meals()
    expect(existsSync(join(t.module.dir, 'NOTES.md'))).toBe(true)
    const manifest = readFileSync(join(t.module.dir, 'module.yaml'), 'utf8')
    expect(manifest).toContain('name: Meals')
    expect(manifest).toContain('kind: number')
    const made = world.lines({ kinds: ['made'] }).map((l) => l.words)
    expect(made).toEqual([
      'Made the module Food.',
      'Made the table Meals in Food, with Food, Quantity, Meal.',
    ])
  })

  it('adds a row whose stated values point at the person’s words', () => {
    const t = meals()
    const s = said('log two eggs for breakfast')
    const [id] = world.records.add(
      t.id,
      [
        {
          values: { Food: 'eggs', Quantity: 2, Meal: 'breakfast' },
          provenance: { kind: 'stated' },
        },
      ],
      { actor: alpha, said: s },
    )
    const rows = world.records.list(t.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe(id)
    expect(rows[0]?.values).toEqual({ food: 'eggs', quantity: 2, meal: 'breakfast' })
    expect(rows[0]?.provenance.quantity?.kind).toBe('stated')
    expect(rows[0]?.provenance.quantity?.source.message).toBe(s.message)
    expect(world.lines({ kinds: ['wrote'] })[0]?.words).toBe(
      'Added a row to Meals: Food eggs, Quantity 2, Meal breakfast.',
    )
  })

  it('refuses a value without its provenance, or of the wrong kind', () => {
    const t = meals()
    const add = (values: Record<string, unknown>, provenance: object) =>
      world.records.add(t.id, [{ values, provenance: provenance as never }], { actor: alpha })
    expect(() => add({ Food: 'eggs' }, { kind: 'stated' })).toThrow(/person’s words/)
    expect(() => add({ Food: 'eggs' }, { kind: 'estimated' })).toThrow(/rests on/)
    expect(() => add({ Food: 'eggs' }, { kind: 'looked_up' })).toThrow(/where it was looked up/)
    expect(() => add({ Quantity: 'two' }, { kind: 'assumed', basis: 'a guess' })).toThrow(
      /takes a number/,
    )
    expect(() => add({ Meal: 'brunch' }, { kind: 'assumed', basis: 'a guess' })).toThrow(
      /one of "breakfast"/,
    )
    expect(() => add({ Colour: 'red' }, { kind: 'assumed', basis: 'a guess' })).toThrow(
      /no field called Colour/,
    )
    expect(world.records.list(t.id)).toHaveLength(0)
  })

  it('keeps a version per change, and a rename keeps the values', () => {
    const t = meals()
    const s = said('two eggs')
    const [id] = world.records.add(
      t.id,
      [{ values: { Food: 'eggs', Quantity: 2 }, provenance: { kind: 'stated' } }],
      {
        actor: alpha,
        said: s,
      },
    )
    world.records.change(
      t.id,
      [{ id: id as string, values: { Quantity: 3 }, provenance: { kind: 'stated' } }],
      {
        actor: alpha,
        said: said('make it three'),
      },
    )
    world.shape.rename({ table: 'Meals', field: 'Quantity' }, 'How many', { actor: alpha })
    const row = world.records.list(t.id)[0]
    expect(row?.version).toBe(2)
    expect(row?.values).toEqual({ food: 'eggs', how_many: 3 })
    const versions = world.db
      .prepare('SELECT version FROM versions WHERE record_id = ?')
      .all(id as string)
    expect(versions).toEqual([{ version: 1 }])
  })

  it('removes rows with everything related, and the journal keeps what they were', () => {
    const t = meals()
    const s = said('two eggs')
    const [id] = world.records.add(
      t.id,
      [{ values: { Food: 'eggs', Quantity: 2 }, provenance: { kind: 'stated' } }],
      {
        actor: alpha,
        said: s,
      },
    )
    world.records.change(
      t.id,
      [{ id: id as string, values: { Quantity: 3 }, provenance: { kind: 'stated' } }],
      {
        actor: alpha,
        said: said('make it three'),
      },
    )
    expect(world.records.remove(t.id, [id as string], { actor: alpha })).toBe(1)
    expect(world.records.list(t.id)).toHaveLength(0)
    expect(world.db.prepare('SELECT count(*) AS n FROM versions').get()).toEqual({ n: 0 })
    expect(world.search('eggs').filter((h) => h.what === 'record')).toHaveLength(0)
    const removed = world.lines({ kinds: ['removed'] })[0]
    expect(removed?.words).toBe('Removed a row from Meals: Food eggs, Quantity 3.')
    expect(() => world.db.exec("UPDATE journal SET words = 'x'")).toThrow(/append-only/)
    expect(() => world.db.exec('DELETE FROM journal')).toThrow(/never deleted/)
  })

  it('knows the person’s own entries from what the model made', () => {
    const t = meals()
    const [mine] = world.records.add(
      t.id,
      [{ values: { Food: 'eggs' }, provenance: { kind: 'stated' } }],
      {
        actor: alpha,
        said: said('eggs'),
      },
    )
    const [guess] = world.records.add(
      t.id,
      [{ values: { Food: 'toast' }, provenance: { kind: 'estimated', basis: 'usual breakfast' } }],
      { actor: alpha },
    )
    expect(world.records.personsOwn([mine as string])).toBe(true)
    expect(world.records.personsOwn([guess as string])).toBe(false)
  })
})

describe('migrations', () => {
  it('bring an older world up to date, backing it up first', async () => {
    const dir = join(home, 'tenants', 't_old')
    mkdirSync(dir, { recursive: true })
    const db = new DatabaseSync(join(dir, 'world.sqlite'))
    db.exec(MIGRATIONS[0] as string)
    db.exec('PRAGMA user_version = 1')
    db.close()
    const old = await World.open(dir)
    expect(old.db.prepare('PRAGMA user_version').get()).toEqual({ user_version: MIGRATIONS.length })
    expect(readdirSync(join(dir, 'backups'))).toEqual([
      expect.stringMatching(/^world-.*-v1\.sqlite$/),
    ])
    expect(old.connections.list()).toEqual([])
    old.close()
  })
})

describe('the lasting keys (migration 30, call 6)', () => {
  it('key the tables and modules kits and connectors made, by their names, and no others', async () => {
    const dir = join(home, 'tenants', 't_keys')
    mkdirSync(dir, { recursive: true })
    const db = new DatabaseSync(join(dir, 'world.sqlite'))
    const before = MIGRATIONS.indexOf(lastingKeys)
    for (const m of MIGRATIONS.slice(0, before)) typeof m === 'string' ? db.exec(m) : m(db)
    const at = '2026-10-31T09:00:00.000Z'
    const mod = db.prepare(
      'INSERT INTO modules (id, name, slug, made_by, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    mod.run('m_kit', 'Deals Hub', 'deals-hub', 'system:kit:DealPilot', at)
    mod.run('m_mail', 'Mail', 'mail', 'connector:gmail', at)
    mod.run('m_own', 'Garden', 'garden', 'person:u_1', at)
    db.prepare(
      'INSERT INTO kits (module_id, kit, version, source, installed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('m_kit', 'DealPilot', '0.6.0', '/kits/dealpilot', at, at)
    const table = db.prepare(
      'INSERT INTO tables (id, module_id, name, slug, made_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    for (const [id, module, name, by] of [
      ['t_deals', 'm_kit', 'Deals', 'system:kit:DealPilot'],
      ['t_mail', 'm_mail', 'Mail', 'connector:gmail'],
      ['t_beds', 'm_own', 'Beds', 'alpha'],
    ] as const) {
      table.run(id, module, name, name.toLowerCase(), by, at)
      for (const sql of createTableSql(name.toLowerCase(), id, [])) db.exec(sql)
    }
    db.exec(`PRAGMA user_version = ${before}`)
    db.close()
    const old = await World.open(dir)
    const keys = (sql: string) =>
      old.db
        .prepare(sql)
        .all()
        .map((r) => Object.values(r))
    expect(keys('SELECT name, key FROM modules ORDER BY name')).toEqual([
      ['Deals Hub', 'DealPilot'],
      ['Garden', null],
      ['Mail', 'Mail'],
    ])
    expect(keys('SELECT name, key FROM tables ORDER BY name')).toEqual([
      ['Beds', null],
      ['Deals', 'Deals'],
      ['Mail', 'Mail'],
    ])
    old.close()
  })
})

describe('a world from a newer Alpha', () => {
  it('is refused, never opened and misread', async () => {
    world.db.exec(`PRAGMA user_version = ${MIGRATIONS.length + 1}`)
    world.close()
    await expect(World.open(join(home, 'tenants', 't_test'))).rejects.toThrow(
      /made by a newer Alpha/,
    )
    world = await World.open(join(home, 'tenants', 't_other'))
  })
})

describe('rows a connection lands', () => {
  it('come in by each item’s own id: new ones added, changed ones versioned, the same left', () => {
    const t = meals()
    const src = { connector: 'test', account: 'me' }
    const ctx = { actor: { kind: 'connector' as const, id: 'test' } }
    expect(
      world.records.land(
        t.id,
        [
          { key: 'a', values: { Food: 'eggs' } },
          { key: 'b', values: { Food: 'toast' } },
        ],
        src,
        ctx,
      ),
    ).toEqual({ added: 2, changed: 0, same: 0 })
    expect(
      world.records.land(
        t.id,
        [
          { key: 'a', values: { Food: 'eggs' } },
          { key: 'b', values: { Food: 'jam toast' } },
        ],
        src,
        ctx,
      ),
    ).toEqual({ added: 0, changed: 1, same: 1 })
    const rows = world.records.list(t.id)
    expect(rows.map((r) => [r.values.food, r.version])).toEqual([
      ['eggs', 1],
      ['jam toast', 2],
    ])
    expect(rows[1]?.provenance.food).toMatchObject({
      kind: 'looked_up',
      source: { connector: 'test', account: 'me', item: 'b' },
    })
    expect(world.records.personsOwn(rows.map((r) => r.id))).toBe(false)
  })

  it('never write over what the person said', () => {
    const t = meals()
    const src = { connector: 'test', account: 'me' }
    const ctx = { actor: { kind: 'connector' as const, id: 'test' } }
    world.records.land(t.id, [{ key: 'a', values: { Food: 'eggs', Quantity: 2 } }], src, ctx)
    const [row] = world.records.list(t.id)
    world.records.change(
      t.id,
      [{ id: row?.id as string, values: { Quantity: 3 }, provenance: { kind: 'stated' } }],
      { actor: person, said: said('it was three eggs') },
    )
    expect(
      world.records.land(t.id, [{ key: 'a', values: { Food: 'eggs', Quantity: 2 } }], src, ctx),
    ).toEqual({ added: 0, changed: 0, same: 1 })
    expect(
      world.records.land(
        t.id,
        [{ key: 'a', values: { Food: 'duck eggs', Quantity: 2 } }],
        src,
        ctx,
      ),
    ).toEqual({ added: 0, changed: 1, same: 0 })
    const after = world.records.list(t.id)[0]
    expect([after?.values.food, after?.values.quantity]).toEqual(['duck eggs', 3])
    expect(after?.provenance.quantity?.kind).toBe('stated')
  })

  it('never write over a figure a script worked out, and land on a known row by its id', () => {
    const t = meals()
    const src = { connector: 'test', account: 'me' }
    const ctx = { actor: { kind: 'connector' as const, id: 'test' } }
    world.records.land(t.id, [{ key: 'a', values: { Food: 'eggs', Quantity: 2 } }], src, ctx)
    const [row] = world.records.list(t.id)
    world.records.change(
      t.id,
      [
        {
          id: row?.id as string,
          values: { Quantity: 4 },
          provenance: { kind: 'computed', source: { formula: 'counted from the receipt' } },
        },
      ],
      { actor: { kind: 'agent', id: 'Figures' } },
    )
    world.records.land(t.id, [{ key: 'a', values: { Quantity: 2 } }], src, ctx)
    expect(world.records.list(t.id)[0]?.values.quantity).toBe(4)
    world.records.land(
      t.id,
      [{ key: 'receipt', row: row?.id as string, values: { Meal: 'lunch' } }],
      src,
      ctx,
    )
    expect(world.records.list(t.id).map((r) => r.values.meal)).toEqual(['lunch'])
    expect(() =>
      world.records.land(t.id, [{ key: 'x', row: 'r_none', values: { Meal: 'lunch' } }], src, ctx),
    ).toThrow(/Meals has no row r_none/)
  })
})

describe('a looked-up value from a file', () => {
  it('points at the file by its hash, and a file the world does not hold is refused', () => {
    const t = meals()
    const { file } = world.files.take(
      new TextEncoder().encode('Food\neggs\n'),
      'b.csv',
      'text/csv',
      {
        actor: person,
      },
    )
    const add = (name: string) =>
      world.records.add(
        t.id,
        [
          {
            values: { Food: 'eggs' },
            provenance: { kind: 'looked_up', source: { file: name, cell: 'A2' } },
          },
        ],
        { actor: alpha },
      )
    add('b.csv')
    expect(world.records.list(t.id)[0]?.provenance.food?.source.file).toBe(file.hash)
    expect(() => add('missing.csv')).toThrow(/no file called missing.csv/)
  })
})

describe('cards', () => {
  const call = { tool: 'change', input: { table: 'Meals', remove: ['r_1'] } }

  it('keeps one waiting card per identical call', () => {
    const first = world.cards.open({
      kind: 'permission',
      words: 'Remove eggs?',
      call,
      actor: alpha,
    })
    const second = world.cards.open({
      kind: 'permission',
      words: 'Remove eggs?',
      call,
      actor: alpha,
    })
    expect(world.cards.get(first.id)?.state).toBe('withdrawn')
    expect(world.cards.waiting().map((c) => c.id)).toEqual([second.id])
  })

  it('lets the call through once on a yes, never on an agent’s answer', () => {
    const card = world.cards.open({ kind: 'permission', words: 'Remove eggs?', call, actor: alpha })
    expect(() => world.cards.answer(card.id, 'Yes', { kind: 'agent', id: 'morning' })).toThrow(
      Refused,
    )
    expect(world.cards.useYes(call, 6)).toBeUndefined()
    world.cards.answer(card.id, 'Yes', person)
    expect(world.cards.get(card.id)?.state).toBe('yes')
    const reordered = { tool: 'change', input: { remove: ['r_1'], table: 'Meals' } }
    expect(world.cards.useYes(reordered, 6)?.id).toBe(card.id)
    expect(world.cards.useYes(call, 6)).toBeUndefined()
    expect(world.lines({ kinds: ['card_opened', 'card_closed'] }).map((l) => l.words)).toEqual([
      'Remove eggs?',
      'Yes: Remove eggs?',
    ])
  })

  it('takes a no', () => {
    const card = world.cards.open({ kind: 'permission', words: 'Remove eggs?', call, actor: alpha })
    world.cards.answer(card.id, 'No', person)
    expect(world.cards.get(card.id)?.state).toBe('no')
    expect(world.cards.useYes(call, 6)).toBeUndefined()
  })
})

describe('files', () => {
  it('keeps the same bytes once and reads a document with positions', () => {
    const bytes = new TextEncoder().encode('date,food\n2026-10-19,eggs\n')
    const a = world.files.take(bytes, 'meals.csv', 'text/csv', { actor: person })
    const b = world.files.take(bytes, 'copy.csv', 'text/csv', { actor: person })
    expect(a.isNew).toBe(true)
    expect(b.isNew).toBe(false)
    expect(b.file.hash).toBe(a.file.hash)
    const doc = world.files.addDocument(
      a.file.hash,
      'meals.csv',
      'sheet',
      [
        { position: { sheet: 'Sheet1', cell: 'B1' }, words: 'food' },
        { position: { sheet: 'Sheet1', cell: 'B2' }, words: 'eggs' },
      ],
      { actor: alpha },
    )
    expect(doc.chunks).toBe(2)
    const hit = world.search('eggs').find((h) => h.what === 'document')
    expect(hit?.where).toContain('"cell":"B2"')
  })
})

describe('files on rows', () => {
  function deals() {
    const m = world.shape.makeModule('Deals desk', { actor: alpha })
    const t = world.shape.makeTable(m.id, 'Deals', [{ name: 'Name', kind: 'text' }], {
      actor: alpha,
    })
    world.shape.setDocuments(t.id, ['Teaser', 'CIM'], { actor: { kind: 'system' } })
    const [row] = world.records.add(
      t.id,
      [{ values: { Name: 'Harbor Books' }, provenance: { kind: 'stated', source: {} } }],
      { actor: person, said: said('add Harbor Books') },
    )
    const { file } = world.files.take(
      new TextEncoder().encode('%PDF cim'),
      'Harbor CIM.pdf',
      'application/pdf',
      {
        actor: person,
      },
    )
    return { m, t, row: row as string, file }
  }

  it('puts a file on a row as a kind its table takes, and journals it as filed', () => {
    const { m, t, row, file } = deals()
    expect(() => world.placeFile(file.hash, row, 'Lease', { actor: person })).toThrow(
      /Deals's rows take Teaser, CIM; Lease is not one of them/,
    )
    const on = world.placeFile(file.hash, row, 'CIM', { actor: person })
    expect([on.kind, on.table, on.file.name]).toEqual(['CIM', t.id, 'Harbor CIM.pdf'])
    world.placeFile(file.hash, row, 'Teaser', { actor: person })
    expect(world.rowFiles(row).map((f) => f.kind)).toEqual(['Teaser'])
    expect(world.rowsOfFile(file.hash).map((f) => f.record)).toEqual([row])
    expect(
      world
        .lines({ kinds: ['filed'] })
        .map((l) => l.words)
        .slice(-2),
    ).toEqual([
      'Filed Harbor CIM.pdf on Harbor Books in Deals, as a CIM.',
      'Harbor CIM.pdf on Harbor Books is a Teaser now.',
    ])
    expect(readFileSync(join(m.dir, 'module.yaml'), 'utf8')).toContain('documents:\n      - Teaser')
  })

  it('takes a file off a row, and a row removed takes its files off; the file stays', () => {
    const { t, row, file } = deals()
    world.placeFile(file.hash, row, 'CIM', { actor: person })
    world.unplaceFile(file.hash, row, { actor: person })
    expect(world.rowFiles(row)).toEqual([])
    world.placeFile(file.hash, row, null, { actor: person })
    world.records.remove(t.id, [row], { actor: person })
    expect(world.rowsOfFile(file.hash)).toEqual([])
    expect(world.files.file(file.hash)?.name).toBe('Harbor CIM.pdf')
  })
})

describe('the model’s SQL', () => {
  it('reads a view per table and the journal, and nothing else', () => {
    const t = meals()
    world.records.add(
      t.id,
      [{ values: { Food: 'eggs', Quantity: 2 }, provenance: { kind: 'stated' } }],
      {
        actor: alpha,
        said: said('two eggs'),
      },
    )
    const r = world.sql.query('SELECT food, quantity FROM meals')
    expect(r.rows).toEqual([{ food: 'eggs', quantity: 2 }])
    expect(r.total).toBe(1)
    expect(world.sql.query("SELECT count(*) AS n FROM journal WHERE kind = 'wrote'").rows).toEqual([
      { n: 1 },
    ])
    expect(() => world.sql.query('SELECT * FROM records')).toThrow(/through its views only/)
    expect(() => world.sql.query('SELECT * FROM main.cards')).toThrow(/through its views only/)
    expect(() => world.sql.query("INSERT INTO meals (food) VALUES ('x')")).toThrow(Refused)
    expect(() => world.sql.query('SELECT 1; DELETE FROM records')).toThrow(/One statement/)
  })

  it('follows the shape as it changes', () => {
    const t = meals()
    expect(world.sql.query('SELECT * FROM meals').columns).toEqual([
      'id',
      'added',
      'food',
      'quantity',
      'meal',
    ])
    world.shape.addFields(t.id, [{ name: 'Cost', kind: 'money' }], { actor: alpha })
    expect(world.sql.query('SELECT * FROM meals').columns).toContain('cost_currency')
  })
})
