// A card on its own page (Batch B, pick 13): the card the stream shows, by its id; one not there,
// or another person's, is not there. Answering stays the card's own route.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { Engine } from '../engine/engine.ts'
import { World } from '../world/world.ts'
import { buildServer } from './server.ts'
import type { CardView } from './types.ts'

const token = 'secret-token'
const ok = { host: '127.0.0.1:4700', 'x-alpha-token': token }
let home: string
let world: World
let engine: Engine

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-cardpage-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  engine = new Engine(world)
})

afterEach(() => {
  engine.close()
  world.close()
  rmSync(home, { recursive: true, force: true })
})

it('serves the person’s own card, answered through its own route, and no one else’s', async () => {
  const me = world.owner('Kenil')
  const a = buildServer({ engine, user: me, token, ports: [4700] })
  const mine = world.cards.open({
    kind: 'question',
    words: 'Which deal first?',
    options: ['Harbor', 'Lakeside'],
    actor: { kind: 'alpha' },
    user: me.id,
  })
  const theirs = world.cards.open({
    kind: 'question',
    words: 'Lunch?',
    actor: { kind: 'alpha' },
    user: 'u_someone_else',
  })
  const get = (id: string) => a.inject({ url: `/api/cards/${id}`, headers: ok })
  const card = (await get(mine.id)).json() as CardView
  expect([card.id, card.words, card.options, card.state]).toEqual([
    mine.id,
    'Which deal first?',
    ['Harbor', 'Lakeside'],
    'waiting',
  ])
  for (const id of ['c_gone', theirs.id]) {
    const res = await get(id)
    expect([res.statusCode, res.json().problem]).toEqual([404, 'That card is not there.'])
  }
  await a.inject({
    method: 'POST',
    url: `/api/cards/${mine.id}`,
    headers: ok,
    payload: { answer: 'Lakeside' },
  })
  const answered = (await get(mine.id)).json() as CardView
  // the second option is a no to the first: answered all the same, and the page says with what
  expect([answered.state, answered.answer]).toEqual(['no', 'Lakeside'])
  await a.close()
})
