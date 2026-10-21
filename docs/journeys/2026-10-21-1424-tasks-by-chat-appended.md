# Journey tasks-by-chat: 2026-10-21 14:24

Tasks: said in a sentence, each put on the row it concerns, with a reminder and a repeat

Fresh tenant, model claude-opus-5-5, Alpha's prompt appended to Claude Code’s.
**Passed** in 34 s.


## 1. Said “Make a table Clients with a Name and a City, and add Acme Plumbing in Denver and Riverside Dental in Boulder.
”

Reply (16.7 s): I made a Clients table with Name and City columns, and added Acme Plumbing in Denver and Riverside Dental in Boulder. Both are recorded as things you told me.

Steps: Made the table Clients; Added 2 rows to Clients.

Tokens so far in the session: claude-haiku-5-5: in 1207 (cache read 0), out 18; claude-opus-5-5: in 67241 (cache read 44596), out 380.

- pass: rows in Clients: 2 (saw 2)

## 2. Said “Remind me to send Acme Plumbing their June report next Friday at 10am. Also add a task to call Riverside Dental about their overdue invoice, high priority, and a task to review all clients every Monday starting next Monday.
”

Reply (11.9 s): I've added all three tasks:

- **Send Acme Plumbing their June report:** due Friday 30 October at 10am, with a reminder then. It's on Acme Plumbing's row. I read "next Friday" as the Friday of next week; if you meant this Friday, 23 October, I can move it.
- **Call Riverside Dental about their overdue invoice:** high priority, on Riverside Dental's row. You didn't give a date, so it has none.
- **Review all clients:** on the Clients table, every Monday starting 26 October. A new one appears each time you finish the last.

Steps: Worked on it; Worked on it; Worked on it.

Tokens so far in the session: claude-haiku-5-5: in 1207 (cache read 0), out 18; claude-opus-5-5: in 114535 (cache read 90236), out 1476.

- pass: SELECT title FROM tasks gives 3 (saw [{"title":"Send Acme Plumbing their June report"},{"title":"Call Riverside Dental about their overdue invoice"},{"title":"Review all clients"}])
- pass: SELECT t.title FROM tasks t JOIN clients c ON c.id = t.row WHERE c.name = 'Acme Plumbing' AND t.remind_at IS NOT NULL gives 1 (saw [{"title":"Send Acme Plumbing their June report"}])
- pass: SELECT t.title FROM tasks t JOIN clients c ON c.id = t.row WHERE c.name = 'Riverside Dental' AND t.priority = 'high' gives 1 (saw [{"title":"Call Riverside Dental about their overdue invoice"}])
- pass: SELECT title FROM tasks WHERE repeat IS NOT NULL AND due IS NOT NULL gives 1 (saw [{"title":"Review all clients"}])
- pass: the reply matches /Acme Plumbing|Riverside Dental/ (saw I've added all three tasks:

- **Send Acme Plumbing their June report:** due Friday 30 October at 10am, with a reminder then. It's on Acme Plumbing's row. I rea)
- pass: errors: 0 (saw 0)

## 3. Said “The Riverside call is done.”

Reply (5.9 s): I've marked the call to Riverside Dental about the overdue invoice as done. You still have two open: Acme Plumbing's June report on Friday 30 October at 10am, and the client review every Monday starting 26 October.

Steps: Worked on it.

Tokens so far in the session: claude-haiku-5-5: in 1207 (cache read 0), out 18; claude-opus-5-5: in 164003 (cache read 139157), out 1646.

- pass: SELECT title FROM tasks WHERE state = 'Done' gives 1 (saw [{"title":"Call Riverside Dental about their overdue invoice"}])
- pass: errors: 0 (saw 0)

## The world after

Clients: Name (text), City (text)

- name "Acme Plumbing" [stated], city "Denver" [stated]
- name "Riverside Dental" [stated], city "Boulder" [stated]
