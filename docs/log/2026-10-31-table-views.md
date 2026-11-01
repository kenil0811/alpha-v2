# 31 October 2026: a table's toolbar, board and row panel (design only)

One slice of the 27–30 Oct review, window only, for Kenil's review.

- Toolbar: search is always a wide box, first; Filter sits on the right beside ⋮; Columns moved
  inside ⋮ (a board says why it has none); a board's group is not a chip, its columns say it.
- Board: a card's name opens the row; the keyboard's move picker shows on hover or focus.
- Row panel: headings in sentence case, "Related" for "Linked here" with its rows as links,
  Documents is one drop zone (`ui/drop-zone.tsx`, the same file as in `claude/design-settings-usage`).
- Calendar's weekdays in sentence case; the timeline's scroll box is `isolate`.

Left for later: Save and Cancel beside New (the footer is #65's pager), the List view beside the
row's own page and Slides (`KindPicker`, `Cards.tsx`: they need the row page and Needs you),
`hrefOf` (its users are Grid and the row page), the dropdown's ★ on the board (#64). Nothing
waits on the core.
