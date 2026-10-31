# 31 October 2026: the Agents list

From the 27–30 Oct review, the agents list on its own, for Kenil's review. Window only.

- `window/src/AgentList.tsx`: Intelligence › Agents is one list of every agent from
  `GET /api/working`, grouped under its module, each with how often it runs (`when`), when it last
  ran ("12 min ago", the time on hover; "Running now…" while it runs) and Running or Paused beside
  the switch (`POST /api/agents/:id`). An agent that needs something not there (`needs`) is red,
  with a red dot and the reason.
- The agent's page (`Items.tsx`) says Running or Paused the same way and its block in red.
- A table whose rows are read by an agent of its module shows Sync now beside New, with when it
  last synced (`TableView.tsx`, from `GET /api/modules/:id`).

Waits on the core:

- Grouping by what an agent does: `AgentView.function`.
- How often it runs as a dropdown: `AgentView.schedule` and `POST /api/agents/:id/when`.
- Next run, last result, Activate: `nextRunAt`, `lastResult`, `fresh`.
- The one button that unblocks a blocked agent: `AgentView.blocked.action`.
- Cost this week: `GET /api/usage/agents`. Module and trigger filters: `AgentView.module`,
  `triggers`.
