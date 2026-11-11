# 11 November 2026: agents in kits

Detail and Kenil's calls (all five as recommended): https://claude.ai/artifact/HqYQGsUhaageRCwwYetrct.
It replaces his 10 Nov call that the Module builder is the firm's to change once made.

- One format for a shipped agent: a folder with `AGENT.md` (name, title, description and model in
  its head, instructions below), `skills/`, `files/` and `schedules/` (`kit-sdk/src/agent.ts`).
  Kit API 3 carries them in a kit's `agents/`; kits of API 2 still install. `pnpm kit check`
  checks each agent's head, a model Alpha knows, its skills and schedules, and a name and key once.
- Alpha's own agents are in `core/agents/`, kept at every start; the Module builder moved there
  from `core/config/module-builder.md`, by its key. A client's agents come with their kit.
- An agent has a source (`alpha`, a kit's module, none when made here) and a lasting key
  (`agents.source`, `agents.key`; schema.sql edited in place, so a fresh home).
- Install and update bring a source's agents in by key (`core/src/modules/shipped.ts`). An update
  replaces instructions, skills, schedules and the files it brought, and keeps the memories,
  conversations, the files the agent kept itself and the model picked. A deleted one is remembered
  and stays deleted. A client kit's agent schedules start paused, Alpha's own start on.
- Rules G1 and G2 in a new section, "Who may change an agent": a shipped agent's instructions,
  skills and schedules change only with its source; the Chief of staff, another agent, itself, a
  person (Undo), and a schedule kept for it are refused in words naming the source. Its tests fail
  on six cases with the guard taken out.
- Deleting a kit's module asks whether to keep its agents (kept by default, made here from then
  on). The Agents page groups them: the Chief of staff, From Alpha, From <kit>, Made here; the rail
  beside a conversation says "· Sourcing"; an agent's page says "From Sourcing 0.1.0" and "Changes
  with Sourcing"; a kit's Setup tab lists its agents.

Journeys first: `a-kit-brings-its-agents` and `a-kit-update-keeps-memory`, on a made-up kit
(`journeys/fixtures/kits/sourcing`, and `sourcing-2` for its update), fail on main since a kit of
API 3 is refused; both pass now. Asked to change Sourcer's instructions, the Chief of staff said it
could not, since they change only through the Sourcing kit, and offered a copy of its own.
an-agent-remembers, an-agent-on-a-schedule and one-named-agent-answers pass too.

In WebKit on an empty Alpha with the made-up kit installed: the groups, the agent's page (no Add
on a shipped agent's schedules), the Setup tab's Agents and the Delete dialog's "Keep its agents".

On his look, "the responses should be clear and intuitive": the Chief of staff had said "I've added
it" before saying it could not change Sourcer's instructions. Alpha's prompt (`core/config/system.md`)
now says to lead with the answer, and when something asked was not done as asked, to say so first
with why, then what was done instead; the shipped agent's refusal says the same. The journey checks
the reply's first sentence says what was not done, and passed 2 of 2 ("I couldn't change Sourcer's
instructions."). Its memory step now tells Sourcer a plain fact: told a rule, Sourcer had rightly
kept it in How to work instead of its memory.

On his "ok looks good": Back on an agent's page now goes to Intelligence › Agents, where the page is
opened from, not to the Agents conversation.
