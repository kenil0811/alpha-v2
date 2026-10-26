# 26 Oct: line B brought up to main

Kenil's batches 1 and 2, and his look of 26 Oct (14px body with 11px capital labels, one row of
full-word tabs, the module's Agents and notes tab with nothing under a table, no count cards,
sections without cards, no modules on Home), merged into #16 to #30 and the 19 PRs built on them.
Vikas, 26 Oct: main's look, with the clashes held for Kenil.

- Where a PR met his look, main's look was kept: #16 takes main's comments and Metrics.tsx goes
  with it; #36, #56 and #57 carry their own change over to main's App.tsx. #53's New moves onto
  his kept tables (`kept.onNew`), with no New task field over Tasks. #45's ★ sits with his
  keyboard in the dropdown. #42's rail menu uses his per-person rail width. #19's saved-list
  dropdown stays in place of the view tabs.
- #49 holds rules W5, L2, L3, L5 and L6, which his look reverses, until he answers. The W5 and L3
  tests are skipped meanwhile.
- Not brought up: #39, #40, #41, #48, #58, #60, which undo his calls. They wait on his answer.
- Checks: Biome and `tsc --noUnusedLocals` are clean on all 31 branches. Vitest fails only on
  "reads dates by day", which also fails on main. Not looked at in the app.
