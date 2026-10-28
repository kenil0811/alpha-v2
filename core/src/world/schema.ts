// The world's schema as numbered migrations (design §3, §4). `PRAGMA user_version` says how many
// have run; a world that already holds data is backed up before the next one runs.
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { backup } from 'node:sqlite'
import { type Db, one } from './db.ts'
import { MIGRATIONS } from './migrations.ts'

export { MIGRATIONS }

// Bring a world up to the newest schema; back it up first when it already holds a schema.
export async function migrate(db: Db, file: string, backups: string): Promise<number> {
  const current = Number(
    one<{ user_version: number }>(db, 'PRAGMA user_version')?.user_version ?? 0,
  )
  // a world a newer Alpha made is never opened by an older one: its shape would be misread
  if (current > MIGRATIONS.length)
    throw new Error(
      `This world was made by a newer Alpha (its shape is version ${current}; this Alpha knows up to ${MIGRATIONS.length}). Install the newer Alpha again, or roll back its data too.`,
    )
  if (current >= MIGRATIONS.length) return current
  if (current > 0 && existsSync(file)) {
    mkdirSync(backups, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    await backup(db, join(backups, `world-${stamp}-v${current}.sqlite`))
  }
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN IMMEDIATE')
    try {
      const m = MIGRATIONS[v] as string | ((db: Db) => void)
      if (typeof m === 'string') db.exec(m)
      else m(db)
      db.exec(`PRAGMA user_version = ${v + 1}`)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }
  return MIGRATIONS.length
}
