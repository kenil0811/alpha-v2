// What the `alpha` command asks of the core's own code, with the core stopped or running: a backup of every world by SQLite's backup API, a restore from one (the core
// stopped), and a report to send Kenil with versions, health and shapes, never rows.
//   node core/src/cli.ts backup <dir> | restore <dir> | report <file>
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { arch, release } from 'node:os'
import { join } from 'node:path'
import { backup, DatabaseSync } from 'node:sqlite'
import { readInstall } from './install.ts'

const home = process.env.ALPHA_HOME
if (!home) {
  console.error('ALPHA_HOME is not set.')
  process.exit(1)
}
const install = readInstall(home)
const tenants = join(home, 'tenants')
const worlds = existsSync(tenants)
  ? readdirSync(tenants).filter((t) => existsSync(join(tenants, t, 'world.sqlite')))
  : []
const [verb, where] = process.argv.slice(2)

if (verb === 'backup' && where) {
  mkdirSync(where, { recursive: true })
  for (const t of worlds) {
    const db = new DatabaseSync(join(tenants, t, 'world.sqlite'), { readOnly: true })
    await backup(db, join(where, `${t}.sqlite`))
    db.close()
  }
  console.log(`Backed up ${worlds.length} world${worlds.length === 1 ? '' : 's'} to ${where}`)
} else if (verb === 'restore' && where) {
  // a world put back from a backup, by the backup API too, never by copying the file
  for (const n of readdirSync(where).filter((x) => x.endsWith('.sqlite'))) {
    const t = n.replace(/\.sqlite$/, '')
    mkdirSync(join(tenants, t), { recursive: true })
    const from = new DatabaseSync(join(where, n), { readOnly: true })
    await backup(from, join(tenants, t, 'world.sqlite'))
    from.close()
    console.log(`Put back the world ${t} from ${join(where, n)}`)
  }
} else if (verb === 'report' && where) {
  const lines: string[] = []
  const say = (s: string) => lines.push(s)
  if (install.reportTo) say(`For ${install.reportTo}`)
  const app = join(import.meta.dirname, '..', '..')
  say(
    `Alpha ${existsSync(join(app, 'VERSION')) ? readFileSync(join(app, 'VERSION'), 'utf8').trim() : 'from a repository'}`,
  )
  say(
    `macOS ${execFileSync('sw_vers', ['-productVersion']).toString().trim()} (Darwin ${release()}, ${arch()})`,
  )
  say(`Node ${process.version}`)
  for (const t of worlds) {
    const db = new DatabaseSync(join(tenants, t, 'world.sqlite'), { readOnly: true })
    const v = db.prepare('PRAGMA user_version').get() as { user_version: number }
    say(
      `\nWorld ${t}: shape version ${v.user_version}, ${(statSync(join(tenants, t, 'world.sqlite')).size / 1e6).toFixed(1)} MB`,
    )
    for (const m of db.prepare('SELECT name, kit, kit_version FROM modules').all() as {
      name: string
      kit: string | null
      kit_version: string | null
    }[])
      say(`  module ${m.name}${m.kit ? ` (kit ${m.kit} ${m.kit_version ?? ''})` : ''}`)
    for (const r of db
      .prepare(
        'SELECT t.name AS name, count(r.id) AS n FROM tables t LEFT JOIN records r ON r.table_id = t.id GROUP BY t.id',
      )
      .all() as { name: string; n: number }[])
      say(`  table ${r.name}: ${r.n} rows`)
    for (const k of db
      .prepare('SELECT connector, state, health, last_sync_at FROM connections')
      .all() as {
      connector: string
      state: string
      health: string | null
      last_sync_at: string | null
    }[])
      say(
        `  connection ${k.connector}: ${k.state}${k.health ? `, ${k.health}` : ''}, last read ${k.last_sync_at ?? 'never'}`,
      )
    for (const a of db.prepare('SELECT name, state, last_run_at FROM schedules').all() as {
      name: string
      state: string
      last_run_at: string | null
    }[])
      say(`  schedule ${a.name}: ${a.state}, last ran ${a.last_run_at ?? 'never'}`)
    for (const e of db
      .prepare("SELECT at, words FROM journal WHERE kind = 'error' ORDER BY id DESC LIMIT 20")
      .all() as { at: string; words: string }[])
      say(`  error ${e.at}: ${e.words.slice(0, 200)}`)
    db.close()
  }
  const log = join(install.logs ?? '', 'core.log')
  if (install.logs && existsSync(log)) {
    say('\nThe log, its last 150 lines:')
    say(readFileSync(log, 'utf8').split('\n').slice(-150).join('\n'))
  }
  writeFileSync(where, `${lines.join('\n')}\n`)
  console.log(where)
} else {
  console.error('Say: backup <dir> | restore <dir> | report <file>')
  process.exit(1)
}
