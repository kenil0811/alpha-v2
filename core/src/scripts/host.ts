// Runs one kit or skill script inside its sandbox (design §9). The script imports nothing of
// Alpha's: it is handed `alpha`, whose every call goes to the core over this process's pipes, so
// the network, the world and the gates stay with the core. The script's own output goes to
// stderr; stdout carries only the calls and the result.
import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'

const [script, input] = process.argv.slice(2)
const out = (m: unknown) => process.stdout.write(`${JSON.stringify(m)}\n`)
console.log = (...a: unknown[]) => process.stderr.write(`${a.map(String).join(' ')}\n`)

let seq = 0
const waiting = new Map<number, (m: { result?: unknown; error?: string; kind?: string }) => void>()
createInterface({ input: process.stdin }).on('line', (line) => {
  const m = JSON.parse(line) as { id: number; result?: unknown; error?: string; kind?: string }
  waiting.get(m.id)?.(m)
  waiting.delete(m.id)
})

function call(method: string, params: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = ++seq
    waiting.set(id, (m) =>
      m.error
        ? reject(Object.assign(new Error(m.error), m.kind ? { kind: m.kind } : {}))
        : resolve(m.result),
    )
    out({ id, method, params })
  })
}

const alpha = {
  input: JSON.parse(input ?? '{}') as unknown,
  rows: {
    list: (table: string) => call('rows.list', { table }),
    land: (table: string, items: unknown[]) => call('rows.land', { table, items }),
    compute: (
      table: string,
      id: string,
      values: Record<string, unknown>,
      formula: Record<string, string>,
      notes?: Record<string, string>, // the sum with its numbers, or each check, per field
    ) => call('rows.compute', { table, id, values, formula, ...(notes ? { notes } : {}) }),
  },
  // the documents filed (each with its file's hash and the rows it sits on), one's cells or lines
  // with their places, and a document put on a row of the module's own tables
  documents: {
    list: () => call('documents.list', {}),
    read: (file: string) => call('documents.read', { file }),
    place: (file: string, table: string, row: string, kind?: string) =>
      call('documents.place', { file, table, row, ...(kind ? { kind } : {}) }),
    // the model reads it into what the script names; each value comes with the place it was read
    // from, and one not found where it is cited comes back as null
    extract: (file: string, spec: unknown) => call('documents.extract', { file, spec }),
  },
  browser: {
    open: (url: string) => call('browser.open', { url }),
    extract: (url: string, spec: unknown) => call('browser.extract', { url, spec }),
  },
  // a line on the person's Home; with rows, each can be opened, and `choice` sets one field
  tell: (
    words: string,
    about?: {
      table: string
      rows: string[]
      choice?: { field: string; value: string; label?: string }
    },
  ) => call('tell', { words, ...(about ? { about } : {}) }),
  log: (words: string) => call('log', { words }),
}

try {
  const mod = (await import(pathToFileURL(script as string).href)) as {
    default: (a: typeof alpha) => unknown
  }
  out({ done: true, result: (await mod.default(alpha)) ?? null })
} catch (err) {
  out({ done: true, error: err instanceof Error ? err.message : String(err) })
}
process.exit(0)
