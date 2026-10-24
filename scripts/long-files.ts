// A wall for developers (decision 12, step 4): no file in core/src over 600 lines, so a reader
// finds what they came for in a screen or two. A file that grows past it is split into a folder
// named for it with an index.ts (runs/, tools/, kits/, world/tasks/, records/, shape/, people/).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '..', 'core', 'src')
const LIMIT = 600
// The one file over the limit by design: the window's contract, read whole. The wall keeps it
// from growing further (over its own count here fails too).
const LEFT: Record<string, number> = {
  'api/types.ts': 660, // the window's contract, one file by design (Kenil, 24 Oct)
}
const long: string[] = []
function walk(dir: string) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p)
    else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) {
      const rel = relative(ROOT, p)
      const n = readFileSync(p, 'utf8').split('\n').length
      const limit = LEFT[rel] ?? LIMIT
      if (n > limit) long.push(`${rel}: ${n} lines (the wall for it: ${limit})`)
    }
  }
}
walk(ROOT)
if (long.length) {
  console.error(
    `A file in core/src is over ${LIMIT} lines; split it by what a reader comes looking for:`,
  )
  for (const f of long) console.error(`- ${f}`)
  process.exit(1)
}
console.log(
  `No file in core/src is over ${LIMIT} lines, and the ${Object.keys(LEFT).length} left by design did not grow.`,
)
