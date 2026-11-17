// An agent's marks for one person (ui-rules A11): the agent a card waits from, and Failed until the
// person opens its chat.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CHIEF } from '../world/agents/index.ts'
import { run } from '../world/db.ts'
import { World } from '../world/world.ts'
import { cardAgent, chatOpened, failedAgents, forgetMarks } from './agent-marks.ts'

let home: string
let world: World
let user: string

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-marks-'))
  world = await World.open(home)
  user = world.owner('Kenil').id
  run(
    world.db,
    `INSERT INTO schedules (id, module_id, agent, made_by, name, file, state, trigger)
     VALUES ('s_1', NULL, ?, 'person', 'Morning', 'morning.ts', 'on', 'daily')`,
    CHIEF,
  )
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const ran = (id: string, state: string, at: string) =>
  run(
    world.db,
    `INSERT INTO runs (id, schedule_id, started_at, ended_at, state) VALUES (?, 's_1', ?, ?, ?)`,
    id,
    at,
    at,
    state,
  )

describe('an agent marked Failed', () => {
  it('is marked when the latest run of its schedule failed, until its chat is opened', () => {
    ran('r_1', 'ok', '2000-01-01T08:00:00.000Z')
    expect(failedAgents(world, user)).toEqual([])
    ran('r_2', 'failed', '2000-01-02T08:00:00.000Z')
    expect(failedAgents(world, user)).toEqual([CHIEF])
    chatOpened(world, user, CHIEF)
    expect(failedAgents(world, user)).toEqual([])
    ran('r_3', 'failed', '2999-01-01T08:00:00.000Z')
    expect(failedAgents(world, user)).toEqual([CHIEF])
  })

  it('is not marked once a later run worked', () => {
    ran('r_1', 'failed', '2000-01-01T08:00:00.000Z')
    ran('r_2', 'ok', '2000-01-02T08:00:00.000Z')
    expect(failedAgents(world, user)).toEqual([])
  })

  it('is marked when a task given to it stopped on a failure, for that person only', () => {
    const say = (turn: string) =>
      world.line({ actor: { kind: 'alpha' }, kind: 'error', words: 'It failed.', user, turn })
    say('t_chat') // a failure in its own chat is in the chat already
    expect(failedAgents(world, user)).toEqual([])
    say('task:k_1:1')
    expect(failedAgents(world, user)).toEqual([CHIEF])
    expect(failedAgents(world, 'u_someone_else')).toEqual([])
    chatOpened(world, user, CHIEF)
    expect(failedAgents(world, user)).toEqual([])
  })

  it('forgets what each person saw once the agent is deleted', () => {
    chatOpened(world, user, 'a_gone')
    forgetMarks(world, 'a_gone')
    expect(world.preference(user, 'agent_seen:a_gone')).toBeNull()
  })
})

describe('the agent a card waits from', () => {
  const card = (extra: { agent?: string; turn?: string; run?: string }) =>
    world.cards.open({ kind: 'question', words: 'Which one?', actor: { kind: 'system' }, ...extra })

  it('is the chat it was raised in, the agent a run woke, or none', () => {
    ran('r_1', 'running', '2000-01-01T08:00:00.000Z')
    expect(cardAgent(world, card({ agent: 'a_scout' }))).toBe('a_scout')
    expect(cardAgent(world, card({ turn: 't_1' }))).toBe(CHIEF)
    expect(cardAgent(world, card({ run: 'r_1' }))).toBe(CHIEF)
    expect(cardAgent(world, card({}))).toBeNull()
  })
})
