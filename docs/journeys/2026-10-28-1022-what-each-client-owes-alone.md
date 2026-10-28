# Journey what-each-client-owes: 2026-10-28 10:22

a client shows what it owes, worked out from its invoices, and stays right as they are paid

Fresh tenant, model claude-opus-5-5, Alpha's prompt alone.
**Passed** in 24 s.


## 1. Said “In a module called Billing, make a table Clients with a Name, and a table Invoices with a Number, an Amount in dollars, Paid (Yes or No) and the client it is for. On each client, show what they still owe: their unpaid invoices, added up.
”

Reply (12.7 s): I've set up the Billing module with two tables:

- **Clients** has a Name. I also added an Email field, because a table holding only names isn't allowed here. You can remove it if you don't want it.
- **Invoices** has a Number, an Amount in US dollars, Paid (Yes or No) and the Client it's for.

Each client also has an **Owed** column that adds up their invoices marked Paid = No. It's calculated from the invoices, so it updates when an invoice is added or marked paid.

Both tables are empty for now.

Steps: Made the table Clients; Made the table Clients; Made the table Invoices; Added Owed to Clients.

Tokens so far in the session: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 102727 (cache read 96567), out 1272.

- pass: Clients has a summary (saw Owed)
- pass: errors: 0 (saw 0)

## 2. Said “Add Acme with invoices A-1 for $100, paid, and A-2 for $250, not paid yet; and Bolt, with no invoices yet.
”

Reply (6.6 s): I added Acme and Bolt as clients, plus two invoices for Acme: A-1 for $100 (paid) and A-2 for $250 (not paid).

The Owed column now shows:
- **Acme:** $250, from A-2
- **Bolt:** $0. It has no invoices yet, so $0 here doesn't mean Bolt has paid everything.

Steps: Added 2 rows to Clients; Added 2 rows to Invoices; Looked through the tables; Looked through the tables.

Tokens so far in the session: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 191866 (cache read 184039), out 1925.

- pass: rows in Clients: 2 (saw 2)
- pass: rows in Invoices: 2 (saw 2)
- pass: Clients has a summary that comes to 250 on Acme (saw Owed = 250)
- pass: Clients has a summary that comes to 0 on Bolt (saw Owed = 0)

## 3. Said “Acme paid A-2 today.”

Reply (4.5 s): I marked A-2 as paid and noted on the invoice that it was paid today, 28 October. Acme now owes $0, and both its invoices are settled.

Invoices have no field for the date they were paid, so the date is only in that note. If you want to track payment dates, I can add a "Paid on" date field.

Steps: Changed a row in Invoices; Looked through the tables.

Tokens so far in the session: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 238757 (cache read 230079), out 2333.

- pass: Clients has a summary that comes to 0 on Acme (saw Owed = 0)
- pass: errors: 0 (saw 0)

## The world after

Clients: Name (text), Email (email), Notes (notes), Owed (summary)

- name "Acme" [stated], owed {"amount":0,"currency":"USD"} [computed]
- name "Bolt" [stated], owed {"amount":0,"currency":"USD"} [computed]

Invoices: Number (text), Amount (money), Paid (choice), Client (relation), Notes (notes)

- number "A-1" [stated], amount {"amount":100,"currency":"USD"} [stated], paid "Yes" [stated], client "r_aws25xm8nd" [stated]
- number "A-2" [stated], amount {"amount":250,"currency":"USD"} [stated], paid "Yes" [stated], client "r_aws25xm8nd" [stated], notes "Paid 28 October 2026." [stated]
