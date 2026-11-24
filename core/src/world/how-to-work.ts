// How to work: the standing instructions the desk reads at the start of every conversation, one
// file for each person and one for everyone, a line each ("- …"), some under a heading of their own
// ("## About you"). Settings › Rules shows and removes them.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { World } from './world.ts'

const TOP = '# Standing instructions'

// Where they are kept: the person's, or everyone's.
export function instructionsFile(world: World, user: string | null): string {
  return join(world.paths.instructions, user ? `${user}.md` : 'everyone.md')
}

// One line kept: at the end of its heading's part (made when it is not there yet), or, with no
// heading, after the lines that have none. A line kept already is not kept twice.
export function keepLine(world: World, user: string | null, words: string, heading?: string): void {
  const file = instructionsFile(world, user)
  const text = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const lines = text.trim() ? text.replace(/\n+$/, '').split('\n') : [TOP]
  const line = `- ${words.trim()}`
  if (lines.some((l) => l.trim() === line)) return
  const start = heading ? lines.findIndex((l) => l.trim() === `## ${heading}`) : -1
  if (heading && start < 0) lines.push('', `## ${heading}`, '', line)
  else {
    const from = start < 0 ? 0 : start + 1
    const next = lines.findIndex((l, i) => i >= from && l.startsWith('## '))
    let at = next < 0 ? lines.length : next
    while (at > from && !lines[at - 1]?.trim()) at--
    const opens = !lines.slice(from, at).some((l) => l.startsWith('- '))
    lines.splice(at, 0, ...(opens ? ['', line] : [line]), ...(next < 0 ? [] : ['']))
  }
  writeFileSync(file, `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`)
}
