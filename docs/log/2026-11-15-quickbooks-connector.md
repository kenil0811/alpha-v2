# 15 Nov 2026: the QuickBooks connector

Kenil's yes to the proposal (doc 6zRg2gZHj9tuGNbs3hMKNu), its three calls as recommended: two full
years read again every day, the company's own cash or accrual basis, and real clients connected
on the server only (production keys need an https address; the Mac stays on Intuit's test
companies). He has both Intuit test and production keys (14 Nov).

Intuit's rules, from its developer docs (read 15 Nov): the token calls carry the app's Client
Secret as basic credentials and there is no PKCE; the answer names the company picked (realmId);
`http://localhost` is a return address for test keys only, production needs https on a domain and
no IP; the long-lived token lasts 100 days unused, changes once a day, five years at most; 500
calls a minute a company, a 429 and a minute's wait past it; minor version 75; no read-only
permission.

- Sign-in providers (`connector-sdk/src/signin.ts`) say what they need: an organisation field
  (Microsoft) or a secret (Intuit), PKCE or not, the account hint, where the person signed in to,
  and whether the registered address keeps its port. Intuit is the second provider.
- A sign-in app's secret is typed once in Sign-in apps and kept in the secret store (the Keychain,
  or the server's sealed file), never in the world or a journal line; the field says it is kept.
- A connection keeps where its sign-in went (`connections.place`, the world's first numbered
  migration, 2, which backs the world up first), handed to its connector as `host.place`. A second
  sign-in that picks another company is refused, keeping the first.
- `connectors/quickbooks`: one connection a client company, read daily and on Read now. Eight
  tables of a QuickBooks module (Companies, Accounts, Monthly results, Month-end balances, Sales
  by customer, Transactions, Receivables, Payables), from CompanyInfo, the chart of accounts and
  the reports ProfitAndLoss, BalanceSheet and CustomerSales by month, GeneralLedger a month at a
  time (in halves when Intuit cuts one short), AgedReceivables and AgedPayables. Every call is a
  GET (`src/intuit.ts`) and it declares no tools: the read-only wall is Alpha's. A test company
  is found at the sandbox address. Rows QuickBooks stops showing, within the months read, are
  marked gone.

Tests: Intuit's sign-in against a made-up Intuit (`core/src/connectors/signin.test.ts`), the
connector on made-up Intuit answers (`connectors/quickbooks/src/index.test.ts`), migration 2 on a
world made before it. Not proven yet: a real Intuit test company, which waits for Kenil's keys in
Sign-in apps and his sign-in on Intuit's page; the report shapes are Intuit's documented ones.

Kenil's first sign-in, with his test keys and the sandbox company of the app's developer account,
came back to "Not connected yet: sign in with Intuit and pick the company". The company was kept
on the connection, but a connector runs in its own process and a call carried only its account
over the pipe, so the connector never saw it. A call now carries the place too
(`connectors/process.ts`, `child.ts`), with a test that a sync in the process sees it. After a
restart, Read now read the test company: 580 rows; the balance sheet balances in all 7 months it
has, and all 51 monthly results equal the sum of their ledger lines. The full test run timed out
in seven process-spawning tests while Spotlight and another app held the Mac at a load of 40;
each of those files passes on its own.
