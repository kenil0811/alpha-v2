// An agent's drafts, Always and Revoke, with a stand-in for the mail: nothing is sent anywhere.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { World } from '../world/world.ts'
import { type Draft, Drafts, type Message } from './drafts.ts'

let home: string
let world: World
const alpha = { actor: { kind: 'alpha' as const } }

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-drafts-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

function setUp() {
  const owner = world.owner('Kenil')
  const m = world.shape.makeModule('Desk', alpha)
  const jobs = world.shape.makeTable(m.id, 'Jobs', [{ name: 'Name', kind: 'text' }], alpha)
  const rows = world.records.add(
    jobs.id,
    ['Shop fit', 'Kitchen', 'Porch', 'Attic', 'Garage'].map((Name) => ({
      values: { Name },
      provenance: { kind: 'assumed' as const, basis: 'a test' },
    })),
    alpha,
  )
  const sent: Message[] = []
  const drafts = new Drafts(world, { send: async (_c, msg) => sent.push(msg) }, owner)
  const draft = (i: number): Draft => ({
    agent: 'Outreach',
    module: m.id,
    kind: 'quote request',
    key: rows[i] as string,
    connector: 'gmail',
    message: {
      to: 'sam@builders.example',
      subject: `Quote for job ${i}`,
      body: 'Could you quote it?',
    },
    about: { table: jobs.id, row: rows[i] as string },
    note: null,
  })
  return { owner, m, drafts, draft, sent }
}

describe('an agent’s drafts', () => {
  it('wait on a card, go as the person changed them, and a Not now keeps its reason for the agent', async () => {
    const s = setUp()
    const first = await s.drafts.propose(s.draft(0), null)
    expect(first.sent).toBe(false)
    const card = world.cards.get(first.card as string)
    expect(card?.words).toBe('Send the quote request for Shop fit to sam@builders.example?')
    await s.drafts.send(
      first.card as string,
      { ...s.draft(0).message, body: 'Could you quote it by Friday?' },
      s.owner,
    )
    expect(s.sent.map((m) => m.body)).toEqual(['Could you quote it by Friday?'])
    const second = await s.drafts.propose(s.draft(1), null)
    expect(() => s.drafts.hold(second.card as string, 'Because', '', s.owner)).toThrow(/Say why/)
    s.drafts.hold(second.card as string, 'Bad timing', 'after the holidays', s.owner)
    expect(
      s.drafts.outcomes('Outreach', s.m.id, null).map((o) => [o.outcome, o.changed, o.reason]),
    ).toEqual([
      ['sent', true, null],
      ['not sent', false, 'Bad timing: after the holidays'],
    ])
  })

  it('go to one address, never a blast, and a newer draft for the same thing replaces the waiting one', async () => {
    const s = setUp()
    await expect(
      s.drafts.propose(
        { ...s.draft(0), message: { ...s.draft(0).message, to: 'a@x.example, b@x.example' } },
        null,
      ),
    ).rejects.toThrow(/one address/)
    const a = await s.drafts.propose(s.draft(0), null)
    await s.drafts.propose(
      { ...s.draft(0), message: { ...s.draft(0).message, subject: 'Again' } },
      null,
    )
    expect(world.cards.get(a.card as string)?.state).toBe('withdrawn')
  })

  it('offer Always after three unchanged sends; under it the kind goes at once, until it is revoked', async () => {
    const s = setUp()
    for (const i of [0, 1, 2]) {
      const d = await s.drafts.propose(s.draft(i), null)
      const view = s.drafts.view(world.cards.get(d.card as string) as never)
      expect(view?.always).toBeNull()
      await s.drafts.send(d.card as string, null, s.owner)
    }
    const fourth = await s.drafts.propose(s.draft(3), null)
    const view = s.drafts.view(world.cards.get(fourth.card as string) as never)
    expect(view?.always).toBe(
      "Always send Desk's quote requests (drafted by Outreach) without asking",
    )
    await expect(
      s.drafts.send(
        fourth.card as string,
        { ...s.draft(3).message, subject: 'Changed' },
        s.owner,
        true,
      ),
    ).rejects.toThrow(/Always is offered only/)
    await s.drafts.send(fourth.card as string, null, s.owner, true)
    const [p] = world.permissions.list()
    expect(p?.sentence).toBe(view?.always)
    const fifth = await s.drafts.propose(s.draft(4), null)
    expect(fifth).toEqual({ sent: true, card: null })
    expect(s.sent).toHaveLength(5)
    expect(world.permissions.get(p?.id as string)?.uses).toBe(1)
    expect(world.lines({ kinds: ['told'] }).at(-1)?.words).toBe(
      'Outreach: Sent the quote request for Garage to sam@builders.example (your standing permission).',
    )
    world.permissions.revoke(p?.id as string, { actor: { kind: 'person', id: s.owner.id } })
    const after = await s.drafts.propose(s.draft(0), null)
    expect(after.sent).toBe(false)
    expect(s.drafts.view(world.cards.get(after.card as string) as never)?.always).toBeNull()
  })

  it('a standing permission is given only by the person, and only after the yeses that earn it', () => {
    const s = setUp()
    const covered = s.drafts.covered(s.draft(0))
    expect(() => world.permissions.grant(covered, 'Always', { actor: { kind: 'alpha' } })).toThrow(
      /Only the person/,
    )
    expect(() =>
      world.permissions.grant(covered, 'Always', { actor: { kind: 'person', id: s.owner.id } }),
    ).toThrow(/after 3 yeses in a row/)
  })
})
