// PDFs read by Docling (design §8), in its own Python environment made with uv the first time a
// PDF comes (about 1.6 GB with its models: Kenil's yes, 19 Oct). Each table cell keeps its table,
// row, column, page and box; other text its page and box.
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { Problem } from '@alpha/connector-sdk'
import type { Piece } from './read.ts'

const DOCLING = 'docling==2.140.0'
const SCRIPT = new URL('../py/read_pdf.py', import.meta.url).pathname

function run(cmd: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) =>
    execFile(
      cmd,
      args,
      { maxBuffer: 256 * 1024 * 1024, timeout: timeoutMs },
      (err, stdout, stderr) =>
        err ? reject(new Error(`${err.message}\n${stderr.slice(-2000)}`)) : resolve(stdout),
    ),
  )
}

// uv: the one Alpha ships with, else the Mac's own.
function uv(): string {
  for (const p of [
    process.env.ALPHA_UV,
    join(homedir(), '.local', 'bin', 'uv'),
    '/opt/homebrew/bin/uv',
    '/usr/local/bin/uv',
  ])
    if (p && existsSync(p)) return p
  throw new Problem('Reading PDFs needs uv, which is not on this Mac yet.')
}

let making: Promise<string> | null = null

// The environment, made once; every PDF waits for the one being made.
export function doclingEnv(envs: string): Promise<string> {
  const dir = join(envs, 'docling')
  const python = join(dir, 'bin', 'python')
  if (existsSync(join(dir, '.ready'))) return Promise.resolve(python)
  making ??= (async () => {
    mkdirSync(envs, { recursive: true })
    await run(uv(), ['venv', '--quiet', '--python', '3.12', dir], 600_000)
    await run(uv(), ['pip', 'install', '--quiet', '--python', python, DOCLING], 1_800_000)
    writeFileSync(join(dir, '.ready'), DOCLING)
    return python
  })().finally(() => {
    making = null
  })
  return making
}

export async function readPdf(
  bytes: Uint8Array,
  envs: string,
): Promise<{ pages: number; pieces: Piece[] }> {
  const python = await doclingEnv(envs)
  const dir = mkdtempSync(join(tmpdir(), 'alpha-pdf-'))
  try {
    const file = join(dir, 'in.pdf')
    writeFileSync(file, bytes)
    const out = await run(python, ['-I', SCRIPT, file], 900_000)
    const parsed = JSON.parse(out.trim().split('\n').at(-1) ?? '{}') as {
      pages: number
      pieces: Piece[]
    }
    return parsed
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
