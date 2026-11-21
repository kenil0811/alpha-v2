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
