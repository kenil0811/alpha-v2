// Agents as a row and a folder (clean base step 7): made and changed through keep, its memory,
// and undoing a change to its instructions.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CHIEF } from '../world/agents/index.ts'
import { World } from '../world/world.ts'
import {
  builderId,
  INSTRUCTIONS,
  instructionsOf,
  keepAgent,
  keepAgentFile,
  keepBuilder,
  removeAgent,
  undoAgentChange,
} from './agents.ts'

let home: string
let world: World
const ctx = { actor: { kind: 'alpha' as const }, user: 'u_1' }
const scout = {
  title: 'Finds deals',
  description: 'Ask it to find businesses for sale.',
  instructions: 'Look widely.',
}

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-agents-'))
  world = await World.open(home)
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('an agent', () => {
  it('is made with a title, a description and instructions, and only by the Chief of staff', async () => {
    await expect(keepAgent(world, 'Scout', { title: 'x' }, ctx, null)).rejects.toThrow(
      /needs a title/,
    )
    await keepAgent(world, 'Scout', scout, ctx, null)
    const a = world.agents.byName('scout')
    expect(a?.title).toBe('Finds deals')
    expect(instructionsOf(world, a?.id as string)).toBe('Look widely.')
    await expect(keepAgent(world, 'Other', scout, ctx, a?.id as string)).rejects.toThrow(
      /Only the Chief of staff makes/,
    )
    await expect(keepAgent(world, 'Chief of staff', scout, ctx, null)).rejects.toThrow(
      /already has that name/,
    )
  })

  it('changes itself, and only the Chief of staff changes another', async () => {
    await keepAgent(world, 'Scout', scout, ctx, null)
    await keepAgent(world, 'Reader', scout, ctx, null)
    const a = world.agents.byName('Scout')?.id as string
    await keepAgent(world, 'Scout', { title: 'Finds more' }, ctx, a)
    expect(world.agents.get(a)?.title).toBe('Finds more')
    await expect(keepAgent(world, 'Reader', { title: 'y' }, ctx, a)).rejects.toThrow(
      /changes another/,
    )
  })

  it('refuses a model the config does not list', async () => {
    await expect(
      keepAgent(world, 'Scout', { ...scout, model: 'gpt-9' }, ctx, null),
    ).rejects.toThrow(/not a model an agent can use/)
  })

  it('can undo a change to its instructions', async () => {
    await keepAgent(world, 'Scout', scout, ctx, null)
    const a = world.agents.byName('Scout')?.id as string
    await keepAgent(world, 'Scout', { instructions: 'Look narrowly.' }, ctx, a)
    const line = world.lines({ kinds: ['agent_changed'] }).at(-1)
    expect(instructionsOf(world, a)).toBe('Look narrowly.')
    await undoAgentChange(world, a, line?.data.commit as string, INSTRUCTIONS, ctx)
    expect(instructionsOf(world, a)).toBe('Look widely.')
  })

  it('keeps a skill in its folder, with a name and a description', async () => {
    await keepAgent(world, 'Scout', scout, ctx, null)
    await expect(
      keepAgentFile(world, 'Scout', 'skills/a/SKILL.md', 'no front', ctx, null),
    ).rejects.toThrow(/needs front matter/)
    await expect(keepAgentFile(world, 'Scout', '../x', 'x', ctx, null)).rejects.toThrow(
      /keeps files under/,
    )
    const words = await keepAgentFile(
      world,
      'Scout',
      'skills/a/SKILL.md',
      '---\nname: a\ndescription: b\n---\nSteps',
      ctx,
      null,
    )
    expect(words).toMatch(/Kept skills\/a\/SKILL.md/)
  })

  it('goes with its memories, and the Chief of staff never goes', async () => {
    await keepAgent(world, 'Scout', scout, ctx, null)
    const a = world.agents.byName('Scout')?.id as string
    world.memories.save({
      agent: a,
      user: null,
      text: 'They sign annual',
      essential: true,
      origin: 'agent',
      saidBy: null,
      turn: null,
    })
    removeAgent(world, a, ctx)
    expect(world.agents.get(a)).toBeUndefined()
    expect(world.memories.list(a, 'u_1')).toEqual([])
    expect(() => removeAgent(world, CHIEF, ctx)).toThrow(/always here/)
  })
})

describe('an agent’s memory', () => {
  const save = (over = {}) =>
    world.memories.save({
      agent: 'a1',
      user: 'u_1',
      text: 'They sign annual',
      essential: false,
      origin: 'agent',
      saidBy: 'u_1',
      turn: null,
      ...over,
    })

  it('is one short fact, and the same fact twice is one', () => {
    expect(() => save({ text: 'x'.repeat(501) })).toThrow(/one short fact/)
    const a = save()
    const b = save({ text: '  they   SIGN annual ', essential: true })
    expect(b.id).toBe(a.id)
    expect(b.essential).toBe(true)
  })

  it('keeps one person’s from another, and the firm’s for everyone', () => {
    save()
    save({ user: null, text: 'Dana approves' })
    save({ user: 'u_2', text: 'Likes it short' })
    expect(
      world.memories
        .list('a1', 'u_1')
        .map((m) => m.text)
        .sort(),
    ).toEqual(['Dana approves', 'They sign annual'])
  })

  it('loads essentials within the budget, newest first, and finds the rest by search', () => {
    save({ text: 'Old essential', essential: true })
    save({ text: 'New essential', essential: true })
    save({ text: 'Searchable pricing fact' })
    expect(world.memories.essentials('a1', 'u_1', 13).map((m) => m.text)).toEqual(['New essential'])
    expect(world.memories.search('a1', 'u_1', '"pricing"', 5).map((m) => m.text)).toEqual([
      'Searchable pricing fact',
    ])
  })

  it('leaves what a person wrote alone', () => {
    const m = save({ origin: 'person' })
    expect(() => world.memories.forget(m.id, 'agent')).toThrow(/person wrote/)
    const e = save({ text: 'Agent wrote this' })
    world.memories.edit(e.id, { text: 'A person changed this' })
    expect(world.memories.get(e.id)?.origin).toBe('person')
    expect(world.memories.forget(m.id, 'person').id).toBe(m.id)
  })
})

describe('the Module builder', () => {
  it('is made once in a world, from its words in config, and stays deleted once deleted', async () => {
    const owner = world.owner('Kenil')
    expect(await keepBuilder(world, owner.id)).toBe('Module builder is one of your agents.')
    const id = builderId(world) as string
    expect(world.agents.get(id)?.title).toBe('Builds new modules')
    expect(instructionsOf(world, id)).toMatch(/business case/)
    removeAgent(world, id, ctx)
    expect(await keepBuilder(world, owner.id)).toBeNull()
    expect(builderId(world)).toBeNull()
  })
})
