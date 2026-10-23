// The core on the plain platform: every Mac piece faked, and what it cannot do said in words.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Setup } from '../setup.ts'
import { setHomeRegion } from '../world/phones.ts'
import { World } from '../world/world.ts'
import { PlainPlatform } from './plain.ts'

let home: string
let world: World
beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-platform-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})
afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('the plain platform', () => {
  it('keeps no secrets, shows no notification, and refuses a settings pane in words', async () => {
    const p = new PlainPlatform()
    const { store, helper } = p.secrets(null)
    expect(helper).toBeNull()
    await expect(store.set('x', 'y')).rejects.toThrow(/no secret store on this computer/)
    p.notify('Reminder', 'Call Priya')
    expect(p.notified).toEqual([{ title: 'Reminder', words: 'Call Priya' }])
    expect(() => p.openSettings('Contacts')).toThrow(/no settings pane for Contacts/)
    expect(p.personName()).toBeTypeOf('string')
    expect(p.region()).toBeNull()
    setHomeRegion(p.region())
  })

  it('runs the setup with no keep-awake switch, and the world names its owner by the account', () => {
    const p = new PlainPlatform()
    const setup = new Setup(home, world, null, null, undefined, p)
    setup.holdAwake()
    expect(setup.keepAwake).toBe(false)
    const user = world.owner(p.personName())
    expect(user.name).toBe(p.personName())
  })
})
