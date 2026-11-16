// The world's shape, every version in the order it runs; `schema.ts` runs them.
// One version today: schema.sql, edited directly until the first client is installed. From that day
// a change is a numbered migration here, SQL or code, after it.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Db } from './db.ts'

export const SCHEMA = readFileSync(join(import.meta.dirname, 'schema.sql'), 'utf8')

// A person's paired computers and the one-time links that pair them, as schema.sql has them too.
const COMPUTERS = `
CREATE TABLE IF NOT EXISTS computers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  public_key TEXT NOT NULL,
  paired_at TEXT NOT NULL,
  last_seen_at TEXT,
  removed_at TEXT
);
CREATE TABLE IF NOT EXISTS computer_links (
  code_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  made_at TEXT NOT NULL,
  until TEXT NOT NULL,
  used_at TEXT
);
`

export const MIGRATIONS: (string | ((db: Db) => void))[] = [
  SCHEMA,
  // 2, 15 Nov 2026: where a connection's sign-in went, as its provider names it (a QuickBooks
  // company); a world made from schema.sql has it already
  (db) => {
    const has = (
      db.prepare("SELECT name FROM pragma_table_info('connections')").all() as {
        name: string
      }[]
    ).some((c) => c.name === 'place')
    if (!has) db.exec('ALTER TABLE connections ADD COLUMN place TEXT')
  },
  // 3, 16 Nov 2026: a person's paired computers (the Bridge), their one-time pairing links, and
  // the computer a connection runs on; a world made from schema.sql has them already
  (db) => {
    const cols = (
      db.prepare("SELECT name FROM pragma_table_info('connections')").all() as { name: string }[]
    ).map((c) => c.name)
    if (!cols.includes('computer')) db.exec('ALTER TABLE connections ADD COLUMN computer TEXT')
    db.exec(COMPUTERS)
  },
]
