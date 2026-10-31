# 31 October 2026: a date is that day where the person is

Four date tests in `window/src/table/engine.test.ts` failed on main for anyone west of UTC, and
passed in CI, which runs in UTC. Not a flake: `numberOf` read "2026-10-20" with `Date.parse`, which
takes a day without a time as midnight UTC, so in Chicago the row fell on the 19th. Is today,
before, after, between, grouping by month, the timeline and the calendar were a day early there.

- `numberOf` reads a date through `dateOf`, the start of that day in the person's zone; a date with
  a time still parses as before.
- Earliest and latest write the day back from local parts, not `toISOString`, which would have put
  it a day early east of UTC.
- The engine test runs in Chicago time, so CI fails if this comes back.
