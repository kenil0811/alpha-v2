# Journey what-each-client-owes: 2026-11-09 18:01

a client shows what it owes, worked out from its invoices, and stays right as they are paid

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 30 s, $0.20.


## 1. Said “In a module called Billing, make a table Clients with a Name, and a table Invoices with a Number, an Amount in dollars, Paid (Yes or No) and the client it is for. On each client, show what they still owe: their unpaid invoices, added up.
”

Reply (18.7 s): The Billing module is set up with both tables, and both are empty for now.

- **Clients:** Name and Still owes. Still owes adds up the client's invoices marked Paid: No, and updates by itself.
- **Invoices:** Number, Amount in dollars, Paid (Yes or No) and the client it's for.

I also added a Billing email field to Clients, because a table can't hold only a name. It's my own assumption, so leave it blank if you don't need it. Each table also comes with a Notes field.

Invoices need Paid set to No to count towards Still owes, so one left blank won't be included.

Steps: Made the table Clients; Made the table Clients; Made the table Invoices; Added Still owes to Clients; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 138289 (cache read 130237), out 1908; $0.13.

- pass: Clients has a summary (saw Still owes)
- pass: errors: 0 (saw 0)

## 2. Said “Add Acme with invoices A-1 for $100, paid, and A-2 for $250, not paid yet; and Bolt, with no invoices yet.
”

Reply (5.5 s): I've added both clients and Acme's two invoices, and the Still owes totals are right:

| Client | Invoices | Still owes |
|---|---|---|
| Acme | A-1 for $100 (paid), A-2 for $250 (not paid) | $250 |
| Bolt | None yet | $0 |

Steps: Added 2 rows to Clients; Added 2 rows to Invoices; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 213454 (cache read 204183), out 2479; $0.16.

- pass: rows in Clients: 2 (saw 2)
- pass: rows in Invoices: 2 (saw 2)
- pass: Clients has a summary that comes to 250 on Acme (saw Still owes = 250)
- pass: Clients has a summary that comes to 0 on Bolt (saw Still owes = 0)

## 3. Said “Acme paid A-2 today.”

Reply (6.2 s): A-2 is now marked paid, so Acme owes $0. There's no paid-date field, so I put today's date, 9 November 2026, in that invoice's notes.

Steps: Changed a row in Invoices; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 291872 (cache read 281617), out 3007; $0.20.

- pass: Clients has a summary that comes to 0 on Acme (saw Still owes = 0)
- pass: errors: 0 (saw 0)

## The world after

Clients: Name (text), Billing email (email), Notes (notes), Still owes (summary)

- name "Acme" [stated], still_owes {"amount":0,"currency":"USD"} [computed]
- name "Bolt" [stated], still_owes {"amount":0,"currency":"USD"} [computed]

Invoices: Number (text), Amount (money), Paid (choice), Client (relation), Notes (notes)

- number "A-1" [stated], amount {"amount":100,"currency":"USD"} [stated], paid "Yes" [stated], client "r_2zxg8qh0dd" [stated]
- number "A-2" [stated], amount {"amount":250,"currency":"USD"} [stated], paid "Yes" [stated], client "r_2zxg8qh0dd" [stated], notes "Paid on 9 November 2026." [stated]
