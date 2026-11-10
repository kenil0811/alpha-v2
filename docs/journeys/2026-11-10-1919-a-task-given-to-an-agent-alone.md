# Journey a-task-given-to-an-agent: 2026-11-10 19:19

A task given to an agent is worked in its own thread and ends Done

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 14 s, $0.22.


## 1. Said “Make an agent called Pricer. It answers what things cost, and its instructions are: a widget costs 12 dollars, the source is the price list.
”

Reply (6.0 s): I've made Pricer, an agent that answers what things cost. Its instructions say a widget costs $12, and Pricer will name the price list as the source. I also told it to say when it doesn't have a price for something instead of guessing.

Pricer will use these instructions from the next message it gets.

Steps: Looked for the right connection; Kept the agent Pricer.

Spent so far: claude-haiku-5-5: in 1209 (cache read 0), out 15; claude-opus-5-5: in 64830 (cache read 59570), out 419; $0.06.

- pass: agents: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 2. Said “Add a task called "Price a widget" and give it to Pricer.”

Reply (8.1 s): A widget costs **$12**, according to the price list.

That figure comes from my instructions, which name the price list as the source. I didn't find a copy of the price list itself saved anywhere here. I've marked the "Price a widget" task as done.

Steps: Searched for “widget price list”; Looked at the tasks; Marked a task done.

Spent so far: claude-haiku-5-5: in 2425 (cache read 0), out 30; claude-opus-5-5: in 263024 (cache read 245341), out 1466; $0.22.

- pass: errors: 0 (saw 0)
- pass: the reply matches /12/ (saw A widget costs **$12**, according to the price list.

That figure comes from my instructions, which name the price list as the source. I didn't find a copy of t)

The journal verifies, rows included: 25 lines.

## The world after
