# LBO model layout

A layout that works in one workbook. Inputs in blue, formulas in black (standard practice).

## Tab 1: Assumptions
- Closing date (end of the last historical year).
- LTM EBITDA; entry multiple; exit multiple; exit years to test.
- Existing debt and cash at closing.
- Fees: transaction % of EV; lender fee % of each loan.
- Debt tranches: amount (x EBITDA), rate, amortisation schedule, maturity, cash sweep %.
- Revolver limit; minimum cash.
- Tax rate; capex % of sales; D&A rule; working-capital days.

## Tab 1 blocks
1. **Purchase price:** EV; less existing debt; plus cash; = equity purchase price; fees; total capital required.
2. **Goodwill:** equity purchase price less book equity (net assets).
3. **Sources and uses:** each source with rate, x EBITDA and % of total; sponsor equity = total uses minus all other sources.
4. **Pro forma balance sheet:** columns for opening, adjustments, pro forma; a check row that must read zero.

## Tab 2: Model (one column per year)
1. **Income statement:** revenue, COGS, gross profit, SG&A, EBITDA, D&A, EBIT, interest by tranche, pre-tax income, tax, net income.
2. **Balance sheet:** cash (minimum), receivables (sales x DSO / 365), inventory (COGS x DIO / 365), PP&E (prior + capex - D&A), goodwill, payables (COGS x DPO / 365), each debt tranche (from the debt schedule), equity (prior + net income - dividends). Check row.
3. **Cash flow:** net income + D&A - increase in working capital = cash from operations; - capex = cash from investing; cash available for debt repayment = sum.
4. **Debt schedule:** mandatory repayment; deficit = max(mandatory - cash available, 0); revolver draw = deficit (up to limit); revolver repayment from any surplus; then optional term-loan prepayment; then dividends. Ending balances feed the balance sheet.
5. **Credit statistics:** debt / EBITDA; EBITDA / interest; FCCR = (EBITDA - unfinanced capex - cash taxes) / (cash interest + scheduled principal).
6. **Returns:** for each exit year, EBITDA x exit multiple = EV; less debt; plus cash = equity value; sponsor cash flows (negative at close, dividends in between, equity value at exit); IRR and MOIC.
7. **Sensitivities:** two-way data tables (entry x exit multiple; growth x margin; leverage x entry price).

## Checks before anyone reads it
- Balance sheet balances every year without a plug.
- Cash never below minimum; revolver never above limit.
- No dividends while restricted debt is outstanding.
- Sources equal uses.
- IRR recomputed by hand for one exit year with the MOIC shortcut.

## Operating build for a small company (from a milling-company case model)
When the target's books are a bookkeeping-package P&L rather than audited statements, build the
operating model bottom up before the LBO tabs:
- **Volume tab:** monthly units by product line (for example tons milled), rolled up to years.
- **One tab per major customer or channel:** units, average selling price, product cost, packaging, platform
  commissions, chargebacks and returns, giving a contribution margin per channel. Marketplace fees and
  chargebacks can take a quarter of channel revenue; model them, do not bury them in SG&A.
- **Assumptions tab:** each cost line as % of the revenue it actually varies with (not total revenue);
  fixed costs grown at an inflation rate; named new hires as dollar lines; working-capital days; capex.
- **Per-unit metrics:** gross profit and EBITDA per unit, to compare with peers and test plausibility.
- **Summary tab:** revenue by channel, COGS by type, EBITDA and margin, working capital, linked to the rest.
- **Debt tab:** existing lines of credit and their rates, to be repaid at close.
