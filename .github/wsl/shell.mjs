// Inside Alpha's Linux, as the alpha user: an agent's shell command under the sandbox the core
// gives its agents' shells (the same runtime, Claude Code's own on Linux): it runs; it cannot read
// the Alpha's data; it reaches no site. Exits 1 if any of that does not hold.
import { spawnSync } from 'node:child_process'

const { SandboxManager } = await import(
  '/opt/alpha/current/core/node_modules/@anthropic-ai/sandbox-runtime/dist/index.js'
)
await SandboxManager.initialize({
  network: { allowedDomains: [], deniedDomains: [] },
  filesystem: { denyRead: ['/home/alpha'], allowRead: [], allowWrite: ['/tmp'], denyWrite: [] },
})
const sh = async (cmd) => {
  const wrapped = await SandboxManager.wrapWithSandbox(cmd)
  const r = spawnSync(wrapped, { shell: true, encoding: 'utf8', timeout: 30000 })
  return { code: r.status, out: `${r.stdout}${r.stderr}`.trim() }
}
let failed = false
const runs = await sh('echo ran in the sandbox: $(uname -sr) && ls /usr/bin | wc -l')
console.log(`a command: ${runs.code === 0 ? 'ran' : 'FAILED'} (${runs.out.split('\n')[0]})`)
failed ||= runs.code !== 0
const data = await sh('cat /home/alpha/data/token')
console.log(`the Alpha's data: ${data.code !== 0 ? 'refused' : 'READ (wrong)'}`)
failed ||= data.code === 0
const net = await sh('curl -s -m 10 -o /dev/null -w "%{http_code}" https://example.com')
console.log(`a site: ${net.code !== 0 || net.out !== '200' ? 'refused' : 'REACHED (wrong)'}`)
failed ||= net.code === 0 && net.out === '200'
await SandboxManager.reset?.()
process.exit(failed ? 1 : 0)
