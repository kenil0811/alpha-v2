// A hosted Alpha, from this Mac. Run with `pnpm server <what>`:
//   setup <address> <owner's name> [public address]    make a Linux machine into an Alpha server
//   package                                            a signed release of what is here now
//   update <address>                                   send that release; the server takes it now
//   link <address>                                     open the owner's one-time link in the browser
//   address <address>                                  bring up Tailscale: an https address on the owner's own devices only
// <address> is what ssh reaches the machine by. Nothing here prints a secret or a one-time link.
import { execFileSync, spawn } from 'node:child_process'
import { createPrivateKey, sign } from 'node:crypto'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const OUT = join(ROOT, '.data', 'release')
const KEY = join(homedir(), '.ssh', 'alpha-server')
const SSH = ['-i', KEY, '-o', 'StrictHostKeyChecking=accept-new']
const SERVER_FILES = join(ROOT, 'release', 'server')
const LEFT_OUT = /^(docs\/|mac\/|\.data\/|\.github\/)/

// a Mac's tar would otherwise add a ._ file beside every file with extended attributes
process.env.COPYFILE_DISABLE = '1'

const run = (cmd: string, args: string[]) =>
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit' })
const out = (cmd: string, args: string[]) =>
  execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8' }).trim()
const remote = (host: string, command: string) => run('ssh', [...SSH, host, command])
const put = (host: string, files: string[], to: string) =>
  run('scp', ['-q', ...SSH, ...files, `${host}:${to}`])

// Tailscale's approvals are links for its owner: opened in their browser here, never printed.
const APPROVAL = /https:\/\/login\.tailscale\.com\/\S+(?=\s)/g
function tailscale(host: string, command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ssh', [...SSH, host, command])
    let said = ''
    const opened = new Set<string>()
    const read = (chunk: Buffer) => {
      said += chunk.toString('utf8')
      for (const [link] of said.matchAll(APPROVAL)) {
        if (opened.has(link)) continue
        opened.add(link)
        run('open', [link])
        console.log('Opened Tailscale in your browser. Approve it there.')
      }
    }
    child.stdout.on('data', read)
    child.stderr.on('data', read)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(said.replace(APPROVAL, '(a link)').trim()))
    })
  })
}

function signingKey(): string {
  const b64 = out('security', [
    'find-generic-password',
    '-s',
    'Alpha signing key',
    '-a',
    'alpha',
    '-w',
  ])
  return Buffer.from(b64, 'base64').toString('utf8')
}

function latest(): string {
  return readFileSync(join(OUT, 'alpha-server-latest'), 'utf8').trim()
}

function packageIt(): void {
  run('pnpm', ['--filter', '@alpha/window', 'build'])
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
  const name = `alpha-server-${stamp}-${out('git', ['rev-parse', '--short', 'HEAD'])}`
  const files = out('git', ['ls-files', '-c', '-o', '--exclude-standard'])
    .split('\n')
    .filter((f) => f && !LEFT_OUT.test(f))
  const list = join(mkdtempSync(join(tmpdir(), 'alpha-server-')), 'files')
  writeFileSync(list, [...files, 'window/dist'].join('\n'))
  mkdirSync(OUT, { recursive: true })
  const file = join(OUT, `${name}.tar.gz`)
  run('tar', ['-czf', file, '-T', list])
  const signature = sign(null, readFileSync(file), createPrivateKey(signingKey()))
  writeFileSync(`${file}.sig`, signature.toString('base64'))
  writeFileSync(join(OUT, 'alpha-server-latest'), name)
  console.log(`Made ${name}.`)
}

const [what, host, ...rest] = process.argv.slice(2)
if (what === 'package') packageIt()
else if (what === 'setup' && host && rest[0]) {
  const dir = mkdtempSync(join(tmpdir(), 'alpha-setup-'))
  for (const f of ['setup.sh', 'alpha', 'alpha.service', 'verify.mjs'])
    copyFileSync(join(SERVER_FILES, f), join(dir, f))
  copyFileSync(join(ROOT, 'core', 'config', 'signing-key.pub'), join(dir, 'signing-key.pub'))
  copyFileSync(join(ROOT, '.nvmrc'), join(dir, '.nvmrc'))
  copyFileSync(join(ROOT, 'package.json'), join(dir, 'package.json'))
  remote(host, 'rm -rf /tmp/alpha-setup && mkdir -p /tmp/alpha-setup')
  run('scp', ['-q', '-r', ...SSH, `${dir}/.`, `${host}:/tmp/alpha-setup`])
  remote(
    host,
    `sudo sh /tmp/alpha-setup/setup.sh ${JSON.stringify(rest[0])} ${JSON.stringify(rest[1] ?? '')}`,
  )
} else if (what === 'update' && host) {
  const name = latest()
  const file = join(OUT, `${name}.tar.gz`)
  put(host, [file, `${file}.sig`], '/tmp/')
  remote(host, `sudo alpha update /tmp/${name}.tar.gz /tmp/${name}.tar.gz.sig`)
} else if (what === 'link' && host) {
  const link = execFileSync('ssh', [...SSH, host, 'sudo alpha link'], { encoding: 'utf8' }).trim()
  if (!link) throw new Error('The server gave no link: the owner may have a password already.')
  run('open', [link])
  console.log('Opened the owner’s link in your browser.')
} else if (what === 'address' && host) {
  await tailscale(host, 'sudo tailscale up --hostname=alpha')
  await tailscale(host, 'sudo tailscale serve --bg 4700')
  const status = JSON.parse(out('ssh', [...SSH, host, 'tailscale status --json'])) as {
    Self: { DNSName: string }
  }
  remote(host, `sudo alpha address https://${status.Self.DNSName.replace(/\.$/, '')}`)
} else {
  console.error(
    'Say: pnpm server setup|package|update|link|address. The top of scripts/server.ts says how.',
  )
  process.exit(1)
}
