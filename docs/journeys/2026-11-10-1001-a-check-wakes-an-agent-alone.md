# Journey a-check-wakes-an-agent: 2026-11-10 10:01

A check that finds nothing wakes nobody, and one that finds something wakes the agent

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 22 s, $0.29.


## 1. Said “In a module called Sales desk, make a table Leads with a Name. Add no rows yet.”

Reply (7.8 s): The Sales desk module now has a Leads table with a Name field and no rows.

Alpha won't make a table that holds only a name, so I also added Email and Status (New, Contacted, Qualified, Won, Lost). A Notes field comes with it automatically. I also assumed a short description of the module: it serves the sales desk, tracks its leads and helps decide which to pursue.

Tell me if you'd like different fields, statuses or wording.

Steps: Made the table Leads; Made the table Leads.

Spent so far: claude-haiku-5-5: in 1193 (cache read 0), out 18; claude-opus-5-5: in 67163 (cache read 61322), out 797; $0.08.

- pass: rows in Leads: 0 (saw 0)
- pass: errors: 0 (saw 0)

## 2. Said “Make an agent called Watcher. Its job is watching for new leads. Its instructions are to be brief.”

Reply (4.3 s): Watcher is set up. Its job is watching for new leads in the Sales desk, and its only instruction is to be brief.

It won't check on its own yet, because nothing is waking it up. If you'd like, I can have it run whenever a row is added to Leads, or on a set schedule.

Steps: Looked for the right connection; Kept the agent Watcher.

Spent so far: claude-haiku-5-5: in 1193 (cache read 0), out 18; claude-opus-5-5: in 138681 (cache read 131408), out 1156; $0.11.

- pass: agents: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 3. Said “Keep a schedule called Watch the leads, every hour. It must look first with a check that reads the Leads table and wakes you only when the table has a row, with their names as what it found. Each time you wake, tell me the names in one sentence.
”

Reply (6.6 s): Watch the leads is on and runs every hour, next at 11:01 UTC. The check only wakes me when the Leads table has a row, and then I'll give you the names in one sentence. I tried it just now: the table is empty, so it didn't wake me.

Steps: Looked for the right connection; Worked on it; Looked through the tables; Worked on it.

Spent so far: claude-haiku-5-5: in 2430 (cache read 0), out 196; claude-opus-5-5: in 215565 (cache read 196962), out 1793; $0.22.

- pass: Watcher keeps 1 schedule(s) with a check (saw Watch the leads (check))
- pass: errors: 0 (saw 0)

## 4. Pressed Run now on Watch the leads: Nothing new.

Took 0.1 s.

- pass: Watcher's last run matches /Nothing new/ (saw Nothing new.)
- pass: the task Watch the leads, 0 of them (saw none)

## 5. Said “Add a lead called Oat Mill to Leads.”

Reply (2.0 s): Oat Mill is now in Leads, with only the name filled in; Email and Status are blank.

Steps: Added a row to Leads.

Spent so far: claude-haiku-5-5: in 3623 (cache read 0), out 214; claude-opus-5-5: in 326792 (cache read 311603), out 2457; $0.23.

- pass: rows in Leads: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 6. Pressed Run now on Watch the leads: Watch the leads woke its agent.

Took 1.4 s.

- pass: the task Watch the leads is done, 1 of them (saw 1, the newest done)
- pass: the reply matches /Oat Mill/ (saw The Leads table in the Sales desk has one row: Oat Mill.)
- pass: errors: 0 (saw 0)

## The world after

Leads: Name (text), Email (email), Status (choice), Notes (notes)

- name "Oat Mill" [stated]
