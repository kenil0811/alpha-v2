# 9 November 2026: the clean base, step 7, agents

Kenil's direction, after reading OpenBot, Grok Bot and Hermes Agent with me (analyses
https://claude.ai/artifact/4E3F65fSWJph3exn8J41SZ and https://claude.ai/artifact/W3xcFFB4i9wipUrKYKSzQg):
make it useful first and add guardrails as we need them; learn freely from them and write our own
code. The design: https://claude.ai/artifact/BhAFjaoFQfqbMiNLrqaKek. His calls: no card to make an
agent; giving a task to an agent comes next, then agents on a schedule; memories are written only
during a conversation.

- An agent is a row and a folder (`AGENT.md`, skills, files), made and changed through `keep`. Every
  agent has what the Chief of staff has. The row's empty reach and `agentReach` are the one place a
  limit would go.
- One session per person and agent, in `desk_sessions`. Every journal line and card names the agent.
- Memory is short facts with an owner, a few essential ones loaded and the rest searched, saved only
  when a turn finishes. A fresh session starts with the recent conversation, and the person's last
  messages go back after a compaction.
- Asks between agents are saved rows delivered once (`agent_asks`). The asker's turn ends; the answers
  come back together in one turn. A middle agent waits for its own answers before it answers. Work a
  restart left half done is reported as unknown and not replayed.
- One rule, R6: one request makes at most 8 asks and 4 hops, then waits for Continue; Alpha counts.
- The conversation has the agents down its left, and the assistant has a picker. @ picks teammates, the
  lens goes, Intelligence opens on Agents, and Usage has By agent.
