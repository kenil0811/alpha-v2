# QuickBooks

A client company's QuickBooks Online books, read through the firm's own Intuit app. Each
connection is one company, signed in once by that company's admin, or by the firm's owner for a
client of the firm. Alpha only reads: nothing here can change a client's books, and a value typed
over in Alpha stays in Alpha, with QuickBooks' own beside it.

Every table holds every connected company's rows; **Company** names the company (QuickBooks' own
name) and **Company ID** its QuickBooks id. Amounts are in the company's own currency, on the
basis its own reports use (cash or accrual, in Companies).

- **Companies:** each connected company: its name, its fiscal year's first month, its currency,
  its basis, and whether it is one of Intuit's test companies.
- **Accounts:** the chart of accounts: name, number, type, detail type, parent, active, balance.
- **Monthly results:** the profit and loss by month: an account's amount in a month (Month is the
  month's first day). Group is where it sits in the report (Income, Cost of goods sold, Expenses,
  Other income, Other expenses).
- **Month-end balances:** the balance sheet at each month's end: an account's balance on that day.
- **Sales by customer:** a customer's sales in a month.
- **Transactions:** every line under each account, from the general ledger: date, type, number,
  name, memo, the other side (Split), amount.
- **Receivables** and **Payables:** what each customer owes the company, and what it owes each
  vendor, by age on the day it was read.

The first read goes back two full years before this month; each daily read reads the same span
again, since books change after the fact. A row QuickBooks no longer shows is marked gone and
kept. For anything older, or a report not here, open the company in QuickBooks itself.
