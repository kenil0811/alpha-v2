// Spike 4: the macOS sandbox. The desk works in its own folder and writes there and in modules/;
// a granted folder is read, never written; the world file and everything else are out of reach;
// the shell's network asks the callback host by host.
import { query } from '@anthropic-ai/claude-agent-sdk'
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { base, drain, home } from './common.ts'

// Outside the temp folder: the sandbox lets every command write in $TMPDIR
const h = process.env.S3_HOME ? (mkdirSync(process.env.S3_HOME, { recursive: true }), realpathSync(process.env.S3_HOME)) : home('s3')
const desk = join(h, 'desk', 'kenil')
const modules = join(h, 'modules')
const granted = join(h, 'granted')
const outside = join(h, 'outside')
for (const d of [desk, modules, granted, outside]) mkdirSync(d, { recursive: true })
writeFileSync(join(granted, 'note.txt'), 'granted note\n')
writeFileSync(join(h, 'world.sqlite'), 'SQLite format 3\0 pretend\n')

const asked: string[] = []
const inside = (p: string, roots: string[]) => {
  let full: string
  try {
    full = realpathSync(resolve(desk, p))
  } catch {
    full = resolve(desk, p)
  }
  return roots.some((r) => full === r || full.startsWith(`${r}/`))
}

const q = query({
  prompt: `Run each of these shell commands one at a time with the Bash tool, and after all of them give me a numbered list with each command's outcome in a few words. Don't try workarounds; a refusal is an outcome.
1. echo a > inside.txt
2. echo b > ${modules}/m.txt
3. echo c > ${outside}/x.txt
4. cat ${granted}/note.txt
5. echo d > ${granted}/y.txt
6. head -1 /etc/hosts
7. head -c 15 ${h}/world.sqlite
8. echo e >> ${h}/world.sqlite
9. curl -s -m 8 https://example.com | head -c 60
10. ls ~/Documents | head -3
Then use the Write tool to write ${outside}/w.txt with "w", and the Read tool to read ${granted}/note.txt.`,
  options: base(desk, {
    additionalDirectories: [modules, granted],
    allowedTools: ['Bash', 'Glob', 'Grep'],
    permissionMode: 'default',
    sandbox: {
      enabled: true,
      failIfUnavailable: true,
      autoAllowBashIfSandboxed: true,
      allowUnsandboxedCommands: false,
      filesystem: process.env.S3_READS === '1'
        ? { denyWrite: [granted], denyRead: [process.env.HOME ?? ''], allowRead: [desk, modules, granted] }
        : { denyWrite: [granted] },
      network: {},
    },
    canUseTool: async (name, input, opts) => {
      const path = String(input.file_path ?? input.path ?? '')
      let verdict: 'allow' | 'deny'
      if (name === 'SandboxNetworkAccess') verdict = 'deny'
      else if (name === 'Read') verdict = inside(path, [desk, modules, granted]) ? 'allow' : 'deny'
      else if (name === 'Write' || name === 'Edit') verdict = inside(path, [desk, modules]) ? 'allow' : 'deny'
      else verdict = 'deny'
      asked.push(`${name} ${JSON.stringify(input).slice(0, 100)} blocked=${opts.blockedPath ?? ''} -> ${verdict}`)
      return verdict === 'allow'
        ? { behavior: 'allow', updatedInput: input }
        : { behavior: 'deny', message: `${name} refused by Alpha's walls.` }
    },
  }),
})
const { result } = await drain(q, 's3')
console.log('\ncallback asked:\n  ' + asked.join('\n  '))
console.log('\non disk:')
for (const [label, p] of [
  ['inside.txt', join(desk, 'inside.txt')],
  ['modules/m.txt', join(modules, 'm.txt')],
  ['outside/x.txt', join(outside, 'x.txt')],
  ['granted/y.txt', join(granted, 'y.txt')],
  ['outside/w.txt', join(outside, 'w.txt')],
] as const)
  console.log(`  ${label}: ${existsSync(p) ? 'written' : 'not there'}`)
console.log(`  world.sqlite: ${JSON.stringify(readFileSync(join(h, 'world.sqlite'), 'utf8'))}`)
console.log('\nthe model said:\n' + result?.result)
