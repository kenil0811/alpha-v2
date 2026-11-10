# 10 November 2026: quiet loading, and Home after a delete

From Kenil's look: deleting a module left the window on its table, saying it was not there, and the
next module opened with that warning until a refresh, then loaded.

- While a table loaded, the window said "That table is not there" in its place. It now shows
  nothing at first and a soft Loading… only after it has taken a while (`ui/waiting.tsx`), on every
  screen that waited with words.
- A module's tabs and the bar's name come from what the rail already knows, so they stay put while
  a table loads, and the bar never shows "…". The rail opens a module straight on where it lands
  (its Overview, front page, People or first table), one load and no stop on the way.
- A table that has gone sends the person Home instead of a warning over the next screen, and
  deleting a module always lands on Home.
- Found while testing: the same folder sent to the Trash twice in a minute failed the second
  delete; it now gets a number.

Checked in WebKit on the Mac, every frame watched, three times over: opening two modules, deleting
one from its own table and opening the other showed no warning, no Loading… words, no "…" and no
blank tabs, and the delete landed on Home.
