# 31 October 2026: the Second Brain, from what the core gives today

Design only, ported from the 27–30 Oct review, for Kenil's review.

- Intelligence is the Second Brain: a brain icon on the rail, in the workspace menu, the folded
  strip, Find and the bar. Its tabs: Graph (the default), Across modules, Connections, Agents.
- Graph (`window/src/SecondBrain.tsx`): Alpha in the middle, each module around it sized by its
  rows, its main tables and agents one layer out, the connections along the top and foot; green
  on, amber needs you, red broken, grey paused; a click opens the thing. From `/api/modules`,
  `/api/working` and `/api/connectors`.
- Across modules: ask across every module (`/api/find`, then the assistant), totals (rows, and the
  Alpha module's Decisions and Noticed), since you last looked (`/api/today`), what each module
  holds.
- How to work, Decisions and Noticed move to Settings › Governance; an old
  `#/intelligence/governance` link and the Alpha module land there. ui-rules S2, S3, I1, I2.

Waits on core: `GET /api/brain`. Until it lands, the links between modules (on the graph and as
"How your modules connect") say so in place, and people, organizations, documents and follow-ups
are left out of the totals. Left for their own slices: the rail's brain beside Settings, the pill
switch, blocks that move (`arrange.tsx`), `Stretch` (`ui/chart.tsx`) and the side panel
(`Peek.tsx`): the graph is a plain SVG that scales to its width and a click goes to the page.
