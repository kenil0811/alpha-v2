# 10 November 2026: agents on a schedule

Plan and Kenil's calls: https://claude.ai/artifact/Wbf24oLQSN2gKvFBNGNUme. All as recommended; call 6
left to me, taken now.

- An agent keeps a schedule: a file in its folder (`schedules/<name>.md`, the same shape as a module's),
  made with the `schedule` tool or on its page. No card, and Undo works. It belongs to who asked.
- A check is a small script in the agent's folder that runs first and returns `{ wake: false }`, or
  `{ wake: true, found }`. It only looks: it reads tables and the agent's sites, and cannot write,
  draft, send or use the model. It is tried when it is made, and one that does not work is not kept.
- A wake opens a task in a fresh thread, which starts with what to do, what was found, when it was due
  and what it reported last. It counts in the 4 at once. Reports go to the task's page, Recently
  completed tasks and a notice, never the agent's chat, though the agent knows what it reported.
- `nothing_to_report` closes a run with no notice. A run still open holds the next one and they become
  one. Missed runs become one run and the agent judges. A run cannot make or change schedules.
- A wake counts against the 24 runs a day; a look that finds nothing does not.
- A task given to an agent can start later, and each copy of a repeat starts on its day, at its time or
  at `repeat_starts_at` (08:00).
- A module's schedule can say `wakes: true`. The Chief of staff takes it unless the person picks another
  agent on the module's Setup.
- Triggers gained weekday and named days, and common patterns now read in words.

Checked: `pnpm check` green; four new journeys (a schedule made in chat, a check that wakes, a silent run
and a card, a task waiting for its day); the whole round on 10 Nov passed 30 and left 1 waiting on step 8,
$5.03. In WebKit on an empty home: the agent's page, Add, Run now, Undo, a check saying nothing new, a
task's start time, and Intelligence › Schedules.
