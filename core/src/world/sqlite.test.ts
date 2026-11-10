// What the world needs from Node's own SQLite, checked on every machine the
// tests run on: WAL, full-text search kept by triggers, an append-only journal, a backup that
// keeps the search index, a read-only connection, and an authorizer that closes a table.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { backup, constants, DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

let dir: string
let file: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'alpha-world-'))
  file = join(dir, 'world.sqlite')
  const db = new DatabaseSync(file)
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE journal (id INTEGER PRIMARY KEY, text TEXT NOT NULL);
    CREATE VIRTUAL TABLE journal_fts USING fts5(text, content = 'journal', content_rowid = 'id');
    CREATE TRIGGER journal_indexed AFTER INSERT ON journal
      BEGIN INSERT INTO journal_fts (rowid, text) VALUES (new.id, new.text); END;
    CREATE TRIGGER journal_kept BEFORE UPDATE ON journal
      BEGIN SELECT RAISE(ABORT, 'the journal is append-only'); END;
    CREATE TABLE secrets (k TEXT);
  `)
  db.prepare('INSERT INTO journal (text) VALUES (?)').run('logged two eggs for breakfast')
  db.close()
})

afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe("Node's SQLite", () => {
  it('keeps the world in WAL with full-text search', () => {
    const db = new DatabaseSync(file)
    expect(db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' })
    const hits = db.prepare("SELECT rowid FROM journal_fts WHERE journal_fts MATCH 'eggs'").all()
    expect(hits).toHaveLength(1)
    db.close()
  })

  it('refuses to change the journal', () => {
    const db = new DatabaseSync(file)
    expect(() => db.exec("UPDATE journal SET text = 'x'")).toThrow(/append-only/)
    db.close()
  })

  it('backs up with the search index', async () => {
    const db = new DatabaseSync(file)
    const copy = join(dir, 'copy.sqlite')
    await backup(db, copy)
    db.close()
    const restored = new DatabaseSync(copy)
    const hits = restored.prepare("SELECT rowid FROM journal_fts WHERE journal_fts MATCH 'eggs'")
    expect(hits.all()).toHaveLength(1)
    restored.close()
  })

  it('gives the model a read-only connection with closed tables', () => {
    const db = new DatabaseSync(file, { readOnly: true })
    db.setAuthorizer((action, table) =>
      action === constants.SQLITE_READ && table === 'secrets'
        ? constants.SQLITE_DENY
        : constants.SQLITE_OK,
    )
    expect(() => db.exec("INSERT INTO journal (text) VALUES ('x')")).toThrow(/readonly/)
    expect(() => db.prepare('SELECT k FROM secrets').all()).toThrow(/prohibited/)
    expect(db.prepare('SELECT count(*) AS n FROM journal').get()).toEqual({ n: 1 })
    db.close()
  })
})
