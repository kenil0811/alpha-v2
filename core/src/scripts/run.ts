// A kit's or a skill's script, run in a child process under Anthropic's sandbox runtime (design
// §5, §9): no network at all, writes only in its module's folder, reads only there and in Alpha's
// own code. Everything it needs from outside it asks the core for, through `alpha`.
import { spawn } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { SandboxManager } from '@anthropic-ai/sandbox-runtime'

export type ScriptApi = Record<string, (params: Record<string, unknown>) => Promise<unknown>>

export interface ScriptRun {
  result: unknown
  error: string | null
  stderr: string
  stopped: boolean
}

const HOST = join(import.meta.dirname, 'host.ts')
const CODE = realpathSync(join(import.meta.dirname, '..', '..', '..')) // alpha-v2: node_modules and core

let ready: Promise<void> | null = null

function sandbox(): Promise<void> {
  ready ??= SandboxManager.initialize({
    network: { allowedDomains: [], deniedDomains: [], strictAllowlist: true },
    filesystem: { denyRead: [homedir()], allowRead: [CODE], allowWrite: [], denyWrite: [] },
  })
  return ready
}

const quote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

export async function runScript(options: {
  script: string // an absolute path inside the module
  moduleDir: string
  input?: unknown
  api: ScriptApi
  signal?: AbortSignal
}): Promise<ScriptRun> {
  await sandbox()
  const moduleDir = realpathSync(options.moduleDir)
  const command = [
    process.execPath,
    quote(HOST),
    quote(options.script),
    quote(JSON.stringify(options.input ?? {})),
  ].join(' ')
  const wrapped = await SandboxManager.wrapWithSandbox(command, undefined, {
    filesystem: {
      denyRead: [homedir()],
      allowRead: [CODE, moduleDir],
      allowWrite: [moduleDir, realpathSync(tmpdir())],
      denyWrite: [],
    },
  })
  const child = spawn(wrapped, { shell: true, cwd: moduleDir, stdio: ['pipe', 'pipe', 'pipe'] })
  let stderr = ''
  child.stderr.on('data', (d) => {
    stderr += d
  })
  let stopped = false
  options.signal?.addEventListener('abort', () => {
    stopped = true
    child.kill('SIGTERM')
  })
  const done = new Promise<ScriptRun>((resolve) => {
    let settled = false
    const finish = (r: ScriptRun) => {
      if (!settled) {
        settled = true
        resolve(r)
      }
    }
    createInterface({ input: child.stdout }).on('line', async (line) => {
      let m: {
        id?: number
        method?: string
        params?: Record<string, unknown>
        done?: boolean
        result?: unknown
        error?: string
      }
      try {
        m = JSON.parse(line)
      } catch {
        stderr += `${line}\n`
        return
      }
      if (m.done)
        return finish({ result: m.result ?? null, error: m.error ?? null, stderr, stopped })
      if (m.id === undefined || !m.method) return
      const fn = options.api[m.method]
      try {
        if (!fn) throw new Error(`alpha has no ${m.method}.`)
        const result = await fn(m.params ?? {})
        child.stdin.write(`${JSON.stringify({ id: m.id, result: result ?? null })}\n`)
      } catch (err) {
        // a problem's kind goes with its words, so a reader can say "needs your sign-in"
        const kind = (err as { kind?: unknown }).kind
        child.stdin.write(
          `${JSON.stringify({
            id: m.id,
            error: err instanceof Error ? err.message : String(err),
            ...(typeof kind === 'string' ? { kind } : {}),
          })}\n`,
        )
      }
    })
    child.on('close', (code) =>
      finish({
        result: null,
        error: stopped ? 'Stopped.' : `The script ended without an answer (exit ${code}).`,
        stderr,
        stopped,
      }),
    )
  })
  return done
}
