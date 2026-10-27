# Journey what-each-client-owes: 2026-10-27 15:51

a client shows what it owes, worked out from its invoices, and stays right as they are paid

Fresh tenant, model claude-opus-5-5, Alpha's prompt alone.
**Passed** in 21 s.


## 1. Said “In a module called Billing, make a table Clients with a Name, and a table Invoices with a Number, an Amount in dollars, Paid (Yes or No) and the client it is for. On each client, show what they still owe: their unpaid invoices, added up.
”

Reply (10.7 s): I've set up Billing with two tables:

- **Clients** has a Name.
- **Invoices** has a Number, an Amount in US dollars, Paid (Yes or No) and the Client it's for.

Each client has an **Owed** column that adds up the amounts of their unpaid invoices. It updates itself whenever an invoice is added, changed or marked paid.

One thing to know: only invoices set to "No" are counted. If you leave Paid blank on an invoice, it won't show in what the client owes.

Both tables are empty for now. Add clients and invoices whenever you're ready.

Steps: Made the table Clients; Made the table Invoices; Added Owed to Clients.

Tokens so far in the session: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 79331 (cache read 59066), out 951.

- pass: Clients has a summary (saw Owed)
- pass: errors: 0 (saw 0)

## 2. Said “Add Acme with invoices A-1 for $100, paid, and A-2 for $250, not paid yet; and Bolt, with no invoices yet.
”

Reply (6.0 s): I've added Acme and Bolt to Clients, and two invoices for Acme:

- A-1 for $100, paid
- A-2 for $250, not paid

Acme now shows **$250 owed**, which is just A-2. Bolt shows **$0** because it has no invoices yet.

Steps: Added 2 rows to Clients; Added 2 rows to Invoices; Looked through the tables.

Tokens so far in the session: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 143098 (cache read 121219), out 1492.

- pass: rows in Clients: 2 (saw 2)
- pass: rows in Invoices: 2 (saw 2)
- pass: Clients has a summary that comes to 250 on Acme (saw Owed = 250)
- pass: Clients has a summary that comes to 0 on Bolt (saw Owed = 0)

## 3. Said “Acme paid A-2 today.”

Reply (4.0 s): I've marked A-2 as paid, so Acme now owes **$0**. Bolt still owes $0 too.

The table has nowhere to record the date an invoice was paid, so "today" isn't saved. If you want to track payment dates, I can add a Paid on date to Invoices.

Steps: Changed a row in Invoices; Looked through the tables.

Tokens so far in the session: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 187836 (cache read 165251), out 1821.

- pass: Clients has a summary that comes to 0 on Acme (saw Owed = 0)
- pass: errors: 0 (saw 0)

## The world after

Clients: Name (text), Notes (notes), Owed (summary)

- name "Acme" [stated], owed {"amount":0,"currency":"USD"} [computed]
- name "Bolt" [stated], owed {"amount":0,"currency":"USD"} [computed]

Invoices: Number (text), Amount (money), Paid (choice), Client (relation), Notes (notes)

- number "A-1" [stated], amount {"amount":100,"currency":"USD"} [stated], paid "Yes" [stated], client "r_6jp8ehptnk" [stated]
- number "A-2" [stated], amount {"amount":250,"currency":"USD"} [stated], paid "Yes" [stated], client "r_6jp8ehptnk" [stated]
