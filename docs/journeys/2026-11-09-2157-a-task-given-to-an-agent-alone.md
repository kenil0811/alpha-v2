# Journey a-task-given-to-an-agent: 2026-11-09 21:57

A task given to an agent is worked in its own thread and ends Done

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 15 s, $0.47.


## 1. Said “Make an agent called Pricer. It answers what things cost, and its instructions are: a widget costs 12 dollars, the source is the price list.
”

Reply (4.5 s): I've made Pricer. It answers what things cost, and its instructions are the ones you gave: a widget costs 12 dollars, and the source is the price list.

The price list itself isn't in Alpha yet, so Pricer only knows the widget price as you stated it.

Steps: Looked for the right connection; Kept the agent Pricer.

Spent so far: claude-haiku-5-5: in 1209 (cache read 0), out 15; claude-opus-5-5: in 67522 (cache read 44609), out 328; $0.20.

- pass: agents: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 2. Said “Add a task called "Price a widget" and give it to Pricer.”

Reply (10.8 s): I added "Price a widget" and gave it to Pricer, which picked it up straight away and the task is now marked done. Pricer's answer: **a widget costs $12**, according to the price list. It says that figure comes from its instructions and that it didn't open the price list to check.

The task's owner shows as "Alpha" rather than Pricer, even though I assigned it to Pricer and Pricer did the work, so don't rely on that field to see who did it. The task isn't attached to any module or row, since you don't have any yet.

Steps: Worked on it; Added a task: Price a widget; Looked through the tables; Looked through the tables; Looked at the team; Looked through the tables.

Spent so far: claude-haiku-5-5: in 3634 (cache read 0), out 45; claude-opus-5-5: in 281371 (cache read 232694), out 1599; $0.47.

- pass: errors: 0 (saw 0)
- pass: the reply matches /12/ (saw I added "Price a widget" and gave it to Pricer, which picked it up straight away and the task is now marked done. Pricer's answer: **a widget costs $12**, accor)

## The world after
