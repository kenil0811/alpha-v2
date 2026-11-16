# 16 Nov 2026: schedules stopped by a module's deletion

Read the books (06:00) and Read the sources (07:00) did not start on the Mac's Alpha. Since the
QuickBooks module was deleted at 21:57 on 15 Nov, no schedule had started on its own: the morning
reads, Measure the deals, Keep the pipeline, Work out the figures. Deleting a module journals
`tables` as a count (8); the check for schedules waiting on changes reads a line's `tables` as the
list a revert names, so it threw at the first such schedule, every minute. The schedules' lane
swallowed the throw, so nothing said so. The server had no such line.

Kenil's yes to the fix (16 Nov):

- The changes check reads a line's tables only when they are a list. The journal stays as it is.
- The deletion line names its counts `tablesGone` and `rowsGone`.
- Each schedule is judged on its own (`judge` in `modules/runs/due.ts`): one that cannot be
  judged says so in a line ("could not start"), and after `run_retries` in a row opens the Try
  again / Leave it card a failed run opens; the others still run.
- A failure of the due runs, in the lane or started by a change, is thrown at the lane's next
  start, so the scheduler journals it and opens its card after two (R1).
- Tests: a changes schedule runs past an old deletion line; R1 gains three cases (a schedule that
  cannot start, twice in a row, and the lane that fails).
