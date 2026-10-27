import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { run } from '../world/db.ts'
import { World } from '../world/world.ts'
import { askedFor, decide, gateOf, WAITS } from './gates.ts'

let home: string
let world: World
const alpha = { kind: 'alpha' as const }
const call = { tool: 'change', input: { table: 'Meals', remove: ['r_1'] } }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-gates-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('the gates', () => {
  it('are three, and an undeclared effect counts as leaving the world', () => {
    const base = { call, preview: 'x', actor: alpha }
    expect(gateOf({ ...base, effect: 'read' })).toBeNull()
    expect(gateOf({ ...base, effect: 'write' })).toBeNull()
    expect(gateOf({ ...base, effect: 'outward' })).toBe('leaves_world')
    expect(gateOf({ ...base, effect: 'sign_in' })).toBe('sign_in')
    expect(gateOf({ ...base, effect: undefined })).toBe('leaves_world')
  })

  it('let a removal through when it is not the person’s own, or when they asked in their words', () => {
    const base = { call, preview: 'x', actor: alpha, effect: 'remove' as const }
    expect(gateOf({ ...base, ownEntries: false })).toBeNull()
    expect(gateOf({ ...base, ownEntries: true })).toBe('deletes_own')
    expect(
      gateOf({
        ...base,
        ownEntries: true,
        askedIn: 'remove the eggs',
        message: 'Please remove the eggs, I logged them twice',
      }),
    ).toBeNull()
    expect(
      gateOf({ ...base, ownEntries: true, askedIn: 'remove the eggs', message: 'log two eggs' }),
    ).toBe('deletes_own')
    expect(gateOf({ ...base, ownEntries: true, askedIn: 'remove the eggs', message: null })).toBe(
      'deletes_own',
    )
  })

  it('find the asking words whatever their case, spacing or quote marks, and only when they say removal', () => {
    expect(askedFor('throw away  THE eggs', 'please throw away the eggs')).toBe(true)
    expect(askedFor('Get rid of the eggs', 'get rid of the eggs, I logged them twice')).toBe(true)
    // the person's words, but no removal in them: a card
    expect(askedFor("don't keep the eggs", 'please don’t keep the eggs')).toBe(false)
    // three letters of a message are never an ask
    expect(askedFor('two', 'log two eggs')).toBe(false)
    expect(askedFor('eggs', 'remove the eggs')).toBe(false)
    expect(askedFor('ok', 'ok')).toBe(false)
    // removal words the model made up, not in what was typed
    expect(askedFor('remove the eggs', 'the eggs were a mistake')).toBe(false)
  })

  it('make a card and refuse; the yes on it lets the same call through once', () => {
    const input = {
      call,
      preview: 'Remove a row from Meals?',
      actor: alpha,
      effect: 'outward' as const,
      user: 'u_1',
    }
    const first = decide(world, input)
    expect(first.pass).toBe(false)
    if (first.pass || !first.card) throw new Error('should have waited on a card')
    expect(first.reason).toBe(WAITS)
    expect(first.card.state).toBe('waiting')
    world.cards.answer(first.card.id, 'Yes', { kind: 'person', id: 'u_1' })
    expect(decide(world, input)).toEqual({
      pass: true,
      card: expect.objectContaining({ id: first.card.id }),
    })
    const again = decide(world, input)
    expect(again.pass).toBe(false)
  })

  it('let a yes lapse after its hours: the call asks again, and Activity says so', () => {
    const input = {
      call,
      effect: 'remove' as const,
      preview: 'Remove eggs?',
      actor: alpha,
      ownEntries: true,
    }
    const first = decide(world, input)
    expect(first.pass).toBe(false)
    if (first.pass || !first.card) throw new Error('should have waited on a card')
    world.cards.answer(first.card.id, 'Remove them', { kind: 'person', id: 'u_1' })
    // the yes is seven hours old by the time the call comes again
    run(
      world.db,
      'UPDATE cards SET decided_at = ? WHERE id = ?',
      new Date(Date.now() - 7 * 3_600_000).toISOString(),
      first.card.id,
    )
    const again = decide(world, input)
    expect(again.pass).toBe(false)
    if (again.pass || !again.card) throw new Error('should have waited on a card')
    expect(again.card.id).not.toBe(first.card.id)
    expect(again.card.state).toBe('waiting')
    expect(world.cards.get(first.card.id)?.lapsedAt).not.toBeNull()
    expect(world.lines({ kinds: ['card_lapsed'] }).map((l) => l.words)).toEqual([
      'Your yes on “Remove eggs?” lapsed after 6 hours; Alpha asks again.',
    ])
    // a fresh yes still lets the same call through once
    world.cards.answer(again.card.id, 'Remove them', { kind: 'person', id: 'u_1' })
    expect(decide(world, input).pass).toBe(true)
  })

  it('keep a no: the call waits on a new card', () => {
    const input = { call, preview: 'Send it?', actor: alpha, effect: 'outward' as const }
    const first = decide(world, input)
    if (first.pass || !first.card) throw new Error('should have waited')
    world.cards.answer(first.card.id, 'No', { kind: 'person', id: 'u_1' })
    const again = decide(world, input)
    expect(again.pass).toBe(false)
    if (!again.pass) expect(again.card?.id).not.toBe(first.card.id)
  })
})
