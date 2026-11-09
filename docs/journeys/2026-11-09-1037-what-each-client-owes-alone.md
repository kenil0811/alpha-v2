# Journey what-each-client-owes: 2026-11-09 10:37

a client shows what it owes, worked out from its invoices, and stays right as they are paid

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 33 s, $0.21.


## 1. Said “In a module called Billing, make a table Clients with a Name, and a table Invoices with a Number, an Amount in dollars, Paid (Yes or No) and the client it is for. On each client, show what they still owe: their unpaid invoices, added up.
”

Reply (20.7 s): The Billing module is set up with both tables, and both are empty for now.

- **Clients:** has Name and a **Still owes** column, which adds up that client's invoices marked Paid: No and updates by itself. I haven't seen it add up real invoices yet, since there aren't any.
- **Invoices:** has Number, Amount in dollars, Paid (Yes or No) and Client.

**Added without being asked:** a Billing email on Clients, because the system won't make a table that holds only a name. You can leave it blank. Both tables also come with a Notes field.

An invoice only counts as owed once it's marked No, so one with Paid left blank won't be included in Still owes.

Steps: Made the table Clients; Made the table Clients; Made the table Invoices; Added Still owes to Clients; Added Still owes to Clients; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 153271 (cache read 145157), out 2097; $0.14.

- pass: Clients has a summary (saw Still owes)
- pass: errors: 0 (saw 0)

## 2. Said “Add Acme with invoices A-1 for $100, paid, and A-2 for $250, not paid yet; and Bolt, with no invoices yet.
”

Reply (5.8 s): Acme and Bolt are added, along with Acme's two invoices.

| Client | Invoices | Still owes |
|---|---|---|
| Acme | A-1 for $100 (paid), A-2 for $250 (not paid) | $250 |
| Bolt | None yet | $0 |

The Still owes column is adding up correctly: Acme's total counts only the unpaid A-2.

Steps: Added 2 rows to Clients; Added 2 rows to Invoices; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 225405 (cache read 216047), out 2716; $0.17.

- pass: rows in Clients: 2 (saw 2)
- pass: rows in Invoices: 2 (saw 2)
- pass: Clients has a summary that comes to 250 on Acme (saw Still owes = 250)
- pass: Clients has a summary that comes to 0 on Bolt (saw Still owes = 0)

## 3. Said “Acme paid A-2 today.”

Reply (6.5 s): A-2 is now marked paid, so Acme owes $0. Bolt also still owes $0.

There's no field for when an invoice was paid, so I put today's date in A-2's notes. If you'd like to track that for every invoice, I can add a Paid on date.

Steps: Changed a row in Invoices; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 300982 (cache read 290583), out 3274; $0.21.

- pass: Clients has a summary that comes to 0 on Acme (saw Still owes = 0)
- pass: errors: 0 (saw 0)

## The world after

Clients: Name (text), Billing email (email), Notes (notes), Still owes (summary)

- name "Acme" [stated], still_owes {"amount":0,"currency":"USD"} [computed]
- name "Bolt" [stated], still_owes {"amount":0,"currency":"USD"} [computed]

Invoices: Number (text), Amount (money), Paid (choice), Client (relation), Notes (notes)

- number "A-1" [stated], amount {"amount":100,"currency":"USD"} [stated], paid "Yes" [stated], client "r_0p8wfx0ftd" [stated]
- number "A-2" [stated], amount {"amount":250,"currency":"USD"} [stated], paid "Yes" [stated], client "r_0p8wfx0ftd" [stated], notes "Paid 9 November 2026." [stated]
