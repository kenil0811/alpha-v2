# Journey what-each-client-owes: 2026-11-11 00:54

a client shows what it owes, worked out from its invoices, and stays right as they are paid

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 23 s, $0.17.


## 1. Said “In a module called Billing, make a table Clients with a Name, and a table Invoices with a Number, an Amount in dollars, Paid (Yes or No) and the client it is for. On each client, show what they still owe: their unpaid invoices, added up.
”

Reply (12.7 s): I've set up the Billing module with two tables.

- **Clients** has a Name. I also gave it an Email field for where invoices go, because the system won't keep a table that holds only a name. Every table also comes with a Notes field.
- **Invoices** has a Number, an Amount in US dollars, Paid (Yes or No) and the Client it's for.
- **Owed** on each client adds up their invoices marked Paid = No. It updates by itself, so marking an invoice Yes takes it off the total.

Both tables are empty for now. If an invoice's Paid is left blank, it won't count towards Owed.

Steps: Made the table Clients; Made the table Clients; Made the table Invoices; Added Owed to Clients.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 113847 (cache read 106932), out 1301; $0.10.

- pass: Clients has a summary (saw Owed)
- pass: errors: 0 (saw 0)

## 2. Said “Add Acme with invoices A-1 for $100, paid, and A-2 for $250, not paid yet; and Bolt, with no invoices yet.
”

Reply (6.9 s): I added Acme and Bolt as clients. Acme has two invoices: A-1 for $100, marked paid, and A-2 for $250, marked not paid.

What each one owes now:
- **Acme:** $250, which is just A-2. A-1 is paid, so it doesn't count.
- **Bolt:** $0, since it has no invoices yet.

Steps: Added 2 rows to Clients; Added 2 rows to Invoices; Looked through the tables; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 211979 (cache read 203367), out 1930; $0.15.

- pass: rows in Clients: 2 (saw 2)
- pass: rows in Invoices: 2 (saw 2)
- pass: Clients has a summary that comes to 250 on Acme (saw Owed = 250)
- pass: Clients has a summary that comes to 0 on Bolt (saw Owed = 0)

## 3. Said “Acme paid A-2 today.”

Reply (3.8 s): I marked A-2 as paid, so Acme now owes $0, the same as Bolt.

The invoices don't have a field for the date they were paid, so today's date isn't recorded anywhere. Would you like me to add one?

Steps: Changed a row in Invoices; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 263250 (cache read 253872), out 2260; $0.17.

- pass: Clients has a summary that comes to 0 on Acme (saw Owed = 0)
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 36 lines.

## The world after

Clients: Name (text), Email (email), Notes (notes), Owed (summary)

- name "Acme" [stated], owed {"amount":0,"currency":"USD"} [computed]
- name "Bolt" [stated], owed {"amount":0,"currency":"USD"} [computed]

Invoices: Number (text), Amount (money), Paid (choice), Client (relation), Notes (notes)

- number "A-1" [stated], amount {"amount":100,"currency":"USD"} [stated], paid "Yes" [stated], client "r_d9rwx9zb0q" [stated]
- number "A-2" [stated], amount {"amount":250,"currency":"USD"} [stated], paid "Yes" [stated], client "r_d9rwx9zb0q" [stated]
