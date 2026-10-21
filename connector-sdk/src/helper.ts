// Alpha's helper on the Mac: a small app ("Alpha") that reaches what Node cannot (the Keychain,
// Calendar, Contacts). Calendar and Contacts are asked through the app itself, started by
// `open`, so macOS asks the person on Alpha's behalf (week 2 spike 1); the Keychain is reached by
// running its binary directly, so a secret goes in on stdin and never on a command line.
import { execFile, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Problem } from './connector.ts'

export function helperBinary(app: string): string {
  return join(app, 'Contents', 'MacOS', 'alpha-helper')
}

interface Options {
  stdin?: string
  raw?: boolean // the answer is the bytes themselves (a secret), not JSON
  asApp?: boolean // through `open`, for what macOS asks the person about
}

export async function runHelper(
  app: string,
  args: string[],
  options: Options = {},
): Promise<unknown> {
  if (options.asApp) return runAsApp(app, args)
  const text = await new Promise<string>((resolve, reject) => {
    const child = spawn(helperBinary(app), args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (d) => {
      out += d
    })
    child.on('error', (err) => reject(new Problem(`Alpha's helper did not start: ${err.message}`)))
    child.on('close', () => resolve(out))
    child.stdin.end(options.stdin ?? '')
  })
  if (options.raw) {
    if (text.startsWith('{"ok":false')) return null
    return text
  }
  return parseAnswer(text)
}

// `open -W` can lose a helper that already ended before it began waiting for it ("kevent() failed:
// No such process", seen under load on 21 Oct): the helper's answer is written all the same, so it
// is read; with none written, the helper is started once more.
const ENDED_FIRST = /kevent\(\) failed: No such process/

async function runAsApp(app: string, args: string[], again = 1): Promise<unknown> {
  const dir = mkdtempSync(join(tmpdir(), 'alpha-helper-'))
  const out = join(dir, 'out.json')
  try {
    const failed = await new Promise<Error | null>((resolve) =>
      execFile(
        '/usr/bin/open',
        ['-W', '-n', '--stdout', out, '--stderr', join(dir, 'err.txt'), app, '--args', ...args],
        (err) => resolve(err),
      ),
    )
    const text = existsSync(out) ? readFileSync(out, 'utf8') : ''
    if (failed && !(ENDED_FIRST.test(failed.message) && text.trim())) {
      if (ENDED_FIRST.test(failed.message) && again > 0) return runAsApp(app, args, again - 1)
      throw new Problem(`Alpha's helper did not start: ${failed.message}`)
    }
    return parseAnswer(text)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function parseAnswer(text: string): unknown {
  let answer: { ok?: boolean; problem?: string }
  try {
    answer = JSON.parse(text)
  } catch {
    throw new Problem("Alpha's helper answered with something it should not have.")
  }
  if (answer.ok === false) {
    const words = answer.problem ?? 'It did not work.'
    throw new Problem(
      words.includes('not granted')
        ? `${words}: allow Alpha in System Settings › Privacy & Security.`
        : words,
      words.includes('not granted') ? 'sign_in' : 'other',
    )
  }
  return answer
}
