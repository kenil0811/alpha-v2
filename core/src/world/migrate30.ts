// Migration 30 (Batch B, call 6, Kenil's yes 1 Nov): a lasting key on tables and modules, the name
// a kit or a connector gave the one it made, so it finds its own after the person renames it.
// Ones the person or Alpha made have none. The tables and modules kits and connectors made before
// keys are keyed by their names as they are now; a kit's module by its kit.
import type { Db } from './db.ts'

export function lastingKeys(db: Db): void {
  db.exec(`
  ALTER TABLE tables ADD COLUMN key TEXT COLLATE NOCASE;
  ALTER TABLE modules ADD COLUMN key TEXT COLLATE NOCASE;
  UPDATE tables SET key = name
    WHERE made_by LIKE 'system:kit:%' OR made_by LIKE 'connector:%';
  UPDATE modules SET key = COALESCE((SELECT kit FROM kits WHERE kits.module_id = modules.id), name)
    WHERE made_by LIKE 'system:kit:%' OR made_by LIKE 'connector:%'
      OR id IN (SELECT module_id FROM kits);
  CREATE UNIQUE INDEX tables_key ON tables (module_id, key) WHERE key IS NOT NULL;
  CREATE UNIQUE INDEX modules_key ON modules (key) WHERE key IS NOT NULL;
  `)
}
