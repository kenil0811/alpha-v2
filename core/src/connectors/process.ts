// A connector folder's own process, as the core holds it (step 2, part 1, Kenil's yes 29 Oct): the
// connectors it holds, built from what it says of them, each call sent down its pipe, and its
// host's asks answered with the core's own host for that call. A process that ends is started
// again on the next call; one the core leaves ends with its pipe. It runs in the sandbox (slice 2):
// it reaches only the hosts its rules give, through the proxy; it reads its own code, Alpha's and
// the folders its rules give, and writes only the temporary folder. The browser it asks for opens
// only those hosts, and Alpha's Mac helper is run here, for it.
import { type ChildProcess, spawn } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import {
  type Call,
  type CallOptions,
  type Connector,
  type Effect,
  type Host,
  type Manifest,
  Problem,
  runHelper,
  type TableSpec,
  type Tool,
} from '@alpha/connector-sdk'
import { SandboxManager } from '@anthropic-ai/sandbox-runtime'
import { z } from 'zod'
import { allow, CODE, forget, newId, sandbox } from '../sandbox.ts'

const CHILD = join(import.meta.dirname, 'child.ts')

export interface Described {
  manifest: Manifest
  guide: string
  module: string
  tables: TableSpec[]
  tools: Record<
    string,
    {
      description: string
      input: Record<string, unknown>
      effect: Effect | null
      preview: boolean
      words: boolean
      undo: 'final' | { kind: 'undoable' | 'counter'; said: string } | null
    }
  >
  check: boolean
  sync: boolean
  files: { table: string; field: string } | null
}

// What a call says of itself before the gates: its effect, what a card shows, its words.
export interface CallSays {
  effect: Effect
  preview: { words: string; detail?: string; yes?: string } | null
  words: string | null
  // what it is once done: final, or taken back by Revert (its card says so); none for a read
  undo: { kind: 'final' | 'undoable' | 'counter'; said: string | null } | null
}

// A connector whose code runs in its own process: the core asks it what each call is.
export type RemoteConnector = Connector & {
  remote: {
    process: ConnectorProcess
    says(tool: string, input: unknown): Promise<CallSays>
    undoWords(tool: string, input: unknown, result: unknown): Promise<string | null>
  }
}

// What a call is once done, for its card and the line that says it was done: a write or a send
// is final unless its tool says how it is taken back; a read is nothing.
export function undoSaid(
  effect: Effect | null,
  undo: Tool['undo'] | { kind: 'undoable' | 'counter'; said: string } | null | undefined,
): CallSays['undo'] {
  if (effect === 'read') return null
  if (!undo || undo === 'final') return { kind: 'final', said: null }
  return { kind: undo.kind, said: undo.said }
}

export const isRemote = (c: Connector): c is RemoteConnector => 'remote' in c

type Answer = {
  ok: (v: unknown) => void
  fail: (e: unknown) => void
  host: Host | null
  name: string
}

// What a process may reach and read, asked again at each call (the person's approved hosts, the
// folders the Files connector watches), and where a refusal is said.
export interface ProcessRules {
  hosts: (described: Described[]) => string[]
  reads: (described: Described[]) => string[]
  refused: (host: string, connector: string) => void
}

const OWN: ProcessRules = {
  hosts: (described) => [...new Set(described.flatMap((d) => d.manifest.reaches ?? []))],
  reads: () => [],
  refused: () => undefined,
}

// Whether host (and port) is one a list names: a host, a host:port, or *.example.com.
export function named(list: string[], host: string, port: string): boolean {
  return list.some((entry) => {
    const [h = '', p] = entry.toLowerCase().split(':')
    const fits = h.startsWith('*.') ? host.endsWith(h.slice(1)) : host === h
    return fits && (p === undefined || p === port)
  })
}

// The package folder an entry is in: its own code, which its process reads.
function packageOf(entry: string): string {
  let dir = dirname(entry)
  while (!existsSync(join(dir, 'package.json')) && dirname(dir) !== dir) dir = dirname(dir)
  return realpathSync(dir)
}

const quote = (v: string) => `'${v.replace(/'/g, `'\\''`)}'`

// What the process's environment holds: enough to run, never a secret of the core's.
function envOf(): NodeJS.ProcessEnv {
  const keep = ['PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'TMPDIR', 'TZ']
  return Object.fromEntries(keep.flatMap((k) => (process.env[k] ? [[k, process.env[k]]] : [])))
}

const problemOf = (e: { message: string; kind?: string; retryAfterMs?: number | null }) =>
  e.kind
    ? new Problem(
        e.message,
        e.kind as never,
        e.retryAfterMs ? { retryAfterMs: e.retryAfterMs } : {},
      )
    : new Error(e.message)

export class ConnectorProcess {
  readonly entry: string
  private child: ChildProcess | null = null
  private ready: Promise<Described[]> | null = null
  private next = 1
  private pending = new Map<number, Answer>()
  private rules: ProcessRules = OWN
  private described: Described[] = []
  private id = ''
  private reading = '[]' // the folders it was started with
  private last = '' // the connector whose call came last, for a refusal's line
  stderr = ''

  constructor(entry: string) {
    this.entry = entry
  }

  // Its rules, from the service that holds its connectors.
  govern(rules: ProcessRules): void {
    this.rules = rules
  }

  // The hosts it may reach now, as the proxy holds them.
  hosts(): string[] {
    return this.rules.hosts(this.described)
  }

  // The connectors in it, once its process has said what they are.
  start(): Promise<Described[]> {
    if (this.ready) return this.ready
    this.ready = this.spawn()
    this.ready.then(
      (d) => {
        this.described = d
        allow(this.id, this.hosts(), (host) => this.rules.refused(host, this.refusedBy()))
        this.hold()
      },
      () => undefined,
    )
    return this.ready
  }

  private refusedBy(): string {
    return this.last || this.described[0]?.manifest.name || ''
  }

  private async spawn(): Promise<Described[]> {
    await sandbox()
    const id = newId()
    this.id = id
    // nothing yet: what it reaches is given once it has said what it is
    allow(id, [], (host) => this.rules.refused(host, this.refusedBy()))
    const reads = this.rules.reads(this.described)
    this.reading = JSON.stringify(reads)
    // web calls through the proxy, local ones too, so the proxy judges every host
    const command = `NO_PROXY= no_proxy= NODE_USE_ENV_PROXY=1 ${[process.execPath, CHILD, this.entry].map(quote).join(' ')}`
    const wrapped = await SandboxManager.wrapWithSandbox(
      command,
      undefined,
      {
        filesystem: {
          denyRead: [homedir()],
          allowRead: [CODE, packageOf(this.entry), ...reads],
          allowWrite: [realpathSync(tmpdir())],
          denyWrite: [],
        },
      },
      undefined,
      { commandId: id },
    )
    const child = spawn(wrapped, { shell: true, stdio: ['pipe', 'pipe', 'pipe'], env: envOf() })
    this.child = child
    child.stderr?.on('data', (d) => {
      this.stderr = (this.stderr + String(d)).slice(-4000)
    })
    child.stdin?.on('error', () => undefined)
    return new Promise<Described[]>((ok, fail) => {
      createInterface({ input: child.stdout as NodeJS.ReadableStream }).on('line', (line) =>
        this.read(line, ok, fail),
      )
      child.on('exit', (code) => {
        // what was waiting on it learns that it ended; the next call starts it again
        for (const a of this.pending.values())
          a.fail(new Error(`The connector's process ended (${code ?? 'killed'}).`))
        this.pending.clear()
        if (this.child === child) {
          this.child = null
          this.ready = null
          forget(id)
        }
        fail(
          new Error(
            this.stderr.trim().split('\n').at(-1) || 'its process ended before it said what it is',
          ),
        )
      })
    })
  }

  // A process the core waits on keeps the core up; an idle one never does, and ends with it.
  private hold() {
    const c = this.child
    if (!c) return
    const on = this.pending.size > 0
    for (const h of [c, c.stdin, c.stdout, c.stderr] as unknown as {
      ref?: () => void
      unref?: () => void
    }[])
      on ? h?.ref?.() : h?.unref?.()
  }

  private read(line: string, ok: (d: Described[]) => void, fail: (e: Error) => void) {
    let m: Record<string, unknown>
    try {
      m = JSON.parse(line)
    } catch {
      return
    }
    if (m.t === 'ready') return ok(m.connectors as Described[])
    if (m.t === 'failed') return fail(new Error(String(m.why)))
    const a = this.pending.get(m.id as number)
    if (m.t === 'res') {
      this.pending.delete(m.id as number)
      this.hold()
      if (!a) return
      if (m.error) a.fail(problemOf(m.error as never))
      else a.ok(m.result)
      return
    }
    if (m.t === 'tell' && a?.host) {
      const p = m.params as Record<string, unknown> | string | null
      if (m.method === 'setCursor') a.host.setCursor(p as string | null)
      if (m.method === 'journal') {
        const j = p as { words: string; data?: Record<string, unknown> }
        a.host.journal(j.words, j.data)
      }
      return
    }
    if (m.t === 'host')
      void this.answerHost(m.hid as number, String(m.method), m.params, a?.host ?? null)
  }

  // What the connector asked of its host, answered with the core's host for its call.
  private async answerHost(hid: number, method: string, params: unknown, host: Host | null) {
    const reply = (m: Record<string, unknown>) =>
      this.child?.stdin?.write(`${JSON.stringify({ t: 'hostReply', hid, ...m })}\n`)
    try {
      if (!host) throw new Error('No call is waiting on this.')
      const p = params as Record<string, unknown>
      let result: unknown
      if (method === 'secret') result = await host.secret()
      else if (method === 'land')
        result = await host.land(p.table as string, p.items as never, p.options as never)
      else if (method === 'gone')
        result = (await host.gone?.(p.table as string, p.keys as string[], p.options as never)) ?? 0
      else if (method === 'keepFile') {
        if (!host.keepFile) throw new Problem('This connection cannot keep files.')
        result = await host.keepFile(
          p.name as string,
          Buffer.from(p.bytes as string, 'base64'),
          p.mime as string,
        )
      } else if (method === 'keys') result = (await host.keys?.(params as string)) ?? []
      else if (method === 'helper') {
        const app = process.env.ALPHA_HELPER_APP
        if (!app) throw new Problem("Alpha's helper is not built on this Mac.")
        result = await runHelper(app, p.args as string[], (p.options ?? {}) as never)
      } else if (method.startsWith('browser.')) {
        const b = host.browser?.() as unknown as
          | Record<string, (...a: unknown[]) => unknown>
          | undefined
        const fn = b?.[method.slice('browser.'.length)]
        if (!b || typeof fn !== 'function')
          throw new Problem("Alpha's browser is not set up in this core.")
        // the browser opens only the hosts the connector may reach
        const first = (params as unknown[])[0]
        if (typeof first === 'string' && /^https?:/.test(first)) {
          const u = new URL(first)
          const port = u.port || (u.protocol === 'https:' ? '443' : '80')
          if (!named(this.hosts(), u.hostname, port)) {
            this.rules.refused(u.host, this.refusedBy())
            throw new Problem(`It may not open ${u.host}: that is not one of its hosts.`, 'blocked')
          }
        }
        result = await fn.apply(b, params as unknown[])
      } else throw new Error(`The host has no ${method}.`)
      reply({ result: result ?? null })
    } catch (err) {
      reply({
        error: {
          message: err instanceof Error ? err.message : String(err),
          ...(err instanceof Problem
            ? { kind: err.kind, retryAfterMs: err.retryAfterMs ?? null }
            : {}),
        },
      })
    }
  }

  // One call down the pipe; host, when given, answers what the connector asks while it runs.
  // Its folders changed since it started (one watched more or less): it starts again with them.
  async request(
    op: string,
    fields: Record<string, unknown>,
    host: Host | null = null,
  ): Promise<unknown> {
    if (
      this.child &&
      !this.pending.size &&
      JSON.stringify(this.rules.reads(this.described)) !== this.reading
    )
      this.close()
    await this.start()
    allow(this.id, this.hosts(), (h) => this.rules.refused(h, this.refusedBy()))
    const name = String(fields.name ?? '')
    if (name) this.last = name
    const id = this.next++
    return new Promise((ok, fail) => {
      this.pending.set(id, { ok, fail, host, name })
      this.hold()
      this.child?.stdin?.write(`${JSON.stringify({ t: 'req', id, op, ...fields })}\n`)
    })
  }

  close(): void {
    this.child?.stdin?.end()
    this.child?.kill()
    this.child = null
    this.ready = null
    if (this.id) forget(this.id)
  }
}

// A tool's input, as the zod shape the tool registry takes, from the JSON schema the process gave.
function shapeOf(schema: Record<string, unknown>): z.ZodRawShape {
  const t = z.fromJSONSchema(schema as never)
  return t instanceof z.ZodObject ? (t.shape as z.ZodRawShape) : {}
}

// What a call carries to the process: its account, its cursor and how it is paced and retried.
function callFields(call: Call): Record<string, unknown> {
  return {
    account: call.host.account,
    cursor: call.host.cursor(),
    options: (call as Call & { options?: CallOptions }).options,
  }
}

// The connectors one process holds, as the core holds them.
export function remoteConnectors(
  proc: ConnectorProcess,
  described: Described[],
): RemoteConnector[] {
  return described.map((d) => {
    const name = d.manifest.name
    const tools: Record<string, Tool> = Object.fromEntries(
      Object.entries(d.tools).map(([t, spec]) => [
        t,
        {
          description: spec.description,
          input: shapeOf(spec.input),
          // the core asks the process when it depends on the input (`remote.says`)
          effect: spec.effect ?? 'outward',
          run: (call: Call, input: unknown) =>
            proc.request('run', { name, tool: t, input, ...callFields(call) }, call.host),
          // its take-back runs in the process; the words are asked of it (`service.undoOf`)
          ...(spec.undo && spec.undo !== 'final'
            ? {
                undo: {
                  kind: spec.undo.kind,
                  said: spec.undo.said,
                  words: () => '',
                  run: (call: Call, input: unknown, result: unknown) =>
                    proc.request(
                      'undo',
                      { name, tool: t, input, result, ...callFields(call) },
                      call.host,
                    ),
                },
              }
            : spec.undo
              ? { undo: 'final' as const }
              : {}),
        } satisfies Tool,
      ]),
    )
    const c: RemoteConnector = {
      manifest: d.manifest,
      guide: d.guide,
      module: d.module,
      tables: d.tables,
      tools,
      ...(d.check
        ? {
            check: async (call: Call) =>
              void (await proc.request('check', { name, ...callFields(call) }, call.host)),
          }
        : {}),
      ...(d.sync
        ? {
            sync: async (call: Call) =>
              (await proc.request('sync', { name, ...callFields(call) }, call.host)) as never,
          }
        : {}),
      ...(d.files
        ? {
            files: {
              table: d.files.table,
              field: d.files.field,
              fetch: async (call: Call, item: string) =>
                (
                  (await proc.request('files', { name, item, ...callFields(call) }, call.host)) as {
                    name: string
                    mime: string
                    bytes: string
                    inline: boolean
                  }[]
                ).map((f) => ({ ...f, bytes: new Uint8Array(Buffer.from(f.bytes, 'base64')) })),
            },
          }
        : {}),
      remote: {
        process: proc,
        says: async (tool, input) => {
          const spec = d.tools[tool]
          // a tool whose effect, card and words are fixed needs no question
          const undo = undoSaid(spec?.effect ?? null, spec?.undo ?? null)
          if (spec?.effect && !spec.preview && !spec.words)
            return { effect: spec.effect, preview: null, words: null, undo }
          const said = (await proc.request('describe', { name, tool, input })) as CallSays
          return { ...said, undo: undoSaid(said.effect, spec?.undo ?? null) }
        },
        undoWords: (tool, input, result) =>
          proc.request('undo_words', { name, tool, input, result }) as Promise<string | null>,
      },
    }
    return c
  })
}
