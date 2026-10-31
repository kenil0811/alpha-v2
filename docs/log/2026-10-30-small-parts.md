# 30 October 2026: buttons and small parts

One slice of the 27–30 Oct review, window only.

- `ui/button.tsx`: every kind changes colour under the pointer; a `soft` kind for a way onward.
- `ui/card.tsx` `Actions`: a card's buttons at the right. Draft, Filing, Match and Proposed cards
  use it; their wording changes stay with their own slice.
- New parts: `ui/pill-switch.tsx`, `ui/cut.tsx`, `ui/dot.tsx`, `ui/icon-tile.tsx`, `ui/back.tsx`,
  all shown on #/parts. Activity's All / Didn't finish filter is cut buttons now.
- `ui/tabs.tsx` stays: Module, People, Settings and Tasks still use it; moving them to the pill
  switch needs the bar's `InBar` and goes with the shell slice.
- Rules proposed under "Proposed" in `docs/ui-rules.md`, waiting on Kenil. Nothing waits on core.
