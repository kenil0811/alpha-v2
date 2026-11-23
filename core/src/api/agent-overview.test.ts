// An agent's landing numbers, and an edit of its instructions as a proposal: its tasks, how its cards to this person were answered, the runs of the
// schedules that wake it, and its last lines. The Chief of staff's are those no agent signed.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { config } from '../config.ts'
import { Engine } from '../engine/engine.ts'
import { now, run } from '../world/db.ts'
import { World } from '../world/world.ts'
import { buildServer } from './server.ts'
import type { AgentOverview } from './types.ts'

const token = 'secret-token'
const ok = { host: '127.0.0.1:4700', 'x-alpha-token': token }
let home: string
let world: World
let engine: Engine

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-overview-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  engine = new Engine(world)
})

afterEach(() => {
  engine.close()
  world.close()
  rmSync(home, { recursive: true, force: true })
})

it("counts the Chief of staff's tasks, cards, runs and lines", async () => {
  const me = world.owner('Kenil')
  const a = buildServer({ engine, user: me, token, ports: [4700] })
  run(
    world.db,
    `INSERT INTO schedules (id, module_id, agent, made_by, name, file, state, trigger)
     VALUES ('s_1', NULL, 'chief', 'person', 'Morning', 'morning.ts', 'on', 'daily')`,
  )
  for (const [r, state] of [
    ['r_1', 'ok'],
    ['r_2', 'ok'],
    ['r_3', 'failed'],
  ] as const)
    run(
      world.db,
      `INSERT INTO runs (id, schedule_id, started_at, state) VALUES (?, 's_1', ?, ?)`,
      r,
      now(),
      state,
    )
  const card = (state: string) => {
    const c = world.cards.open({
      kind: 'question',
      words: 'Go?',
      actor: { kind: 'alpha' },
      user: me.id,
    })
    run(world.db, 'UPDATE cards SET state = ? WHERE id = ?', state, c.id)
  }
  card('yes')
  card('yes')
  card('no')
  card('waiting')
  run(
    world.db,
    `INSERT INTO journal (at, actor_kind, kind, words, user_id) VALUES (?, 'alpha', 'wrote', 'Filed the invoice', ?)`,
    now(),
    me.id,
  )
  const got = (
    await a.inject({ url: '/api/agents/chief/overview', headers: ok })
  ).json() as AgentOverview
  expect([got.cards, got.runs, got.tasks]).toEqual([
    { yes: 2, no: 1 },
    { ok: 2, failed: 1 },
    { open: 0, done: 0 },
  ])
  expect(got.recent.map((l) => l.words)).toContain('Filed the invoice')
  expect(
    (await a.inject({ url: '/api/agents/ag_gone/overview', headers: ok })).statusCode,
  ).not.toBe(200)
  await a.close()
})

it('sends an edit of instructions as a proposal in the words kept in config, for an agent that is there', async () => {
  const words = config.proposing({ name: 'Sales', was: '', proposed: 'Call back within a day.' })
  expect(words).toContain("Sales's instructions")
  expect(words).toContain('(none yet)')
  expect(words).toContain('Call back within a day.')
  expect(words).not.toMatch(/\{\w+\}/)
  const a = buildServer({ engine, user: world.owner('Kenil'), token, ports: [4700] })
  const res = await a.inject({
    method: 'POST',
    url: '/api/agents/ag_gone/propose',
    headers: ok,
    payload: { instructions: 'Be brief.' },
  })
  expect(res.statusCode).not.toBe(200)
  await a.close()
})
