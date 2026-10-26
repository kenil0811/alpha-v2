# 26 October 2026: a cell's history

Right-click a cell › History opens a dialog of that value's steps, newest first: old → new, who or
what changed it in the core's words, and the date and time in full. The menu's "Where it came from,
and its history" is now "Where it came from". Built on the existing
`GET /api/tables/:id/rows/:row/history?field=`. Undo of one step waits on a core route, asked of
Kenil in the PR. Checked in Edge with the history answer stubbed (no cell here has two steps yet).
