# 30 October 2026: the audit journal

Step 2 of the final plan, part 3, on Kenil's "makes sense, lets do it" (12:40).

- `world/audit.ts`: a line's hash over its content and the line before's (`hashOf`); `append`
  chains every new line; migration 28 adds the column and chains what was there. `verify` walks
  the chain, letting a fold's checkpoint vouch for the run it stands for; `chain` is the
  migration's hand. Checked at every start (`journal_check` line on a break); `pnpm journal
  verify <world.sqlite | journal.jsonl>` checks a file. "Take my data" adds `journal.jsonl`
  (`exportLines`), closed by the last hash, which `verifyExport` checks.
- Secrets: `world.keepOut(secret)` from the connect route; `append` refuses a line that would
  carry one. Sensitive fields: kit field `sensitive: true` (kit API; `Field.sensitive`); the
  gate's call line writes "(kept out)" for a write's or change's values there.
- The fold: `journal_fold_days` (90) in limits.yaml; once a day, read-only lines older than that
  (world reads, route reads, connector calls that read, quiet connection reads, their done lines)
  fold into a `journal_fold` line a day with each run's last hash; the never-deleted trigger is
  dropped in that transaction and put back.
- Tests `world/audit.test.ts` (an edited line breaks the chain; a secret refused and a sensitive
  value kept out; the export proves itself; the fold keeps the chain), failing before.
