# Journey what-each-client-owes: 2026-11-09 13:10

a client shows what it owes, worked out from its invoices, and stays right as they are paid

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 32 s, $0.21.


## 1. Said “In a module called Billing, make a table Clients with a Name, and a table Invoices with a Number, an Amount in dollars, Paid (Yes or No) and the client it is for. On each client, show what they still owe: their unpaid invoices, added up.
”

Reply (20.4 s): The Billing module is set up with both tables, and both are empty for now.

- **Clients:** Name and Still owes, which adds up the client's invoices marked Paid: No and updates by itself. I haven't tried it on real invoices yet.
- **Invoices:** Number, Amount in dollars, Paid (Yes or No) and Client.

An invoice only counts towards Still owes once it's marked No, so one with Paid left blank won't be included.

I also added two things you didn't ask for. Clients has a Billing email field, because the system wouldn't create a table holding only a name, and you can ignore it if you don't need it. Each table also comes with a Notes field. Invoice Number is stored as text, so numbers like INV-001 will work.

Steps: Made the table Clients; Made the table Clients; Made the table Invoices; Added Still owes to Clients.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 108508 (cache read 101169), out 2058; $0.12.

- pass: Clients has a summary (saw Still owes)
- pass: errors: 0 (saw 0)

## 2. Said “Add Acme with invoices A-1 for $100, paid, and A-2 for $250, not paid yet; and Bolt, with no invoices yet.
”

Reply (7.5 s): Both clients and Acme's two invoices are in, and Still owes is adding up correctly:

| Client | Invoices | Still owes |
|---|---|---|
| Acme | A-1, $100, paid; A-2, $250, not paid | $250 |
| Bolt | None yet | $0 |

Steps: Added 2 rows to Clients; Added 2 rows to Invoices; Looked through the tables; Looked through the tables; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 228244 (cache read 218448), out 2815; $0.18.

- pass: rows in Clients: 2 (saw 2)
- pass: rows in Invoices: 2 (saw 2)
- pass: Clients has a summary that comes to 250 on Acme (saw Still owes = 250)
- pass: Clients has a summary that comes to 0 on Bolt (saw Still owes = 0)

## 3. Said “Acme paid A-2 today.”

Reply (3.9 s): A-2 is now marked paid, so Acme owes $0. Bolt is also at $0.

The Invoices table has no field for the payment date, so "today" isn't saved on the invoice. If you want to track when invoices get paid, I can add a Paid on date and set A-2 to 9 November.

Steps: Changed a row in Invoices; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 304491 (cache read 293995), out 3142; $0.21.

- pass: Clients has a summary that comes to 0 on Acme (saw Still owes = 0)
- pass: errors: 0 (saw 0)

## The world after

Clients: Name (text), Billing email (email), Notes (notes), Still owes (summary)

- name "Acme" [stated], still_owes {"amount":0,"currency":"USD"} [computed]
- name "Bolt" [stated], still_owes {"amount":0,"currency":"USD"} [computed]

Invoices: Number (text), Amount (money), Paid (choice), Client (relation), Notes (notes)

- number "A-1" [stated], amount {"amount":100,"currency":"USD"} [stated], paid "Yes" [stated], client "r_b25geg4v0e" [stated]
- number "A-2" [stated], amount {"amount":250,"currency":"USD"} [stated], paid "Yes" [stated], client "r_b25geg4v0e" [stated]
