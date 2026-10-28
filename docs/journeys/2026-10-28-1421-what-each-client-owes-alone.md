# Journey what-each-client-owes: 2026-10-28 14:21

a client shows what it owes, worked out from its invoices, and stays right as they are paid

Fresh tenant, model claude-opus-5-5, Alpha's prompt alone.
**Passed** in 27 s.


## 1. Said “In a module called Billing, make a table Clients with a Name, and a table Invoices with a Number, an Amount in dollars, Paid (Yes or No) and the client it is for. On each client, show what they still owe: their unpaid invoices, added up.
”

Reply (14.5 s): I made a new Billing module with two tables:

- **Clients**: a Name and an **Owed** column. Owed adds up the client's invoices that are marked Paid "No", so it updates by itself when invoices are added or paid. I also added an Email column, because the system won't create a table that holds only names. You can remove it if you don't need it.
- **Invoices**: a Number, an Amount in US dollars, Paid (Yes or No) and the Client it's for.

Both tables are empty for now.

Steps: Made the table Clients; Made the table Clients; Made the table Invoices; Added Owed to Clients.

Tokens so far in the session: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 102656 (cache read 96520), out 1237.

- pass: Clients has a summary (saw Owed)
- pass: errors: 0 (saw 0)

## 2. Said “Add Acme with invoices A-1 for $100, paid, and A-2 for $250, not paid yet; and Bolt, with no invoices yet.
”

Reply (7.6 s): I added Acme and Bolt as clients, plus Acme's two invoices:

- **A-1**: $100, paid
- **A-2**: $250, not paid yet

Acme now owes **$250**, which is just A-2 because A-1 is paid. Bolt has no invoices yet, so it owes **$0**.

Steps: Added 2 rows to Clients; Added 2 rows to Invoices; Looked through the tables; Looked through the tables.

Tokens so far in the session: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 191648 (cache read 183862), out 1861.

- pass: rows in Clients: 2 (saw 2)
- pass: rows in Invoices: 2 (saw 2)
- pass: Clients has a summary that comes to 250 on Acme (saw Owed = 250)
- pass: Clients has a summary that comes to 0 on Bolt (saw Owed = 0)

## 3. Said “Acme paid A-2 today.”

Reply (4.4 s): I marked A-2 as paid, so Acme now owes **$0**. Bolt still owes $0.

The Invoices table has no column for when an invoice was paid, so today's date was only noted with the change. Should I add a "Paid on" date column?

Steps: Changed a row in Invoices; Looked through the tables.

Tokens so far in the session: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 238314 (cache read 229798), out 2181.

- pass: Clients has a summary that comes to 0 on Acme (saw Owed = 0)
- pass: errors: 0 (saw 0)

## The world after

Clients: Name (text), Email (email), Notes (notes), Owed (summary)

- name "Acme" [stated], owed {"amount":0,"currency":"USD"} [computed]
- name "Bolt" [stated], owed {"amount":0,"currency":"USD"} [computed]

Invoices: Number (text), Amount (money), Paid (choice), Client (relation), Notes (notes)

- number "A-1" [stated], amount {"amount":100,"currency":"USD"} [stated], paid "Yes" [stated], client "r_36azk9yape" [stated]
- number "A-2" [stated], amount {"amount":250,"currency":"USD"} [stated], paid "Yes" [stated], client "r_36azk9yape" [stated]
