// Migration 29 (step 2, part 4, 30 Oct): a connection waiting for the customer is a state of its
// own, and SQLite grows a CHECK only by making the table again: the same columns, every row
// carried over, the unique pair kept.
import type { Db } from './db.ts'

export function connectionStates(db: Db): void {
  db.exec(`
  CREATE TABLE connections_new (
    id TEXT PRIMARY KEY,
    connector TEXT NOT NULL,
    account TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('connected', 'needs_sign_in', 'broken', 'paused', 'waiting')),
    health TEXT,
    secret_ref TEXT,
    cursor TEXT,
    last_sync_at TEXT,
    last_rows INTEGER,
    last_new_at TEXT,
    made_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    hosts TEXT NOT NULL DEFAULT '[]',
    UNIQUE (connector, account)
  );
  INSERT INTO connections_new SELECT id, connector, account, state, health, secret_ref, cursor,
    last_sync_at, last_rows, last_new_at, made_by, created_at, hosts FROM connections;
  DROP TABLE connections;
  ALTER TABLE connections_new RENAME TO connections;
  `)
}
