# 9 November 2026: giving a task to an agent

Plan and Kenil's calls: https://claude.ai/artifact/7f9SvkGS4EfoTajZC8oxpu. All as recommended; four at
once "for now".

- A task's owner can be an agent. Giving it starts at once, in a thread of its own (`task:<id>:<n>`
  turns, a session of its own), so the agent's chat is never held up.
- Up to `tasks_at_once` (4) per agent; the rest wait in To do.
- The thread ending well makes the task Done; a card, a failure or Stop makes it Waiting, with Run again.
  Writing on the task reopens it. A restart waits for the person and is not replayed.
- The task's page has one line for the work, which opens on a page of its own (`#/tasks/<id>/work`);
  Home lists the last three completed tasks, with Clear; an agent's page lists its tasks. Getting Alpha
  ready left Home on his look; its items stay in Settings › Permissions.
- Agents can give tasks to each other: rule R6's 8 and 4 count these too, and Alpha counts them.
- Due dates and repeats do not start work yet: that comes with agents on a schedule.
