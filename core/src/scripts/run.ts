// A kit's or a skill's script, run in a child process under Anthropic's sandbox runtime (design
// §5, §9): no network at all (it is given no list of hosts), writes only in its module's folder, reads only there and in Alpha's
// own code. Everything it needs from outside it asks the core for, through `alpha`.

import { spawn } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { callNamed } from '@alpha/kit-sdk'
import { SandboxManager } from '@anthropic-ai/sandbox-runtime'
import { CODE, sandbox } from '../sandbox.ts'

export type ScriptApi = Record<string, (params: Record<string, unknown>) => Promise<unknown>>

export interface ScriptRun {
  result: unknown
  error: string | null
  stderr: string
  stopped: boolean
}

const HOST = join(import.meta.dirname, 'host.ts')

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
      // a module's sites and shape are the core's to write, on a card's yes or a kit install:
      // never a script's (item 12 of the problems list, 25 Oct)
      denyWrite: [join(moduleDir, 'module.yaml')],
    },
  })
  const child = spawn(wrapped, { shell: true, cwd: moduleDir, stdio: ['pipe', 'pipe', 'pipe'] })
  let stderr = ''
  child.stderr.on('data', (d) => {
    stderr += d
  })
  // An answer to a call the script made: only while the script is still there to read it (a
  // script stopped or dead under a long call leaves a closed pipe, which is its ending, not a
  // failure of the core).
  child.stdin.on('error', () => undefined)
  const answer = (m: Record<string, unknown>) => {
    if (child.exitCode === null && child.signalCode === null && child.stdin.writable)
      child.stdin.write(`${JSON.stringify(m)}\n`)
  }
  let stopped = false
  options.signal?.addEventListener('abort', () => {
    stopped = true
    child.kill('SIGTERM')
  })
  const done = new Promise<ScriptRun>((resolve) => {
    let settled = false
    let answered: { result: unknown; error: string | null } | null = null
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
      // its answer, given once its process has closed: what it wrote to stderr is all read by
      // then (on Linux it can come after the answer)
      if (m.done) {
        answered = { result: m.result ?? null, error: m.error ?? null }
        return
      }
      if (m.id === undefined || !m.method) return
      const fn = options.api[m.method]
      try {
        if (!fn) throw new Error(`alpha has no ${m.method}.`)
        // the input as the kit API says it: a wrong one is refused here with plain words
        const spec = callNamed(m.method)
        const checked = spec ? spec.args.safeParse(m.params ?? {}) : null
        if (checked && !checked.success)
          throw new Error(
            `alpha.${m.method} was given ${checked.error.issues
              .map((i) => `${i.path.join('.') || 'input'}: ${i.message}`)
              .join('; ')}.`,
          )
        const result = await fn(m.params ?? {})
        answer({ id: m.id, result: result ?? null })
      } catch (err) {
        // a problem's kind goes with its words, so a reader can say "needs your sign-in"
        const kind = (err as { kind?: unknown }).kind
        answer({
          id: m.id,
          error: err instanceof Error ? err.message : String(err),
          ...(typeof kind === 'string' ? { kind } : {}),
        })
      }
    })
    child.on('close', (code) =>
      finish(
        answered
          ? { ...answered, stderr, stopped }
          : {
              result: null,
              error: stopped ? 'Stopped.' : `The script ended without an answer (exit ${code}).`,
              stderr,
              stopped,
            },
      ),
    )
  })
  return done
}
