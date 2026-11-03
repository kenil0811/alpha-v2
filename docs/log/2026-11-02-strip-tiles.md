# 2 Nov 2026: strip tiles, whole frames, room between cards; the path, the tabs row, two modules

- First, a strip tile's number two lines tall with its words beside it on both lines, long numbers
  too; still square, the third line the spark and the button (`StripTile` in `Overview.tsx`).
- Then no room left empty in a tile: 190px wide, as tall as its three lines (121px), words 18;
  no longer square. Long goal words on an Overview end in "…"; the hover shows them whole.
- A switch is last in its row: an agents group's Update now sits left of its switch (its time on
  hover), and the footprint card's switches move right of Connect.
- A sized block scrolls only its last part, or the framed list inside it (`data-frame`, on
  `Rows` in `Waiting.tsx`), so Agents' and Needs you's bottom borders stay in sight (`arrange.tsx`).
- Blocks 40px apart, in a column and across Home's and an Overview's two columns (was 20px).
- Checked: every first row (Home, a module's Overview, across modules) is the one `Strip`.
  Second Brain's and Usage's totals are tiles of their own, not the Strip; left as they are.
- The assistant's question card puts its buttons in `Actions`, at the right, as the rule says.
- The bar shows the whole path (steps small and linked, the end larger); a record page's own path
  line goes. Tabs move to a fixed row under the bar (`InNav`, `NavRow` in `Shell.tsx`).
- Calendar and Knowledge Base kits in `core/kits`, installed at start; Find atop every Overview.
  Checked on a fresh tenant, not yet on Avilo's (that needs its core restarted).
- Pinned places show their names; rail modules drop between two as well as into one, the order
  kept per person (`rail_order`). Tried on Avilo, then put back as it was.
- Proposed to Kenil: all of the above, under "Proposed" in `docs/ui-rules.md`.
