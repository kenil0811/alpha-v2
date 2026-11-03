# 3 Nov 2026: an agent's settings behind a gear; the acquisition tools as Avilo's skills

Vikas, after reviewing an acquisition-entrepreneurship site's tools for Avilo ("a settings icon,
clicking on which these things appear so that we can control the agent better"); this branch
ships without Kenil's review (Vikas, 2 Nov). Proposal: `proposals/2026-11-03-acquipreneur-tools-and-agent-settings.md`.

- Core: `AgentView` gains `skills` (the skill folder its script runs from), `documents` (the
  kinds filed on the tables it reads and writes) and `calls` (its `effects`, each with the id of
  the deny rule that turns it off). `POST /api/agents/:id/calls {call, on}` saves or revokes that
  rule, keyed by the agent's name as Governance's rules are.
- Window: `SettingsButton` on the Agents conversation, the agent page and the Agents list;
  `#/agent/:id/settings` peeks `AgentSettings` in the side panel.
- Avilo (its own repository): Deal maths (SBA loan, DSCR base and stressed with the hidden costs,
  a 25% seller note tried when it fails, value range, IRR and MOIC, working capital against the
  peg, the lender's step due), Screener, Diligence plan, Call prep, Deal momentum, the Decision
  page on a lead, Negotiation and Working capital tables, owner dependence and seller motivation
  from the CIM, Outreach's personalisation check and reply funnel, the runway against the
  22-month median; the playbooks, reading list, the lender, the chapter and its events in the seed.
- Found on the way: the first switch saved its rule under the agent's id, which no gate matched;
  fixed before commit.
- Later the same day (Vikas: a deal sheet on every deal, "an interactive tool where I can
  simulate deal structures", what to hold and where to give): the page kit gains sliders and a
  `controls` block; Avilo's DealPilot gets a Deal sheet page on each deal (overview scores,
  financials, service mix, three ways to the value, a structure tried with seven sliders, the
  walk-away price, hold firm / can give / trades priced by the model, reading the seller, the
  questions, a recommendation).
