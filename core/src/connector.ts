// Connectors from the command line: `pnpm connector check <folder>` says what is wrong with a
// connector folder before Alpha loads it (the SDK's check); `pnpm connector pack <folder> [out]`
// packs it into one .alphaconnector file (out defaults to the current folder), ready to send;
// `pnpm connector add <folder or pack>` adds one to the Alpha running on ALPHA_HOME, through the
// core's own route (Kenil's call 5, 7 Nov: the window offers none). A folder needs developer: true
// in that Alpha's alpha.yaml; a pack needs Kenil's signature, or the same.
import { readFileSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { checkFolder, pack } from './connectors/discover.ts'
import { readInstall } from './install.ts'

const [verb, folder, out] = process.argv.slice(2)
const at = (p: string) => resolve(process.env.INIT_CWD ?? process.cwd(), p)

async function add(path: string): Promise<void> {
  const home = process.env.ALPHA_HOME
  if (!home) throw new Error('Say which Alpha with ALPHA_HOME, the folder it keeps its data in.')
  const token = readFileSync(join(home, 'token'), 'utf8').trim()
  const base = `http://127.0.0.1:${readInstall(home).port}`
  const isFolder = statSync(path).isDirectory()
  const answer = await fetch(`${base}/api/connectors${isFolder ? '' : '/pack'}`, {
    method: 'POST',
    headers: isFolder
      ? { 'content-type': 'application/json', 'x-alpha-token': token }
      : {
          'content-type': 'application/octet-stream',
          'x-alpha-token': token,
          'x-file-name': encodeURIComponent(basename(path)),
        },
    body: isFolder ? JSON.stringify({ folder: path }) : readFileSync(path),
  })
  const said = (await answer.json().catch(() => ({}))) as { title?: string; problem?: string }
  if (!answer.ok) throw new Error(said.problem ?? `Alpha answered ${answer.status}.`)
  console.log(`Added ${said.title}. Connect it in Intelligence › Connections.`)
}

if (verb === 'check' && folder) {
  const problems = await checkFolder(at(folder))
  if (!problems.length) console.log('The connector is right.')
  else {
    for (const p of problems) console.log(`- ${p}`)
    process.exit(1)
  }
} else if (verb === 'pack' && folder) {
  console.log(await pack(at(folder), at(out ?? '.')))
} else if (verb === 'add' && folder) {
  await add(at(folder)).catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
} else {
  console.error(
    'Say: pnpm connector check <connector folder>, pnpm connector pack <connector folder> [where to], or pnpm connector add <connector folder or pack>.',
  )
  process.exit(1)
}
