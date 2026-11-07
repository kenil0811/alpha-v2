// The task tool's walls: only the run's own word makes an agent's task done (design §12, Q93;
// item 41 of the problems list, 25 Oct).
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { User } from '../../world/world.ts'
import { World } from '../../world/world.ts'
import type { ToolEntry } from '../registry.ts'
import type { Tooling } from './common.ts'
import { taskTools } from './task.ts'

let home: string
let world: World
let user: User
let task: ToolEntry
let _helper: string // the test kit's agent that takes tasks

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-task-tool-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  user = world.owner('Kenil')
  const tooling: Tooling = {
    world,
    here: {
      current: { user, turn: '1', said: null, message: 'mark it done' },
      fromSubagent: false,
      touched: new Set<string>(),
    },
    ctx: () => ({ actor: { kind: 'alpha' }, user: user.id, turn: '1', said: null }),
  }
  task = taskTools(tooling).find((t) => t.name === 'task') as ToolEntry
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const text = (r: Awaited<ReturnType<ToolEntry['handler']>>) =>
  r.content.map((c) => ('text' in c ? c.text : '')).join('')

describe('the task tool', () => {
  it('marks a task done, and gives one only to the person or Alpha', async () => {
    const person = { actor: { kind: 'person' as const, id: user.id }, user: user.id }
    const own = world.tasks.add({ title: 'Call the mill', on: null, refs: [] }, person)
    const done = await task.handler({ action: 'done', id: own.id })
    expect(done.isError).toBeFalsy()
    expect(world.tasks.get(own.id)?.state).toBe('done')
    const out = await task.handler({ action: 'add', title: 'Count the flour', owner: 'Helper' })
    expect(out.isError).toBe(true)
    expect(text(out)).toBe('The owner is me or alpha, not Helper.')
  })
})
