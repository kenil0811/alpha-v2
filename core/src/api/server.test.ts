import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Engine } from '../engine/engine.ts'
import { World } from '../world/world.ts'
import { buildServer, VERSION } from './server.ts'
import type { Stream, TableView } from './types.ts'

describe('the api', () => {
  it('answers its health check', async () => {
    const app = buildServer()
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, version: VERSION })
    await app.close()
  })
})

describe('the api over a world', () => {
  let home: string
  let world: World
  let engine: Engine
  const token = 'secret-token'
  const ok = { host: '127.0.0.1:4700', 'x-alpha-token': token }

  beforeEach(async () => {
    home = mkdtempSync(join(tmpdir(), 'alpha-api-'))
    world = await World.open(join(home, 'tenants', 't_test'))
    engine = new Engine(world)
  })

  afterEach(() => {
    engine.close()
    world.close()
    rmSync(home, { recursive: true, force: true })
  })

  const app = () => buildServer({ engine, user: world.owner('Kenil'), token, ports: [4700, 4701] })

  it('turns away a request without the token, from another host or from another page', async () => {
    const a = app()
    expect(
      (await a.inject({ url: '/api/me', headers: { host: '127.0.0.1:4700' } })).statusCode,
    ).toBe(403)
    expect(
      (await a.inject({ url: '/api/me', headers: { ...ok, host: 'evil.example:4700' } }))
        .statusCode,
    ).toBe(403)
    expect(
      (await a.inject({ url: '/api/me', headers: { ...ok, origin: 'https://evil.example' } }))
        .statusCode,
    ).toBe(403)
    const me = await a.inject({
      url: '/api/me',
      headers: { ...ok, origin: 'http://127.0.0.1:4701' },
    })
    expect(me.statusCode).toBe(200)
    expect(me.json().user.name).toBe('Kenil')
    await a.close()
  })

  it('shows a table with each value’s source in words', async () => {
    const user = world.owner('Kenil')
    const m = world.shape.makeModule('Food', { actor: { kind: 'alpha' } })
    const t = world.shape.makeTable(m.id, 'Meals', [{ name: 'Food', kind: 'text' }], {
      actor: { kind: 'alpha' },
    })
    const said = world.line({
      actor: { kind: 'person', id: user.id },
      kind: 'said',
      words: 'log two eggs',
      user: user.id,
    })
    world.records.add(t.id, [{ values: { Food: 'eggs' }, provenance: { kind: 'stated' } }], {
      actor: { kind: 'alpha' },
      user: user.id,
      turn: String(said.id),
      said: { message: said.id, user: user.id },
    })
    const a = app()
    const table = (await a.inject({ url: `/api/tables/${t.id}`, headers: ok })).json() as TableView
    expect(table.rows[0]?.values).toEqual({ food: 'eggs' })
    expect(table.rows[0]?.sources.food?.words).toBe('You said “log two eggs”')
    const stream = (await a.inject({ url: '/api/stream', headers: ok })).json() as Stream
    expect(stream.lines.map((l) => [l.kind, l.words])).toEqual([
      ['said', 'log two eggs'],
      ['wrote', 'Added a row to Meals: Food eggs.'],
    ])
    await a.close()
  })
})
