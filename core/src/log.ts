// The core's log: what it prints, also written to a file when ALPHA_LOG_DIR says
// where (the installed app's login item says ~/Library/Logs/Alpha), rotated at 10 MB with 5 kept.
import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const LIMIT = 10 * 1024 * 1024
const KEPT = 5

export function rotate(file: string, kept = KEPT): void {
  rmSync(`${file}.${kept - 1}`, { force: true })
  for (let i = kept - 2; i >= 1; i--)
    if (existsSync(`${file}.${i}`)) renameSync(`${file}.${i}`, `${file}.${i + 1}`)
  if (existsSync(file)) renameSync(file, `${file}.1`)
}

export function logToFile(dir: string, limit = LIMIT): string {
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'core.log')
  let size = existsSync(file) ? statSync(file).size : 0
  const write = (chunk: unknown) => {
    const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk as Uint8Array).toString()
    const line = text.endsWith('\n') ? text : `${text}\n`
    if (size + line.length > limit) {
      rotate(file)
      size = 0
    }
    appendFileSync(file, line)
    size += Buffer.byteLength(line)
  }
  for (const stream of [process.stdout, process.stderr]) {
    const own = stream.write.bind(stream)
    stream.write = ((chunk: unknown, ...rest: unknown[]) => {
      write(chunk)
      return (own as (...a: unknown[]) => boolean)(chunk, ...rest)
    }) as typeof stream.write
  }
  return file
}
