// The world's shape, every version in the order it runs; `schema.ts` runs them.
// One version today: schema.sql, edited directly until the first client is installed. From that day
// a change is a numbered migration here, SQL or code, after it.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Db } from './db.ts'
import { numbers } from './shape/numbers.ts'

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

// What each connection's reads brought, by table ('files' for the files they kept), as schema.sql
// has it too.
export const READ_TOTALS = `
CREATE TABLE IF NOT EXISTS read_totals (
  connection_id TEXT NOT NULL,
  tbl TEXT NOT NULL,
  name TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  added INTEGER NOT NULL DEFAULT 0,
  changed INTEGER NOT NULL DEFAULT 0,
  same INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  left_out INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (connection_id, tbl)
) STRICT;
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
  // 4, 18 Nov 2026: what a connection's last read left out on the never-use list (rules N1); a
  // world made from schema.sql has it already
  (db) => {
    const cols = (
      db.prepare("SELECT name FROM pragma_table_info('connections')").all() as { name: string }[]
    ).map((c) => c.name)
    if (!cols.includes('left_out')) db.exec('ALTER TABLE connections ADD COLUMN left_out INTEGER')
  },
  // 5, 19 Nov 2026: the plugin whose kit a module is (rules P1); a world made from schema.sql has it
  // already
  (db) => {
    const cols = (
      db.prepare("SELECT name FROM pragma_table_info('kits')").all() as { name: string }[]
    ).map((c) => c.name)
    if (!cols.includes('plugin')) db.exec('ALTER TABLE kits ADD COLUMN plugin TEXT')
  },
  // 6, 19 Nov 2026: a card's help, what its ⓘ says (ui-rules R10); a world made from schema.sql
  // has it already
  (db) => {
    const cols = (
      db.prepare("SELECT name FROM pragma_table_info('cards')").all() as { name: string }[]
    ).map((c) => c.name)
    if (!cols.includes('help')) db.exec('ALTER TABLE cards ADD COLUMN help TEXT')
  },
  // 7, 22 Nov 2026: how a table's kit says it first opens (a calendar for Events); a world made
  // from schema.sql has it already
  (db) => {
    const cols = (
      db.prepare("SELECT name FROM pragma_table_info('tables')").all() as { name: string }[]
    ).map((c) => c.name)
    if (!cols.includes('start_view')) db.exec('ALTER TABLE tables ADD COLUMN start_view TEXT')
  },
  // 8, 22 Nov 2026: the grey values a person turned down (✕); a world made from schema.sql has it
  // already
  (db) => {
    db.exec(`CREATE TABLE IF NOT EXISTS turned_down (
  record_id TEXT NOT NULL REFERENCES records (id),
  field_id TEXT NOT NULL,
  value TEXT NOT NULL,
  at TEXT NOT NULL,
  PRIMARY KEY (record_id, field_id, value)
) STRICT`)
  },
  // 9, 22 Nov 2026: every module, table and row numbered (1.3.4), each from a counter that only
  // goes up (shape/numbers.ts)
  numbers,
  // 10, 22 Nov 2026: the module People and Organizations live in reads Network (its kit's title);
  // its lasting key stays People. A name the person gave it is theirs, and a Network already there
  // leaves it as it is.
  (db) => {
    db.exec(`UPDATE modules SET name = 'Network' WHERE key = 'People' AND name = 'People'
      AND NOT EXISTS (SELECT 1 FROM modules AS o WHERE o.id != modules.id
        AND (lower(o.name) = 'network' OR o.slug = 'network'))`)
  },
  // 11, 22 Nov 2026: Set up Alpha, each person's way through it (world/story.ts). Everyone already
  // in an Alpha that was live before it came is marked done, so no one is pushed into it.
  (db) => {
    db.exec(`CREATE TABLE IF NOT EXISTS story (
  user_id TEXT PRIMARY KEY REFERENCES users (id),
  chapters TEXT NOT NULL DEFAULT '{}',
  done_at TEXT,
  declined_at TEXT
) STRICT`)
    db.prepare('INSERT OR IGNORE INTO story (user_id, done_at) SELECT id, ? FROM users').run(
      new Date().toISOString(),
    )
  },
  // 12, 24 Nov 2026: what each connection's reads brought, kept as running totals by table
  // (connectors/tally.ts), and how many reads it had and how many failed; What Alpha read reads
  // them. Backfilled from the journal: the reads and failures each read's line names, and the rows
  // its landed lines added and changed; what a read met and left out before this was not counted.
  (db) => {
    db.exec(READ_TOTALS)
    const cols = (
      db.prepare("SELECT name FROM pragma_table_info('connections')").all() as { name: string }[]
    ).map((c) => c.name)
    if (!cols.includes('reads'))
      db.exec('ALTER TABLE connections ADD COLUMN reads INTEGER NOT NULL DEFAULT 0')
    if (!cols.includes('reads_failed'))
      db.exec('ALTER TABLE connections ADD COLUMN reads_failed INTEGER NOT NULL DEFAULT 0')
    db.exec(`UPDATE connections SET
      reads = (SELECT count(*) FROM journal WHERE kind = 'connection_read'
        AND json_extract(data, '$.connection') = connections.id),
      reads_failed = (SELECT count(*) FROM journal WHERE kind = 'connection_read'
        AND json_extract(data, '$.connection') = connections.id
        AND json_extract(data, '$.state') = 'failed')`)
    db.exec(`INSERT OR IGNORE INTO read_totals (connection_id, tbl, name, added, changed)
      SELECT c.id, json_extract(j.data, '$.table'), coalesce(t.name, 'A table'),
        sum(coalesce(json_extract(j.data, '$.added'), 0)),
        sum(coalesce(json_extract(j.data, '$.changed'), 0))
      FROM journal j
      JOIN connections c ON c.connector = json_extract(j.data, '$.connector')
        AND c.account = json_extract(j.data, '$.account')
      LEFT JOIN tables t ON t.id = json_extract(j.data, '$.table')
      WHERE j.kind = 'landed' AND json_extract(j.data, '$.table') IS NOT NULL
      GROUP BY c.id, json_extract(j.data, '$.table')`)
  },
]
