// The task tool's walls: only the run's own word makes an agent's task done (design §12, Q93;
// item 41 of the problems list, 25 Oct).
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { agents, syncAgents } from '../../modules/agents.ts'
import { install } from '../../modules/kits/index.ts'
import type { User } from '../../world/world.ts'
import { World } from '../../world/world.ts'
import type { ToolEntry } from '../registry.ts'
import type { Tooling } from './common.ts'
import { taskTools } from './task.ts'

let home: string
let world: World
let user: User
let task: ToolEntry
let helper: string // the test kit's agent that takes tasks

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-task-tool-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  user = world.owner('Kenil')
  const person = { actor: { kind: 'person' as const, id: user.id }, user: user.id }
  const m = await install(
    world,
    join(import.meta.dirname, '..', '..', 'modules', 'test-kit'),
    person,
  )
  writeFileSync(join(m.dir, 'skills/helper.js'), 'export default async () => null')
  writeFileSync(
    join(m.dir, 'agents/helper.md'),
    '---\nname: Helper\ntasks: true\nruns: { script: skills/helper.js }\n---\nTakes the bakery’s small tasks.\n',
  )
  syncAgents(world, m, 'on')
  helper = agents(world, m.id).find((a) => a.name === 'Helper')?.id as string
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
  it('refuses done on a task given to an agent, and marks the person’s own done', async () => {
    const person = { actor: { kind: 'person' as const, id: user.id }, user: user.id }
    const given = world.tasks.add(
      { title: 'Count the flour', on: null, refs: [], owner: { kind: 'agent', id: helper } },
      person,
    )
    const out = await task.handler({ action: 'done', id: given.id })
    expect(out.isError).toBe(true)
    expect(text(out)).toBe("Only Helper's run marks “Count the flour” done; start it, or drop it.")
    expect(world.tasks.get(given.id)?.state).toBe('todo')
    const own = world.tasks.add({ title: 'Call the mill', on: null, refs: [] }, person)
    const done = await task.handler({ action: 'done', id: own.id })
    expect(done.isError).toBeFalsy()
    expect(world.tasks.get(own.id)?.state).toBe('done')
  })
})
