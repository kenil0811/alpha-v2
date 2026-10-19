// The files connector (design §8): files read with their places, and watched folders. A folder
// the person grants is looked at every minute; what is new or changed in it is kept and read,
// as if they had dropped it in.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { type Connector, Problem } from '@alpha/connector-sdk'

export { doclingEnv, readPdf } from './pdf.ts'
export { type Piece, type Position, type Readable, readBytes } from './read.ts'

const MIME: Record<string, string> = {
  '.csv': 'text/csv',
  '.tsv': 'text/tab-separated-values',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

export function mimeOf(name: string): string {
  return MIME[extname(name).toLowerCase()] ?? 'application/octet-stream'
}

// Every file under the folder, skipping what is hidden or a system's own.
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.startsWith('~$')) continue
    const p = join(dir, entry.name)
    if (entry.isDirectory()) walk(p, out)
    else if (entry.isFile()) out.push(p)
  }
  return out
}

export const folder: Connector = {
  manifest: {
    name: 'folder',
    title: 'Folder',
    auth: 'system',
    account: { label: 'Folder', placeholder: '/Users/you/Documents/Exports' },
    pace: { perMinute: 120 },
    syncEveryMinutes: 1,
  },
  guide: readFileSync(new URL('../GUIDE.md', import.meta.url), 'utf8'),
  module: 'Files',
  tables: [],
  tools: {},
  check: async (c) => {
    const dir = c.host.account
    if (!existsSync(dir) || !statSync(dir).isDirectory())
      throw new Problem(`There is no folder at ${dir}.`, 'gone')
  },
  // The cursor remembers each file's size and time, so only what is new or changed is read.
  sync: async (c) => {
    const dir = c.host.account
    if (!existsSync(dir)) throw new Problem(`The folder ${dir} is not there any more.`, 'gone')
    const seen: Record<string, string> = JSON.parse(c.host.cursor() ?? '{}')
    const files = walk(dir)
    let fresh = false
    for (const path of files) {
      const s = statSync(path)
      const mark = `${s.size}:${Math.trunc(s.mtimeMs)}`
      const key = relative(dir, path)
      if (seen[key] === mark) continue
      const keep = c.host.keepFile
      if (!keep) throw new Problem('This connection cannot keep files.')
      const kept = keep(key, readFileSync(path), mimeOf(path))
      fresh ||= kept.isNew
      seen[key] = mark
    }
    for (const key of Object.keys(seen)) if (!files.includes(join(dir, key))) delete seen[key]
    c.host.setCursor(JSON.stringify(seen))
    return { rows: files.length, sawNew: fresh }
  },
}
