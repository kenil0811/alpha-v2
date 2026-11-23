// An agent's time saved this week: its finished work times the minutes each kind saves.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { config } from '../config.ts'
import { Engine } from '../engine/engine.ts'
import { dayOf, weekdayOf } from '../world/day.ts'
import { run } from '../world/db.ts'
import { World } from '../world/world.ts'
import { timeSaved } from './routes/time-saved.ts'
import { buildServer } from './server.ts'
import type { AgentDetail } from './types.ts'

describe("an agent's time saved", () => {
  let home: string
  let world: World
  let engine: Engine
  const token = 'secret-token'
  const ok = { host: '127.0.0.1:4700', 'x-alpha-token': token }

  beforeEach(async () => {
    home = mkdtempSync(join(tmpdir(), 'alpha-saved-'))
    world = await World.open(join(home, 'tenants', 't_test'))
    engine = new Engine(world)
  })
  afterEach(() => {
    engine.close()
    world.close()
    rmSync(home, { recursive: true, force: true })
  })

  const scout = () =>
    world.agents.add({
      id: 'ag_scout',
      name: 'Scout',
      title: 'Researcher',
      description: 'Finds things out.',
      model: null,
      madeBy: world.owner('Kenil').id,
    })
  const done = (title: string, at: Date) => {
    const t = world.tasks.add(
      { title, owner: { kind: 'alpha', id: 'ag_scout' } },
      { actor: { kind: 'person' }, user: world.owner('Kenil').id },
    )
    run(
      world.db,
      "UPDATE tasks SET state = 'done', done_at = ? WHERE id = ?",
      at.toISOString(),
      t.id,
    )
  }

  it('is nothing for an agent that finished nothing', async () => {
    scout()
    const a = buildServer({ engine, user: world.owner('Kenil'), token, ports: [4700, 4701] })
    const d = (await a.inject({ url: '/api/agents/ag_scout', headers: ok })).json() as AgentDetail
    expect(d.timeSaved).toBeNull()
    await a.close()
  })

  it("counts this week's finished tasks by day, and leaves last week's out", () => {
    scout()
    const now = new Date()
    done('Today', now)
    done('Also today', now)
    done('Last week', new Date(now.getTime() - 8 * 86_400_000))
    const each = config.limits().minutes_saved.task_done ?? 0
    const s = timeSaved(world, 'ag_scout', now)
    expect(s).toMatchObject({ minutes: 2 * each, source: 'estimated' })
    expect(s?.how).toBe(`2 tasks done × ${each} min each`)
    expect(s?.days[weekdayOf(dayOf(now))]).toBe(2 * each)
    expect(s?.days).toHaveLength(7)
  })
})
