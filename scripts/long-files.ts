// A wall for developers (decision 12, step 4): no file in core/src over 600 lines, so a reader
// finds what they came for in a screen or two. A file that grows past it is split into a folder
// named for it with an index.ts (runs/, tools/, kits/, world/tasks/, records/, shape/, people/).
// The window is held to the same wall (Batch A, call 10, Kenil's yes 1 Nov): a new file stays
// under 600 lines, and the big screens it began with may only shrink, each new behaviour in a
// small file of its own that they wire in.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const REPO = join(import.meta.dirname, '..')
const LIMIT = 600
// The files over the limit by design, each at most as long as it is here: over its own count
// fails too.
const LEFT: Record<string, number> = {
  'core/src/api/types.ts': 660, // the window's contract, one file by design (Kenil, 24 Oct)
  // the window's big screens as they stood after the clean base's delete (7 Nov): they may only
  // shrink
  'window/src/Settings.tsx': 1072,
  'window/src/table/Grid.tsx': 1272,
  'window/src/Shell.tsx': 692,
  'window/src/TableView.tsx': 856,
  'window/src/Tasks.tsx': 680,
}
const long: string[] = []
function walk(dir: string) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) {
      const rel = relative(REPO, p)
      const n = readFileSync(p, 'utf8').split('\n').length
      const limit = LEFT[rel] ?? LIMIT
      if (n > limit) long.push(`${rel}: ${n} lines (the wall for it: ${limit})`)
    }
  }
}
walk(join(REPO, 'core', 'src'))
walk(join(REPO, 'window', 'src'))
if (long.length) {
  console.error(
    `A file in core/src or window/src is over its wall (${LIMIT} lines, or its own count); split it by what a reader comes looking for:`,
  )
  for (const f of long) console.error(`- ${f}`)
  process.exit(1)
}
console.log(
  `No file in core/src or window/src is over ${LIMIT} lines, and the ${Object.keys(LEFT).length} left by design did not grow.`,
)
