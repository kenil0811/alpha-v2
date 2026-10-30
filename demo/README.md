# Demo

A fresh Alpha with two made-up sample modules, filled with invented rows, for trying the platform
without a client's data.

- `modules/deal-sourcing/`: businesses for sale found on brokers' listings (Sources, Deals,
  Financials, Outreach), measured against a buyer's Criteria, with weekly Goals. Agents: Fit and
  Insights.
- `modules/case-desk/`: a small firm's Clients, the Claims it files against Carriers, Leads and
  Payments, with Targets. Agents: Overdue claims, Lead aging and Statement check.
- `seed.js`: about 250 deals from 20 sources and 60 clients with 80 claims, seeded random, put in
  through the core's API, dated back from today. Every name is made up; links and addresses are on
  `.example`.

```bash
demo/start.sh          # port 4790; demo/start.sh 4795 for another
```

It builds the window if needed, starts a core on a fresh home in `demo/homes/<port>` (gitignored),
installs both modules from their folders, seeds them and prints the link. Every agent ends paused:
the seed runs the sample agents once, so their runs, Insights and lines on Home show, and lets
Statement check fail for want of a bank statement, so a failed run waits on Home beside a possible
duplicate (a lead with a client's name). A question card needs the model: sign in, then Interview
me on Home.
