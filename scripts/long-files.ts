// A wall for developers (decision 12, step 4): no file in core/src over 600 lines, so the two that
// were split (server.ts, runs.ts) never grow back. The one left for its own step is named here.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '..', 'core', 'src')
const LIMIT = 600
// The files over the limit before the wall went up, each left for a step of its own: the wall
// keeps them from growing further (a file here over its line count here fails too).
const LEFT: Record<string, number> = {
  'engine/tools.ts': 880, // the world tools
  'api/types.ts': 660, // the window's contract, one file by design
  'modules/kits/index.ts': 670, // install, update, the ownership rule (+ the core flag, 24 Oct)
  'world/people.ts': 1850, // how the world gathers people
  'world/records.ts': 980, // rows on real tables
  'world/shape.ts': 1190, // modules, tables, fields, DDL
  'world/tasks.ts': 830, // the task store
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
  `No file in core/src is over ${LIMIT} lines, and none of the ${Object.keys(LEFT).length} left for their own steps grew.`,
)
