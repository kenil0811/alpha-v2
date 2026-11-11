# Journey a-task-waits-for-its-day: 2026-11-11 00:52

A task told to start later, and a repeating task, wait for their day

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 24 s, $0.19.


## 1. Said “Make an agent called Pricer. It answers what things cost. Its instructions are to be brief.”

Reply (5.9 s): I've made Pricer. It answers questions about what things cost and is told to be brief: it gives the price, the currency and where the figure came from, or a short range if prices vary.

You can send it its first question whenever you like.

Steps: Looked for the right connection; Kept the agent Pricer.

Spent so far: claude-haiku-5-5: in 1194 (cache read 0), out 15; claude-opus-5-5: in 68059 (cache read 61411), out 413; $0.07.

- pass: agents: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 2. Said “Add a task called "Price a widget" and give it to Pricer, to start tomorrow at 9 in the morning.”

Reply (10.9 s): I added the task "Price a widget" and gave it to Pricer. Pricer will start on it tomorrow, Thursday 12 November, at 9:00 in the morning.

The task list shows Alpha as the owner, but the activity record says the task is for Pricer and starts at that time. It isn't attached to anything yet, so it sits on its own in your task list.

Steps: Worked on it; Added a task: Price a widget; Looked through the tables; Changed a task; Looked through the tables; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1194 (cache read 0), out 15; claude-opus-5-5: in 215811 (cache read 206452), out 1379; $0.14.

- pass: the task Price a widget is todo, 1 of them (saw 1, the newest todo)
- pass: errors: 0 (saw 0)

## 3. Said “Add a task called "Weekly review", due next Monday and repeating every Monday, and give it to Pricer.”

Reply (7.2 s): I added "Weekly review" and gave it to Pricer. It's due next Monday, 16 November, and repeats every Monday. Pricer will start each week's copy on its Monday.

Like "Price a widget", it isn't attached to anything yet, so it sits on its own in your task list.

Steps: Added a task: Weekly review; Looked through the tables; Changed a task; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1194 (cache read 0), out 15; claude-opus-5-5: in 322381 (cache read 311731), out 2025; $0.19.

- pass: the task Weekly review is todo, 1 of them (saw 1, the newest todo)
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 37 lines.

## The world after
