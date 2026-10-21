// Agents on tasks (Kenil's plan, 21 Oct): a made-up kit's agent on call for the tasks given to
// it, run on one by Start, settling it by its own word; never a client's agent, never a site.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BrowserEngine } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Module } from '../world/shape.ts'
import { World } from '../world/world.ts'
import { agents, syncAgents } from './agents.ts'
import { install } from './kits.ts'
import { AgentRunner } from './runs.ts'

let home: string
let world: World
let m: Module
let runner: AgentRunner
const person = { actor: { kind: 'person' as const, id: 'u_1' }, user: 'u_1' }
const who = { user: 'u_1', turn: null }

// What the helper does, by the task's title: says it is done, waits, says nothing, proposes
// tasks (a card), or takes its time.
const HELPER = `export default async (alpha) => {
  const t = alpha.input.task
  if (t.title.startsWith('Wait')) { await alpha.task.wait('the mill to answer'); return { words: 'asked' } }
  if (t.title.startsWith('Quiet')) return { words: 'looked' }
  if (t.title.startsWith('Slow')) { await new Promise((r) => setTimeout(r, 20000)); return null }
  if (t.title.startsWith('Plan')) {
    const yes = t.cards.find((c) => c.state !== 'waiting')
    if (yes) { await alpha.task.done('the person kept ' + (yes.state === 'yes' ? 'them' : 'none')); return null }
    await alpha.task.propose([{ title: 'Order flour', on: { table: 'Suppliers', row: t.touches[0]?.ref } }, { title: 'Check the oven', owner: 'agent' }], 'Two things for the bakery')
    return { words: 'proposed' }
  }
  await alpha.task.done('counted ' + (t.values?.Item ?? 'nothing') + ' on ' + t.place.words)
  return { words: 'counted' }
}
`

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-tasks-agents-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  m = await install(world, join(import.meta.dirname, 'test-kit'), person)
  writeFileSync(join(m.dir, 'skills/helper.js'), HELPER)
  writeFileSync(
    join(m.dir, 'agents/helper.md'),
    '---\nname: Helper\ntasks: true\nruns: { script: skills/helper.js }\n---\nTakes the bakery’s small tasks.\n',
  )
  syncAgents(world, m, 'on')
  runner = new AgentRunner(world, () => ({}) as BrowserEngine, { owner: 'u_1' })
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const helper = () => agents(world, m.id).find((a) => a.name === 'Helper')
const give = (title: string, on: object | null = null, refs: { kind: 'row'; ref: string }[] = []) =>
  world.tasks.add({ title, on, refs, owner: { kind: 'agent', id: helper()?.id ?? null } }, person)
const said = (id: string) =>
  world
    .lines({ kinds: ['task'] })
    .filter((l) => (l.data as { task?: string }).task === id)
    .map((l) => l.words)

describe('an agent on tasks', () => {
  it('is on call with no trigger, and only an agent that takes tasks is given one', () => {
    expect(helper()).toMatchObject({ trigger: null, tasks: true })
    const counter = agents(world, m.id).find((a) => a.name === 'Counter')
    expect(() =>
      world.tasks.add({ title: 'x', owner: { kind: 'agent', id: counter?.id ?? null } }, person),
    ).toThrow(/Counter does not take tasks/)
    const mine = world.tasks.add({ title: 'Mine' }, person)
    expect(() => runner.startTask(mine.id, who)).toThrow(/not given to an agent/)
  })

  it('works on a task when started, and only its own word makes it Done', async () => {
    world.records.land(
      world.shape.table('Orders')?.id as string,
      [{ key: 'o1', values: { Item: 'Flour', Quantity: 3 } }],
      { connector: 'test' },
      person,
    )
    const row = world.records.list(world.shape.table('Orders')?.id as string)[0]?.id as string
    const t = give('Count the flour', { table: 'Orders', row })
    expect(world.tasks.get(t.id)?.state).toBe('todo') // giving it never starts it
    const out = await runner.startTask(t.id, who).run
    expect(out.state).toBe('ok')
    expect(world.tasks.get(t.id)?.state).toBe('done')
    expect(runner.runsOf(t.id).map((r) => r.task)).toEqual([t.id])
    expect(said(t.id).slice(-2)).toEqual([
      'Helper started on “Count the flour”.',
      'Helper finished “Count the flour”: counted Flour on Bakery › Orders › Flour',
    ])
  }, 60_000)

  it('leaves a task waiting when its run ends without saying it is done, or says what it waits for', async () => {
    const quiet = give('Quiet look')
    await runner.startTask(quiet.id, who).run
    expect(world.tasks.get(quiet.id)?.state).toBe('waiting')
    expect(said(quiet.id).at(-1)).toBe(
      'Helper ended without saying “Quiet look” was done; it waits.',
    )
    const wait = give('Wait for the mill')
    await runner.startTask(wait.id, who).run
    expect(world.tasks.get(wait.id)?.state).toBe('waiting')
    expect(said(wait.id).at(-1)).toBe('Helper waits on “Wait for the mill”: the mill to answer')
  }, 60_000)

  it('changes no task on a try with a made-up task: what it would say is a step', async () => {
    const out = await runner.runScript(
      m,
      'skills/helper.js',
      { task: { title: 'Count', place: { words: 'somewhere' }, values: { Item: 'Rye' } } },
      'A try',
      null,
    )
    expect(out.state).toBe('ok')
    expect(world.lines({ kinds: ['run_step'] }).at(-1)?.words).toBe(
      'Would finish the task: counted Rye on somewhere',
    )
    expect(world.lines({ kinds: ['task'] })).toHaveLength(0)
  }, 60_000)

  it('puts a task back in To do when its run is stopped', async () => {
    const t = give('Slow bake')
    const { run } = runner.startTask(t.id, who)
    expect(() => runner.startTask(t.id, who)).toThrow(/busy/)
    const [r] = runner.runsOf(t.id)
    await new Promise((ok) => setTimeout(ok, 500))
    runner.stop(r?.id as string)
    expect((await run).state).toBe('stopped')
    expect(world.tasks.get(t.id)?.state).toBe('todo')
  }, 60_000)

  it('proposes tasks on one card, waits for the yes, and goes on once it is decided', async () => {
    const mill = world.records.list(world.shape.table('Suppliers')?.id as string)[0]?.id as string
    const t = give('Plan the week', null, [{ kind: 'row', ref: mill }])
    await runner.startTask(t.id, who).run
    const [card] = world.cards.waiting()
    expect(card?.words).toBe('Two things for the bakery')
    expect(world.cards.waitingTasks()).toEqual(new Set([t.id]))
    expect(world.tasks.get(t.id)?.state).toBe('waiting')
    expect(said(t.id).at(-1)).toBe('“Plan the week” waits for your yes on a card from Helper.')
    expect(
      runner.proposedView(card as never)?.tasks.map((x) => [x.title, x.place, x.owner]),
    ).toEqual([
      ['Order flour', 'Bakery › Suppliers › Mill & Co', 'You'],
      ['Check the oven', 'nowhere yet', 'Helper'],
    ])
    // the person keeps the first only; none is kept before their yes
    expect(world.tasks.list().map((x) => x.title)).toEqual(['Plan the week'])
    expect(runner.adopt(card?.id as string, [0], 'u_1')).toMatchObject({
      state: 'yes',
      answer: 'Added 1 of 2',
    })
    const added = world.tasks.list().find((x) => x.title === 'Order flour')
    expect(added).toMatchObject({ madeBy: 'agent:Helper', owner: { kind: 'person' } })
    expect(world.tasks.list().some((x) => x.title === 'Check the oven')).toBe(false)
    // every card decided: its agent runs on it again, handed what came of them
    await runner.runDue()
    await new Promise((ok) => setTimeout(ok, 50))
    for (let i = 0; i < 100 && world.tasks.get(t.id)?.state !== 'done'; i++)
      await new Promise((ok) => setTimeout(ok, 100))
    expect(world.tasks.get(t.id)?.state).toBe('done')
    expect(said(t.id).at(-1)).toBe('Helper finished “Plan the week”: the person kept them')
    expect(runner.runsOf(t.id)).toHaveLength(2)
  }, 60_000)
})
