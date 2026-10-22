// This Mac's setup (packaging, piece 3): what a fresh install still needs, in words for the first
// open and Settings. Claude's own sign-in on this Mac (asked of the bundled Claude Code, which
// answers for the route this install uses), the person's connections, Google Chrome for sites they
// sign in to, and the two downloads reading needs, started at install and here on asking: the
// reading browser and the document reader (about 1.8 GB between them).
import { type ChildProcess, execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { doclingEnv } from '@alpha/connector-files'
import { chromePath, ensureBrowser } from '@alpha/connector-sdk'
import type { ConnectorService } from './connectors/service.ts'
import type { ModelRoute } from './engine/route.ts'
import { one, run } from './world/db.ts'
import type { World } from './world/world.ts'

export type Readiness = 'ready' | 'preparing' | 'not yet' | 'failed'

export interface SetupView {
  claude: { signedIn: boolean; email: string | null; how: string | null; problem: string | null }
  route: 'subscription' | 'key' | 'api'
  // Each connector that asks for a place on the first open, as it describes itself.
  steps: { connector: string; title: string; sub: string; done: boolean }[]
  chrome: boolean
  keepAwake: boolean | null
  readers: { browser: Readiness; documents: Readiness; problem: string | null }
}

// Claude Code as the Agent SDK carries it for this Mac.
export function claudeBinary(): string | null {
  try {
    const sdk = createRequire(import.meta.url).resolve('@anthropic-ai/claude-agent-sdk')
    const pkg = createRequire(sdk).resolve(
      '@anthropic-ai/claude-agent-sdk-darwin-arm64/package.json',
    )
    const bin = join(pkg, '..', 'claude')
    return existsSync(bin) ? bin : null
  } catch {
    return null
  }
}

export class Setup {
  private home: string
  private world: World
  private route: ModelRoute | null
  private connectors: ConnectorService | null
  private browser: Readiness
  private documents: Readiness
  private problem: string | null = null
  private awake: ChildProcess | null = null

  constructor(
    home: string,
    world: World,
    route: ModelRoute | null,
    connectors: ConnectorService | null = null,
  ) {
    this.home = home
    this.world = world
    this.route = route
    this.connectors = connectors
    this.browser = existsSync(join(home, 'browsers', '.chromium-headless-shell-ready'))
      ? 'ready'
      : 'not yet'
    this.documents = existsSync(join(home, 'envs', 'docling', '.ready')) ? 'ready' : 'not yet'
  }

  // The two downloads, each once, in the background; what failed is said in words.
  prepare(): void {
    if (this.browser === 'not yet' || this.browser === 'failed') {
      this.browser = 'preparing'
      ensureBrowser(join(this.home, 'browsers')).then(
        () => {
          this.browser = 'ready'
        },
        (err: unknown) => {
          this.browser = 'failed'
          this.problem = err instanceof Error ? err.message : String(err)
        },
      )
    }
    if (this.documents === 'not yet' || this.documents === 'failed') {
      this.documents = 'preparing'
      doclingEnv(join(this.home, 'envs')).then(
        () => {
          this.documents = 'ready'
        },
        (err: unknown) => {
          this.documents = 'failed'
          this.problem = `The document reader could not be set up: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`
        },
      )
    }
  }

  // Whether Alpha keeps this Mac from sleeping while it is plugged in (on by default where the
  // installed app asks it to): macOS's own caffeinate, for as long as the core runs. The screen
  // still turns off; on battery or with the lid closed the Mac sleeps, and catches up on waking.
  get keepAwake(): boolean {
    return (
      process.env.ALPHA_KEEP_AWAKE === '1' &&
      one<{ value: string }>(this.world.db, "SELECT value FROM meta WHERE key = 'keep_awake'")
        ?.value !== 'off'
    )
  }

  holdAwake(): void {
    this.awake?.kill()
    this.awake = null
    if (process.platform !== 'darwin' || !this.keepAwake) return
    this.awake = spawn('/usr/bin/caffeinate', ['-s', '-w', String(process.pid)], {
      stdio: 'ignore',
    })
    this.awake.unref()
  }

  setKeepAwake(on: boolean): void {
    run(
      this.world.db,
      "INSERT INTO meta (key, value) VALUES ('keep_awake', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      on ? 'on' : 'off',
    )
    this.holdAwake()
  }

  // Claude's own sign-in, started from the window: it opens the person's browser and finishes
  // there by itself; Alpha only watches the status change. Started once at a time.
  private signingIn: ReturnType<typeof execFile> | null = null
  signIn(): boolean {
    const bin = claudeBinary()
    if (!bin || this.signingIn) return false
    const child = execFile(
      bin,
      ['auth', 'login'],
      {
        timeout: 5 * 60_000,
        env: { ...process.env, ...(this.route?.env() ?? {}) },
      },
      () => {
        this.signingIn = null
      },
    )
    child.stdin?.end()
    this.signingIn = child
    return true
  }

  private claude(): Promise<SetupView['claude']> {
    const bin = claudeBinary()
    if (!bin)
      return Promise.resolve({
        signedIn: false,
        email: null,
        how: null,
        problem: 'Claude Code is not in this copy of Alpha.',
      })
    return new Promise((resolve) =>
      execFile(
        bin,
        ['auth', 'status'],
        { timeout: 20_000, env: { ...process.env, ...(this.route?.env() ?? {}) } },
        (err, stdout) => {
          try {
            const s = JSON.parse(stdout) as {
              loggedIn?: boolean
              email?: string
              authMethod?: string
            }
            resolve({
              signedIn: !!s.loggedIn,
              email: s.email ?? null,
              how: s.authMethod ?? null,
              problem: null,
            })
          } catch {
            resolve({
              signedIn: false,
              email: null,
              how: null,
              problem: err ? 'Claude Code did not say whether it is signed in.' : null,
            })
          }
        },
      ),
    )
  }

  async view(): Promise<SetupView> {
    const kinds = new Set(
      this.world.connections
        .list()
        .filter((k) => k.state === 'connected')
        .map((k) => k.connector),
    )
    return {
      claude: await this.claude(),
      route: this.route?.name ?? 'subscription',
      steps: (this.connectors?.known() ?? []).flatMap((c) =>
        c.manifest.setup
          ? [
              {
                connector: c.manifest.name,
                title: c.manifest.title,
                sub: c.manifest.setup.sub,
                done: kinds.has(c.manifest.name),
              },
            ]
          : [],
      ),
      chrome: !!chromePath(),
      keepAwake: process.env.ALPHA_KEEP_AWAKE === '1' ? this.keepAwake : null,
      readers: { browser: this.browser, documents: this.documents, problem: this.problem },
    }
  }
}
