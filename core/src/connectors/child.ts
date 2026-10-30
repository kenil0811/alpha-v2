// A connector's own process (step 2, part 1): it imports the connector's code, says what the
// connectors in it are (their manifest, tables, tools with their inputs as JSON schemas, guide),
// then answers the core's calls one line at a time. Its host is the core's, over the same pipe: a
// secret, landing rows, keeping a file, the keys a table holds, the browser and Alpha's Mac helper
// are asked of the core; the cursor is the one the core gave with the call, kept here as it is set.
import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'
import {
  type Call,
  type CallOptions,
  type Connector,
  checkConnector,
  type Host,
  makeCall,
  Problem,
  type Tool,
} from '@alpha/connector-sdk'
import { z } from 'zod'

const entry = process.argv[2] as string

const send = (m: Record<string, unknown>) => process.stdout.write(`${JSON.stringify(m)}\n`)

// what a thrown thing says over the pipe: its words, and a Problem's kind
const errorOf = (err: unknown) => ({
  message: err instanceof Error ? err.message : String(err),
  ...(err instanceof Problem ? { kind: err.kind, retryAfterMs: err.retryAfterMs ?? null } : {}),
})

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')

// A tool as the core holds it: its input as a JSON schema, its effect when it is one for every
// call (null: it depends on the input, and the core asks), and whether it has a preview and words.
function describeTool(t: Tool) {
  return {
    description: t.description,
    input: z.toJSONSchema(z.object(t.input)),
    effect: typeof t.effect === 'function' ? null : t.effect,
    preview: !!t.preview,
    words: !!t.words,
    // what it is once done (step 2, part 2): final, or taken back; none for a read
    undo:
      !t.undo || t.undo === 'final' ? (t.undo ?? null) : { kind: t.undo.kind, said: t.undo.said },
  }
}

export function describe(c: Connector) {
  return {
    manifest: c.manifest,
    guide: c.guide,
    module: c.module,
    tables: c.tables,
    tools: Object.fromEntries(Object.entries(c.tools).map(([n, t]) => [n, describeTool(t)])),
    check: !!c.check,
    sync: !!c.sync,
    files: c.files ? { table: c.files.table, field: c.files.field } : null,
  }
}

// The host calls of one request wait here for the core's answer.
let nextHost = 1
const waiting = new Map<number, { ok: (v: unknown) => void; fail: (e: unknown) => void }>()
function ask(req: number, method: string, params: unknown): Promise<unknown> {
  const hid = nextHost++
  return new Promise((ok, fail) => {
    waiting.set(hid, { ok, fail })
    send({ t: 'host', id: req, hid, method, params })
  })
}
// a call whose answer nothing waits on (a journal line, a new cursor): said, and the core does it
// before it reads the request's own answer, as lines are read in order
const tell = (req: number, method: string, params: unknown) =>
  send({ t: 'tell', id: req, method, params })

function hostFor(req: number, account: string, cursor: string | null): Host {
  let now = cursor
  // the human-pace browser stays with the core: each of its methods is asked of it
  const browser = new Proxy(
    {},
    {
      get:
        (_, m) =>
        (...args: unknown[]) =>
          ask(req, `browser.${String(m)}`, args),
    },
  )
  return {
    account,
    secret: () => ask(req, 'secret', null) as Promise<string | null>,
    cursor: () => now,
    setCursor: (c) => {
      now = c
      tell(req, 'setCursor', c)
    },
    land: (table, items, options) => ask(req, 'land', { table, items, options }) as never,
    keepFile: (name, bytes, mime) =>
      ask(req, 'keepFile', { name, bytes: b64(bytes), mime }) as never,
    keys: (table) => ask(req, 'keys', table) as never,
    helper: (args, options) => ask(req, 'helper', { args, options: options ?? {} }),
    browser: () => browser as never,
    journal: (words, data) => tell(req, 'journal', { words, data }),
  }
}

interface Request {
  t: 'req'
  id: number
  op: 'check' | 'sync' | 'run' | 'files' | 'describe' | 'undo_words' | 'undo'
  name: string
  tool?: string
  input?: Record<string, unknown>
  result?: unknown
  item?: string
  account?: string
  cursor?: string | null
  options?: CallOptions
}

async function main() {
  let found: Connector[]
  try {
    const mod = (await import(pathToFileURL(entry).href)) as Record<string, unknown>
    const all = Array.isArray(mod.connectors)
      ? mod.connectors
      : mod.connector !== undefined
        ? [mod.connector]
        : []
    if (!all.length) throw new Error('its entry exports no connector (export const connector)')
    found = []
    for (const x of all) {
      const problems = checkConnector(
        x,
        found.map((c) => c.manifest.name),
      )
      if (problems.length) throw new Error(problems.join('; '))
      found.push(x as Connector)
    }
  } catch (err) {
    send({ t: 'failed', why: errorOf(err).message })
    return
  }
  send({ t: 'ready', connectors: found.map(describe) })

  const run = async (r: Request): Promise<unknown> => {
    const c = found.find((x) => x.manifest.name === r.name)
    if (!c) throw new Error(`No connector ${r.name} here.`)
    const tool = r.tool ? c.tools[r.tool] : undefined
    if (r.op === 'describe') {
      if (!tool) throw new Error(`${c.manifest.title} has no ${r.tool}.`)
      const input = (r.input ?? {}) as never
      return {
        effect: typeof tool.effect === 'function' ? tool.effect(input) : tool.effect,
        preview: tool.preview ? tool.preview(input) : null,
        words: tool.words ? tool.words(input) : null,
      }
    }
    if (r.op === 'undo_words') {
      if (!tool?.undo || tool.undo === 'final') return null
      return tool.undo.words((r.input ?? {}) as never, r.result)
    }
    const call: Call = makeCall(
      c.manifest,
      hostFor(r.id, r.account ?? '', r.cursor ?? null),
      r.options as CallOptions,
    )
    if (r.op === 'check') return c.check?.(call) ?? null
    if (r.op === 'sync') return c.sync?.(call) ?? null
    if (r.op === 'files') {
      const files = (await c.files?.fetch(call, r.item ?? '')) ?? []
      return files.map((f) => ({ ...f, bytes: b64(f.bytes) }))
    }
    if (!tool) throw new Error(`${c.manifest.title} has no ${r.tool}.`)
    if (r.op === 'undo') {
      if (!tool.undo || tool.undo === 'final') throw new Error(`${r.tool} cannot be taken back.`)
      return tool.undo.run(call, (r.input ?? {}) as never, r.result)
    }
    return tool.run(call, (r.input ?? {}) as never)
  }

  createInterface({ input: process.stdin }).on('line', (line) => {
    let m: {
      t?: string
      id?: number
      hid?: number
      result?: unknown
      error?: { message: string; kind?: string; retryAfterMs?: number | null }
    } & Omit<Partial<Request>, 't' | 'id'>
    try {
      m = JSON.parse(line)
    } catch {
      return
    }
    if (m.t === 'hostReply' && m.hid !== undefined) {
      const w = waiting.get(m.hid)
      waiting.delete(m.hid)
      if (!w) return
      if (m.error)
        w.fail(
          m.error.kind
            ? new Problem(
                m.error.message,
                m.error.kind as never,
                m.error.retryAfterMs ? { retryAfterMs: m.error.retryAfterMs } : {},
              )
            : new Error(m.error.message),
        )
      else w.ok(m.result)
      return
    }
    if (m.t === 'req')
      run(m as Request).then(
        (result) => send({ t: 'res', id: m.id, result: result ?? null }),
        (err) => send({ t: 'res', id: m.id, error: errorOf(err) }),
      )
  })
  // the core gone, its pipe closed: nothing is left to answer
  process.stdin.on('close', () => process.exit(0))
}

void main()
