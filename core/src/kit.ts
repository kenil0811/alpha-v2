// Kits from the command line: `pnpm kit pack <folder> [out]` packs a kit's folder into one file
// (out defaults to the current folder), ready to send or to drop in a Mac's kits/inbox.
import { resolve } from 'node:path'
import { pack } from './modules/packs.ts'

const [verb, folder, out] = process.argv.slice(2)
if (verb !== 'pack' || !folder) {
  console.error('Say: pnpm kit pack <kit folder> [where to put the pack]')
  process.exit(1)
}
console.log(
  pack(
    resolve(process.env.INIT_CWD ?? process.cwd(), folder),
    resolve(process.env.INIT_CWD ?? process.cwd(), out ?? '.'),
  ),
)
