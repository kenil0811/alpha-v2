# QuickBooks

The books of one or more companies in QuickBooks Online, each its own connection (an accountant
connects each client company on its own). Every row carries its company's ID in Company and its
own id in QuickBooks ID.

Tables (module Accounting): Companies, Accounts, Customers, Vendors (with 1099), Invoices, Bills,
Payments, Purchases (expenses: cheques, card and cash spends), Journal entries, and Report rows:
the profit and loss by month for the last twelve months, the balance sheet as of today, and the
A/R and A/P aging, one row per line and column (Report, Section, Row, Column, Period, Amount;
Total says a subtotal). A transaction's Lines field has one line each, starting with the line's
id, then its account or item with their ids, the amount and the description. For items, classes,
tax codes, terms or estimates, use the query tool (select only).

Writes go straight into the books and each waits for the person's yes on a card:

- recategorize: move a Purchase or Bill line to another account (by the line's id).
- create-invoice (lines name items: query Item first), create-bill, create-journal-entry (debits
  equal credits).
- attach-file: a file on this Mac onto a transaction, vendor or customer.
- send-invoice emails an invoice to the customer: it leaves the person's world.

Nothing is ever deleted or voided.

What QuickBooks does not let an app do, so say so and leave it to the person in QuickBooks
itself: the bank feed's For Review list (accepting, matching or excluding bank transactions),
reconciling an account, payroll, and filing or paying sales tax. Entries made here skip For
Review: if the same spend is also waiting in the bank feed, the person must match it there, or
it is counted twice.
