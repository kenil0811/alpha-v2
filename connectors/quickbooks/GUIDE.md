# QuickBooks

A client company's QuickBooks Online books, read through the firm's own Intuit app. Each
connection is one company (its account is the client's name as the firm calls it), signed in
once by that company's admin, or by the firm's owner for a client of the firm. Alpha only reads:
nothing here can change a client's books.

QuickBooks keeps nothing in Alpha by itself. The Accounting module reads each client's books into
its own tables every morning; answer from those first. Read QuickBooks directly when the person
asks for something those tables do not hold, and say which client (`account`) when more than one
is connected. What is read this way is not kept unless the person asks for it to be.

- `company`: its name, fiscal year, currency, cash or accrual, and whether it is a test company.
- `accounts`: the chart of accounts.
- `report`: one of QuickBooks' reports by name (ProfitAndLoss, BalanceSheet, CustomerSales,
  GeneralLedger, AgedReceivables, AgedPayables, VendorExpenses, …), for a period (start, end), by
  month or not, or as of a day for an aging. Its data rows, without totals.
- `list`: any list by one select in QuickBooks' query words ("select * from Vendor").

A report too big for Intuit is read in parts by itself. Intuit allows 500 calls a minute for each
company, far above what is needed.
