# 20 Nov: one record page, made of blocks (prototype)

Vikas asked for a record page with a summary page and the rest as tabs under the header, built
from standard blocks. A row, a person and an organization now share one page (`RecordPage.tsx`).

- **Bar:** the record's name is the title (a double-click renames it), with Module / Table in
  small type under Back.
- **Tab row:** Summary first, then the blocks the person pins (right-click a tab or a block's
  heading: Pin to the tabs, Unpin). Ask about this sits at the row's right.
- **Summary:** the properties across the width in columns. Right-click one to Hide it (per
  person, for every record of its table); "+ Add a property" sits under them. Then each block's
  start.
- **A block:** a title, a count, a short form for Summary and a full form for its tab. One that
  holds nothing shows nowhere.
  - A row's blocks: its note, each part, files, tasks, related, What Alpha knows (values Alpha
    read, with Keep and Forget, then the rules that hold). What Alpha knows scrolls inside its
    block.
  - A person's: activity, related, What Alpha knows.
- **Core:** the layout keeps `recordHidden` and `recordTabs` per person.
- **Not done:**
  - an activity block for rows (no per-row history yet);
  - one record view from the core (each block asks for its own part);
  - tabs kept in the address.
- **Seen on:** :4702, on a backup copy of a test home.
- **Failing elsewhere:** 4 date tests in `engine.test.ts` and 8 core tests (bridge, connector
  discovery, desk, PDF pages, R1). This change touches none of them; they weren't rerun on clean
  main.

Later, from Vikas's look: the property form lists Text, Number (with money and phone icons),
Date, Choices (a circle for one, a box for several), Link (with an email icon), and the rest; it
moved out of the grid into its own file. The + is the next free cell of the properties. A value's
source is on its hover, in plain words ("Alpha found it", or its own words, and the day). What
Alpha knows is sentences: where the values came from and when, the rules, what Alpha read as text
links; it no longer repeats the values. "On" is the DealPilot module's own field, not the page.

P16-4, asked by Vikas through the P4 session: a page can belong to a table's records. Its file
says `<meta name="alpha-record" content="Clients">`; the core lists it with that table's id, draws
it for one row of that table (`?record=`, refused for any other row) and hands the page the row as
`alpha.record`. The record page shows it as a block, drawn for that record. A page keeps its
picker on its module's tab when `alpha.record` is empty. Not done: the row panel.

21 Nov, from Vikas: a record's module pages also show in the row's side panel, at its foot. On the
record page a module page is its own tab, always there and never on Summary. Tabs drag to a new
place; the order is kept with the pins, per person, for every record of the table.
