# Journey what-each-client-owes: 2026-11-10 20:51

a client shows what it owes, worked out from its invoices, and stays right as they are paid

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 25 s, $0.17.


## 1. Said “In a module called Billing, make a table Clients with a Name, and a table Invoices with a Number, an Amount in dollars, Paid (Yes or No) and the client it is for. On each client, show what they still owe: their unpaid invoices, added up.
”

Reply (12.9 s): I've set up the Billing module with two tables:

- **Clients** has a Name and an **Owes** column. Owes adds up the amounts of that client's invoices marked Paid = No and updates itself. When you mark an invoice paid, the client's total goes down.
- **Invoices** has a Number, an Amount in US dollars, Paid (Yes or No) and the client it's for.

I also added an Email field to Clients, because a table holding only a name wasn't allowed. You can leave it empty or I can remove it. Both tables are empty for now, so you can start adding clients and invoices.

Steps: Made the table Clients; Made the table Clients; Made the table Invoices; Added Owes to Clients.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 91321 (cache read 84293), out 1348; $0.10.

- pass: Clients has a summary (saw Owes)
- pass: errors: 0 (saw 0)

## 2. Said “Add Acme with invoices A-1 for $100, paid, and A-2 for $250, not paid yet; and Bolt, with no invoices yet.
”

Reply (6.4 s): I added Acme and Bolt as clients, and two invoices for Acme: A-1 for $100 (paid) and A-2 for $250 (not paid yet).

I checked the Owes column:
- **Acme** owes $250, which is A-2. A-1 is paid, so it isn't counted.
- **Bolt** shows 0 because it has no invoices yet.

Steps: Added 2 rows to Clients; Added 2 rows to Invoices; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 189609 (cache read 181042), out 1920; $0.14.

- pass: rows in Clients: 2 (saw 2)
- pass: rows in Invoices: 2 (saw 2)
- pass: Clients has a summary that comes to 250 on Acme (saw Owes = 250)
- pass: Clients has a summary that comes to 0 on Bolt (saw Owes = 0)

## 3. Said “Acme paid A-2 today.”

Reply (5.5 s): I marked A-2 as paid, so Acme now owes $0. Bolt still has no invoices and owes $0 too.

The Invoices table has no field for the date an invoice was paid, so I put "Paid on 10 November 2026" in that invoice's notes. If you want to keep payment dates for every invoice, I can add a Paid on date field.

Steps: Changed a row in Invoices; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 240853 (cache read 231459), out 2368; $0.17.

- pass: Clients has a summary that comes to 0 on Acme (saw Owes = 0)
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 34 lines.

## The world after

Clients: Name (text), Email (email), Notes (notes), Owes (summary)

- name "Acme" [stated], owes {"amount":0,"currency":"USD"} [computed]
- name "Bolt" [stated], owes {"amount":0,"currency":"USD"} [computed]

Invoices: Number (text), Amount (money), Paid (choice), Client (relation), Notes (notes)

- number "A-1" [stated], amount {"amount":100,"currency":"USD"} [stated], paid "Yes" [stated], client "r_c0wmsp7zjy" [stated]
- number "A-2" [stated], amount {"amount":250,"currency":"USD"} [stated], paid "Yes" [stated], client "r_c0wmsp7zjy" [stated], notes "Paid on 10 November 2026." [stated]
