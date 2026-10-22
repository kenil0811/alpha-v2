// Runs one kit or skill script inside its sandbox (design §9). The script imports nothing of
// Alpha's: it is handed `alpha`, whose every call goes to the core over this process's pipes, so
// the network, the world and the gates stay with the core. The script's own output goes to
// stderr; stdout carries only the calls and the result.
import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'
import { shape } from '@alpha/kit-sdk'

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

// `alpha` is built from the kit API's own shape (kit-sdk): each call sits at its dotted place,
// and a script's positional arguments become the call's input by the names the schema gives;
// an argument left out is left out of the input. alpha.input is what the run was given.
const alpha: Record<string, unknown> = { input: JSON.parse(input ?? '{}') as unknown }
for (const c of shape()) {
  const path = c.name.split('.')
  let at = alpha
  for (const p of path.slice(0, -1)) {
    at[p] ??= {}
    at = at[p] as Record<string, unknown>
  }
  at[path.at(-1) as string] = (...args: unknown[]) =>
    call(
      c.name,
      c.params === 'object'
        ? args[0]
        : Object.fromEntries(
            c.params.map((k, i) => [k, args[i]]).filter(([, v]) => v !== undefined),
          ),
    )
}

try {
  const mod = (await import(pathToFileURL(script as string).href)) as {
    default: (a: unknown) => unknown
  }
  out({ done: true, result: (await mod.default(alpha)) ?? null })
} catch (err) {
  out({ done: true, error: err instanceof Error ? err.message : String(err) })
}
process.exit(0)
