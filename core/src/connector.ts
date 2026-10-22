// Connectors from the command line: `pnpm connector check <folder>` says what is wrong with a
// connector folder before Alpha loads it (the SDK's check); `pnpm connector pack <folder> [out]`
// packs it into one .alphaconnector file (out defaults to the current folder), ready to send or
// to add in Settings › Connections.
import { resolve } from 'node:path'
import { checkFolder, pack } from './connectors/discover.ts'

const [verb, folder, out] = process.argv.slice(2)
const at = (p: string) => resolve(process.env.INIT_CWD ?? process.cwd(), p)
if (verb === 'check' && folder) {
  const problems = await checkFolder(at(folder))
  if (!problems.length) console.log('The connector is right.')
  else {
    for (const p of problems) console.log(`- ${p}`)
    process.exit(1)
  }
} else if (verb === 'pack' && folder) {
  console.log(await pack(at(folder), at(out ?? '.')))
} else {
  console.error(
    'Say: pnpm connector check <connector folder>, or pnpm connector pack <connector folder> [where to put the pack]',
  )
  process.exit(1)
}
