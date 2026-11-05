// docs/rules.md against its tests (R3), for `pnpm rules` and for R3's own test: every rule marked
// test or skip has its rule(), every rule() names a rule of the list, and a rule left to step 8 or
// to review has none yet. What the routes, tools and plugin calls are, read from the code, so the
// door list can be held to them.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
const ROOT = join(import.meta.dirname, '..', '..', '..')
export const RULES_MD = join(ROOT, 'docs', 'rules.md')

// Each rule's Held by, from its line in docs/rules.md.
export function marks(text = readFileSync(RULES_MD, 'utf8')): Map<string, string> {
  const out = new Map<string, string>()
  for (const line of text.split('\n')) {
    const cells = line.split('|').map((c) => c.trim())
    const ruleId = cells[1] ?? ''
    if (/^[MDAR]\d+$/.test(ruleId)) out.set(ruleId, cells.at(-2) ?? '')
  }
  return out
}
const RULES_DIR = import.meta.dirname
const HELD = /^(?:test|skip \(steps? \d+(?:, \d+)*\)|step 8|—)$/

export interface RulesCheck {
  problems: string[]
  summary: string
}

export function checkRules(text = readFileSync(RULES_MD, 'utf8')): RulesCheck {
  const held = marks(text)
  const problems: string[] = []
  const tested = new Map<string, string>()
  for (const f of readdirSync(RULES_DIR).filter((n) => n.endsWith('.test.ts')))
    for (const m of readFileSync(join(RULES_DIR, f), 'utf8').matchAll(/\brule\(\s*'([MDAR]\d+)'/g)) {
      const ruleId = m[1] as string
      if (tested.has(ruleId)) problems.push(`${ruleId} has two rule() calls, in ${tested.get(ruleId)} and ${f}.`)
      tested.set(ruleId, f)
    }
  for (const [ruleId, mark] of held) {
    if (!HELD.test(mark))
      problems.push(`${ruleId} is held by “${mark}”: say test, skip (step N), step 8 or —.`)
    const written = tested.has(ruleId)
    if ((mark === 'test' || mark.startsWith('skip')) && !written)
      problems.push(`${ruleId} says ${mark}, but no rule('${ruleId}', …) in core/src/rules/ tries it.`)
    if ((mark === 'step 8' || mark === '—') && written)
      problems.push(`${ruleId} says ${mark}, but ${tested.get(ruleId)} tries it: mark it as its test finds it.`)
  }
  for (const [ruleId, f] of tested)
    if (!held.has(ruleId)) problems.push(`${f} tries ${ruleId}, which docs/rules.md does not have.`)
  const count = (p: (m: string) => boolean) => [...held.values()].filter(p).length
  const waiting = [...held.values()].filter((m) => m.startsWith('skip'))
  const steps = [...new Set(waiting.flatMap((m) => [...m.matchAll(/\d+/g)].map((x) => Number(x[0]))))]
    .filter((s) => s < 8)
    .sort((a, b) => a - b)
  const summary = `rules: ${count((m) => m === 'test')} held, ${waiting.length} waiting${
    steps.length ? ` on steps ${steps.join(', ')}` : ''
  }, ${count((m) => m === 'step 8')} with Dell, ${count((m) => m === '—')} by review`
  return { problems, summary }
}

// The core's routes that write, as `METHOD /path`, a part worked out in code as `*`.
export function writeRoutes(): string[] {
  const out = new Set<string>()
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name) && !p.startsWith(RULES_DIR))
        for (const m of readFileSync(p, 'utf8').matchAll(
          /\bapp\.(post|put|patch|delete)\(\s*(['`])([^'`]+)\2/g,
        ))
          out.add(`${(m[1] as string).toUpperCase()} ${(m[3] as string).replace(/\$\{[^}]*\}/g, '*')}`)
    }
  }
  walk(join(ROOT, 'core', 'src'))
  return [...out].sort()
}

// What the plugin host offers, as `plugin <call>` (`plugin own.add` for its own module's).
export function pluginCalls(): string[] {
  const text = readFileSync(join(ROOT, 'plugin-sdk', 'src', 'index.ts'), 'utf8')
  const body = /export interface PluginHost \{([\s\S]*?)\n\}/.exec(text)?.[1] ?? ''
  const calls: string[] = []
  let within: string | null = null
  for (const line of body.split('\n')) {
    const open = /^ {2}(\w+): \{$/.exec(line)
    if (open) within = open[1] as string
    else if (/^ {2}\}$/.test(line)) within = null
    const m = within ? /^ {4}(\w+)\(/.exec(line) : /^ {2}(\w+)\(/.exec(line)
    if (m) calls.push(`plugin ${within ? `${within}.` : ''}${m[1]}`)
  }
  return calls.sort()
}
