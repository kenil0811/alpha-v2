// Kits from the command line: `pnpm kit check <folder>` says what is wrong with a kit before
// anything installs (the kit API's checker, kit-sdk); `pnpm kit test <folder> [--record]` runs
// its cases against a fixture world and recorded answers, without the model;
// `pnpm kit pack <folder> [out]` packs a kit's folder into one file (out defaults to the
// current folder), ready to send or to drop in a Mac's kits/inbox.
import { resolve } from 'node:path'
import { checkKit, kitNotes } from '@alpha/kit-sdk'
import { kitTest } from './modules/kittest.ts'
import { pack } from './modules/packs.ts'

const [verb, folder, out] = process.argv.slice(2)
const at = (p: string) => resolve(process.env.INIT_CWD ?? process.cwd(), p)
if (verb === 'check' && folder) {
  const problems = checkKit(at(folder))
  for (const n of kitNotes(at(folder))) console.log(`  note: ${n}`)
  if (!problems.length) console.log('The kit is right.')
  else {
    for (const p of problems) console.log(`- ${p}`)
    process.exit(1)
  }
} else if (verb === 'test' && folder) {
  const report = await kitTest(at(folder), { record: process.argv.includes('--record') })
  for (const p of report.passed) console.log(`✓ ${p}`)
  for (const f of report.failed) console.log(`× ${f.name}: ${f.why}`)
  if (!report.passed.length && !report.failed.length)
    console.log('The kit has no tests (tests/*.yaml).')
  if (report.failed.length) process.exit(1)
} else if (verb === 'pack' && folder) {
  console.log(pack(at(folder), at(out ?? '.')))
} else {
  console.error(
    'Say: pnpm kit check <kit folder>, or pnpm kit pack <kit folder> [where to put the pack]',
  )
  process.exit(1)
}
