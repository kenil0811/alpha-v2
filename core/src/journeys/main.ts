// The journeys runner's command (design §16), each journey on a fresh tenant with the real model:
//   node src/journeys/main.ts <name> [--times [N]] [--appended] [--keep] [--from <folder of journeys>]
//   node src/journeys/main.ts --all [--times [N]] [--from <folder of journeys>]   (pnpm journeys)
// --times runs each N times, each on a fresh world (N from limits.yaml journey_times when not
// given), and says how many passed; --all runs every journey in the folder, a few at once
// (limits.yaml journeys_at_once, Kenil 29 Oct); either writes one summary beside the reports
// (item 48 of the problems list, 25 Oct), in the journeys' order whatever order they end in.
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { config } from '../config.ts'
import { placesOf, runOne, stampOf } from './run.ts'

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const timesAt = args.indexOf('--times')
  const given = timesAt >= 0 ? Number.parseInt(args[timesAt + 1] ?? '', 10) : Number.NaN
  const times = timesAt < 0 ? 1 : given > 0 ? given : config.limits().journey_times
  const names = args.includes('--all')
    ? readdirSync(placesOf(args).journeys)
        .filter((f) => f.endsWith('.yaml'))
        .map((f) => f.replace(/\.yaml$/, ''))
        .sort()
    : [
        args.find(
          (a, i) => !a.startsWith('--') && args[i - 1] !== '--from' && args[i - 1] !== '--times',
        ),
      ]
  if (!names[0]) throw new Error('Name a journey: node src/journeys/run.ts track-what-i-eat')
  // every run of every journey, a few at once, each on its own world: the next starts as one ends
  type Run = { passed: boolean; report: string; seconds: number }
  const runs = new Map<string, Run[]>()
  const waiting = (names as string[]).flatMap((name) =>
    Array.from({ length: times }, (_, i) => ({ name, at: i + 1 })),
  )
  const lanes = Math.min(waiting.length, config.limits().journeys_at_once)
  await Promise.all(
    Array.from({ length: lanes }, async () => {
      for (let next = waiting.shift(); next; next = waiting.shift()) {
        // one that crashes fails, with its words, and the others run on
        const t0 = Date.now()
        const r = await runOne(next.name, args, { at: next.at, of: times }).catch((err) => ({
          passed: false,
          report: `it crashed: ${err instanceof Error ? err.message : String(err)}`,
          seconds: Math.round((Date.now() - t0) / 1000),
        }))
        runs.set(next.name, [...(runs.get(next.name) ?? []), r])
        if (times > 1)
          console.log(`  ${next.name} run ${next.at}: ${r.passed ? 'passed' : 'failed'}`)
      }
    }),
  )
  let all = true
  const done = new Map<string, string[]>()
  for (const name of names as string[]) {
    const own = runs.get(name) ?? []
    const k = own.filter((r) => r.passed).length
    all &&= k === times
    const said = times > 1 ? `passed ${k} of ${times}` : k ? 'passed' : 'FAILED'
    console.log(`${name}: ${said}`)
    // a crash is said here too, as a single journey writes no summary
    for (const r of own) if (r.report.startsWith('it crashed')) console.log(`  ${r.report}`)
    done.set(name, [
      `- **${name}**: ${said}, ${own.map((r) => `${r.seconds} s`).join(', ')}`,
      ...own.map((r) => `  - ${r.passed ? 'passed' : 'failed'}: ${r.report}`),
    ])
  }
  const lines = (names as string[]).flatMap((n) => done.get(n) ?? [])
  // a folder's run, or a journey run many times: one summary beside the reports
  if (names.length > 1 || times > 1) {
    const { base } = placesOf(args)
    const out = join(base, 'docs', 'journeys', `${stampOf()}-summary.md`)
    mkdirSync(join(base, 'docs', 'journeys'), { recursive: true })
    writeFileSync(
      out,
      `# Journeys, ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC\n\n${names.length} journey${names.length === 1 ? '' : 's'}, each run ${times} time${times === 1 ? '' : 's'} on a fresh world.\n\n${lines.join('\n')}\n`,
    )
    console.log(`summary: ${out}`)
  }
  process.exitCode = all ? 0 : 1
}

await main()
