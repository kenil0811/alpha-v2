# 25 Nov 2026: each block of a record page in its place

Vikas asked that every part of a record page can be placed on Summary, as a tab, both, or hidden, from a
right-click, and that tabs, Summary included, move left and right as a module's do.

- `RecordPage.tsx`: each block has a place kept per person and kind of record (0 nowhere, 1 Summary, 2 a tab,
  3 both). The right-click on a block's heading or tab offers On Summary, As a tab, Hide, Move left, Move right
  and Show again. Summary is in the order like any tab. Until the person chooses, a block made only to look
  things up is a tab, and a block pinned before is both.
- Core: `places` is kept beside the hidden properties and the tab order, and leaves with a deleted table.
- The person page's blocks are now separate: Events, Activity, Works at or People there, In your modules,
  Mentioned in, and Second Brain (which starts as a tab).
- Clicked through on a person, an organization and a deal's row, on a backup of a test home with test people.
- Proposed next, for Kenil: one Reports block for a record's module pages, kinds of report as saved section
  choices, hiding inside a block, Files on a person, and the nine button words.
