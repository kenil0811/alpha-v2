# Journey what-each-client-owes: 2026-11-09 11:05

a client shows what it owes, worked out from its invoices, and stays right as they are paid

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 28 s, $0.18.


## 1. Said “In a module called Billing, make a table Clients with a Name, and a table Invoices with a Number, an Amount in dollars, Paid (Yes or No) and the client it is for. On each client, show what they still owe: their unpaid invoices, added up.
”

Reply (18.8 s): The Billing module is set up, with both tables empty for now.

- **Clients:** Name and Still owes, which adds up the client's invoices marked Paid: No and updates by itself. An invoice with Paid left blank doesn't count towards it.
- **Invoices:** Number, Amount in dollars, Paid (Yes or No) and Client, which links to a row in Clients.

Alpha wouldn't create a client table holding only a name, so I added an Email field to Clients, on the assumption that it's where their invoices go. Each table also comes with a Notes field. Leave Email blank if you don't need it, or tell me to remove it now that Still owes is there.

Steps: Made the table Clients; Made the table Clients; Made the table Invoices; Added Still owes to Clients.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 107428 (cache read 100906), out 1861; $0.11.

- pass: Clients has a summary (saw Still owes)
- pass: errors: 0 (saw 0)

## 2. Said “Add Acme with invoices A-1 for $100, paid, and A-2 for $250, not paid yet; and Bolt, with no invoices yet.
”

Reply (5.3 s): I've added both clients and Acme's two invoices, as you stated them.

| Client | Invoices | Still owes |
|---|---|---|
| Acme | A-1 for $100 (paid), A-2 for $250 (not paid) | $250 |
| Bolt | None yet | $0 |

Steps: Added 2 rows to Clients; Added 2 rows to Invoices; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 177831 (cache read 169324), out 2396; $0.15.

- pass: rows in Clients: 2 (saw 2)
- pass: rows in Invoices: 2 (saw 2)
- pass: Clients has a summary that comes to 250 on Acme (saw Still owes = 250)
- pass: Clients has a summary that comes to 0 on Bolt (saw Still owes = 0)

## 3. Said “Acme paid A-2 today.”

Reply (3.9 s): A-2 is now marked paid, so Acme owes $0. Bolt is also at $0.

There's no field for when an invoice was paid, so today's date isn't recorded. I can add a Paid on date if you'd like to keep it.

Steps: Changed a row in Invoices; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 251773 (cache read 242598), out 2693; $0.18.

- pass: Clients has a summary that comes to 0 on Acme (saw Still owes = 0)
- pass: errors: 0 (saw 0)

## The world after

Clients: Name (text), Email (email), Notes (notes), Still owes (summary)

- name "Acme" [stated], still_owes {"amount":0,"currency":"USD"} [computed]
- name "Bolt" [stated], still_owes {"amount":0,"currency":"USD"} [computed]

Invoices: Number (text), Amount (money), Paid (choice), Client (relation), Notes (notes)

- number "A-1" [stated], amount {"amount":100,"currency":"USD"} [stated], paid "Yes" [stated], client "r_434xs4npk0" [stated]
- number "A-2" [stated], amount {"amount":250,"currency":"USD"} [stated], paid "Yes" [stated], client "r_434xs4npk0" [stated]
