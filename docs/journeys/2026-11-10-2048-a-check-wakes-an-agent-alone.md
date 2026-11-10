# Journey a-check-wakes-an-agent: 2026-11-10 20:48

A check that finds nothing wakes nobody, and one that finds something wakes the agent

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 29 s, $0.30.


## 1. Said “In a module called Sales desk, make a table Leads with a Name. Add no rows yet.”

Reply (9.8 s): I've made the Sales desk module with a Leads table. It has no rows yet.

A table with only a name column wasn't allowed, so I added three more columns:
- **Email**, for how to reach the lead.
- **Status**, a pick-list: New, Contacted, Qualified, Won or Lost.
- **Notes**, which every main table gets automatically.

I also wrote a short description of what the module is for: it's for you and the sales team, it keeps track of leads who might buy, and it helps you decide which ones to follow up. It's marked as a guess until you change it. If you'd like different columns or statuses, say which and I'll change them.

Steps: Made the table Leads; Made the table Leads.

Spent so far: claude-haiku-5-5: in 1193 (cache read 0), out 18; claude-opus-5-5: in 67139 (cache read 60824), out 850; $0.08.

- pass: rows in Leads: 0 (saw 0)
- pass: errors: 0 (saw 0)

## 2. Said “Make an agent called Watcher. Its job is watching for new leads. Its instructions are to be brief.”

Reply (5.9 s): I've made Watcher. Its job is watching the Leads table in Sales desk for new leads, and its instructions tell it to be brief.

For now it only works when someone sends it a message or gives it a task. It won't notice new leads by itself until something sets it off, such as a check whenever a lead is added. Want me to set that up?

Steps: Looked for the right connection; Kept the agent Watcher.

Spent so far: claude-haiku-5-5: in 1193 (cache read 0), out 18; claude-opus-5-5: in 138881 (cache read 131021), out 1295; $0.12.

- pass: agents: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 3. Said “Keep a schedule called Watch the leads, every hour. It must look first with a check that reads the Leads table and wakes you only when the table has a row, with their names as what it found. Each time you wake, tell me the names in one sentence.
”

Reply (8.0 s): I've set up "Watch the leads" to run every hour. Each time, a check reads the Leads table and only wakes me if the table has at least one row. When it does, I'll tell you the names in one sentence.

I ran the check once to test it, and it didn't wake me because the table is empty right now. The first scheduled run is at 21:48 tonight.

Steps: Looked for the right connection; Looked through the tables; Worked on it; Worked on it.

Spent so far: claude-haiku-5-5: in 2430 (cache read 0), out 187; claude-opus-5-5: in 238448 (cache read 220060), out 1949; $0.23.

- pass: Watcher keeps 1 schedule(s) with a check (saw Watch the leads (check))
- pass: errors: 0 (saw 0)

## 4. Pressed Run now on Watch the leads: Nothing new.

Took 0.1 s.

- pass: Watcher's last run matches /Nothing new/ (saw Nothing new.)
- pass: the task Watch the leads, 0 of them (saw none)

## 5. Said “Add a lead called Oat Mill to Leads.”

Reply (3.2 s): I've added Oat Mill to Leads. Its email and status are blank because you didn't give them.

Watcher won't pick this up by itself yet, because nothing sets it off when a lead is added. If you want, I can set it to check whenever Leads changes.

Steps: Added a row to Leads.

Spent so far: claude-haiku-5-5: in 3623 (cache read 0), out 205; claude-opus-5-5: in 327508 (cache read 311091), out 2819; $0.25.

- pass: rows in Leads: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 6. Pressed Run now on Watch the leads: Watch the leads woke its agent.

Took 1.8 s.

- pass: the task Watch the leads is done, 1 of them (saw 1, the newest done)
- pass: the reply matches /Oat Mill/ (saw The Leads table has: Oat Mill.)
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 48 lines.

## The world after

Leads: Name (text), Email (email), Status (choice), Notes (notes)

- name "Oat Mill" [stated]
