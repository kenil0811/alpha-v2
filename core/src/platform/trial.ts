// The trial on a real Mac (onboarding step 1, Kenil's yes 1 Nov): every source onboarding reads,
// read once through Alpha's helper as the app (so macOS asks naming Alpha) and the Chromium
// reader, each timed. The raw answers stay in .data/onboarding-trial/<when>/ and are never
// committed; the report holds counts, times and states only. `--settings` opens Full Disk Access
// with Alpha beside it; `--record` writes test recordings from the newest trial with every name,
// site, title, path and app replaced; `--count` runs the three connectors for this computer as the
// core runs them (each in its own process, asking the Mac reader across the pipe) and says how
// much they counted, the names left in .data for the person alone. Nothing leaves the computer;
// no model is asked.
//
//   pnpm onboarding-trial [--settings | --record | --count]
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { MemorySecrets, runHelper } from '@alpha/connector-sdk'
import { loadConnector } from '../connectors/discover.ts'
import { ConnectorService } from '../connectors/service.ts'
import { World } from '../world/world.ts'
import { MacReader } from './mac-local.ts'
import { chromiumVisits } from './readers/chromium.ts'

const REPO = join(import.meta.dirname, '..', '..', '..')
const HELPER_SRC = join(REPO, 'connector-sdk', 'helper')
const APP = join(HELPER_SRC, 'build', 'Alpha Helper.app')
const TRIALS = join(REPO, '.data', 'onboarding-trial')
const FIXTURES = join(import.meta.dirname, 'fixtures', 'mac')
const CHROME = join(homedir(), 'Library', 'Application Support', 'Google', 'Chrome')
const DAYS = 90
const since = new Date(Date.now() - DAYS * 86_400_000).toISOString()
const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()

type Answer = Record<string, unknown> & { ok?: boolean }
interface Read {
  source: string
  seconds: number
  answer: Answer | null
  problem: string | null
}

const helper = (args: string[]) => runHelper(APP, args, { asApp: true }) as Promise<Answer>

async function timed(source: string, read: () => Promise<Answer>): Promise<Read> {
  const t0 = performance.now()
  try {
    const answer = await read()
    return { source, seconds: (performance.now() - t0) / 1000, answer, problem: null }
  } catch (err) {
    return {
      source,
      seconds: (performance.now() - t0) / 1000,
      answer: null,
      problem: err instanceof Error ? err.message : String(err),
    }
  }
}

const site = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}
const list = (a: Answer | null, key: string) => (a?.[key] as Record<string, unknown>[]) ?? []

// One line of the report per source: counts and times, never a name.
function line(r: Read): string {
  const a = r.answer
  const took = `${r.seconds.toFixed(1)} s`
  if (!a) return `| ${r.source} | ${r.problem} | ${took} |`
  if (r.source === 'apps') {
    const apps = list(a, 'apps')
    const used = apps.filter((x) => x.lastUsed).length
    return `| apps | ${apps.length} apps, ${used} with a last use, ${apps.filter((x) => Number(x.launches) > 0).length} with launches | ${took} |`
  }
  if (r.source === 'chrome' || r.source === 'safari') {
    const visits = list(a, 'visits')
    const sites = new Set(visits.map((v) => site(String(v.url))))
    return `| ${r.source} | ${visits.length} visits, ${sites.size} sites, last ${DAYS} days | ${took} |`
  }
  if (r.source === 'app-time') {
    const spans = list(a, 'spans')
    const files = list(a, 'files')
    return `| app-time | from ${a.from}: ${spans.length} spans${files.length ? `; ${files.length} Biome files, ${files.reduce((n, f) => n + Number(f.size), 0)} bytes, not yet read` : ''} | ${took} |`
  }
  if (r.source.startsWith('files ')) {
    const files = list(a, 'files')
    const projects = files.filter((f) => f.project).length
    return `| ${r.source} | ${files.filter((f) => !f.folder).length} files in ${files.filter((f) => f.folder && !f.project).length} folders${projects ? `, ${projects} projects` : ''} | ${took} |`
  }
  return `| ${r.source} | ${a.state ?? 'answered'} | ${took} |`
}

async function trial() {
  execFileSync('/bin/sh', [join(HELPER_SRC, 'build.sh')], { stdio: 'inherit' })
  const when = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = join(TRIALS, when)
  mkdirSync(join(dir, 'raw'), { recursive: true })
  const reads: Read[] = []
  // the three folders first: the first read of each is when macOS asks, naming Alpha
  for (const folder of ['documents', 'desktop', 'downloads'])
    reads.push(await timed(`files ${folder}`, () => helper(['files', folder])))
  reads.push(await timed('apps', () => helper(['apps'])))
  reads.push(
    await timed('chrome', async () => ({ ok: true, visits: chromiumVisits(CHROME, since) })),
  )
  reads.push(await timed('safari', () => helper(['safari-visits', since])))
  reads.push(await timed('app-time', () => helper(['app-time', monthAgo])))
  for (const part of ['safari', 'screen-time', 'documents', 'desktop', 'downloads'])
    reads.push(await timed(`access ${part}`, () => helper(['access', part])))
  for (const r of reads)
    writeFileSync(
      join(dir, 'raw', `${r.source.replace(' ', '-')}.json`),
      JSON.stringify(r, null, 1),
    )
  const report = [
    `# Onboarding trial, ${new Date().toString()}`,
    '',
    `macOS ${execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim()}; the helper at ${APP}.`,
    '',
    '| Source | What came back | Took |',
    '|---|---|---|',
    ...reads.map(line),
    '',
  ].join('\n')
  writeFileSync(join(dir, 'report.md'), report)
  console.log(report)
  console.log(`Raw answers (never committed): ${join(dir, 'raw')}`)
}

// The newest trial's answers, with every name, site, title, path and app replaced, a sample of
// each, as the recordings step 2's tests replay.
function record() {
  const newest = readdirSync(TRIALS).sort().at(-1)
  if (!newest) throw new Error('Run the trial first.')
  const raw = (name: string) => {
    const file = join(TRIALS, newest, 'raw', `${name}.json`)
    return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Read).answer : null
  }
  const names = new Map<string, string>()
  const as = (kind: string, real: string) => {
    const key = `${kind}:${real}`
    if (!names.has(key))
      names.set(
        key,
        `${kind}-${String([...names.keys()].filter((k) => k.startsWith(`${kind}:`)).length + 1).padStart(3, '0')}`,
      )
    return names.get(key) as string
  }
  const ext = (path: string) => /\.[A-Za-z0-9]{1,5}$/.exec(path)?.[0] ?? ''
  const out: Record<string, unknown> = {}
  const visits = (a: Answer | null) =>
    list(a, 'visits')
      .slice(-300)
      .map((v) => ({
        ...v,
        url: `https://${as('site', site(String(v.url)))}.example/${as('page', String(v.url))}`,
        title: v.title ? as('title', String(v.title)) : '',
      }))
  out['safari-visits'] = { ok: true, visits: visits(raw('safari')) }
  out.chrome = { ok: true, visits: visits(raw('chrome')) }
  out.apps = {
    ok: true,
    apps: list(raw('apps'), 'apps').map((x) => ({
      ...x,
      name: as('app', String(x.name)),
      id: x.id ? `example.${as('bundle', String(x.id))}` : '',
    })),
  }
  const time = raw('app-time')
  out['app-time'] = {
    ...(time ?? { ok: false }),
    spans: list(time, 'spans')
      .slice(-500)
      .map((s) => ({ ...s, app: `example.${as('bundle', String(s.app))}` })),
  }
  for (const folder of ['documents', 'desktop', 'downloads'])
    out[`files-${folder}`] = {
      ok: true,
      files: list(raw(`files-${folder}`), 'files')
        .slice(0, 300)
        .map((f) => ({
          ...f,
          path: String(f.path)
            .split('/')
            .map((part, i, all) =>
              i === all.length - 1 && !f.folder
                ? `${as('file', part)}${ext(part)}`
                : as('folder', part),
            )
            .join('/'),
        })),
    }
  mkdirSync(FIXTURES, { recursive: true })
  for (const [name, answer] of Object.entries(out))
    writeFileSync(join(FIXTURES, `${name}.json`), `${JSON.stringify(answer, null, 1)}\n`)
  console.log(`Recordings, names replaced, from ${newest}: ${FIXTURES}`)
}

// The three connectors as the core runs them, on a world of their own made for this and dropped.
async function count() {
  execFileSync('/bin/sh', [join(HELPER_SRC, 'build.sh')], { stdio: 'inherit' })
  const dir = join(TRIALS, `count-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  const world = await World.open(join(dir, 'world'))
  const svc = new ConnectorService(world, {
    secrets: new MemorySecrets(),
    known: await loadConnector(join(REPO, 'connectors', 'this-computer')),
    local: new MacReader(helper),
  })
  const out: Record<string, unknown> = {}
  try {
    for (const [name, tool, input] of [
      ['browsing', 'sites', { days: DAYS }],
      ['apps', 'apps', { days: 30 }],
      ['filenames', 'files', {}],
    ] as const) {
      await svc.connect(name, 'This computer', null, 'trial')
      const t0 = performance.now()
      out[name] = await svc.runTool(name, tool, { ...input })
      console.log(`${name}: ${((performance.now() - t0) / 1000).toFixed(1)} s`)
    }
  } finally {
    svc.close()
    world.close()
  }
  writeFileSync(join(dir, 'counted.json'), JSON.stringify(out, null, 1))
  const b = out.browsing as { parts: object; sites: unknown[] }
  const a = out.apps as { parts: object; apps: { hoursWeek?: number }[] }
  const f = out.filenames as { parts: object; tree: unknown[]; recent: unknown[] }
  console.log(
    [
      `browsing ${JSON.stringify(b.parts)}: ${b.sites.length} sites after the filters`,
      `apps ${JSON.stringify(a.parts)}: ${a.apps.length} apps, ${a.apps.filter((x) => x.hoursWeek).length} with hours a week`,
      `filenames ${JSON.stringify(f.parts)}: ${f.tree.length} folders in the tree, ${f.recent.length} newest names`,
      `What was counted, names and all, for you alone: ${join(dir, 'counted.json')}`,
    ].join('\n'),
  )
}

const flag = process.argv[2]
if (flag === '--settings') console.log(await helper(['show-settings', 'safari']))
else if (flag === '--record') record()
else if (flag === '--count') await count()
else await trial()
