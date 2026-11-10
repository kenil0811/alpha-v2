# Journey a-task-waits-for-its-day: 2026-11-10 12:00

A task told to start later, and a repeating task, wait for their day

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 28 s, $0.22.


## 1. Said “Make an agent called Pricer. It answers what things cost. Its instructions are to be brief.”

Reply (3.9 s): Pricer is made. It answers what things cost, and its only instruction is to be brief.

Steps: Looked for the right connection; Kept the agent Pricer.

Spent so far: claude-haiku-5-5: in 1194 (cache read 0), out 15; claude-opus-5-5: in 67878 (cache read 61336), out 295; $0.07.

- pass: agents: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 2. Said “Add a task called "Price a widget" and give it to Pricer, to start tomorrow at 9 in the morning.”

Reply (13.3 s): "Price a widget" is set for Pricer to start tomorrow, Wednesday 11 November, at 9:00. The log confirms both the time and Pricer, though the task list's owner column still says Alpha. It may just show every agent that way, but I can't tell from here, so check that Pricer picks it up tomorrow.

The task isn't attached to anything yet, as you don't have any modules, and it has no due date.

Steps: Worked on it; Added a task: Price a widget; Looked through the tables; Looked through the tables; Looked at the team; Changed a task; Looked at the tasks; Looked through the tables; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1194 (cache read 0), out 15; claude-opus-5-5: in 242255 (cache read 231434), out 1551; $0.16.

- pass: the task Price a widget is todo, 1 of them (saw 1, the newest todo)
- pass: errors: 0 (saw 0)

## 3. Said “Add a task called "Weekly review", due next Monday and repeating every Monday, and give it to Pricer.”

Reply (10.8 s): "Weekly review" is set for Pricer, due next Monday, 16 November, and repeating every Monday. Pricer starts each one by itself on the day it's due. As with "Price a widget", the log says Pricer while the owner column says Alpha.

The task has only a title and Pricer's job is answering what things cost, so it won't know what to review. Tell me what it should cover and I'll add that to the task.

Steps: Added a task: Weekly review; Looked through the tables; Looked through the tables; Changed a task; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1194 (cache read 0), out 15; claude-opus-5-5: in 356071 (cache read 343125), out 2587; $0.22.

- pass: the task Weekly review is todo, 1 of them (saw 1, the newest todo)
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 46 lines.

## The world after
