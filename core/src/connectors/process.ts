// A connector folder's own process, as the core holds it (step 2, part 1, Kenil's yes 29 Oct): the
// connectors it holds, built from what it says of them, each call sent down its pipe, and its
// host's asks answered with the core's own host for that call. A process that ends is started
// again on the next call; one the core leaves ends with its pipe.
import { type ChildProcess, spawn } from 'node:child_process'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import {
  type Call,
  type CallOptions,
  type Connector,
  type Effect,
  type Host,
  type Manifest,
  Problem,
  type TableSpec,
  type Tool,
} from '@alpha/connector-sdk'
import { z } from 'zod'

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
}

// A connector whose code runs in its own process: the core asks it what each call is.
export type RemoteConnector = Connector & {
  remote: { process: ConnectorProcess; says(tool: string, input: unknown): Promise<CallSays> }
}

export const isRemote = (c: Connector): c is RemoteConnector => 'remote' in c

type Answer = { ok: (v: unknown) => void; fail: (e: unknown) => void; host: Host | null }

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
  stderr = ''

  constructor(entry: string) {
    this.entry = entry
  }

  // The connectors in it, once its process has said what they are.
  start(): Promise<Described[]> {
    if (this.ready) return this.ready
    const child = spawn(process.execPath, [CHILD, this.entry], { stdio: ['pipe', 'pipe', 'pipe'] })
    this.child = child
    child.stderr?.on('data', (d) => {
      this.stderr = (this.stderr + String(d)).slice(-4000)
    })
    child.stdin?.on('error', () => undefined)
    this.ready = new Promise<Described[]>((ok, fail) => {
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
        }
        fail(
          new Error(
            this.stderr.trim().split('\n').at(-1) || 'its process ended before it said what it is',
          ),
        )
      })
    })
    // held while it says what it is; then only while a call waits on it
    this.ready.then(
      () => this.hold(),
      () => undefined,
    )
    return this.ready
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
      else if (method === 'keepFile') {
        if (!host.keepFile) throw new Problem('This connection cannot keep files.')
        result = await host.keepFile(
          p.name as string,
          Buffer.from(p.bytes as string, 'base64'),
          p.mime as string,
        )
      } else if (method === 'keys') result = (await host.keys?.(params as string)) ?? []
      else if (method.startsWith('browser.')) {
        const b = host.browser?.() as unknown as
          | Record<string, (...a: unknown[]) => unknown>
          | undefined
        const fn = b?.[method.slice('browser.'.length)]
        if (!b || typeof fn !== 'function')
          throw new Problem("Alpha's browser is not set up in this core.")
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
  async request(
    op: string,
    fields: Record<string, unknown>,
    host: Host | null = null,
  ): Promise<unknown> {
    await this.start()
    const id = this.next++
    return new Promise((ok, fail) => {
      this.pending.set(id, { ok, fail, host })
      this.hold()
      this.child?.stdin?.write(`${JSON.stringify({ t: 'req', id, op, ...fields })}\n`)
    })
  }

  close(): void {
    this.child?.stdin?.end()
    this.child?.kill()
    this.child = null
    this.ready = null
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
          if (spec?.effect && !spec.preview && !spec.words)
            return { effect: spec.effect, preview: null, words: null }
          return (await proc.request('describe', { name, tool, input })) as CallSays
        },
      },
    }
    return c
  })
}
