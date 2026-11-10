# Journey what-each-client-owes: 2026-11-10 10:04

a client shows what it owes, worked out from its invoices, and stays right as they are paid

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 30 s, $0.21.


## 1. Said “In a module called Billing, make a table Clients with a Name, and a table Invoices with a Number, an Amount in dollars, Paid (Yes or No) and the client it is for. On each client, show what they still owe: their unpaid invoices, added up.
”

Reply (17.4 s): The Billing module is set up with both tables.

- **Clients:** Name and Still owes, which adds up the amounts of that client's invoices marked Paid: No and updates by itself. I also added a Billing email field, because a table can't hold only a name. Use it or ignore it.
- **Invoices:** Number, Amount in dollars, Paid (Yes or No) and Client. Number is a text field, so something like INV-001 works too.

An invoice with Paid left blank doesn't count towards what a client owes, so set it to No when you enter one. Both tables are empty for now, so I haven't seen the total work on real invoices yet.

Steps: Made the table Clients; Made the table Clients; Made the table Invoices; Added Still owes to Clients.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 115141 (cache read 107869), out 1814; $0.12.

- pass: Clients has a summary (saw Still owes)
- pass: errors: 0 (saw 0)

## 2. Said “Add Acme with invoices A-1 for $100, paid, and A-2 for $250, not paid yet; and Bolt, with no invoices yet.
”

Reply (9.2 s): Acme and Bolt are added, along with Acme's two invoices, and the total works on real figures:

| Client | Invoices | Still owes |
|---|---|---|
| Acme | A-1, $100, paid; A-2, $250, not paid | $250 |
| Bolt | None yet | $0 |

Steps: Added 2 rows to Clients; Looked through the tables; Added 2 rows to Invoices; Looked through the tables; Looked through the tables; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 267188 (cache read 257186), out 2679; $0.19.

- pass: rows in Clients: 2 (saw 2)
- pass: rows in Invoices: 2 (saw 2)
- pass: Clients has a summary that comes to 250 on Acme (saw Still owes = 250)
- pass: Clients has a summary that comes to 0 on Bolt (saw Still owes = 0)

## 3. Said “Acme paid A-2 today.”

Reply (3.5 s): A-2 is now marked paid, and Acme owes $0. The Invoices table has no field for the payment date, so today's date isn't recorded. I can add a Paid on date if you'd like to keep it.

Steps: Changed a row in Invoices; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 348019 (cache read 337376), out 2983; $0.21.

- pass: Clients has a summary that comes to 0 on Acme (saw Still owes = 0)
- pass: errors: 0 (saw 0)

## The world after

Clients: Name (text), Billing email (email), Notes (notes), Still owes (summary)

- name "Acme" [stated], still_owes {"amount":0,"currency":"USD"} [computed]
- name "Bolt" [stated], still_owes {"amount":0,"currency":"USD"} [computed]

Invoices: Number (text), Amount (money), Paid (choice), Client (relation), Notes (notes)

- number "A-1" [stated], amount {"amount":100,"currency":"USD"} [stated], paid "Yes" [stated], client "r_1ywvwj66y2" [stated]
- number "A-2" [stated], amount {"amount":250,"currency":"USD"} [stated], paid "Yes" [stated], client "r_1ywvwj66y2" [stated]
