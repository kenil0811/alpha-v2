# 15 Nov 2026: QuickBooks feeds the Accounting module only

Kenil, on seeing QuickBooks' eight tables of its own: QuickBooks is for the Accounting module, not
a module that copies the books into Alpha; other data later on his ask, through an agent or the
Module builder. His yes to the step 7 proposal (doc W9jzVY9ZpXGRKS4oT8Edoz), its four calls as
recommended. The step 6 branch was never pushed; this builds on it.

- `connectors/quickbooks` keeps nothing: no tables, no module, no daily read. It offers four
  reads, each a GET: `company`, `accounts`, `report` (any report by name and dates, by month or
  not, its data rows with their group and account, cut-short reports read in halves) and `list`
  (one select, every page). An agent the person asks uses them as tools, naming the client.
- Kit API 3 gains `alpha.connections.list(connector)` and `alpha.connections.read(connection,
  read, input)`, for a connector the kit names in `uses`; the schedule names `connections.read`
  in its effects. The connector service's `readThrough` runs only a tool whose effect is read,
  its input checked, and a lapsed sign-in shows on the connection as a failed sync's does.
- `pnpm kit test` makes a case's `connections`, each read answered from what the case recorded
  (and a later run's `reads`), so a kit's tests never reach the service.
