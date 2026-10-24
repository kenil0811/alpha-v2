# 20 October 2026: the Accounting kit, and what alpha-v2 needed for it

Kenil, 20:27: "ok looks good" on the Accounting plan (the Claude Doc "Accounting kit plan: the
monthly client report"); his four questions went unanswered, so my picks stand: Excel exports
first (QuickBooks PDFs once a real one arrives), an unapproved mapping used and flagged, days
cash, DSO and DPO over 30 days as the reference does, insights drafted on the report's button.
Same message: nothing of the client's should be in alpha-v2. Code and data already were apart; client
names had slipped into two UI hints, test samples and the generic mail journey's made-up emails,
now neutral (the mail journey passed on its renamed recordings). On his "move", what BRIEF.md,
design.md §16 and §18 and five logs said about the client went to the client's repository, and
alpha-v2's docs speak of "the first client".

- **alpha-v2:** scripts read the filed documents (`alpha.documents.list`, `read`: cells or lines
  with their places); `rows.land` takes `places`, so a value cites its file, sheet and cell; an
  agent's trigger can be `{ filed: true }`; a value the person typed over keeps the script's
  figure beside it (`Provenance.beside`, `records.keepBeside`; kept the moment they type over a
  computed value, and again whenever the script works it out), shown in its panel with Reset
  (`POST /api/tables/:id/rows/:row/reset`); the page kit draws bars and a line on two axes, and a
  `button` asks Alpha as the person (`/api/say` from the module); a page redraws when the world
  changes; `alpha.open` with a field opens that value's panel (`#/table/<id>/<row>?field=`).
  Tests for each (108).
- **The accounting kit 0.1 (in the client's repository):** 14 tables; the Exports reader (on a filed document) reads each
  export once by its title rows, lands its lines citing cells, and proposes an account and service
  line for each new label; Figures (on changes) works out each month with formulas and sums, the
  service lines, the checks (P&L sums, the balance sheet balances, the agings tie, the year's net
  income ties) and the benchmarks as Flags; the Report page in the reference's order, every figure
  opening its source, the PDF from pages.
- **a client's real exports, on Kenil's Mac only (`core/.readers/accounting-check.ts`, not
  committed):** the figures and the checks came out right against the reference; the numbers are
  in alpha-avilo's log (the client's own repository), not here (moved 24 Oct, item 8 of the
  problems list).
- Journey `accounting-a-month` on invented exports (the client's repository, `journeys/fixtures/files/
  lakeside`) passed, Alpha's drafted insights included. Seen in the window in WebKit; a figure
  opened its formula and sum; the PDF printed (four A4 pages).
