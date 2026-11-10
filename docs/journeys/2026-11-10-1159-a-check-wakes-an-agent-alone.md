# Journey a-check-wakes-an-agent: 2026-11-10 11:59

A check that finds nothing wakes nobody, and one that finds something wakes the agent

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 22 s, $0.30.


## 1. Said “In a module called Sales desk, make a table Leads with a Name. Add no rows yet.”

Reply (8.0 s): The Sales desk module now has a Leads table with a Name field and no rows.

Alpha won't make a table that holds only a name, so I also added two fields you didn't ask for: Email and Status (New, Contacted, Qualified, Won, Lost). A Notes field comes with the table automatically. The Status options are my guess, so tell me if you'd like them changed or if you want either field removed.

Steps: Made the table Leads; Made the table Leads.

Spent so far: claude-haiku-5-5: in 1193 (cache read 0), out 18; claude-opus-5-5: in 67234 (cache read 60282), out 806; $0.08.

- pass: rows in Leads: 0 (saw 0)
- pass: errors: 0 (saw 0)

## 2. Said “Make an agent called Watcher. Its job is watching for new leads. Its instructions are to be brief.”

Reply (3.8 s): Watcher is set up. Its job is watching for new leads, and its only instruction is to be brief.

It doesn't check anything on its own yet, because nothing wakes it when a lead comes in. If you'd like, I can have it run each time the Leads table changes, or at a set time each day.

Steps: Looked for the right connection; Kept the agent Watcher.

Spent so far: claude-haiku-5-5: in 1193 (cache read 0), out 18; claude-opus-5-5: in 138749 (cache read 130415), out 1132; $0.12.

- pass: agents: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 3. Said “Keep a schedule called Watch the leads, every hour. It must look first with a check that reads the Leads table and wakes you only when the table has a row, with their names as what it found. Each time you wake, tell me the names in one sentence.
”

Reply (6.4 s): The Watch the leads schedule is on and runs every hour, next at 12:59. Its check tried once and stayed asleep because the Leads table is empty. Once the table has a row, I'll wake each hour and tell you the names in one sentence, including names I've already told you.

Steps: Looked for the right connection; Worked on it; Looked through the tables; Worked on it.

Spent so far: claude-haiku-5-5: in 2430 (cache read 0), out 35; claude-opus-5-5: in 215673 (cache read 196005), out 1753; $0.23.

- pass: Watcher keeps 1 schedule(s) with a check (saw Watch the leads (check))
- pass: errors: 0 (saw 0)

## 4. Pressed Run now on Watch the leads: Nothing new.

Took 0.1 s.

- pass: Watcher's last run matches /Nothing new/ (saw Nothing new.)
- pass: the task Watch the leads, 0 of them (saw none)

## 5. Said “Add a lead called Oat Mill to Leads.”

Reply (2.2 s): Oat Mill is now in Leads, with Email and Status left blank.

Watcher won't have noticed it, since nothing wakes it yet.

Steps: Added a row to Leads.

Spent so far: claude-haiku-5-5: in 3623 (cache read 0), out 53; claude-opus-5-5: in 326947 (cache read 309600), out 2450; $0.25.

- pass: rows in Leads: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 6. Pressed Run now on Watch the leads: Watch the leads woke its agent.

Took 1.1 s.

- pass: the task Watch the leads is done, 1 of them (saw 1, the newest done)
- pass: the reply matches /Oat Mill/ (saw The Sales desk Leads table has one lead: Oat Mill.)
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 48 lines.

## The world after

Leads: Name (text), Email (email), Status (choice), Notes (notes)

- name "Oat Mill" [stated]
