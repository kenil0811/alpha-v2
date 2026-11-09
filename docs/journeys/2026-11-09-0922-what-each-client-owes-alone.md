# Journey what-each-client-owes: 2026-11-09 09:22

a client shows what it owes, worked out from its invoices, and stays right as they are paid

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 34 s, $0.22.


## 1. Said “In a module called Billing, make a table Clients with a Name, and a table Invoices with a Number, an Amount in dollars, Paid (Yes or No) and the client it is for. On each client, show what they still owe: their unpaid invoices, added up.
”

Reply (19.5 s): The Billing module is set up with both tables. Both are empty, so I haven't seen the total work on real invoices yet.

- **Clients:** Name and Still owes, which adds up the amounts of that client's unpaid invoices and updates by itself. It also has a Billing email, which you didn't ask for: Alpha wouldn't create a table holding only a name, so I assumed that field. You can rename it or put it to another use.
- **Invoices:** Number, Amount in dollars, Paid (Yes or No), and Client. Number accepts letters too, so something like INV-001 works.

Only invoices marked No count towards Still owes, so one with Paid left blank won't be included.

Both tables also come with a Notes field for free notes.

Steps: Made the table Clients; Made the table Clients; Made the table Invoices; Added Still owes to Clients.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 108368 (cache read 101043), out 2031; $0.12.

- pass: Clients has a summary (saw Still owes)
- pass: errors: 0 (saw 0)

## 2. Said “Add Acme with invoices A-1 for $100, paid, and A-2 for $250, not paid yet; and Bolt, with no invoices yet.
”

Reply (8.9 s): I've added Acme and Bolt, and the Still owes total is working:

| Client | Invoices | Still owes |
|---|---|---|
| Acme | A-1 for $100 (paid), A-2 for $250 (not paid) | $250 |
| Bolt | None yet | $0 |

Steps: Added 2 rows to Clients; Looked through the tables; Added 2 rows to Invoices; Looked through the tables; Looked through the tables; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 252754 (cache read 242698), out 2870; $0.19.

- pass: rows in Clients: 2 (saw 2)
- pass: rows in Invoices: 2 (saw 2)
- pass: Clients has a summary that comes to 250 on Acme (saw Still owes = 250)
- pass: Clients has a summary that comes to 0 on Bolt (saw Still owes = 0)

## 3. Said “Acme paid A-2 today.”

Reply (5.6 s): A-2 is now marked paid, so Acme owes $0.

Invoices don't have a field for the payment date, so today's date isn't recorded anywhere. Would you like me to add a Paid on date to Invoices and set A-2 to today?

Steps: Changed a row in Invoices; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 330068 (cache read 319149), out 3340; $0.22.

- pass: Clients has a summary that comes to 0 on Acme (saw Still owes = 0)
- pass: errors: 0 (saw 0)

## The world after

Clients: Name (text), Billing email (email), Notes (notes), Still owes (summary)

- name "Acme" [stated], still_owes {"amount":0,"currency":"USD"} [computed]
- name "Bolt" [stated], still_owes {"amount":0,"currency":"USD"} [computed]

Invoices: Number (text), Amount (money), Paid (choice), Client (relation), Notes (notes)

- number "A-1" [stated], amount {"amount":100,"currency":"USD"} [stated], paid "Yes" [stated], client "r_4kegrxsn3d" [stated]
- number "A-2" [stated], amount {"amount":250,"currency":"USD"} [stated], paid "Yes" [stated], client "r_4kegrxsn3d" [stated]
