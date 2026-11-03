# 2 Nov 2026: Alpha no module, one rail line, lists as a row, QuickBooks sign-in

For Avilo's demo; Vikas asked for every core change it needs on this branch. Uncommitted, for
Kenil's review (his addendum: `proposals/2026-11-02-search-and-books-for-kenil.md`, 16–23).

- Alpha is no module: not numbered (`moduleNumbers` from 1), not in an Overview's Tables card.
- Network is Overview and People; Organizations left the tabs and Find.
- Tabs in the bar on every module page; a record page has the path in the bar and its module's
  switch under it (`RecordSwitch` in `App.tsx`).
- The rail is one line (`railLine`, `FixedItem` in `Shell.tsx`): a module drops between Home,
  Agents and Tasks. Tried on the demo: Calendar above Agents, Knowledge Base above Tasks, kept
  after a reload.
- `ViewTabs` is two rows: the lists as wrapping pills, the one on screen lit, the table's actions
  at the right; search and filter under it. The drop-down is gone.
- A plain date counts as local, not UTC (`numberOf` in `table/engine.ts`): 4 engine tests failing
  on main too now pass.
- QuickBooks: `connectors-extra/quickbooks` (fixtures only), OAuth in the connector SDK, the
  `/api/connectors/oauth/*` routes (the callback alone skips the token), Sign in with QuickBooks in
  Settings. Never run against Intuit.
- Seen: an Overview shows "No data yet" until its main tables load; with 8 tables that is a
  second or two. Left as it is.
