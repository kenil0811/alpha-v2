// The journeys runner's command (design §16), each journey on a fresh tenant with the real model:
//   node src/journeys/main.ts <name> [--times [N]] [--appended] [--keep] [--from <folder of journeys>]
//   node src/journeys/main.ts --all [--times [N]] [--from <folder of journeys>]   (pnpm journeys)
// --times runs each N times, each on a fresh world (N from limits.yaml journey_times when not
// given), and says how many passed; --all runs every journey in the folder; either writes one
// summary beside the reports (item 48 of the problems list, 25 Oct).
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
  const lines: string[] = []
  let all = true
  for (const name of names as string[]) {
    const runs: { passed: boolean; report: string; seconds: number }[] = []
    for (let at = 1; at <= times; at++) runs.push(await runOne(name, args, { at, of: times }))
    const k = runs.filter((r) => r.passed).length
    all &&= k === times
    const said = times > 1 ? `passed ${k} of ${times}` : k ? 'passed' : 'FAILED'
    console.log(`${name}: ${said}`)
    lines.push(
      `- **${name}**: ${said}, ${runs.map((r) => `${r.seconds} s`).join(', ')}`,
      ...runs.map((r) => `  - ${r.passed ? 'passed' : 'failed'}: ${r.report}`),
    )
  }
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
