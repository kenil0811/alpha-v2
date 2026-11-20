// A choice's ★ from the window: the field's default for everyone, set and cleared as the person,
// shown on the field, and taken by a row added without it.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { Engine } from '../engine/engine.ts'
import { World } from '../world/world.ts'
import { buildServer } from './server.ts'
import type { TableView } from './types.ts'

let home: string
let world: World
let engine: Engine
const token = 'secret-token'
const ok = { host: '127.0.0.1:4700', 'x-alpha-token': token }
const alpha = { actor: { kind: 'alpha' as const } }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-default-api-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  engine = new Engine(world)
})
afterEach(() => {
  engine.close()
  world.close()
  rmSync(home, { recursive: true, force: true })
})

it('sets a choice field’s default as the person, which the field shows and a new row takes', async () => {
  const m = world.shape.makeModule('Deals desk', alpha)
  const t = world.shape.makeTable(
    m.id,
    'Deals',
    [
      { name: 'Name', kind: 'text' },
      { name: 'Stage', kind: 'choice', choices: ['New', 'Looking'] },
    ],
    alpha,
  )
  const stage = t.fields.find((f) => f.name === 'Stage')?.id as string
  const a = buildServer({ engine, user: world.owner('Kenil'), token, ports: [4700] })
  const star = (value: string | null) =>
    a.inject({
      method: 'POST',
      url: `/api/tables/${t.id}/default`,
      headers: ok,
      payload: { field: stage, value },
    })
  expect((await star('Looking')).json()).toEqual({ ok: true })
  expect(world.lines({ kinds: ['shaped'] }).at(-1)?.actor).toMatchObject({ kind: 'person' })
  const view = (await a.inject({ url: `/api/tables/${t.id}`, headers: ok })).json() as TableView
  expect(view.fields.find((f) => f.id === stage)?.default).toBe('Looking')
  await a.inject({
    method: 'POST',
    url: `/api/tables/${t.id}/rows`,
    headers: ok,
    payload: { values: { Name: 'Acme' } },
  })
  expect(world.records.list(t.id).map((r) => r.values.stage)).toEqual(['Looking'])
  expect((await star('Won')).statusCode).toBe(409)
  await star(null)
  expect(world.shape.table(t.id)?.fields.find((f) => f.id === stage)?.default).toBeNull()
  await a.close()
})
