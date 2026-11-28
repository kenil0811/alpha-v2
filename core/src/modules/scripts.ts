// A module's scripts: the code that does its work by itself, the same way every time, each in
// scripts/<name>/ with what it reads beside it (a source's reader, a list). A skill is never code:
// it is a how-to the model follows, in skills/<name>/SKILL.md (the definitions, 27 Nov).
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Schedule } from './schedules.ts'

export const SCRIPTS = 'scripts/'

// A file that runs: never a skill's.
export const isCode = (path: string): boolean => /\.(m?js|cjs|ts)$/i.test(path)

// A path under a module's scripts/, as a schedule's runs.script and the run tool name one.
export const inScripts = (path: string): boolean => {
  const p = path.replace(/^\.\//, '')
  return p.startsWith(SCRIPTS) && p.length > SCRIPTS.length
}

// A module's scripts, each with the schedules that run it.
export function scriptsOf(dir: string, schedules: Schedule[]): { name: string; runBy: string[] }[] {
  const root = join(dir, 'scripts')
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => ({
      name: d.name,
      runBy: schedules
        .filter((s) => s.runs?.script.replace(/^\.\//, '').startsWith(`${SCRIPTS}${d.name}/`))
        .map((s) => s.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
