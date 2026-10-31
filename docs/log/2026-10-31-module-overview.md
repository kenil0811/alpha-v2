# 31 October 2026: a module's Overview, actionable

Ported from the 27–30 Oct review, window only, for Kenil's review.

- Every module opens on its Overview, the first tab (People's module still opens on People, with
  an Overview tab beside it); a module holding others and no tables of its own keeps its list.
- `window/src/Overview.tsx`: a pulse strip (each goal as its next step with its verb, "Review 10
  more listings this week", and what is new this week split by the field that best explains it),
  then Insights, Goal tasks and the charts of the module's tables on the left (stages, a funnel,
  bubbles, lines per week, scatter, heat, where rows come from, goals, goals by week, criteria, an
  organization chart), and Agents, Tables (numbered, 2.2, 2.2.1) and Second Brain on the right.
  Every bar and count opens its rows. Blocks move and resize within their column.
- Numbering (`moduleNumbers`, `numberTables`) in `Parts.tsx`, with a test.
- Copied unchanged from the open PRs: `ui/chart.tsx` (#69), `ui/dot.tsx` (#66), `arrange.tsx` and
  the z scale in `app.css` (#67).

Waits on the core (none of it is on main):

- Goal tasks: `POST /api/tasks/ensure` keeps one task per goal behind. Until then Add to Tasks is
  greyed with its reason; nothing is kept in the browser.
- Insights read the agent's last run from `/api/activity` by its name; `AgentView.lastResult`
  replaces that.
- Files and "documents read": `ModuleView.files`.
- Which cards come first by how often they are opened: `POST /api/seen` and `Layout.seen`.
- Pinning tables to the bar: `Layout.pins`. A block's arrangement: `Layout.arrange` (until then it
  lasts while the window is open, as in #67).
- Left out, in other changes: Needs you and Waiting on you, Interview me, Governance on the
  Overview, the bar's switch, Home's module pulses.
