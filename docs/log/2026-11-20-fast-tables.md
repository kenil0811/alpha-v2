# 20–22 Nov 2026: tables open fast

Deals (1,017 rows) took seconds to open: 1.55 MB came down, most of it sources, and the rows were
read twice.

- A table's read carries of each row's sources only what a cell draws (a guess's mark, the dot of
  a value kept beside it). A row's panel and a value's source panel read the row's own, from
  `/api/rows/:row`, when they open. The row page already did.
- Deleting rows says "values you typed" from the core's goes words, since the table no longer
  carries the sources the window counted them from.
- Opening a table reads its rows once: one read at a time per table, and the stream's first
  refresh no longer reads it again.
- The marks a cell draws (≈, ?) are one list, `CELL_MARKS` in the core's api types, used by the
  core's trim and the window's grid; adding a column reads the table's shape alone (`?rows=none`).
- Next, for Kenil: paging, filtering and sorting in the core, so a table never comes down whole.
