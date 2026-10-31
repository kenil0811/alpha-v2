# 31 October 2026: each agent has its own thread, the list first

From the 27–30 Oct review, the per-agent-thread part, design only.

- Conversation is now a list of who to talk to, as a messenger's contacts: Alpha first (its
  thread is the conversation as it was, lens and all), then every agent grouped by its module,
  paused ones saying so. Alpha's own module's agents are left off: they speak in Alpha's thread.
  `#/conversation/<agent>` opens one; the list is `ui/side-list.tsx`.
- An agent's thread says it does not have one yet, that what it posts and asks shows in Alpha's
  thread for now, and links to the agent's page.
- Waits on core, field by field: `StreamLine.agent` and `StreamLine.run` (whose thread a line is
  in), `CardView.agent` (whose thread a card is in, and the count waiting beside each agent),
  `agent` on `POST /api/say` (a message to the agent, so its thread gets a composer),
  `AgentView.function` (grouping by what agents do rather than by module) and
  `AgentView.blocked` (blocked in red on the list). The review's `threadOf` in `stream.ts`
  comes with them.
- Not looked at in the running app yet.
