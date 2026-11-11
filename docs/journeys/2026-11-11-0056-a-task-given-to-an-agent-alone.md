# Journey a-task-given-to-an-agent: 2026-11-11 00:56

A task given to an agent is worked in its own thread and ends Done

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 13 s, $0.23.


## 1. Said “Make an agent called Pricer. It answers what things cost, and its instructions are: a widget costs 12 dollars, the source is the price list.
”

Reply (7.4 s): I've made Pricer, an agent that answers what things cost. Its instructions say a widget costs 12 dollars and the source is the price list, and it will name the price list when it gives a price.

I added one line you didn't ask for: if someone asks about something other than a widget, Pricer will say it doesn't have that price instead of guessing. You can ask it something now. It only knows the widget price, so give me the other prices from the list if you want it to cover more items.

Steps: Looked for the right connection; Kept the agent Pricer.

Spent so far: claude-haiku-5-5: in 1209 (cache read 0), out 15; claude-opus-5-5: in 68129 (cache read 61969), out 518; $0.07.

- pass: agents: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 2. Said “Add a task called "Price a widget" and give it to Pricer.”

Reply (6.0 s): A widget costs **$12**. That price comes from the price list.

Steps: Ran: List files in my agent folder.

Spent so far: claude-haiku-5-5: in 2425 (cache read 0), out 30; claude-opus-5-5: in 228845 (cache read 209103), out 1476; $0.23.

- pass: errors: 0 (saw 0)
- pass: the reply matches /12/ (saw A widget costs **$12**. That price comes from the price list.)

The journal verifies, rows included: 22 lines.

## The world after
