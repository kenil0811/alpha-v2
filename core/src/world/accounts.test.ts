// Who may sign in (the clean base, step 4b): passwords, links and sessions. Never a real account.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { World } from './world.ts'

const PASSWORD = 'correct horse battery'
let home: string
let world: World
let ctx: { actor: { kind: 'person'; id: string }; user: string }
beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-accounts-'))
  world = await World.open(join(home, 'tenants', 't_test'))
  const owner = world.owner('Kenil')
  ctx = { actor: { kind: 'person', id: owner.id }, user: owner.id }
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

const priya = async () => {
  const { id, link } = world.accounts.add('Priya', 'Priya@Example.com', ctx)
  return { id, link, session: await world.accounts.setPassword(link, PASSWORD, null, 30) }
}

describe('an account', () => {
  it('starts from a one-time link that sets a password of at least 12 characters', async () => {
    const { link } = world.accounts.add('Priya', 'priya@example.com', ctx)
    expect(world.accounts.linkFor(link)).toEqual({ name: 'Priya', email: 'priya@example.com' })
    await expect(world.accounts.setPassword(link, 'short', null, 30)).rejects.toThrow(/12/)
    const session = await world.accounts.setPassword(link, PASSWORD, null, 30)
    expect(world.accounts.userOf(session)?.name).toBe('Priya')
    expect(world.accounts.linkFor(link)).toBeNull()
    await expect(world.accounts.setPassword(link, PASSWORD, null, 30)).rejects.toThrow(/used/)
  })

  it('keeps no password, link or session in the clear, and says so in the journal only by name', async () => {
    const { link, session } = await priya()
    const row = JSON.stringify(world.db.prepare('SELECT * FROM accounts').all())
    const held = JSON.stringify(world.db.prepare('SELECT * FROM sessions').all())
    expect(row).not.toContain(PASSWORD)
    expect(row).not.toContain(link)
    expect(held).not.toContain(session)
    const lines = JSON.stringify(world.lines({ kinds: ['account', 'signed_in'] }))
    expect(lines).toContain('Added Priya')
    expect(lines).not.toContain(PASSWORD)
  })

  it('signs in by email, whatever its case, with the same words for any wrong try', async () => {
    await priya()
    expect(
      world.accounts.userOf(await world.accounts.signIn('PRIYA@example.com', PASSWORD, 30))?.name,
    ).toBe('Priya')
    const wrong = /do not match/
    await expect(world.accounts.signIn('priya@example.com', 'not the one', 30)).rejects.toThrow(
      wrong,
    )
    await expect(world.accounts.signIn('nobody@example.com', PASSWORD, 30)).rejects.toThrow(wrong)
  })

  it('makes a run of wrong tries wait', async () => {
    await priya()
    for (let i = 0; i < 5; i++)
      await expect(world.accounts.signIn('priya@example.com', 'wrong try', 30)).rejects.toThrow()
    await expect(world.accounts.signIn('priya@example.com', PASSWORD, 30)).rejects.toThrow(/wait/)
  })

  it('ends a session on signing out, and at its end', async () => {
    const { session } = await priya()
    world.accounts.signOut(session)
    expect(world.accounts.userOf(session)).toBeNull()
    const old = await world.accounts.signIn('priya@example.com', PASSWORD, 30)
    world.db.prepare("UPDATE sessions SET until = '2020-01-01T00:00:00.000Z'").run()
    expect(world.accounts.userOf(old)).toBeNull()
    expect(world.accounts.userOf(undefined)).toBeNull()
  })

  it('takes a new link and removal: the old password and sessions end', async () => {
    const { id, session } = await priya()
    const link = world.accounts.newLink(id, ctx)
    expect(world.accounts.userOf(session)).toBeNull()
    await expect(world.accounts.signIn('priya@example.com', PASSWORD, 30)).rejects.toThrow()
    const again = await world.accounts.setPassword(link, `${PASSWORD} two`, null, 30)
    world.accounts.remove(id, ctx)
    expect(world.accounts.userOf(again)).toBeNull()
    expect(world.accounts.list().map((p) => p.name)).toEqual([])
    expect(world.user(id)?.name).toBe('Priya') // what they did keeps their name
  })

  it('gives the owner a link until they have a password, then none', async () => {
    const owner = world.owner()
    const first = world.accounts.ownerLink(owner) as string
    const second = world.accounts.ownerLink(owner) as string
    expect(world.accounts.linkFor(first)).toBeNull() // a new one replaces it
    expect(world.accounts.linkFor(second)).toEqual({ name: 'Kenil', email: null })
    await expect(world.accounts.setPassword(second, PASSWORD, null, 30)).rejects.toThrow(/email/)
    await world.accounts.setPassword(second, PASSWORD, 'kenil@example.com', 30)
    expect(world.accounts.ownerLink(owner)).toBeNull()
    expect(() => world.accounts.remove(owner.id, ctx)).toThrow(/owner stays/)
  })

  it('lets a provider sign in only someone already added', async () => {
    await priya()
    expect(world.accounts.signInByEmail('nobody@example.com', 30)).toBeNull()
    const token = world.accounts.signInByEmail('priya@example.com', 30) as string
    expect(world.accounts.userOf(token)?.name).toBe('Priya')
  })
})
