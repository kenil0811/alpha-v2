// `pnpm release windows`: the Windows setup program, as GitHub's Windows machine made it from this
// branch (.github/workflows/windows.yml: Alpha's Linux, the app around it, then an install test on
// a fresh Windows), fetched here once its install test passed. A Mac cannot make it: the setup
// carries a Linux image WSL exported and an app built for Windows. Out: .data/release/
// Alpha-<version>-setup.exe, to send.
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const OUT = join(ROOT, '.data', 'release')
const gh = (args: string[]) => execFileSync('gh', args, { cwd: ROOT, encoding: 'utf8' }).trim()

interface Run {
  databaseId: number
  status: string
  conclusion: string
}
interface Job {
  name: string
  status: string
  conclusion: string
}

const branch = execFileSync('git', ['branch', '--show-current'], {
  cwd: ROOT,
  encoding: 'utf8',
}).trim()
const runs = JSON.parse(
  gh([
    'run',
    'list',
    '--workflow',
    'windows.yml',
    '--branch',
    branch,
    '--limit',
    '10',
    '--json',
    'databaseId,status,conclusion',
  ]),
) as Run[]
const jobsOf = (id: number) =>
  (JSON.parse(gh(['run', 'view', String(id), '--json', 'jobs'])) as { jobs: Job[] }).jobs
// the newest run that made a setup program and installed it: one still going is waited on (asked
// once a minute; GitHub limits how often it is asked)
let found: number | null = null
for (const r of runs) {
  let jobs = jobsOf(r.databaseId)
  while (
    r.status !== 'completed' &&
    jobs.find((j) => j.name === 'install')?.status !== 'completed'
  ) {
    console.log(`· Waiting for the Windows build on GitHub (run ${r.databaseId})…`)
    await new Promise((done) => setTimeout(done, 60_000))
    jobs = jobsOf(r.databaseId)
    if (jobs.some((j) => j.conclusion === 'failure')) break
  }
  if (jobs.find((j) => j.name === 'install')?.conclusion === 'success') {
    found = r.databaseId
    break
  }
}
if (!found)
  throw new Error(
    `No Windows build of ${branch} passed its install test: push it as a windows-* branch first.`,
  )
const got = join(OUT, 'work', 'windows')
rmSync(got, { recursive: true, force: true })
mkdirSync(got, { recursive: true })
gh(['run', 'download', String(found), '--name', 'alpha-setup', '--dir', got])
const exe = readdirSync(got).find((f) => f.endsWith('-setup.exe'))
if (!exe) throw new Error('The Windows build made no setup program.')
const version = /_(\d+\.\d+\.\d+)_/.exec(exe)?.[1] ?? 'windows'
const to = join(OUT, `Alpha-${version}-setup.exe`)
copyFileSync(join(got, exe), to)
rmSync(got, { recursive: true, force: true })
const mb = Math.round(statSync(to).size / 1e6)
console.log(
  `· Alpha ${version} for Windows passed its install test and is ready to send: ${to} (${mb} MB)`,
)
