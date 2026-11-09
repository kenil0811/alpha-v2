# Journey what-each-client-owes: 2026-11-09 22:04

a client shows what it owes, worked out from its invoices, and stays right as they are paid

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 29 s, $0.19.


## 1. Said “In a module called Billing, make a table Clients with a Name, and a table Invoices with a Number, an Amount in dollars, Paid (Yes or No) and the client it is for. On each client, show what they still owe: their unpaid invoices, added up.
”

Reply (17.9 s): The Billing module now has both tables, and each client has a **Still owes** column.

- **Clients:** Name, Still owes, and Notes, which every main table gets. I also added an Email field, because the system won't make a table that holds only a name. You can ignore it or put it to use.
- **Invoices:** Number, Amount in dollars, Paid (Yes or No), Client and Notes. Number is text, so something like INV-001 works.
- **Still owes:** this adds up the client's invoices marked No and updates by itself. An invoice with Paid left blank isn't counted, so mark each one Yes or No.

Both tables are empty, so I haven't yet seen the total work on real invoices.

Steps: Made the table Clients; Made the table Clients; Made the table Invoices; Added Still owes to Clients.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 114708 (cache read 107365), out 1874; $0.12.

- pass: Clients has a summary (saw Still owes)
- pass: errors: 0 (saw 0)

## 2. Said “Add Acme with invoices A-1 for $100, paid, and A-2 for $250, not paid yet; and Bolt, with no invoices yet.
”

Reply (6.5 s): I've added both clients and Acme's two invoices, and the Still owes total is working: only the unpaid invoice counts.

| Client | Invoices | Still owes |
|---|---|---|
| Acme | A-1 for $100 (paid), A-2 for $250 (not paid) | $250 |
| Bolt | None yet | $0 |

Steps: Added 2 rows to Clients; Added 2 rows to Invoices; Looked through the tables; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 214710 (cache read 205359), out 2522; $0.17.

- pass: rows in Clients: 2 (saw 2)
- pass: rows in Invoices: 2 (saw 2)
- pass: Clients has a summary that comes to 250 on Acme (saw Still owes = 250)
- pass: Clients has a summary that comes to 0 on Bolt (saw Still owes = 0)

## 3. Said “Acme paid A-2 today.”

Reply (4.1 s): A-2 is now marked paid, so Acme owes $0. The table only records Yes or No, so today's payment date isn't saved. I can add a Paid on date to invoices if you'd like to keep it.

Steps: Changed a row in Invoices; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 267284 (cache read 257041), out 2891; $0.19.

- pass: Clients has a summary that comes to 0 on Acme (saw Still owes = 0)
- pass: errors: 0 (saw 0)

## The world after

Clients: Name (text), Email (email), Notes (notes), Still owes (summary)

- name "Acme" [stated], still_owes {"amount":0,"currency":"USD"} [computed]
- name "Bolt" [stated], still_owes {"amount":0,"currency":"USD"} [computed]

Invoices: Number (text), Amount (money), Paid (choice), Client (relation), Notes (notes)

- number "A-1" [stated], amount {"amount":100,"currency":"USD"} [stated], paid "Yes" [stated], client "r_a4vhx30whq" [stated]
- number "A-2" [stated], amount {"amount":250,"currency":"USD"} [stated], paid "Yes" [stated], client "r_a4vhx30whq" [stated]
