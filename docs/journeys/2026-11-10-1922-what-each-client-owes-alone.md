# Journey what-each-client-owes: 2026-11-10 19:22

a client shows what it owes, worked out from its invoices, and stays right as they are paid

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 28 s, $0.17.


## 1. Said “In a module called Billing, make a table Clients with a Name, and a table Invoices with a Number, an Amount in dollars, Paid (Yes or No) and the client it is for. On each client, show what they still owe: their unpaid invoices, added up.
”

Reply (16.5 s): I've set up a Billing module with two tables:

- **Clients**: Name, plus an Email field I added because the system wouldn't create a table with only a name. You can leave Email blank. Each client also has an **Owes** field that adds up the amounts of their unpaid invoices. It updates on its own as invoices are added or marked paid.
- **Invoices**: Number, Amount in dollars, Paid (Yes or No) and the Client it's for.

Both tables are empty, so I haven't seen Owes work on real numbers yet. Only invoices marked "No" are counted, so an invoice with Paid left blank won't show up in what the client owes.

Steps: Made the table Clients; Made the table Invoices; Made the table Clients; Made the table Invoices; Added Owes to Clients.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 110351 (cache read 104353), out 1666; $0.10.

- pass: Clients has a summary (saw Owes)
- pass: errors: 0 (saw 0)

## 2. Said “Add Acme with invoices A-1 for $100, paid, and A-2 for $250, not paid yet; and Bolt, with no invoices yet.
”

Reply (6.5 s): I added Acme and Bolt to Clients. Acme has two invoices: A-1 for $100, marked paid, and A-2 for $250, marked not paid. Bolt has no invoices.

I checked what each client owes. Acme owes **$250**, which is A-2. The paid invoice, A-1, isn't counted. Bolt owes **$0**.

Steps: Added 2 rows to Clients; Added 2 rows to Invoices; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 206341 (cache read 198672), out 2233; $0.15.

- pass: rows in Clients: 2 (saw 2)
- pass: rows in Invoices: 2 (saw 2)
- pass: Clients has a summary that comes to 250 on Acme (saw Owes = 250)
- pass: Clients has a summary that comes to 0 on Bolt (saw Owes = 0)

## 3. Said “Acme paid A-2 today.”

Reply (4.8 s): I marked A-2 as paid, so Acme now owes **$0**. Bolt also owes $0.

Invoices don't have a field for the payment date, so I wrote "Paid on 10 November 2026" in A-2's notes. If you'd like a payment date on every invoice, I can add a Paid on field.

Steps: Changed a row in Invoices; Looked through the tables.

Spent so far: claude-haiku-5-5: in 1244 (cache read 0), out 17; claude-opus-5-5: in 281571 (cache read 273117), out 2595; $0.17.

- pass: Clients has a summary that comes to 0 on Acme (saw Owes = 0)
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 36 lines.

## The world after

Clients: Name (text), Email (email), Notes (notes), Owes (summary)

- name "Acme" [stated], owes {"amount":0,"currency":"USD"} [computed]
- name "Bolt" [stated], owes {"amount":0,"currency":"USD"} [computed]

Invoices: Number (text), Amount (money), Paid (choice), Client (relation), Notes (notes)

- number "A-1" [stated], amount {"amount":100,"currency":"USD"} [stated], paid "Yes" [stated], client "r_jqqyvcfffz" [stated]
- number "A-2" [stated], amount {"amount":250,"currency":"USD"} [stated], paid "Yes" [stated], client "r_jqqyvcfffz" [stated], notes "Paid on 10 November 2026." [stated]
