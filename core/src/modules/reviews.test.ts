// An agent's script reading people, having the model sort them, and putting rows to the person on
// one card, on the made-up kit (test-kit/): never a client's, never the real model.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BrowserEngine } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Ask } from '../files/reading.ts'
import { World } from '../world/world.ts'
import { judge } from './judging.ts'
import { install } from './kits/index.ts'
import { AgentRunner } from './runs/index.ts'

let home: string
let world: World
const ctx = { actor: { kind: 'person' as const, id: 'u_1' }, user: 'u_1' }
const engine = {} as BrowserEngine

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-reviews-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

// A stand-in for the model: puts each item whose facts say "mill" in Mills, names a group that was
// never asked for the rest, and answers for an item that was never asked.
const asked: string[] = []
const fakeJudge: Ask = async (prompt) => {
  asked.push(prompt)
  const items = prompt
    .split('\n')
    .filter((l) => /^p_|^i\d/.test(l))
    .map((l) => [l.split(':')[0] as string, l] as const)
  return {
    answer: {
      answers: [
        ...items.map(([id, l]) =>
          /mill/i.test(l)
            ? { id, group: 'Mills', why: 'mills flour' }
            : { id, group: 'Bakers', why: 'made up' },
        ),
        { id: 'nobody', group: 'Mills', why: 'never asked' },
      ],
    },
    tokens: 100,
  }
}

describe('sorting into the person’s groups', () => {
  it('keeps only groups and items that were asked, in batches', async () => {
    asked.length = 0
    const items = Array.from({ length: 130 }, (_, i) => ({
      id: `i${i}`,
      facts: i === 3 ? 'Oat Mill' : 'Sugar Co',
    }))
    const out = await judge({ groups: [{ name: 'Mills', about: 'who mills' }], items }, fakeJudge)
    expect(asked).toHaveLength(2)
    expect(out.judged).toHaveLength(130)
    expect(out.judged.filter((j) => j.group)).toEqual([
      { id: 'i3', group: 'Mills', why: 'mills flour' },
    ])
    expect(out.tokens).toBe(200)
  })
})

describe('rows put to the person', () => {
  it('a script reads people, sorts them, and the person decides each row on one card', async () => {
    const m = await install(world, join(import.meta.dirname, 'test-kit'), ctx)
    // the kit's suppliers are people
    world.people.mapTable(
      world.shape.table('Suppliers')?.id as string,
      { each: 'person', name: 'Name', emails: 'Email' },
      ctx,
    )
    world.shape.makeTable(
      m.id,
      'Picks',
      [
        { name: 'Supplier', kind: 'person' },
        { name: 'State', kind: 'choice', choices: ['Proposed', 'In', 'Left out'] },
        { name: 'Why', kind: 'text' },
      ],
      ctx,
    )
    writeFileSync(
      join(m.dir, 'skills/picks.js'),
      `export default async (alpha) => {
        const people = await alpha.people.list()
        const judged = await alpha.judge({
          groups: [{ name: 'Mills', about: 'anyone who mills flour' }],
          items: people.map((p) => ({ id: p.id, facts: p.name + ' ' + p.emails.join(' ') })),
        })
        const fits = judged.filter((j) => j.group)
        await alpha.rows.land('Picks', judged.map((j) => ({
          key: j.id, values: { Supplier: j.id, State: 'Proposed', Why: j.why || 'no fit' },
        })))
        const picks = await alpha.rows.list('Picks')
        const out = await alpha.review({
          words: 'These may be mills', table: 'Picks', field: 'State',
          choices: ['In', 'Left out'], rows: picks.map((r) => r.id), note: 'Why',
        })
        return { people: people.length, fits: fits.length, card: out.card, since: alpha.input.lastRun ?? null }
      }`,
    )
    const runner = new AgentRunner(world, () => engine, { owner: 'u_1', judge: fakeJudge })
    const run = await runner.runScript(m, 'skills/picks.js', {}, 'Picks', null)
    expect(run.state).toBe('ok')
    const { people, fits, card } = run.result as { people: number; fits: number; card: string }
    expect([people, fits]).toEqual([2, 1])
    const view = runner.reviews.view(world.cards.get(card) as never)
    expect(view?.rows.map((r) => [r.name, r.note, r.value]).sort()).toEqual([
      ['Dairy Farm', 'no fit', null],
      ['Mill & Co', 'mills flour', null],
    ])
    const dairy = view?.rows.find((r) => r.name === 'Dairy Farm')?.id as string
    runner.reviews.choose(card, [dairy], 'Left out', ctx)
    expect(world.cards.get(card)?.state).toBe('waiting')
    const done = runner.reviews.choose(card, 'rest', 'In', ctx)
    expect(done.open).toBe(0)
    expect(world.cards.get(card)?.answer).toBe('In 1, Left out 1')
    // the person's word stands when the script lands the rows again
    await runner.runScript(m, 'skills/picks.js', {}, 'Picks', null)
    const states = world.records
      .list(world.shape.table('Picks')?.id as string)
      .map((r) => [r.values.why, r.values.state])
      .sort()
    expect(states).toEqual([
      ['mills flour', 'In'],
      ['no fit', 'Left out'],
    ])
  }, 60_000)

  it('refuses choices the field does not have, and rows of another module', async () => {
    const m = await install(world, join(import.meta.dirname, 'test-kit'), ctx)
    writeFileSync(
      join(m.dir, 'skills/bad.js'),
      `export default async (alpha) => {
        const rows = (await alpha.rows.list('Orders')).map((r) => r.id)
        return alpha.review({ words: 'x', table: 'Suppliers', field: 'Name', choices: ['Yes'], rows })
      }`,
    )
    const runner = new AgentRunner(world, () => engine, { owner: 'u_1', judge: fakeJudge })
    const bad = await runner.runScript(m, 'skills/bad.js', {}, 'Bad', null)
    expect(bad.state).toBe('failed')
    expect(bad.words).toMatch(/no choice field Name/)
  }, 60_000)
})
