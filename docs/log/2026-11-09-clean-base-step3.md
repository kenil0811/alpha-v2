# 9 November 2026: the clean base, step 3, one schema

Kenil's call: until the first client is installed, a change to the shape edits version 1 directly;
numbered migrations start the day one goes live ("everything should be clean when we give it to
clients").

- `core/src/world/schema.sql` is the world's shape, version 1, generated from an empty world and
  grouped by what it holds. The 33 migrations and `migrate1`, `13`, `29`, `30` are gone, and the old
  chain-once with them.
- Taken out: `desk_messages`, `connections.never`, `agents.tasks`, `runs.task_id`, the `undo_since`
  setting, a task's agent owner and a cost "priced" from our own table.
- A world of another shape is refused in words that name both versions and the clean base. Kenil's
  old `Alpha` folder now opens only with the code on `reference/full-2026-11-06`.
- `core/src/world/schema.test.ts` holds that a fresh world is exactly `schema.sql`. The tests of old
  upgrades went with the upgrades.
- Tried on a fresh install, 9 Nov: Backup now, Go back to a backup (a task added after it was gone,
  the journal's chain whole with the restore's own line), Take my data (`journal.jsonl` verified, its
  world opens at version 1), `pnpm journal verify` on the world, and the `alpha` command's backup,
  report (shape version 1) and restore.
