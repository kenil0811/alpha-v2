-- The world's shape, version 1. Until the first client is installed, a change to the shape edits
-- this file; numbered migrations start the day one goes live. A table of a module's is not here:
-- each is made by ddl.ts.

-- ---- The world's own record ----

-- What the world keeps about itself, by key.
CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Everything that happened, one line each, append-only and chained by hash.
CREATE TABLE journal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('person', 'alpha', 'schedule', 'connector', 'system')),
  actor_id TEXT,
  source TEXT,
  kind TEXT NOT NULL,
  words TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  user_id TEXT,
  turn_id TEXT,
  module_id TEXT,
  run_id TEXT,
  card_id TEXT,
  agent_id TEXT,
  hash TEXT
);
CREATE INDEX journal_user ON journal (user_id, id);
CREATE INDEX journal_turn ON journal (turn_id, id);
CREATE INDEX journal_module ON journal (module_id, id);
CREATE INDEX journal_agent ON journal (agent_id, user_id, id);
CREATE TRIGGER journal_indexed AFTER INSERT ON journal BEGIN INSERT INTO journal_fts (rowid, words) VALUES (new.id, new.words); END;
CREATE TRIGGER journal_kept BEFORE DELETE ON journal BEGIN SELECT RAISE(ABORT, 'the journal is never deleted'); END;
CREATE TRIGGER journal_unchanged BEFORE UPDATE ON journal BEGIN SELECT RAISE(ABORT, 'the journal is append-only'); END;

-- The journal searched by its words.
CREATE VIRTUAL TABLE journal_fts USING fts5 (words, content = 'journal', content_rowid = 'id', tokenize = 'porter unicode61');

-- The people of this Alpha.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  created_at TEXT NOT NULL
);

-- How a person signs in, on an Alpha that asks: their email and password, or a link to set one.
CREATE TABLE accounts (
  user_id TEXT PRIMARY KEY REFERENCES users (id),
  email TEXT UNIQUE COLLATE NOCASE,
  password TEXT,
  link_hash TEXT,
  link_until TEXT,
  failed INTEGER NOT NULL DEFAULT 0,
  wait_until TEXT,
  last_in TEXT,
  gone_at TEXT
);

-- A browser that is signed in, by the hash of its cookie.
CREATE TABLE sessions (
  hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  created_at TEXT NOT NULL,
  until TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);

-- A person's own settings in the window.
CREATE TABLE preferences (
  user_id TEXT NOT NULL REFERENCES users (id),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);

-- ---- Modules, tables and fields ----

-- A module, its place in another, and who made it.
CREATE TABLE modules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  kit TEXT,
  kit_version TEXT,
  made_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  parent_id TEXT REFERENCES modules (id),
  placed_by TEXT CHECK (placed_by IN ('kit', 'person', 'alpha')),
  key TEXT COLLATE NOCASE
);
CREATE UNIQUE INDEX modules_key ON modules (key) WHERE key IS NOT NULL;

-- A table's registry row; its rows live in a real table of its own (ddl.ts).
CREATE TABLE tables (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL REFERENCES modules (id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  made_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0,
  documents TEXT,
  people TEXT,
  about TEXT,
  about_by TEXT CHECK (about_by IN ('kit', 'alpha', 'person')),
  setup INTEGER NOT NULL DEFAULT 0,
  tab INTEGER NOT NULL DEFAULT 0,
  added_on TEXT,
  key TEXT COLLATE NOCASE,
  mirror TEXT
);
CREATE UNIQUE INDEX tables_key ON tables (module_id, key) WHERE key IS NOT NULL;

-- A field of a table, with its lasting key and what it means.
CREATE TABLE fields (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL REFERENCES tables (id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  kind TEXT NOT NULL,
  options TEXT NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL,
  key TEXT,
  hidden INTEGER NOT NULL DEFAULT 0,
  about TEXT,
  about_by TEXT CHECK (about_by IN ('kit', 'alpha', 'person')),
  UNIQUE (table_id, slug)
);

-- A table's saved lists, shared by the firm.
CREATE TABLE views (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL REFERENCES tables (id),
  name TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  is_default INTEGER NOT NULL DEFAULT 0,
  made_by TEXT NOT NULL CHECK (made_by IN ('person', 'alpha', 'kit')),
  kit_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  about TEXT
);
CREATE UNIQUE INDEX views_name ON views (table_id, lower(name));

-- What a person removed from a kit, so an update never brings it back.
CREATE TABLE tombstones (
  module_id TEXT NOT NULL REFERENCES modules (id),
  kind TEXT NOT NULL CHECK (kind IN ('field', 'table', 'row', 'view')),
  key TEXT NOT NULL,
  removed_at TEXT NOT NULL,
  removed_by TEXT NOT NULL,
  PRIMARY KEY (module_id, kind, key)
);

-- ---- Rows ----

-- Every row of every table, by id; its number never changes.
CREATE TABLE records (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL REFERENCES tables (id),
  created_at TEXT NOT NULL,
  seq INTEGER,
  read_at TEXT,
  gone_at TEXT
);
CREATE INDEX records_table ON records (table_id, created_at);
CREATE UNIQUE INDEX records_seq ON records (seq);

-- A row's earlier values, each with the journal line that replaced it.
CREATE TABLE versions (
  record_id TEXT NOT NULL REFERENCES records (id),
  version INTEGER NOT NULL,
  vals TEXT NOT NULL,
  provenance TEXT NOT NULL,
  replaced_at TEXT NOT NULL,
  replaced_by TEXT NOT NULL,
  line_id INTEGER,
  wrote TEXT,
  PRIMARY KEY (record_id, version)
);
CREATE INDEX versions_line ON versions (line_id);

-- Where each value came from, and any newer value kept beside it.
CREATE TABLE provenance (
  record_id TEXT NOT NULL REFERENCES records (id),
  field_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  source TEXT NOT NULL,
  basis TEXT,
  at TEXT NOT NULL,
  beside TEXT,
  PRIMARY KEY (record_id, field_id)
) STRICT;

-- Rows searched by their words.
CREATE VIRTUAL TABLE records_fts USING fts5 (record_id UNINDEXED, table_id UNINDEXED, words, tokenize = 'porter unicode61');

-- A removed row's whole state, kept so Bring back can return it.
CREATE TABLE removed_rows (
  record_id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL,
  line_id INTEGER NOT NULL,
  removed_at TEXT NOT NULL,
  state TEXT NOT NULL
);
CREATE INDEX removed_rows_line ON removed_rows (line_id);
CREATE INDEX removed_rows_table ON removed_rows (table_id);

-- A file on a row, with its kind.
CREATE TABLE row_files (
  record_id TEXT NOT NULL REFERENCES records (id),
  file_hash TEXT NOT NULL REFERENCES files (hash),
  kind TEXT,
  placed_by TEXT NOT NULL,
  placed_at TEXT NOT NULL,
  PRIMARY KEY (record_id, file_hash)
);
CREATE INDEX row_files_file ON row_files (file_hash);

-- ---- Files and documents ----

-- A file by its hash.
CREATE TABLE files (
  hash TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime TEXT NOT NULL,
  added_by TEXT NOT NULL,
  added_at TEXT NOT NULL
);

-- A file read into text.
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  file_hash TEXT NOT NULL UNIQUE REFERENCES files (hash),
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  module_id TEXT,
  made_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- A document's text in pieces, each knowing where on the page it came from.
CREATE TABLE chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT NOT NULL REFERENCES documents (id),
  position TEXT NOT NULL,
  words TEXT NOT NULL
);
CREATE INDEX chunks_document ON chunks (document_id, id);
CREATE TRIGGER chunks_indexed AFTER INSERT ON chunks BEGIN INSERT INTO chunks_fts (rowid, words) VALUES (new.id, new.words); END;
CREATE TRIGGER chunks_gone AFTER DELETE ON chunks BEGIN INSERT INTO chunks_fts (chunks_fts, rowid, words) VALUES ('delete', old.id, old.words); END;

-- The pieces searched by their words.
CREATE VIRTUAL TABLE chunks_fts USING fts5 (words, content = 'chunks', content_rowid = 'id', tokenize = 'porter unicode61');

-- ---- Asking the person ----

-- What waits for the person: a gate, a question, a draft, a review.
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
  created_at TEXT NOT NULL,
  detail TEXT,
  lapsed_at TEXT,
  agent_id TEXT
);
CREATE INDEX cards_state ON cards (state, created_at);
CREATE INDEX cards_call ON cards (call_key, state);

-- What Alpha may and may not do: approved by the person, or noticed and awaiting them.
CREATE TABLE rules (
  id TEXT PRIMARY KEY,
  words TEXT NOT NULL,
  said TEXT,
  side TEXT NOT NULL CHECK (side IN ('allow', 'deny')),
  kind TEXT NOT NULL CHECK (kind IN ('approved', 'inferred')),
  module_id TEXT,
  schedule TEXT,
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

-- ---- The model ----

-- Each person's session with each agent (the Chief of staff is 'chief').
CREATE TABLE desk_sessions (
  user_id TEXT NOT NULL REFERENCES users (id),
  agent_id TEXT NOT NULL DEFAULT 'chief',
  session_id TEXT NOT NULL,
  tools TEXT NOT NULL,
  seen_journal_id INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  last_turn_at TEXT,
  PRIMARY KEY (user_id, agent_id)
);

-- An agent: its name, its job, when to use it, and its model. Its instructions and skills are
-- files in its folder. Reach is empty for now: every agent reaches what the Chief of staff does.
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  model TEXT,
  reach TEXT,
  made_by TEXT,
  -- where it shipped from: 'alpha' for Alpha's own, a kit's module id; none when made here
  source TEXT,
  -- its lasting name in its source, so an update finds it whatever it is called here
  key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX agents_shipped ON agents (source, key) WHERE key IS NOT NULL;

-- What an agent remembers: short facts, the firm's (no person) or one person's.
CREATE TABLE agent_memories (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  user_id TEXT,
  text TEXT NOT NULL,
  normalized TEXT NOT NULL,
  essential INTEGER NOT NULL DEFAULT 0,
  origin TEXT NOT NULL CHECK (origin IN ('agent', 'person')),
  said_by TEXT,
  turn_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX agent_memories_one ON agent_memories (agent_id, COALESCE(user_id, ''), normalized);
CREATE VIRTUAL TABLE agent_memories_fts USING fts5 (text, content = 'agent_memories', content_rowid = 'rowid', tokenize = 'porter unicode61');
CREATE TRIGGER agent_memories_indexed AFTER INSERT ON agent_memories BEGIN INSERT INTO agent_memories_fts (rowid, text) VALUES (new.rowid, new.text); END;
CREATE TRIGGER agent_memories_gone AFTER DELETE ON agent_memories BEGIN INSERT INTO agent_memories_fts (agent_memories_fts, rowid, text) VALUES ('delete', old.rowid, old.text); END;
CREATE TRIGGER agent_memories_changed AFTER UPDATE OF text ON agent_memories BEGIN INSERT INTO agent_memories_fts (agent_memories_fts, rowid, text) VALUES ('delete', old.rowid, old.text); INSERT INTO agent_memories_fts (rowid, text) VALUES (new.rowid, new.text); END;

-- One agent asking another: a saved row, delivered once.
CREATE TABLE agent_asks (
  id TEXT PRIMARY KEY,
  root TEXT NOT NULL,
  user_id TEXT NOT NULL,
  from_agent TEXT NOT NULL,
  from_turn TEXT NOT NULL,
  parent TEXT,
  to_agent TEXT NOT NULL,
  hop INTEGER NOT NULL,
  key TEXT NOT NULL UNIQUE,
  brief TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('queued', 'running', 'answered', 'failed', 'stopped', 'unknown')),
  answer TEXT,
  reported INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  settled_at TEXT
);
CREATE INDEX agent_asks_root ON agent_asks (root);
CREATE INDEX agent_asks_turn ON agent_asks (from_turn);

-- How many asks one request may make, once a person has said Continue.
CREATE TABLE agent_ask_roots (
  root TEXT PRIMARY KEY,
  allowed INTEGER NOT NULL
);

-- What each use of the model spent.
CREATE TABLE spend (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('turn', 'run', 'ask')),
  turn TEXT,
  run TEXT,
  module_id TEXT,
  schedule TEXT,
  model TEXT NOT NULL,
  input INTEGER NOT NULL DEFAULT 0,
  output INTEGER NOT NULL DEFAULT 0,
  cache_read INTEGER NOT NULL DEFAULT 0,
  cache_write INTEGER NOT NULL DEFAULT 0,
  usd REAL,
  how TEXT NOT NULL CHECK (how IN ('reported', 'unpriced')),
  agent TEXT
);
CREATE INDEX spend_at ON spend (at);
CREATE INDEX spend_turn ON spend (turn);

-- ---- Kits and schedules ----

-- The kit a module came from, who keeps it, and who manages it.
CREATE TABLE kits (
  module_id TEXT PRIMARY KEY REFERENCES modules (id),
  kit TEXT NOT NULL,
  version TEXT NOT NULL,
  source TEXT NOT NULL,
  installed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  api INTEGER NOT NULL DEFAULT 1,
  maintainer TEXT,
  managed TEXT
);

-- A kit's file as it was installed, by hash.
CREATE TABLE module_files (
  module_id TEXT NOT NULL REFERENCES modules (id),
  path TEXT NOT NULL,
  installed_hash TEXT NOT NULL,
  PRIMARY KEY (module_id, path)
);

-- A row a kit shipped, as it was installed.
CREATE TABLE kit_rows (
  record_id TEXT PRIMARY KEY REFERENCES records (id),
  installed_hash TEXT NOT NULL
);

-- A change to a maintained kit's module, for its maintainer.
CREATE TABLE kit_changes (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL REFERENCES modules (id),
  words TEXT NOT NULL,
  call TEXT,
  at TEXT NOT NULL,
  by TEXT NOT NULL,
  seen_at TEXT
);

-- A schedule as its file says, and whether it is on. The file sits in a module or in an agent's
-- folder. agent is who it wakes, none for a module's script alone; made_by is who asked for an
-- agent's own, and its reports and cards go to them.
CREATE TABLE schedules (
  id TEXT PRIMARY KEY,
  module_id TEXT REFERENCES modules (id),
  agent TEXT,
  made_by TEXT,
  name TEXT NOT NULL,
  file TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('on', 'paused')),
  trigger TEXT NOT NULL,
  runs TEXT,
  cursor TEXT,
  last_run_at TEXT,
  description TEXT,
  UNIQUE (module_id, name),
  CHECK (module_id IS NOT NULL OR agent IS NOT NULL)
);
CREATE UNIQUE INDEX schedules_of_agent ON schedules (agent, name) WHERE module_id IS NULL;

-- Each run of a schedule or a script.
CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  schedule_id TEXT REFERENCES schedules (id),
  module_id TEXT REFERENCES modules (id),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  state TEXT NOT NULL CHECK (state IN ('running', 'ok', 'failed', 'stopped')),
  words TEXT,
  data TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX runs_schedule ON runs (schedule_id, started_at);

-- ---- People and organizations ----

-- A person or an organization, derived from the rows that name them.
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

-- The email, phone or profile that makes someone the same person.
CREATE TABLE people_keys (
  key TEXT NOT NULL CHECK (key IN ('email', 'phone', 'profile', 'domain', 'company')),
  value TEXT NOT NULL,
  person_id TEXT NOT NULL REFERENCES people (id),
  PRIMARY KEY (key, value)
);
CREATE INDEX people_keys_person ON people_keys (person_id);

-- The rows that name them.
CREATE TABLE people_sources (
  person_id TEXT NOT NULL REFERENCES people (id),
  record_id TEXT NOT NULL,
  table_id TEXT,
  said TEXT NOT NULL,
  at TEXT NOT NULL,
  PRIMARY KEY (record_id, person_id)
);
CREATE INDEX people_sources_person ON people_sources (person_id);

-- Who works where, from when.
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

-- Two who may be one, and what the person said.
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

-- Who wrote or met whom, and when, for counts and the last contact.
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

-- ---- Tasks ----

-- One list of all work, each on the place it concerns.
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
  owner_kind TEXT NOT NULL DEFAULT 'person' CHECK (owner_kind IN ('person', 'alpha')),
  owner_id TEXT,
  given_by TEXT,
  given_root TEXT,
  given_hop INTEGER NOT NULL DEFAULT 0,
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
  schedule_id TEXT,
  opening TEXT,
  starts_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  done_at TEXT
);
CREATE INDEX tasks_state ON tasks (state, due);
CREATE INDEX tasks_place ON tasks (module_id, table_id, record_id);
CREATE INDEX tasks_parent ON tasks (parent_id);

-- The rows, people and files a task touches.
CREATE TABLE task_refs (
  task_id TEXT NOT NULL REFERENCES tasks (id),
  kind TEXT NOT NULL CHECK (kind IN ('row', 'person', 'file')),
  ref TEXT NOT NULL,
  PRIMARY KEY (task_id, kind, ref)
);
CREATE INDEX task_refs_ref ON task_refs (kind, ref);

-- ---- Connections ----

-- One account of one connector; it points at its secret and never holds it.
CREATE TABLE connections (
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
