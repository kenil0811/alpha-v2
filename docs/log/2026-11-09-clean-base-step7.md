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
- On his look: one answer. The asker's chat shows a line for each ask, with the answer folded on it, and
  then one reply; the asked agent's chat shows only what the person and it said to each other.
- Timed against Claude Code on the same model: Alpha alone matches it, and going through another agent
  costs extra in both. The ask line says what the agent is doing. Depth is the agent's judgement, with no
  limit written anywhere (Kenil, 9 Nov).
- A message naming one agent goes straight to it with what came before, word for word, and its answer
  is the reply; the Chief of staff is told, so the work carries on from either conversation.
- An ask stays open while a card from its work waits. The follow-up after the person's answer is that
  work, not a turn in the agent's chat; after the ask is answered, nothing runs.
- Settings › Permissions: Scripts can reach any website, a rule by a switch, off on a fresh install.
- Every agent's model shows beside the composer and on its page, and the owner changes it there; it
  takes effect on the next turn, in the same conversation.
- A turn stays as it streamed: every piece of text the model wrote, in order with its steps (`along` in
  the journal), and no folding. The chat only follows to the bottom when you are at the bottom.
- The chat restyled after Claude Code on his word: a plain bubble, steps as rows with icons, Stop inside Send, code blocks and Copy on hover, bordered tables, a small title.
- Colours across all of Alpha moved to warm neutrals and a clay accent, after Claude Code, on his word; the page kit and the Mac app's first screens follow.
- A reply is straight on the page, as in Claude Code: no box, tables in the column, steps on one line.
- The conversation has the agents down its left, and the assistant has a picker. @ picks teammates, the
  lens goes, Intelligence opens on Agents, and Usage has By agent.
