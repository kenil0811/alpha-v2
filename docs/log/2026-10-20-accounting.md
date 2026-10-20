# 20 October 2026: the Accounting kit, and what alpha-v2 needed for it

Kenil, 20:27: "ok looks good" on the Accounting plan (the Claude Doc "Accounting kit plan: the
monthly client report"); his four questions went unanswered, so my picks stand: Excel exports
first (QuickBooks PDFs once a real one arrives), an unapproved mapping used and flagged, days
cash, DSO and DPO over 30 days as the reference does, insights drafted on the report's button.
Same message: "nothing avilo should be in alpha-v2 repo". Code and data already were apart; client
names had slipped into two UI hints, test samples and the generic mail journey's made-up emails,
now neutral (the mail journey passed on its renamed recordings). Avilo's name stays in BRIEF.md,
design.md §16 and §18 and five logs, which record the work: asked him whether to move them.

- **alpha-v2:** scripts read the filed documents (`alpha.documents.list`, `read`: cells or lines
  with their places); `rows.land` takes `places`, so a value cites its file, sheet and cell; an
  agent's trigger can be `{ filed: true }`; a value the person typed over keeps the script's
  figure beside it (`Provenance.beside`, `records.keepBeside`; kept the moment they type over a
  computed value, and again whenever the script works it out), shown in its panel with Reset
  (`POST /api/tables/:id/rows/:row/reset`); the page kit draws bars and a line on two axes, and a
  `button` asks Alpha as the person (`/api/say` from the module); a page redraws when the world
  changes; `alpha.open` with a field opens that value's panel (`#/table/<id>/<row>?field=`).
  Tests for each (108).
- **Accounting 0.1 (alpha-avilo):** 14 tables; the Exports reader (on a filed document) reads each
  export once by its title rows, lands its lines citing cells, and proposes an account and service
  line for each new label; Figures (on changes) works out each month with formulas and sums, the
  service lines, the checks (P&L sums, the balance sheet balances, the agings tie, the year's net
  income ties) and the benchmarks as Flags; the Report page in the reference's order, every figure
  opening its source, the PDF from pages.
- **RestoPros' real exports, on Kenil's Mac only (`core/.readers/accounting-check.ts`, not
  committed):** days cash on hand 54 (the reference: 656), 89% of A/R ($292,160.49) over 90 days,
  Michael Hutchinson's −$184,107.55 credit, and no check failing (assets $658,446.40 balance, the
  A/R aging ties at $329,593.77, January to June net income ties at −$63,953.37).
- Journey `accounting-a-month` on invented exports (`alpha-avilo/journeys/fixtures/files/
  lakeside`) passed, Alpha's drafted insights included. Seen in the window in WebKit; a figure
  opened its formula and sum; the PDF printed (four A4 pages).
