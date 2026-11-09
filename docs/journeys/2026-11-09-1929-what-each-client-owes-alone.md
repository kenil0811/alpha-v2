# Journey what-each-client-owes: 2026-11-09 19:29

a client shows what it owes, worked out from its invoices, and stays right as they are paid

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 27 s, $0.20.


## 1. Said “In a module called Billing, make a table Clients with a Name, and a table Invoices with a Number, an Amount in dollars, Paid (Yes or No) and the client it is for. On each client, show what they still owe: their unpaid invoices, added up.
”

Reply (16.3 s): The Billing module now has both tables, and they're empty, so the owed total hasn't been tested on real invoices yet.

- **Clients:** Name and Still owes, which adds up that client's invoices marked Paid = No and updates by itself. It can't be typed over.
- **Invoices:** Number, Amount in dollars, Paid (Yes or No) and Client.

I also added two things you didn't ask for. Clients has an Email field, because the system wouldn't create a table holding only a name, and each table gets a Notes field automatically.

An invoice with Paid left blank doesn't count towards what the client owes, so set it to No when you add one.

Steps: Made the table Clients; Made the table Clients; Made the table Invoices; Added Still owes to Clients.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 113804 (cache read 106674), out 1656; $0.11.

- pass: Clients has a summary (saw Still owes)
- pass: errors: 0 (saw 0)

## 2. Said “Add Acme with invoices A-1 for $100, paid, and A-2 for $250, not paid yet; and Bolt, with no invoices yet.
”

Reply (8.1 s): Both clients and the two invoices are in, and the owed totals come out right:

| Client | Invoices | Still owes |
|---|---|---|
| Acme | A-1 $100 (paid), A-2 $250 (not paid) | $250 |
| Bolt | None | $0 |

Steps: Added 2 rows to Clients; Looked through the tables; Added 2 rows to Invoices; Looked through the tables; Looked through the tables; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 263685 (cache read 254091), out 2431; $0.18.

- pass: rows in Clients: 2 (saw 2)
- pass: rows in Invoices: 2 (saw 2)
- pass: Clients has a summary that comes to 250 on Acme (saw Still owes = 250)
- pass: Clients has a summary that comes to 0 on Bolt (saw Still owes = 0)

## 3. Said “Acme paid A-2 today.”

Reply (3.0 s): A-2 is now marked paid, so Acme owes $0. Invoices only record paid or not, so today's date isn't kept anywhere; I can add a Paid on date if you want it.

Steps: Changed a row in Invoices; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 316475 (cache read 306187), out 2708; $0.20.

- pass: Clients has a summary that comes to 0 on Acme (saw Still owes = 0)
- pass: errors: 0 (saw 0)

## The world after

Clients: Name (text), Email (email), Notes (notes), Still owes (summary)

- name "Acme" [stated], still_owes {"amount":0,"currency":"USD"} [computed]
- name "Bolt" [stated], still_owes {"amount":0,"currency":"USD"} [computed]

Invoices: Number (text), Amount (money), Paid (choice), Client (relation), Notes (notes)

- number "A-1" [stated], amount {"amount":100,"currency":"USD"} [stated], paid "Yes" [stated], client "r_b26n174vps" [stated]
- number "A-2" [stated], amount {"amount":250,"currency":"USD"} [stated], paid "Yes" [stated], client "r_b26n174vps" [stated]
