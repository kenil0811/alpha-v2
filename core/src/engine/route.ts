// How this install reaches Claude: the person's own subscription, signed in through
// Claude Code's own sign-in on this Mac (Alpha never sees that token and leaves ~/.claude where it
// is); or the firm's API key handed to Claude Code, with its files in Alpha's own folder. Chosen
// per install in Settings and kept in the world. Claude Code never updates itself: the app ships the one it was
// tested with.
import { join } from 'node:path'
import { MemorySecrets, type SecretStore } from '@alpha/connector-sdk'
import { one, run } from '../world/db.ts'
import { Refused } from '../world/kinds.ts'
import type { World } from '../world/world.ts'

export type RouteName = 'subscription' | 'key'

export const KEY_REF = 'anthropic:api-key'
export const TOKEN_REF = 'anthropic:oauth-token'

// A run handed its token in the environment, as the journeys are on a server; otherwise no route.
export async function tokenRoute(world: World, home: string): Promise<{ route?: ModelRoute }> {
  const token = process.env.CLAUDE_CODE_OAUTH_TOKEN
  if (!token) return {}
  const secrets = new MemorySecrets()
  await secrets.set(TOKEN_REF, token)
  const route = new ModelRoute(world, secrets, home)
  await route.load()
  return { route }
}

export class ModelRoute {
  private world: World
  private secrets: SecretStore
  private key: string | null = null
  private token: string | null = null // a subscription's, from `claude setup-token`, on a server
  private home: string

  constructor(world: World, secrets: SecretStore, home: string) {
    this.world = world
    this.secrets = secrets
    this.home = home
  }

  // The route as kept: subscription until the person gives a key.
  get name(): RouteName {
    const v = one<{ value: string }>(
      this.world.db,
      "SELECT value FROM meta WHERE key = 'model_route'",
    )
    return v?.value === 'key' ? 'key' : 'subscription'
  }

  get hasKey(): boolean {
    return !!this.key
  }

  get hasToken(): boolean {
    return !!this.token
  }

  // A server has no browser for Claude's sign-in, so a subscription comes as a token.
  async setToken(token: string, by: string): Promise<void> {
    const given = token.trim()
    if (!/^sk-ant-[\w-]{20,}$/.test(given))
      throw new Refused('That is not a Claude token: it starts with sk-ant-.')
    await this.secrets.set(TOKEN_REF, given)
    this.token = given
    this.world.line({
      actor: { kind: 'person', id: by },
      kind: 'shaped',
      words: 'Alpha now reaches Claude with a subscription token.',
      data: { route: 'subscription' },
      user: by,
    })
  }

  // The key read from the Keychain once at start, so a session's start never waits on it.
  async load(): Promise<void> {
    this.key = await this.secrets.get(KEY_REF).catch(() => null)
    this.token = await this.secrets.get(TOKEN_REF).catch(() => null)
  }

  async set(name: RouteName, key: string | null, by: string): Promise<void> {
    if (name === 'key') {
      const given = key?.trim()
      if (given) {
        if (!/^sk-ant-[\w-]{20,}$/.test(given))
          throw new Refused('That is not an Anthropic API key: it starts with sk-ant-.')
        await this.secrets.set(KEY_REF, given)
        this.key = given
      }
      if (!this.key) throw new Refused('Give the API key to use it.')
    }
    run(
      this.world.db,
      "INSERT INTO meta (key, value) VALUES ('model_route', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      name,
    )
    this.world.line({
      actor: { kind: 'person', id: by },
      kind: 'shaped',
      words:
        name === 'key'
          ? 'Alpha now reaches Claude with the API key kept in the Keychain, through Claude Code.'
          : 'Alpha now reaches Claude on your own Claude subscription.',
      data: { route: name },
      user: by,
    })
  }

  // What each Claude Code session is started with, besides its own settings.
  env(): Record<string, string> {
    const always = { DISABLE_AUTOUPDATER: '1' }
    if (this.name === 'key' && this.key)
      return {
        ...always,
        ANTHROPIC_API_KEY: this.key,
        CLAUDE_CONFIG_DIR: join(this.home, 'claude'),
      }
    if (this.token) return { ...always, CLAUDE_CODE_OAUTH_TOKEN: this.token }
    return always
  }
}
