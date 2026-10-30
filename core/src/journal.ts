// The journal from the command line (step 2, part 3): `pnpm journal verify <world.sqlite |
// journal.jsonl>` walks the chain and says whether every line is as it was written, or at which
// line it is not. A world file is opened read-only; an export is read as it is.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { verify, verifyExport } from './world/audit.ts'

const [verb, file] = process.argv.slice(2)
const at = (p: string) => resolve(process.env.INIT_CWD ?? process.cwd(), p)
if (verb !== 'verify' || !file) {
  console.error('Say: pnpm journal verify <world.sqlite or journal.jsonl>')
  process.exit(1)
}
const path = at(file)
const out = path.endsWith('.jsonl')
  ? verifyExport(readFileSync(path, 'utf8'))
  : (() => {
      const db = new DatabaseSync(path, { readOnly: true })
      try {
        return verify(db as never)
      } finally {
        db.close()
      }
    })()
if (out.ok) console.log(`The journal is as it was written: ${out.lines} lines, the chain whole.`)
else {
  console.log(`The journal's chain is broken at line ${out.at}: ${out.why}.`)
  process.exit(1)
}
