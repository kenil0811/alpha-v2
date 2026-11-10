# Journey what-each-client-owes: 2026-11-10 12:03

a client shows what it owes, worked out from its invoices, and stays right as they are paid

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 38 s, $0.25.


## 1. Said “In a module called Billing, make a table Clients with a Name, and a table Invoices with a Number, an Amount in dollars, Paid (Yes or No) and the client it is for. On each client, show what they still owe: their unpaid invoices, added up.
”

Reply (29.3 s): The Billing module is ready, with both tables empty:

- **Clients:** Name and Still owes, which adds up that client's unpaid invoices by itself.
- **Invoices:** Number, Amount in US dollars, Paid (Yes or No) and the Client it's for.

I tested Still owes with a temporary client: unpaid invoices of $100 and $50.50 plus a paid one of $1,000 gave $150.50. Those test rows are now deleted.

- **Email on Clients:** I added this field because a table can't hold only a name. Leave it blank if you don't need it.
- **Invoice numbers:** these are stored as text, so something like INV-001 works.
- **Blank Paid:** only invoices marked No count toward Still owes, so an invoice with Paid left blank isn't included.

Steps: Made the table Clients; Made the table Clients; Made the table Invoices; Added Still owes to Clients; Added a row to Clients; Looked through the tables; Added 3 rows to Invoices; Looked through the tables; Remove 3 rows from Invoices; Remove a row from Clients.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 219049 (cache read 209390), out 3117; $0.18.

- pass: Clients has a summary (saw Still owes)
- pass: errors: 0 (saw 0)

## 2. Said “Add Acme with invoices A-1 for $100, paid, and A-2 for $250, not paid yet; and Bolt, with no invoices yet.
”

Reply (5.3 s): Both clients are in, and Acme's two invoices are on it. **Acme** still owes $250 (A-2 is unpaid, A-1 for $100 is paid), and **Bolt** owes $0 with no invoices yet.

Steps: Added 2 rows to Clients; Added 2 rows to Invoices; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 327036 (cache read 316144), out 3660; $0.22.

- pass: rows in Clients: 2 (saw 2)
- pass: rows in Invoices: 2 (saw 2)
- pass: Clients has a summary that comes to 250 on Acme (saw Still owes = 250)
- pass: Clients has a summary that comes to 0 on Bolt (saw Still owes = 0)

## 3. Said “Acme paid A-2 today.”

Reply (3.2 s): A-2 is marked paid, so **Acme** now owes $0. The Invoices table has no payment date, so today's date isn't recorded on it; I can add a Paid on field if you'd like to keep those.

Steps: Changed a row in Invoices; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 382814 (cache read 371145), out 3989; $0.25.

- pass: Clients has a summary that comes to 0 on Acme (saw Still owes = 0)
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 51 lines.

## The world after

Clients: Name (text), Email (email), Notes (notes), Still owes (summary)

- name "Acme" [stated], still_owes {"amount":0,"currency":"USD"} [computed]
- name "Bolt" [stated], still_owes {"amount":0,"currency":"USD"} [computed]

Invoices: Number (text), Amount (money), Paid (choice), Client (relation), Notes (notes)

- number "A-1" [stated], amount {"amount":100,"currency":"USD"} [stated], paid "Yes" [stated], client "r_607xjvjd7e" [stated]
- number "A-2" [stated], amount {"amount":250,"currency":"USD"} [stated], paid "Yes" [stated], client "r_607xjvjd7e" [stated]
