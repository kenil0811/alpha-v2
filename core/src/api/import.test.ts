// A sheet into a table from the ⋮ menu: headers first, then the rows by the person's mapping.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Engine } from '../engine/engine.ts'
import { World } from '../world/world.ts'
import { buildServer } from './server.ts'

let home: string
let world: World
let engine: Engine
const ok = { host: '127.0.0.1:4700', 'x-alpha-token': 'secret-token' }
const alpha = { actor: { kind: 'alpha' as const } }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-import-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  engine = new Engine(world)
})
afterEach(() => {
  engine.close()
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('POST /api/tables/:id/import', () => {
  it('answers the headers, then imports by the mapping; a mirror is refused', async () => {
    const a = buildServer({
      engine,
      user: world.owner('Kenil'),
      token: 'secret-token',
      ports: [4700],
    })
    const m = world.shape.makeModule('Desk', alpha)
    const deals = world.shape.makeTable(
      m.id,
      'Deals',
      [
        { name: 'Name', kind: 'text' },
        { name: 'Size', kind: 'number' },
      ],
      alpha,
    )
    const cell = (c: string, row: number, words: string) => ({
      position: { sheet: 'Sheet1', cell: c, row },
      words,
    })
    const f = world.files.take(
      Buffer.from('Name,Amount\nHarbor,5\n'),
      'd.csv',
      'text/csv',
      alpha,
    ).file
    world.files.addDocument(
      f.hash,
      'd.csv',
      'sheet',
      [cell('A1', 1, 'Name'), cell('B1', 1, 'Amount'), cell('A2', 2, 'Harbor'), cell('B2', 2, '5')],
      alpha,
    )
    const post = (body: unknown, id = deals.id) =>
      a.inject({
        method: 'POST',
        url: `/api/tables/${id}/import`,
        headers: ok,
        payload: body as object,
      })
    const heads = await post({ file: f.hash })
    expect(heads.json()).toEqual({ headers: ['Name', 'Amount'], sheets: ['Sheet1'] })
    expect(world.records.list(deals.id)).toHaveLength(0)
    const done = await post({ file: f.hash, columns: { Name: 'Name', Amount: 'Size' } })
    expect(done.json()).toEqual({ added: 1 })
    expect(world.records.list(deals.id)[0]?.values).toMatchObject({ name: 'Harbor', size: 5 })
    const bad = await post({ file: f.hash, columns: { Nope: 'Name' } })
    expect(bad.statusCode).toBeGreaterThanOrEqual(400)
    const mirror = world.shape.makeTable(m.id, 'Seen', [{ name: 'Name', kind: 'text' }], alpha)
    world.db.prepare('UPDATE tables SET mirror = ? WHERE id = ?').run('Xero', mirror.id)
    const refused = await post({ file: f.hash }, mirror.id)
    expect(refused.statusCode).toBeGreaterThanOrEqual(400)
    expect(refused.json().problem).toContain('mirror')
    await a.close()
  })
})
