// A wall for developers (decision 12, step 4): the core asks what computer it is on in one place,
// core/src/platform/. A Mac call anywhere else in core/src fails `pnpm check`.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '..', 'core', 'src')
const MAC =
  /process\.platform|osascript|caffeinate|\/usr\/bin\/open|x-apple\.|\/usr\/bin\/id\b|AppleLocale|MacKeychain|mdfind|plutil|com\.apple\.|Library\/(Application Support|Safari)|AppData/
const found: string[] = []
function walk(dir: string) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p)
    else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) {
      const rel = relative(ROOT, p)
      if (rel.startsWith('platform/')) continue
      readFileSync(p, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (MAC.test(line)) found.push(`${rel}:${i + 1}: ${line.trim()}`)
        })
    }
  }
}
walk(ROOT)
if (found.length) {
  console.error('The core asks what computer it is on outside core/src/platform/:')
  for (const f of found) console.error(`- ${f}`)
  process.exit(1)
}
console.log('The core asks what computer it is on in core/src/platform/ only.')
