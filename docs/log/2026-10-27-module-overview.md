# 27 October: a module's Overview and the switch in the bar

Vikas asked for the Overview mock (v3) built in the window, on its own branch for Kenil's look.

- Every module opens on its Overview. The bar's middle holds the module's switch in place of
  its name: Overview, the tables pinned to it (a table lower on the spine first: Deals before
  Sources), a rule, its pages and its Conversation. The row of tabs under the bar is gone.
- The Overview's cards sit in rows that stretch so they end level: Needs you (the module's cards,
  when any), its main table as a chart (by the choice that spreads its rows most), Tables (a tree:
  main, its parts under it, what you set up; a pin per table), Agents (agents named after a
  table's rows are one line with one switch and Sync now), What Alpha knows (its notes) and What
  Alpha may do (rules, and what it changed lately with Revert).
- The rail's Intelligence takes the single sparkle.
- Pins are kept in the browser until the core keeps them (item 75); the relation's table is read
  from the field's name until the core sends it.
- Proposal: rules R10–R18 and core items 74–78. Four date tests in `table/engine.test.ts` fail on
  this main without this change touching them.

Later the same day: the whole of mock v4 on the branch, core included, for Kenil to see the
bigger picture; it will be redone as phased pull requests.

- The Overview opens on the pulse strip (the same block Home shows per module): hover a tile and
  it lists what it counts, a click keeps it open, a second click goes to its card. Under it the
  module's own work on the left (Needs you, then its charts, the most opened first) and the
  standard column on the right in every module: Interview me, Files, Agents, Intelligence, What
  Alpha may do, Tables. A card's head is its name only; the one-line explanations are gone.
- Charts are read from a table's shape, never named: by the choice that spreads rows most, by
  the main table a relation points at, new rows by week, goals (a setup table of targets on a
  stage) and what rules rows out (a setup table of at-most and at-least tests). Each has a
  dropdown of the kinds that fit (bars, donut, funnel, against target, rings). Every bar, slice,
  ring, count and tile line opens the table filtered to those rows, saying why, with Show
  original list.
- Signal dots (S1) as bullets everywhere: pulsing amber needs you now, filled blue waits for your
  yes, hollow is optional, green runs as it should; each says so on hover; the rail shows the
  strongest beside each module.
- Core: `Layout.pins` and `Layout.seen` kept per person (`POST /api/seen` counts a screen or card
  opened, which orders the work column and Home's modules); `ModuleView.files`, the files on a
  module's rows (`world.moduleFiles`); `Me.textSize` with Appearance › Text size, Small, Medium
  or Large, the spacing growing with it.
- Home: each module's strip; Getting this Mac ready is one line, "2 of 5 done", until opened.
