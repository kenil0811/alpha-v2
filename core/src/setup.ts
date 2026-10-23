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
import { type Install, readInstall, writeInstall } from './install.ts'
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
  // what alpha.yaml says of this install
  install: { owner: string; port: number; home: string; reportTo: string | null }
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
  private install: Install
  private browser: Readiness
  private documents: Readiness
  private problem: string | null = null
  private awake: ChildProcess | null = null

  constructor(
    home: string,
    world: World,
    route: ModelRoute | null,
    connectors: ConnectorService | null = null,
    install: Install = readInstall(home),
  ) {
    this.home = home
    this.world = world
    this.route = route
    this.connectors = connectors
    this.install = install
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

  // Whether Alpha keeps this Mac from sleeping while it is plugged in (the installed app asks
  // for it in alpha.yaml; the person turns it off in Settings › This Mac, and the core writes
  // that back): macOS's own caffeinate, for as long as the core runs. The screen still turns
  // off; on battery or with the lid closed the Mac sleeps, and catches up on waking.
  get keepAwake(): boolean {
    return this.install.keepAwake
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
    this.install = { ...this.install, keepAwake: on }
    writeInstall(this.home, { keepAwake: on })
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
      // the switch shows where an installed app runs the core; a development run has no login item
      keepAwake: this.install.helper ? this.keepAwake : null,
      install: {
        owner: this.world.owner().name,
        port: this.install.port,
        home: this.home,
        reportTo: this.install.reportTo,
      },
      readers: { browser: this.browser, documents: this.documents, problem: this.problem },
    }
  }
}
