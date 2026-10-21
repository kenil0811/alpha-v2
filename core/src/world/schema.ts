// The world's schema as numbered migrations (design §3, §4). `PRAGMA user_version` says how many
// have run; a world that already holds data is backed up before the next one runs.
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { backup } from 'node:sqlite'
import { type Db, one } from './db.ts'

export const MIGRATIONS: string[] = [
  `
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  -- Append-only: every write of the world adds its line in the same transaction.
  CREATE TABLE journal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    actor_kind TEXT NOT NULL CHECK (actor_kind IN ('person', 'alpha', 'agent', 'connector', 'system')),
    actor_id TEXT,
    source TEXT,
    kind TEXT NOT NULL,
    words TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    user_id TEXT,
    turn_id TEXT,
    module_id TEXT,
    run_id TEXT,
    card_id TEXT
  );
  CREATE INDEX journal_user ON journal (user_id, id);
  CREATE INDEX journal_turn ON journal (turn_id, id);
  CREATE INDEX journal_module ON journal (module_id, id);
  CREATE VIRTUAL TABLE journal_fts USING fts5 (words, content = 'journal', content_rowid = 'id',
    tokenize = 'porter unicode61');
  CREATE TRIGGER journal_indexed AFTER INSERT ON journal
    BEGIN INSERT INTO journal_fts (rowid, words) VALUES (new.id, new.words); END;
  CREATE TRIGGER journal_unchanged BEFORE UPDATE ON journal
    BEGIN SELECT RAISE(ABORT, 'the journal is append-only'); END;
  CREATE TRIGGER journal_kept BEFORE DELETE ON journal
    BEGIN SELECT RAISE(ABORT, 'the journal is never deleted'); END;

  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
    created_at TEXT NOT NULL
  );

  CREATE TABLE modules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    kit TEXT,
    kit_version TEXT,
    made_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE tables (
    id TEXT PRIMARY KEY,
    module_id TEXT NOT NULL REFERENCES modules (id),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    made_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE fields (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL REFERENCES tables (id),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    kind TEXT NOT NULL,
    options TEXT NOT NULL DEFAULT '{}',
    position INTEGER NOT NULL,
    UNIQUE (table_id, slug)
  );

  -- A record keeps its values and each value's provenance, keyed by field id; what it was
  -- before each change is in record_versions.
  CREATE TABLE records (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL REFERENCES tables (id),
    version INTEGER NOT NULL,
    vals TEXT NOT NULL,
    provenance TEXT NOT NULL,
    made_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX records_table ON records (table_id, created_at);
  CREATE TABLE record_versions (
    record_id TEXT NOT NULL REFERENCES records (id),
    version INTEGER NOT NULL,
    vals TEXT NOT NULL,
    provenance TEXT NOT NULL,
    replaced_at TEXT NOT NULL,
    replaced_by TEXT NOT NULL,
    PRIMARY KEY (record_id, version)
  );
  CREATE VIRTUAL TABLE records_fts USING fts5 (record_id UNINDEXED, table_id UNINDEXED, words,
    tokenize = 'porter unicode61');

  -- Every question, permission and review is a row with one state.
  CREATE TABLE cards (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('permission', 'question', 'review', 'match', 'suggestion')),
    state TEXT NOT NULL CHECK (state IN ('waiting', 'yes', 'no', 'answered', 'withdrawn', 'allowed')),
    user_id TEXT,
    words TEXT NOT NULL,
    rests_on TEXT NOT NULL DEFAULT '[]',
    cannot_undo TEXT,
    options TEXT NOT NULL DEFAULT '[]',
    gate TEXT,
    call_key TEXT,
    call TEXT,
    answer TEXT,
    decided_by TEXT,
    decided_at TEXT,
    used_at TEXT,
    module_id TEXT,
    run_id TEXT,
    turn_id TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX cards_state ON cards (state, created_at);
  CREATE INDEX cards_call ON cards (call_key, state);

  CREATE TABLE files (
    hash TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    size INTEGER NOT NULL,
    mime TEXT NOT NULL,
    added_by TEXT NOT NULL,
    added_at TEXT NOT NULL
  );

  -- The same bytes are the same document.
  CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    file_hash TEXT NOT NULL UNIQUE REFERENCES files (hash),
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    module_id TEXT,
    made_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT NOT NULL REFERENCES documents (id),
    position TEXT NOT NULL,
    words TEXT NOT NULL
  );
  CREATE INDEX chunks_document ON chunks (document_id, id);
  CREATE VIRTUAL TABLE chunks_fts USING fts5 (words, content = 'chunks', content_rowid = 'id',
    tokenize = 'porter unicode61');
  CREATE TRIGGER chunks_indexed AFTER INSERT ON chunks
    BEGIN INSERT INTO chunks_fts (rowid, words) VALUES (new.id, new.words); END;
  CREATE TRIGGER chunks_gone AFTER DELETE ON chunks
    BEGIN INSERT INTO chunks_fts (chunks_fts, rowid, words) VALUES ('delete', old.id, old.words); END;

  -- One long-lived desk session per user (design §5).
  CREATE TABLE desk_sessions (
    user_id TEXT PRIMARY KEY REFERENCES users (id),
    session_id TEXT NOT NULL,
    tools TEXT NOT NULL,
    seen_journal_id INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL,
    last_turn_at TEXT
  );
  `,
  `
  -- A connection: one account of one connector. It points at its secret and never holds it.
  CREATE TABLE connections (
    id TEXT PRIMARY KEY,
    connector TEXT NOT NULL,
    account TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('connected', 'needs_sign_in', 'broken', 'paused')),
    health TEXT,
    secret_ref TEXT,
    cursor TEXT,
    last_sync_at TEXT,
    last_rows INTEGER,
    last_new_at TEXT,
    made_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (connector, account)
  );

  -- A row a connection lands keeps the item's own id, so the next sync changes it in place.
  ALTER TABLE records ADD COLUMN item_key TEXT;
  CREATE UNIQUE INDEX records_item ON records (table_id, item_key) WHERE item_key IS NOT NULL;

  -- What a card shows in full: the message to be sent, the rows to be filed.
  ALTER TABLE cards ADD COLUMN detail TEXT;
  `,
  `
  -- A table out of the sidebar: what a connection keeps is Alpha's working memory, hidden until
  -- the person shows it (Kenil, 19 Oct). The model reads it all the same.
  ALTER TABLE tables ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
  UPDATE tables SET hidden = 1 WHERE made_by LIKE 'connector:%';
  `,
  `
  -- A kit installed as a module: which kit, which version, from where (design §10).
  CREATE TABLE kits (
    module_id TEXT PRIMARY KEY REFERENCES modules (id),
    kit TEXT NOT NULL,
    version TEXT NOT NULL,
    source TEXT NOT NULL,
    installed_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  -- The ownership rule: each installed file's and setup row's hash as installed, so an update
  -- replaces what nobody changed and keeps what the person (or Alpha) changed.
  CREATE TABLE module_files (
    module_id TEXT NOT NULL REFERENCES modules (id),
    path TEXT NOT NULL,
    installed_hash TEXT NOT NULL,
    PRIMARY KEY (module_id, path)
  );
  CREATE TABLE kit_rows (
    record_id TEXT PRIMARY KEY REFERENCES records (id),
    installed_hash TEXT NOT NULL
  );

  -- Agents: the file in the module is the agent; this row is its state and its trigger as read.
  CREATE TABLE agents (
    id TEXT PRIMARY KEY,
    module_id TEXT NOT NULL REFERENCES modules (id),
    name TEXT NOT NULL,
    file TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('on', 'paused')),
    trigger TEXT NOT NULL,
    runs TEXT NOT NULL,
    cursor TEXT,
    last_run_at TEXT,
    UNIQUE (module_id, name)
  );
  -- A run serves its agent and reports to Activity (design §11).
  CREATE TABLE runs (
    id TEXT PRIMARY KEY,
    agent_id TEXT REFERENCES agents (id),
    module_id TEXT REFERENCES modules (id),
    started_at TEXT NOT NULL,
    ended_at TEXT,
    state TEXT NOT NULL CHECK (state IN ('running', 'ok', 'failed', 'stopped')),
    words TEXT,
    data TEXT NOT NULL DEFAULT '{}'
  );
  CREATE INDEX runs_agent ON runs (agent_id, started_at);
  `,
  // 5: a person's own preferences in the window (Appearance), kept by Alpha, not the browser.
  `
  CREATE TABLE preferences (
    user_id TEXT NOT NULL REFERENCES users (id),
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (user_id, key)
  );
  `,
  // 6: a table's saved views, shared by the firm; a kit's keep the kit's hash until changed.
  `
  CREATE TABLE views (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL REFERENCES tables (id),
    name TEXT NOT NULL,
    config TEXT NOT NULL DEFAULT '{}',
    is_default INTEGER NOT NULL DEFAULT 0,
    made_by TEXT NOT NULL CHECK (made_by IN ('person', 'alpha', 'kit')),
    kit_hash TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX views_name ON views (table_id, lower(name));
  `,
  // 7: a module inside another (Kenil, 20 Oct), and who put it there: a kit's place gives way to
  // the person's or Alpha's.
  `
  ALTER TABLE modules ADD COLUMN parent_id TEXT REFERENCES modules (id);
  ALTER TABLE modules ADD COLUMN placed_by TEXT CHECK (placed_by IN ('kit', 'person', 'alpha'));
  `,
  // 8: a file on a row (a deal's CIM, a client's export), with its kind and who put it there; and
  // the kinds of document a table's rows take, as its kit names them (Kenil, 20 Oct).
  `
  CREATE TABLE row_files (
    record_id TEXT NOT NULL REFERENCES records (id),
    file_hash TEXT NOT NULL REFERENCES files (hash),
    kind TEXT,
    placed_by TEXT NOT NULL,
    placed_at TEXT NOT NULL,
    PRIMARY KEY (record_id, file_hash)
  );
  CREATE INDEX row_files_file ON row_files (file_hash);
  ALTER TABLE tables ADD COLUMN documents TEXT;
  `,
  // 9: standing permissions (design §7): a yes given once for one agent's one kind of thing, shown
  // as a sentence, used and counted, revoked in Settings (Kenil, 20 Oct).
  `
  CREATE TABLE permissions (
    id TEXT PRIMARY KEY,
    sentence TEXT NOT NULL,
    action TEXT NOT NULL,
    agent TEXT,
    module_id TEXT,
    place TEXT NOT NULL,
    granted_by TEXT NOT NULL,
    granted_at TEXT NOT NULL,
    card_id TEXT,
    uses INTEGER NOT NULL DEFAULT 0,
    last_used_at TEXT,
    revoked_at TEXT,
    revoked_by TEXT
  );
  CREATE INDEX permissions_action ON permissions (action, revoked_at);
  `,
]

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
      db.exec(MIGRATIONS[v] as string)
      db.exec(`PRAGMA user_version = ${v + 1}`)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }
  return MIGRATIONS.length
}
