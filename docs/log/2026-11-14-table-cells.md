# 14 Nov 2026: a table's cells, after Kenil's look

Three asks on the table, from his look at a table of a thousand rows.

- **No words on a cell when hovered.** "Double-click, Enter or F2 to change it" is gone, and so is
  the hover tip of a cell that can't be changed. A double-click still changes a value, and on one
  that can't change says why at once (L12): `tipNow` now carries the words, and they go when the
  pointer leaves the cell. A long value still shows whole on hover.
- **Only a row's first cell opens the row.** A click on any other cell picks it (for Enter, F2,
  ⇧↓, a paste) and nothing more, with a panel open too. The first cell's words underline under the
  pointer, as what opens (T4).
- **The table's scroll bars are easier to take hold of.** In a table's frame alone the bar is
  12px with a 6px thumb, and the thumb fills its bar under the pointer (L4). Everywhere else the
  thin 4px thumb stays.

Found on the way, and fixed: saved lists were read back ordered by the time they were made alone,
so two made in the same millisecond (a kit's, at install) came back in either order, and one test
of it failed two runs in five. They are now read in the order made.

Seen in WebKit on the Mac's Alpha: no tip on hover, a click on a middle cell marks it and opens
nothing, the first cell opens the row and another row's first cell shows that row, a drag on the
bar scrolls the table.
