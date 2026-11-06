// The world's schema, every migration in the order it runs (design §3, §4); `schema.ts` runs
// them. Kept apart so the list can grow without the runner around it.

import { chainJournal } from './audit.ts'
import type { Db } from './db.ts'
import { FIRST_SCHEMA } from './migrate1.ts'
import { addSeq, foldProvenance, toRealTables } from './migrate13.ts'
import { connectionStates } from './migrate29.ts'
import { lastingKeys } from './migrate30.ts'

// A migration is SQL, or code where the shape of the data decides the statements.
export const MIGRATIONS: (string | ((db: Db) => void))[] = [
  FIRST_SCHEMA, // 1: the first schema (migrate1.ts)
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
  // 10: people and companies (design §4), derived from the rows that name them and the person's
  // word. A merged one keeps its row, pointing at the one it joined, so Unmerge gives it back.
  `
  CREATE TABLE people (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('person', 'company')),
    name TEXT NOT NULL,
    rank INTEGER NOT NULL,
    merged_into TEXT REFERENCES people (id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX people_kind ON people (kind, merged_into);
  CREATE INDEX people_merged ON people (merged_into);
  -- A key is one person's or company's: the one whose row first gave it.
  CREATE TABLE people_keys (
    key TEXT NOT NULL CHECK (key IN ('email', 'phone', 'profile', 'domain', 'company')),
    value TEXT NOT NULL,
    person_id TEXT NOT NULL REFERENCES people (id),
    PRIMARY KEY (key, value)
  );
  CREATE INDEX people_keys_person ON people_keys (person_id);
  -- What each row said of someone (a contact card, a message's recipient), or the person's own
  -- word (record 'person'): removing the row takes away only what it alone brought.
  CREATE TABLE people_sources (
    person_id TEXT NOT NULL REFERENCES people (id),
    record_id TEXT NOT NULL,
    table_id TEXT,
    said TEXT NOT NULL,
    at TEXT NOT NULL,
    PRIMARY KEY (record_id, person_id)
  );
  CREATE INDEX people_sources_person ON people_sources (person_id);
  -- Someone at a company, as a row said, with their title; one that ends keeps its dates.
  CREATE TABLE people_links (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL REFERENCES people (id),
    company_id TEXT NOT NULL REFERENCES people (id),
    title TEXT,
    record_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT
  );
  CREATE INDEX people_links_person ON people_links (person_id, ended_at);
  CREATE INDEX people_links_company ON people_links (company_id, ended_at);
  CREATE INDEX people_links_record ON people_links (record_id);
  -- Two who may be one, for the person to decide; a decided pair is never proposed again.
  CREATE TABLE people_pairs (
    id TEXT PRIMARY KEY,
    a TEXT NOT NULL REFERENCES people (id),
    b TEXT NOT NULL REFERENCES people (id),
    why TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('found', 'proposed', 'merged', 'apart', 'withdrawn')),
    card_id TEXT,
    created_at TEXT NOT NULL,
    decided_at TEXT,
    UNIQUE (a, b)
  );
  CREATE INDEX people_pairs_state ON people_pairs (state, card_id);
  -- A message or meeting with someone, by the address it reached them at, so it counts for
  -- whoever holds that address, through merges and unmerges.
  CREATE TABLE exchanges (
    record_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    channel TEXT NOT NULL,
    at TEXT NOT NULL,
    started_by TEXT CHECK (started_by IN ('you', 'them')),
    PRIMARY KEY (record_id, key, value)
  );
  CREATE INDEX exchanges_key ON exchanges (key, value, at);
  -- How a table's rows name people: a row that is a person, or an exchange with people.
  ALTER TABLE tables ADD COLUMN people TEXT;
  `,
  // 11: tasks (Kenil's plan, 21 Oct): one list of all work, each on the place it concerns.
  `
  CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('todo', 'doing', 'waiting', 'done', 'dropped')),
    notes TEXT,
    due TEXT,
    remind_at TEXT,
    reminded_at TEXT,
    repeat TEXT,
    repeat_rule TEXT,
    repeat_next TEXT,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
    owner_kind TEXT NOT NULL DEFAULT 'person' CHECK (owner_kind IN ('person', 'alpha', 'agent')),
    owner_id TEXT,
    parent_id TEXT REFERENCES tasks (id),
    module_id TEXT,
    table_id TEXT,
    record_id TEXT,
    field_id TEXT,
    page TEXT,
    placed_by TEXT,
    placed_why TEXT,
    made_by TEXT NOT NULL,
    run_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    done_at TEXT
  );
  CREATE INDEX tasks_state ON tasks (state, due);
  CREATE INDEX tasks_place ON tasks (module_id, table_id, record_id);
  CREATE INDEX tasks_parent ON tasks (parent_id);
  -- What else a task touches: rows, people, files.
  CREATE TABLE task_refs (
    task_id TEXT NOT NULL REFERENCES tasks (id),
    kind TEXT NOT NULL CHECK (kind IN ('row', 'person', 'file')),
    ref TEXT NOT NULL,
    PRIMARY KEY (task_id, kind, ref)
  );
  CREATE INDEX task_refs_ref ON task_refs (kind, ref);
  -- A run serves the task it works on.
  ALTER TABLE runs ADD COLUMN task_id TEXT;
  `,
  // 12: agents on tasks: an agent that takes the tasks given to it (on call, it may have no
  // trigger), and the runs serving a task found by it.
  `
  ALTER TABLE agents ADD COLUMN tasks INTEGER NOT NULL DEFAULT 0;
  CREATE INDEX runs_task ON runs (task_id, started_at);
  `,
  // 13: real tables (Kenil, 22 Oct): a SQLite table per kit table, provenance and versions
  // beside them, records as the registry; see migrate13.ts and ddl.ts.
  toRealTables,
  // 14: a row's number that never changes, its full-text entry under it (migrate13.ts).
  addSeq,
  // 15: one provenance per row where every value came the same way (migrate13.ts).
  foldProvenance,
  // 16: the contracts (Stage 1, step 2): the kit API a kit was written for and who keeps it; an
  // agent's one-line description.
  `
  ALTER TABLE kits ADD COLUMN api INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE kits ADD COLUMN maintainer TEXT;
  ALTER TABLE agents ADD COLUMN description TEXT;
  `,
  // 17: stable keys and tombstones (decision 3): a kit field's key, a field a kit no longer uses
  // (hidden, its rows kept), what the person removed so an update does not bring it back, and
  // the changes of theirs a maintained kit's maintainer has not seen (decision 3b).
  `
  ALTER TABLE fields ADD COLUMN key TEXT;
  ALTER TABLE fields ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
  CREATE TABLE tombstones (
    module_id TEXT NOT NULL REFERENCES modules (id),
    kind TEXT NOT NULL CHECK (kind IN ('field', 'table', 'row', 'view')),
    key TEXT NOT NULL,
    removed_at TEXT NOT NULL,
    removed_by TEXT NOT NULL,
    PRIMARY KEY (module_id, kind, key)
  );
  CREATE TABLE kit_changes (
    id TEXT PRIMARY KEY,
    module_id TEXT NOT NULL REFERENCES modules (id),
    words TEXT NOT NULL,
    call TEXT,
    at TEXT NOT NULL,
    by TEXT NOT NULL,
    seen_at TEXT
  );
  `,
  // 18: the messages of a desk session on Alpha's own loop (decision 11), kept so the session
  // resumes with them; a route that keeps its own session (Claude Code) writes none.
  `
  CREATE TABLE desk_messages (
    id INTEGER PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id),
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    at TEXT NOT NULL
  );
  CREATE INDEX idx_desk_messages_user ON desk_messages (user_id, id);
  `,
  // 19: the semantic layer (Kenil, 24 Oct): one sentence on what a table, a field and a view
  // mean, and whose sentence it is (the kit's, Alpha's, or the person's, which stands).
  `
  ALTER TABLE tables ADD COLUMN about TEXT;
  ALTER TABLE tables ADD COLUMN about_by TEXT CHECK (about_by IN ('kit', 'alpha', 'person'));
  ALTER TABLE fields ADD COLUMN about TEXT;
  ALTER TABLE fields ADD COLUMN about_by TEXT CHECK (about_by IN ('kit', 'alpha', 'person'));
  ALTER TABLE views ADD COLUMN about TEXT;
  `,
  // 20: a one-time yes that was not used in time lapses (item 39 of the problems list, 25 Oct).
  `
  ALTER TABLE cards ADD COLUMN lapsed_at TEXT;
  `,
  // 21: undo (core step 1, 26 Oct): a removed row's whole state, kept for keep_removed_days so it
  // can come back whole; each version the journal line that replaced it and what that line
  // wrote, so a turn's or a run's changes can be put back; and the last line before, since
  // nothing older can be.
  `
  CREATE TABLE removed_rows (
    record_id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL,
    line_id INTEGER NOT NULL,
    removed_at TEXT NOT NULL,
    state TEXT NOT NULL
  );
  CREATE INDEX removed_rows_line ON removed_rows (line_id);
  CREATE INDEX removed_rows_table ON removed_rows (table_id);
  ALTER TABLE versions ADD COLUMN line_id INTEGER;
  ALTER TABLE versions ADD COLUMN wrote TEXT;
  CREATE INDEX versions_line ON versions (line_id);
  INSERT OR REPLACE INTO meta (key, value) SELECT 'undo_since', coalesce(max(id), 0) FROM journal;
  `,
  // 22: rules (core step 2, 27 Oct): one store of allows and denies, approved by the person or
  // inferred by Alpha, each scoped to all of Alpha, a module or an agent, with what it covers in
  // parts code matches against a call. Standing permissions move in as approved allow rules.
  `
  CREATE TABLE rules (
    id TEXT PRIMARY KEY,
    words TEXT NOT NULL,
    said TEXT,
    side TEXT NOT NULL CHECK (side IN ('allow', 'deny')),
    kind TEXT NOT NULL CHECK (kind IN ('approved', 'inferred')),
    module_id TEXT,
    agent TEXT,
    covers TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT '{}',
    made_by TEXT NOT NULL,
    made_at TEXT NOT NULL,
    uses INTEGER NOT NULL DEFAULT 0,
    last_used_at TEXT,
    revoked_at TEXT,
    revoked_by TEXT
  );
  CREATE INDEX rules_live ON rules (revoked_at, side);
  INSERT INTO rules (id, words, side, kind, module_id, agent, covers, source, made_by, made_at,
    uses, last_used_at, revoked_at, revoked_by)
    SELECT id, sentence, 'allow', 'approved', module_id, agent,
      json_object('does', json_array(CASE WHEN action = 'send_email' THEN 'send' ELSE 'change' END),
        'always', json_object('action', action, 'place', json(place))),
      json_object('card', card_id), granted_by, granted_at, uses, last_used_at, revoked_at,
      revoked_by
    FROM permissions;
  DROP TABLE permissions;
  `,
  // 23: a table can be setup (core step 3a, 27 Oct): what a module's agents read, shown under
  // Agents and notes, not as a tab. A relation that is part of its row says so in its options.
  `
  ALTER TABLE tables ADD COLUMN setup INTEGER NOT NULL DEFAULT 0;
  `,
  // 24: a table kept as a tab of its module wherever it sits (28 Oct): the person's choice or its
  // kit's; its rows stay where they are
  `
  ALTER TABLE tables ADD COLUMN tab INTEGER NOT NULL DEFAULT 0;
  `,
  // 25: what each use of the model spent (core plan step 5, 28 Oct), a row per model per use:
  // a desk turn's share, an agent's run's ask, a small ask; counted from the day it shipped
  `
  CREATE TABLE spend (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('turn', 'run', 'ask')),
    turn TEXT,
    run TEXT,
    module_id TEXT,
    agent TEXT,
    model TEXT NOT NULL,
    input INTEGER NOT NULL DEFAULT 0,
    output INTEGER NOT NULL DEFAULT 0,
    cache_read INTEGER NOT NULL DEFAULT 0,
    cache_write INTEGER NOT NULL DEFAULT 0,
    usd REAL,
    how TEXT NOT NULL CHECK (how IN ('reported', 'priced', 'unpriced'))
  );
  CREATE INDEX spend_at ON spend (at);
  CREATE INDEX spend_turn ON spend (turn);
  `,
  // 26: the hosts the person approved for a connection beyond what its connector names (step 2,
  // part 1, slice 2, 29 Oct), a JSON list
  `
  ALTER TABLE connections ADD COLUMN hosts TEXT NOT NULL DEFAULT '[]';
  `,
  // 27: a table Alpha adds to only once the person has answered this word on a card (its kit's
  // `added_on`, 29 Oct): DealPilot's sources, after their page is read and shown
  `
  ALTER TABLE tables ADD COLUMN added_on TEXT;
  `,
  chainJournal, // 28: the audit journal (step 2, part 3): every line chained to the one before

  connectionStates, // 29: a connection waiting for the customer (step 2, part 4; migrate29.ts)
  lastingKeys, // 30: a lasting key on the tables and modules kits and connectors make (migrate30.ts)
  // 31: what a connection never counts (onboarding step 3): the sites, folders and words the person
  // left out, a JSON list
  `
  ALTER TABLE connections ADD COLUMN never TEXT NOT NULL DEFAULT '[]';
  `,
  // 32: a table a connection fills is a mirror of the system that keeps its record (rules D1); a
  // row a read met says when (D12), and one the source deleted is kept, gone (D8)
  `
  ALTER TABLE tables ADD COLUMN mirror TEXT;
  ALTER TABLE records ADD COLUMN read_at TEXT;
  ALTER TABLE records ADD COLUMN gone_at TEXT;
  `,
  // 33: who manages a kit's module, when it is managed: Alpha, or Kenil for a signed pack (rules M1)
  `
  ALTER TABLE kits ADD COLUMN managed TEXT;
  `,
]
