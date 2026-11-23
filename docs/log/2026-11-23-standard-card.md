# 23 Nov: one standard card

Vikas asked that cards be one piece of UI reused everywhere, pop-ups included, and that a
double-click edit show Save and Cancel rather than lean on Enter and Escape.

- `ui/frame.tsx`: `Frame` (padded) and `FRAME` (the classes); `List` is the same frame with rows to
  its edges. 44 hand-drawn boxes across the window now use one of them, the padding one size (16px).
  Pop-overs, a board's cards and tooltips keep their own.
- A pop-up (`Dialog`, `Confirm`) is the same card lifted: half the window wide, a phone's width at
  the least, as tall as what it holds.
- `ui/yes-no.tsx`: ✓ and ✕, the word on hover. A rename (`Renamable`: a tab, a table, a module, a
  page title) shows Cancel and Save under the box; Enter and Escape still work. Leaving the box no
  longer saves.

Not done: a grid cell's edit keeps a spreadsheet's keys (Enter, Escape, Tab) without buttons.

Later the same day: a label on a tab, a toggle, a tag or a button is as wide as its words and
about 15 letters at most (`ui/fit.tsx`); the rest slides into view under the pointer or focus.
