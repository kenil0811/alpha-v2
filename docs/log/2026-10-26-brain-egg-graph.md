# 26 October 2026: Second Brain opens on a graph shaped like an egg

Asked by Vikas. Intelligence › Second Brain's switch is now Graph, How to work, Decisions,
Noticed, and opens on Graph unless the person picked another part in this browser
(`alpha.brain` in localStorage). The graph, in `window/src/BrainGraph.tsx`, is one SVG node per
thing the Second Brain holds, inside an egg outline: how to work and the Kept decisions (the
rules) on rows at the narrow top, Proposed decisions in the middle, noticed facts across the broad
bottom; Dropped ones are left out. Each band's rows follow the egg's width at the widest spacing
that fits. The legend filters by kind, hover or focus shows the words under the egg, a click opens
the row (`#/table/<table>/<row>`) or the How to work list. The only links the data gives are facts
noticed about the same one, drawn as lines. Checked in Edge at 1440×900, light and dark, on the
test install (six rules) and on 166 made-up nodes; the switch kept How to work across a reload.
