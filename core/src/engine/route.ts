// How this install reaches Claude (design §5): the person's own subscription, signed in through
// Claude Code's own sign-in on this Mac (Alpha never sees that token and leaves ~/.claude where it
// is); or the firm's API key handed to Claude Code, with its files in Alpha's own folder. Chosen
// per install in Settings and kept in the world. Claude Code never updates itself: the app ships the one it was
// tested with.
import { join } from 'node:path'
import type { SecretStore } from '@alpha/connector-sdk'
import { one, run } from '../world/db.ts'
import { Refused } from '../world/kinds.ts'
import type { World } from '../world/world.ts'

export type RouteName = 'subscription' | 'key'

export const KEY_REF = 'anthropic:api-key'

export class ModelRoute {
  private world: World
  private secrets: SecretStore
  private key: string | null = null
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

  // The key read from the Keychain once at start, so a session's start never waits on it.
  async load(): Promise<void> {
    this.key = await this.secrets.get(KEY_REF).catch(() => null)
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
    return always
  }
}
