# Journey a-check-wakes-an-agent: 2026-11-10 19:18

A check that finds nothing wakes nobody, and one that finds something wakes the agent

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 33 s, $0.27.


## 1. Said “In a module called Sales desk, make a table Leads with a Name. Add no rows yet.”

Reply (10.3 s): I made the Sales desk module with an empty Leads table. It has no rows.

Alpha won't make a table that holds only a name, so I added a few fields you'd likely want. They're my guesses, and you can rename or remove any of them:
- **Email**
- **Status:** New, Contacted, Qualified, Won or Lost
- **First contact:** the date the lead came in

Every table also gets a Notes field automatically.

I also wrote a short description of what the module is for: your sales work, keeping track of leads, to help decide which ones to follow up next. That's my guess too, so change it if it's off.

Steps: Made the table Leads; Made the table Leads.

Spent so far: claude-haiku-5-5: in 1193 (cache read 0), out 18; claude-opus-5-5: in 63952 (cache read 58972), out 864; $0.07.

- pass: rows in Leads: 0 (saw 0)
- pass: errors: 0 (saw 0)

## 2. Said “Make an agent called Watcher. Its job is watching for new leads. Its instructions are to be brief.”

Reply (5.6 s): I made the Watcher agent. Its job is watching for new leads, and its only instruction is "Be brief." I also gave it a short description saying it checks the Leads table in Sales desk, so other agents know when to hand it work.

Right now Watcher only works when someone gives it something to do. It won't check for new leads on its own until it's set to run on a schedule or whenever a lead is added.

Steps: Looked for the right connection; Kept the agent Watcher.

Spent so far: claude-haiku-5-5: in 1193 (cache read 0), out 18; claude-opus-5-5: in 132677 (cache read 126124), out 1299; $0.10.

- pass: agents: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 3. Said “Keep a schedule called Watch the leads, every hour. It must look first with a check that reads the Leads table and wakes you only when the table has a row, with their names as what it found. Each time you wake, tell me the names in one sentence.
”

Reply (8.7 s): I set up "Watch the leads" to run every hour, starting at 20:19 UTC tonight. Each time, a check reads the Leads table first and only wakes me if it has rows. When it does, I'll tell you their names in one sentence. I tried the check once just now: the table is empty, so it didn't wake me.

Steps: Looked for the right connection; Looked through the tables; Worked on it; Worked on it.

Spent so far: claude-haiku-5-5: in 2430 (cache read 0), out 259; claude-opus-5-5: in 228202 (cache read 212083), out 1958; $0.21.

- pass: Watcher keeps 1 schedule(s) with a check (saw Watch the leads (check))
- pass: errors: 0 (saw 0)

## 4. Pressed Run now on Watch the leads: Nothing new.

Took 0.3 s.

- pass: Watcher's last run matches /Nothing new/ (saw Nothing new.)
- pass: the task Watch the leads, 0 of them (saw none)

## 5. Said “Add a lead called Oat Mill to Leads.”

Reply (2.7 s): I added Oat Mill to Leads. Its other fields are empty for now.

Steps: Added a row to Leads.

Spent so far: claude-haiku-5-5: in 3623 (cache read 0), out 277; claude-opus-5-5: in 313228 (cache read 299347), out 2737; $0.23.

- pass: rows in Leads: 1 (saw 1)
- pass: errors: 0 (saw 0)

## 6. Pressed Run now on Watch the leads: Watch the leads woke its agent.

Took 5.5 s.

- pass: the task Watch the leads is done, 1 of them (saw 1, the newest done)
- pass: the reply matches /Oat Mill/ (saw The Leads table has: Oat Mill.)
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 48 lines.

## The world after

Leads: Name (text), Email (email), Status (choice), First contact (date), Notes (notes)

- name "Oat Mill" [stated]
