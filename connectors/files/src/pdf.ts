// PDFs read by Docling, in its own Python environment made with uv the first time a
// PDF comes (about 1.6 GB with its models). Each table cell keeps its table,
// row, column, page and box; other text its page and box.
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { Problem } from '@alpha/connector-sdk'
import type { Piece } from './read.ts'

const DOCLING = 'docling==2.140.0'
const SCRIPT = new URL('../py/read_pdf.py', import.meta.url).pathname
const RENDER = new URL('../py/render_page.py', import.meta.url).pathname
const PEEK = new URL('../py/peek_pdf.py', import.meta.url).pathname

// Everything uv and Docling write stays in Alpha's own folder (envs): the Python uv fetches, its
// cache and Docling's models, never ~/.local, ~/.cache or a Python of the Mac's own.
function envOf(envs: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    UV_PYTHON_INSTALL_DIR: join(envs, 'python'),
    UV_PYTHON_PREFERENCE: 'only-managed',
    UV_CACHE_DIR: join(envs, 'uv-cache'),
    HF_HOME: join(envs, 'huggingface'),
  }
}

function run(cmd: string, args: string[], timeoutMs: number, envs: string): Promise<string> {
  return new Promise((resolve, reject) =>
    execFile(
      cmd,
      args,
      { maxBuffer: 256 * 1024 * 1024, timeout: timeoutMs, env: envOf(envs) },
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
    await run(uv(), ['venv', '--quiet', '--python', '3.12', dir], 600_000, envs)
    await run(uv(), ['pip', 'install', '--quiet', '--python', python, DOCLING], 1_800_000, envs)
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
    const out = await run(python, ['-I', SCRIPT, file], 900_000, envs)
    const parsed = JSON.parse(out.trim().split('\n').at(-1) ?? '{}') as {
      pages: number
      pieces: Piece[]
    }
    return parsed
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// One page drawn as a PNG, with the page's size in points: a piece's box (in points, counted up
// from the bottom of the page) is marked on it by the window.
export async function renderPage(
  file: string,
  page: number,
  envs: string,
): Promise<{ png: Buffer; pages: number; width: number; height: number }> {
  const python = await doclingEnv(envs)
  const dir = mkdtempSync(join(tmpdir(), 'alpha-page-'))
  try {
    const out = join(dir, 'page.png')
    const size = JSON.parse(
      (await run(python, ['-I', RENDER, file, String(page), out, '2'], 120_000, envs))
        .trim()
        .split('\n')
        .at(-1) ?? '{}',
    ) as { pages: number; width: number; height: number }
    return { png: readFileSync(out), ...size }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// The words of a PDF's first pages, for a look at what it is before it is read in full.
export async function peekPdf(
  file: string,
  envs: string,
  pages = 2,
): Promise<{ pages: number; words: string[] }> {
  const python = await doclingEnv(envs)
  const out = await run(python, ['-I', PEEK, file, String(pages)], 120_000, envs)
  return JSON.parse(out.trim().split('\n').at(-1) ?? '{}') as { pages: number; words: string[] }
}
