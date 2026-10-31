# 30 October 2026: charts stretch by dragging an axis

Design only, from the 27–30 Oct review, its chart slice alone.

- `window/src/ui/chart.tsx`: the one chart file. `Stretch` resizes a drawing with no chrome, only
  the cursor: ↔ over the x-axis strip, ↕ over the y-axis strip, ↘↖ at the corner; a double-click
  fits it back, a focused axis takes the arrows, wider than its box it scrolls inside it. With it
  the kinds the Overview will draw (bars, donut, funnel, against target, rings, bubbles, scatter,
  lines, heat) and `ticksOf`, tested in `chart.test.ts`.
- A table's saved Chart view now stretches: its labels are the y-axis, the corner widens it.
- `ui-rules.md` L6 holds the rule; `docs/charts.md` is the catalogue and library proposal (ECharts
  recommended), Kenil's call.
- Waits on other slices: the Overview and Second Brain, which draw the other kinds, need the core;
  the series colours `Lines` uses (`--color-series-1…4`) come with `app.css`'s hunk in another slice; nothing on main draws `Lines` yet.
