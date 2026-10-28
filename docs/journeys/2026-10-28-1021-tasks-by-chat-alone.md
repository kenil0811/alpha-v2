# Journey tasks-by-chat: 2026-10-28 10:21

Tasks: said in a sentence, each put on the row it concerns, with a reminder and a repeat

Fresh tenant, model claude-opus-5-5, Alpha's prompt alone.
**Passed** in 39 s.


## 1. Said “Make a table Clients with a Name and a City, and add Acme Plumbing in Denver and Riverside Dental in Boulder.
”

Reply (17.8 s): I made a Clients table with a Name and a City, plus a Notes field each row gets automatically. I added both clients as you gave them:

- Acme Plumbing, Denver
- Riverside Dental, Boulder

The table is in a new Clients module. I filled in a guess at what the module is for: keeping track of who your clients are and where they're based. You can change that wording whenever you want.

Steps: Made the table Clients; Added 2 rows to Clients.

Tokens so far in the session: claude-haiku-5-5: in 1207 (cache read 0), out 30; claude-opus-5-5: in 60384 (cache read 54931), out 595.

- pass: rows in Clients: 2 (saw 2)

## 2. Said “Remind me to send Acme Plumbing their June report next Friday at 10am. Also add a task to call Riverside Dental about their overdue invoice, high priority, and a task to review all clients every Monday starting next Monday.
”

Reply (15.1 s): I've added all three tasks:

- **Send Acme Plumbing their June report**: due Friday 6 November at 10am, with a reminder at the same time. It's on Acme Plumbing's row. I took "next Friday" to mean the 6th, not this Friday the 30th. Tell me if you meant the 30th and I'll move it.
- **Call Riverside Dental about their overdue invoice**: high priority, on Riverside Dental's row. It has no due date because you didn't give one.
- **Review all clients**: every Monday, starting 2 November, on the Clients table. When you mark one done, the next Monday's task is created.

Steps: Worked on it; Added a task: Send Acme Plumbing their June report; Added a task: Call Riverside Dental about their overdue invoice; Added a task: Review all clients.

Tokens so far in the session: claude-haiku-5-5: in 1207 (cache read 0), out 30; claude-opus-5-5: in 125353 (cache read 117857), out 1610.

- pass: SELECT title FROM tasks gives 3 (saw [{"title":"Send Acme Plumbing their June report"},{"title":"Call Riverside Dental about their overdue invoice"},{"title":"Review all clients"}])
- pass: SELECT t.title FROM tasks t JOIN clients c ON c.id = t.row WHERE c.name = 'Acme Plumbing' AND t.remind_at IS NOT NULL gives 1 (saw [{"title":"Send Acme Plumbing their June report"}])
- pass: SELECT t.title FROM tasks t JOIN clients c ON c.id = t.row WHERE c.name = 'Riverside Dental' AND t.priority = 'high' gives 1 (saw [{"title":"Call Riverside Dental about their overdue invoice"}])
- pass: SELECT title FROM tasks WHERE repeat IS NOT NULL AND due IS NOT NULL gives 1 (saw [{"title":"Review all clients"}])
- pass: the reply matches /Acme Plumbing|Riverside Dental/ (saw I've added all three tasks:

- **Send Acme Plumbing their June report**: due Friday 6 November at 10am, with a reminder at the same time. It's on Acme Plumbing')
- pass: errors: 0 (saw 0)

## 3. Said “The Riverside call is done.”

Reply (5.7 s): I've marked the call to Riverside Dental about their overdue invoice as done. If you tell me how the call went, I can add a note to Riverside Dental's row.

Steps: Marked a task done.

Tokens so far in the session: claude-haiku-5-5: in 1207 (cache read 0), out 30; claude-opus-5-5: in 171281 (cache read 163251), out 1758.

- pass: SELECT title FROM tasks WHERE state = 'Done' gives 1 (saw [{"title":"Call Riverside Dental about their overdue invoice"}])
- pass: errors: 0 (saw 0)

## The world after

Clients: Name (text), City (text), Notes (notes)

- name "Acme Plumbing" [stated], city "Denver" [stated]
- name "Riverside Dental" [stated], city "Boulder" [stated]
