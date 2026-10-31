# 31 October 2026: Settings, Usage, Activity and the smaller screens (design only)

One slice of the 27–30 Oct review, window only, for Kenil's review.

- Settings: Usage is its own section and Connections is in Settings' list; the list is
  `ui/side-list.tsx`. Adding a connector or a module from a file is one drop zone
  (`ui/drop-zone.tsx`). Experimental and Modules say nothing when there is nothing.
- Activity: Loading… while it asks, the refusal if the core says no, "Failed" for a run's state,
  day headings in sentence case.
- Network: a pill switch in the bar (Overview, People, Organizations) and a Connect button in
  place of the empty-state sentence.
- Over any link, the foot of the window names where it goes (`ui/link-status.tsx`); a link in
  Alpha's words to a place in Alpha opens here.
- Taken byte-identical from other slices: `ui/pill-switch.tsx` (#66), `floatRoot` and the z scale
  in `app.css` (#67).

Waits on the core: Text size in Appearance (`POST /api/appearance` takes no `textSize`), the
layout's `pins`, `seen` and `docked` (not in `Layout` from `/api/me`). Usage stays as the core
serves it.

Left to other slices: the Governance tab and Second Brain's pages, the Agents list, New agent,
everything opening in the side panel (`peek`), the vocabulary rules (they would fail `look.test`
on cards and Needs you until those screens change their words), and the table hunks (their own
pull request).
