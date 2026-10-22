# 22 October 2026: the world on real tables (Stage 1, step 1)

Kenil's checkpoint review settled the platform decisions
(https://claude.ai/artifact/5vaDbFXgw614VMdGWb1WeK); the first job of Stage 1 is the world on
real tables, "switch now, no spike", his yes on the step plan
(https://claude.ai/artifact/V6udvBpkfNR55uJLPZag27) at 18:43 UTC.

- **The shape of it** (`core/src/world/ddl.ts`): a kit table is a SQLite table named by its
  slug, STRICT, a typed column per field by the field's slug (text, date, choice, person, file,
  link, email, phone: TEXT; number: REAL; money: `<slug>` REAL and `<slug>_currency` TEXT;
  relation: TEXT, indexed); a list relation (`many: true` on the field, new in module.yaml) is a
  junction table `<table>__<field>` (record_id, other_id, position). `provenance` (record, field
  id, kind, source JSON, basis, at, beside JSON) and `versions` (record_versions renamed) sit
  beside them. `records` stays as the registry (id, table id, created at), so `row_files`,
  `kit_rows`, `tasks` and the people tables keep pointing at a row by its id, and `get(id)`
  finds its table. Indexes are named by ids, so a rename moves nothing. No SQL foreign keys:
  pointers are kept whole by Alpha's own writes in the same transaction, so a shape change never
  fights a cascade (the plan said "foreign keys"; this is the one deviation, told to Kenil in
  the doc's defaults).
- **Shape changes as DDL** (`shape.ts`): make (CREATE TABLE with its indexes and junctions), add
  (ADD COLUMN or a junction table), rename (RENAME, RENAME COLUMN, junction renames), remove a
  table (junctions, side rows, pointers from other tables cleared), and the new `removeField`
  (DROP COLUMN or the junction table, its provenance, the saved views forgetting it). A field
  whose slug a row's own column has (Version, ID) steps aside as `<slug>_field`; a table whose
  slug the file already uses (Views) as `<slug>_table`. `clearPointers` and `pointersAt` give
  the count the removal words say ("cleared from 2 rows pointing at it").
- **The records store** (`records.ts`): the same calls over columns and junction rows; values
  by field id are built from a row (`rowVals`), a NULL column is no value, as a missing key was;
  provenance by `INSERT ... ON CONFLICT`; a version keeps the snapshot by field id as before. New
  helpers for the readers that used to read the JSON: `tableOf`, `rawValues`, `ids`, `column`,
  `valuesOf`, `idsWhere`, `byKey`, `keys`, `itemKeys`, `landed`. People, intake, kits, the
  script host (`rows.list` keys, `rows.compute` stated check), the connector service and the
  journey runner moved onto them; nothing outside the world reads a kit table's SQL.
- **The model's read** (`modelsql.ts`): still a view per table, now thin (`id`, `added`, the
  fields' columns from the real table), a view per junction table and a `provenance` view;
  the `json_extract` views are gone; the wall is unchanged (views only).
- **Migration 13** (`migrate13.ts`, the first migration that is code, not SQL): per table, the
  real table is made, rows copied out of the JSON (a value that does not fit its column is left
  out, not cast), junction rows from arrays (a relation that held a list anywhere becomes
  `many`), provenance rows from the JSON objects, dangling pointers cleared, then the JSON
  columns dropped from `records`. Tested on a hand-made populated version-12 world
  (`realtables.test.ts`), which the review had found nothing did before.
- **Tests**: 195 (33 files); the new file covers the migration, list relations, pointers
  cleared with the count, add/rename/remove on populated tables with versions and provenance
  intact, table renames with junctions, a reserved slug.
- **The numbers**: `pnpm fixture [rows]` (`scripts/fixture.ts`) builds a 40-field table of
  200,000 rows and a related table of 20,000 through the same calls a kit uses and times what the
  window, the model, a kit and a connection ask; run on c988f49 (JSON) and on this code.
- **Full-text entries by rowid**: the baseline showed the old JSON path adding 200,000 rows in
  well over an hour: every `index()` deleted the row's entry by `record_id`, a column FTS5 does
  not index, so each insert read the whole index. Entries now sit under the registry row's
  rowid (an insert says so, a change or a removal deletes by it); migration 13 moves the
  existing entries.
- **The journey** `a-reader-for-a-list` on the real model (twice): the rows landed, the agent's
  run ended ok, no errors; two checks that passed on 19 Oct failed both times on the model's
  side (it asked before making the agent, and its reader took the firms from the list pages
  rather than each firm's page, so no provenance URL has `/firm/`). A row landed with its page
  URL keeps it (checked directly); the reading depth is the model's choice, not the world's.
- **Kenil's "tests look good" and his ask to check the code against the design and vision** (19:29):
  a review doc (https://claude.ai/artifact/UKkWzMubWf1SRMpmyub2NW), my pass and a fresh-eyes
  pass. Fixed from mine: `records.seq` (migration 14) as the full-text rowid, since a VACUUM may
  renumber rowids; `shape.check()` at open refuses a world whose tables and catalogue drift;
  `rawValues` and `column()` read only what they return; `indexed: true` on a kit field. The
  structural finding: a provenance row per value is 9.5 rows per row on his world and 40 per row
  on the fixture, though 65% of rows carry one provenance for every field; proposed row-level
  provenance with per-field exceptions, for his word.
- **The fresh-eyes pass** (a subagent reading the same files, probing a fresh world) found three
  holes, all fixed with tests: the model's wall let `SELECT made_by FROM main.deals`,
  `main.provenance` and `main.journal` through (reads now pass only inside a view's own SQL or
  of a temp view by name, with SQLite's JSON tables open and a column-less read for `count(*)`
  allowed; the people view's recursive expression is named `alpha_up_`, a name the model's
  query may not use); a connection landing a null made every sync "changed" (a null is no
  value now, with no provenance); a table named like a model view broke every query (the nine
  names are reserved, also in the migration). Also: renames step aside like additions, pointers
  are cleared per batch of removed rows, statements are prepared once per connection (db.ts),
  migration 14 tidies provenance of absent values. Left for later: a catalogue cache, paging,
  a fuller integrity check. 198 tests.
- **Row-level provenance** (his "makes sense", 20:15 UTC): a row whose values all came the same
  way keeps one provenance row for all of them (field id ''), and a row per field that differs;
  a field's provenance is its own row, else the row's, and only valued fields have one
  (`resolve` in records.ts; `setProvenance` writes the one row on a fresh row, and on a change
  only where a field differs from the row's). Migration 15 folds the rows; the model's
  `provenance` view expands the row's default to its fields. 199 tests.
- **The numbers** (`pnpm fixture`, 40-field table + a related one, Kenil's Mac, 22 Oct). The
  old code's 200,000-row run was stopped after three hours still adding (the full-text scan
  above); the like-for-like is at 20,000 rows, the new code also at 200,000.

  | Measured | JSON, 20,000 | Real tables, 20,000 | Real tables, 200,000 |
  |---|---|---|---|
  | Add the rows | 80.7 s | 5.8 s | 78.5 s |
  | List the table whole (the window) | 705 ms | 483 ms | 6.6 s |
  | Model: count where a choice is B | 126 ms | 9 ms | 102 ms |
  | Model: rows whose notes contain a word | 70 ms | 7 ms | 65 ms |
  | Model: top 50 by a number | 127 ms | 8 ms | 95 ms |
  | Model: join to the related table | 46 ms | 4.5 ms | 6 ms |
  | Change one row | 8.4 ms | 0.6 ms | 0.7 ms |
  | Land 1,000 items (500 changed, 500 new) | 7.5 s | 74 ms | 125 ms |
  | Add a field | 5 ms | 21 ms | 172 ms |
  | Rename the field | 4 ms | 6 ms | 7 ms |
  | Drop the field | not possible | 33 ms | 292 ms |
  | World file | 181 MB | 48 MB | 464 MB |

  What they say: writes and landings are 10 to 100 times faster and the file a quarter of the
  size; the model's questions are 10 times faster at the same size and, at 200,000 rows, still
  full scans (an `indexed:` field or a relation column makes them indexed reads); the window's
  whole-table load is the one thing that grows with the table (6.6 s at 200,000), so paging is
  the next thing a big table needs. The real-tables fixture at 200,000 rows is 464 MB: 40
  columns of words and numbers plus a provenance row per row and the full-text index.
