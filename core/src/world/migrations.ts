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
  // 6, 20 Nov 2026: People keeps its own source table, the Address book, and Contacts goes (Vikas,
  // 19 and 20 Nov). The shared Contacts table of the module People lives in (or of the module a
  // connector made for it before People) is renamed in place: same id, rows, versions, lasting
  // key's rows and what people_sources says of them, so every person, link and history is
  // unchanged. Its lasting key, name, folder and kit view follow; a world without it is left as it is.
  (db) => {
    const one = (sql: string, ...a: string[]) =>
      db.prepare(sql).get(...a) as Record<string, string> | undefined
    const was = db
      .prepare(
        `SELECT t.id, t.slug FROM tables t JOIN modules m ON m.id = t.module_id
         WHERE t.key = 'Contacts' AND m.key IN ('People', 'Contacts')`,
      )
      .all() as { id: string; slug: string }[]
    for (const t of was) {
      // one already there (a connector made it again) is left: nothing is merged by guesswork
      if (
        one(
          "SELECT 1 AS x FROM tables WHERE key = 'Address book' AND module_id = (SELECT module_id FROM tables WHERE id = ?)",
          t.id,
        )
      )
        continue
      let slug = 'address_book'
      for (
        let n = 2;
        one('SELECT 1 AS x FROM tables WHERE slug = ?', slug) ||
        one('SELECT 1 AS x FROM sqlite_master WHERE name = ?', slug);
        n++
      )
        slug = `address_book_${n}`
      db.exec(`ALTER TABLE "${t.slug.replace(/"/g, '""')}" RENAME TO "${slug}"`)
      db.prepare(
        "UPDATE tables SET name = 'Address book', key = 'Address book', slug = ? WHERE id = ?",
      ).run(slug, t.id)
      db.prepare(
        "UPDATE views SET name = 'Everyone' WHERE table_id = ? AND lower(name) = 'all contacts' AND NOT EXISTS (SELECT 1 FROM views v WHERE v.table_id = ? AND lower(v.name) = 'everyone')",
      ).run(t.id, t.id)
    }
  },
]
