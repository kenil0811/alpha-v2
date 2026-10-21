// The route: a subscription leaves Claude Code's own files alone; a key is handed to sessions.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MemorySecrets } from '@alpha/connector-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { World } from '../world/world.ts'
import { ModelRoute } from './route.ts'

let home: string
let world: World

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'alpha-route-'))
  world = await World.open(join(home, 'tenants', 't_test'))
})

afterEach(() => {
  world.close()
  rmSync(home, { recursive: true, force: true })
})

describe('the route to Claude', () => {
  it('is the subscription until a key is given, and Claude Code never updates itself', async () => {
    const route = new ModelRoute(world, new MemorySecrets(), home)
    await route.load()
    expect(route.name).toBe('subscription')
    expect(route.env()).toEqual({ DISABLE_AUTOUPDATER: '1' })
    await expect(route.set('key', 'not-a-key', 'u_1')).rejects.toThrow(/sk-ant-/)
    await expect(route.set('key', null, 'u_1')).rejects.toThrow(/Give the API key/)
  })

  it('keeps the key in the secret store and hands it to sessions, with Claude Code’s files in Alpha’s folder', async () => {
    const secrets = new MemorySecrets()
    const route = new ModelRoute(world, secrets, home)
    await route.set('key', 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz', 'u_1')
    expect(await secrets.get('anthropic:api-key')).toBe('sk-ant-api03-abcdefghijklmnopqrstuvwxyz')
    const again = new ModelRoute(world, secrets, home)
    await again.load()
    expect(again.env()).toEqual({
      DISABLE_AUTOUPDATER: '1',
      ANTHROPIC_API_KEY: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz',
      CLAUDE_CONFIG_DIR: join(home, 'claude'),
    })
    await again.set('subscription', null, 'u_1')
    expect(again.env()).toEqual({ DISABLE_AUTOUPDATER: '1' })
  })
})
