# 10 November 2026: compressed answers

Kenil found Mail's 900 rows took 5 to 7 seconds to open on the server. The core builds that table in
about 30 ms; the time went in sending it, 1.7 MB a load, two thirds of it each value's source, which
repeats from row to row. The core now compresses what it sends when it is over 2 KB and the window
can read it so (brotli, or gzip where the browser asks only for that), and streams the window's own
files compressed too (`api/compress.ts`).

Checked from this Mac over the public address: Mail went from 1.7 MB in 1 to 3.6 s to 104 KB in about
0.4 s, and the window's script from 802 KB to about 230 KB. `pnpm check` green; the window loads in
WebKit as before.

Then, on his ask: a table newly opened draws from its shape first (`GET /api/tables/:id?rows=none`:
its fields and lists, no rows) while its rows come alongside, so its tabs, toolbar and columns show at
once and only the rows fill in; no count is said until they are here. The same table brought up to
date fetches its rows alone. In WebKit with the rows held back two seconds: the columns drew at once,
no "0 rows", then 60 rows and their count.

And the bar's ‹ now always sits in its place, greyed and not to be pressed where there is no page
above (Home, Agents, Tasks, a module, Intelligence, Settings), so it never comes and goes (H1).

Then: moving from one table to another (Tasks to a module's table, or between modules) keeps the
table's frame on screen, its toolbar and grid, and only changes what is in it; a table's frame is drawn
from what the rail knows until its shape is here (`table/frame.ts`). With every table answer held back
almost a second, no frame in 411 went without the table's frame. A mirror's line under its tabs ("A
mirror of Gmail…") is gone; its gone rows stay one click away on the row-count line (D8).

From his look: the ‹ on a module's table pointed at the module, whose address opens that same table
again. A module's tables and pages now go back to Home, or to the module they sit in.
Then Tasks, Agents, Intelligence and Settings go back to Home too; only Home has nothing above it.
