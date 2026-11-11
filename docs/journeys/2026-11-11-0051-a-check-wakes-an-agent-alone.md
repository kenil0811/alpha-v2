# Journey a-check-wakes-an-agent: 2026-11-11 00:51

A check that finds nothing wakes nobody, and one that finds something wakes the agent

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 29 s, $0.31.


## 1. Said “In a module called Sales desk, make a table Leads with a Name. Add no rows yet.”

Reply (9.1 s): I've made the Sales desk module with a Leads table in it. It has no rows yet.

The system wouldn't create a table that holds only a name, so I added a few fields of my own choosing:
- **Email**
- **Status:** New, Contacted, Qualified, Won or Lost
- **First contact:** a date

A Notes field was also added automatically, as every main table gets one.

I also wrote a short description of what the module is for, which you can edit. It says it's for you and the sales team, keeps track of the leads you're working, and helps decide which leads to follow up.

I can remove or rename any of the extra fields if you'd rather keep it simpler.

Steps: Made the table Leads; Made the table Leads.

Spent so far: claude-haiku-5-5: in 1193 (cache read 0), out 18; claude-opus-5-5: in 67260 (cache read 60879), out 907; $0.08.

- pass: rows in Leads: 0 (saw 0)
- pass: errors: 0 (saw 0)

## 2. Said “Make an agent called Watcher. Its job is watching for new leads. Its instructions are to be brief.”

Reply (5.7 s): I've made an agent called Watcher. Its job is watching the Sales desk Leads table for new leads, and its instructions are to be brief.

It only acts when someone gives it a task or asks it a question, so it won't notice new leads by itself yet. Do you want me to set it to look whenever a lead is added, or check once a day?

Steps: Looked for the right connection; Kept the agent Watcher.

Spent so far: claude-haiku-5-5: in 1193 (cache read 0), out 18; claude-opus-5-5: in 139226 (cache read 131287), out 1385; $0.12.

- pass: agents: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 3. Said “Keep a schedule called Watch the leads, every hour. It must look first with a check that reads the Leads table and wakes you only when the table has a row, with their names as what it found. Each time you wake, tell me the names in one sentence.
”

Reply (9.9 s): I've set up the hourly "Watch the leads" schedule. Before each run, a check reads the Sales desk Leads table. It only wakes me if the table has at least one row, and it passes me the leads' names. When that happens, I'll give you the names in one sentence.

I ran the check once as a test and it stayed quiet, which is right because the Leads table is empty. Since there were no rows, that test couldn't show whether it reads the names correctly; we'll see that the first time a lead is added. The first run is at about 1:51 am.

Steps: Looked for the right connection; Looked through the tables; Looked through the tables; Worked on it.

Spent so far: claude-haiku-5-5: in 2430 (cache read 0), out 177; claude-opus-5-5: in 259485 (cache read 242575), out 2165; $0.23.

- pass: Watcher keeps 1 schedule(s) with a check (saw Watch the leads (check))
- pass: errors: 0 (saw 0)

## 4. Pressed Run now on Watch the leads: Nothing new.

Took 0.1 s.

- pass: Watcher's last run matches /Nothing new/ (saw Nothing new.)
- pass: the task Watch the leads, 0 of them (saw none)

## 5. Said “Add a lead called Oat Mill to Leads.”

Reply (2.6 s): I've added Oat Mill to Leads. Its email, status and first contact date are blank for now.

Watcher won't pick this up by itself, because nothing tells it to look yet.

Steps: Added a row to Leads.

Spent so far: claude-haiku-5-5: in 3623 (cache read 0), out 195; claude-opus-5-5: in 328408 (cache read 311797), out 2942; $0.25.

- pass: rows in Leads: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 6. Pressed Run now on Watch the leads: Watch the leads woke its agent.

Took 1.5 s.

- pass: the task Watch the leads is done, 1 of them (saw 1, the newest done)
- pass: the reply matches /Oat Mill/ (saw The leads are: Oat Mill.)
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 49 lines.

## The world after

Leads: Name (text), Email (email), Status (choice), First contact (date), Notes (notes)

- name "Oat Mill" [stated]
