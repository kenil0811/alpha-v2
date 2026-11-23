// Watching a person's work (23 Nov, proposed): the wall refuses without Alpha staying on their
// computer or without their own yes, and the reader itself is a stub that refuses.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NOT_BUILT, watchFrontApp } from '@alpha/connector-computer/observe'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { watchAfterSetup } from '../api/routes/observe.ts'
import { giveLeave, leaveOf, mayNotWatch, takeBack } from './observe.ts'
import { World } from './world.ts'

let home: string
let world: World
beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-observe-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

it('refuses without the person’s own yes, or without Alpha staying on their computer', () => {
  const user = world.owner('Kenil')
  expect(mayNotWatch(null, user.id, ['pc_1'])).toMatch(/not said yes/)
  const leave = giveLeave(world.db, user.id)
  expect(leaveOf(world.db, user.id)).toEqual({ by: user.id, at: leave.at })
  expect(mayNotWatch(leave, user.id, [])).toMatch(/Alpha Bridge/)
  // someone else's yes is not theirs
  expect(mayNotWatch(leave, 'u_other', ['pc_1'])).toMatch(/not said yes/)
  expect(mayNotWatch(leave, user.id, ['pc_1'])).toBeNull()
  takeBack(world.db, user.id)
  expect(leaveOf(world.db, user.id)).toBeNull()
})

it('never starts at the end of setup without both, and its reader refuses while unbuilt', () => {
  const user = world.owner('Kenil')
  let started = 0
  const start = () => {
    started++
  }
  expect(watchAfterSetup(world, user, start)).toMatch(/not said yes/)
  giveLeave(world.db, user.id)
  // no computer of theirs connected
  expect(watchAfterSetup(world, user, start)).toMatch(/Alpha Bridge/)
  expect(started).toBe(0)
  expect(world.lines({ kinds: ['observe'] })).toEqual([])
  expect(() => watchFrontApp()).toThrow(NOT_BUILT)
})
