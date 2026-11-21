# Acquisition debt capacity and capital structure

> **Area:** `acquisition-debt-capacity` · owned by the CFO skill. **Use when:** Estimate how much debt an acquisition can carry, from which lenders, in which tranches and on what terms, and test it against coverage limits. Use when financing a buyout or add-on, reading a lender term sheet, or deciding how much equity a deal needs.

**Outcome:** a sized capital stack (revolver, term debt, sub debt, seller note, equity) with rates, amortisation and a coverage check, plus the equity cheque that fills the gap.

## When to use

- "How much can we borrow to buy this company?"
- "Bank or private credit? Asset-based or cash-flow loan?"
- "Will the lender's covenants hold in a bad year?"
- Comparing financing offers or lender term sheets.

## Method

### 1. Know the trade-offs
Debt is any interest-bearing obligation (capital leases, notes, long-term debt). It is a fixed claim; equity is the residual.
- Benefits: interest is tax deductible; debt service and covenants impose discipline; less equity per dollar of EBITDA lifts equity IRR.
- Costs: bankruptcy (direct and reputational), conflict between lenders and owners (covenants, rates), and lost flexibility for later financing.
- Debt needs sustainable cash flow. Size to the bad year, not the plan.

### 2. Pick the lending approach
- **Asset-based (ABL):** loan sized off collateral (receivables, inventory, equipment, real estate). Cash-flow consistency matters less; pricing is lowest.
- **Cash-flow (enterprise-value) loan:** sized off EBITDA; the whole business is the collateral. Needs stable, growing cash flow; costs more. Most buyouts need it because assets alone do not support enough debt.
- Market tiers by EBITDA: small business under $1M; lower middle market $1M to $10M; middle market $10M to $30M; upper middle market $30M to $75M; broadly syndicated loans above that (often covenant-lite, rated, tradeable).
- Since 2008, private credit (direct lenders, "sponsor finance") has taken much of the middle market from banks. It offers higher leverage, no intercreditor fight (one lender), and more flexible terms and workouts, at higher rates.

### 3. Size it: lower-middle-market / bank guidelines
Use midpoints when unsure. Rates are shown as spreads over the base rate (older tables used LIBOR; use SOFR today).

| Collateral / tranche | Advance or size | Amortisation | Maturity | Price |
|---|---|---|---|---|
| Receivables (eligible: excluding aged, concentrated) | 75% to 85% | interest only, revolving borrowing base | annual | base + 3% to 4% |
| Inventory (varies by raw, WIP, finished) | 40% to 60% | interest only, revolving | annual | same revolver |
| Equipment (orderly liquidation value) | 60% to 70% | 5 to 7 years | 5 years | swapped fixed + 3% to 4% |
| Real estate (fair value) | 70% to 80% | 5 to 25 years | 5 years | same |
| Cash-flow "airball" over collateral | to the senior cap | 3 to 10 years; 50% to 75% of excess cash flow swept | 3 to 5 years | base + 4% to 5% |
| Subordinated (non-bank) | 1x to 1.5x EBITDA | interest only | 6+ months after senior | swapped + 9% to 12%; up to a third PIK |

Limits on the whole package:
- Senior debt / EBITDA at most 2.5x to 3.5x.
- Total debt / EBITDA at most 3.5x to 5x.
- Fixed charge coverage at least about 1.2x (some ABL lenders accept 1.05x). FCCR = (EBITDA - unfinanced capex - cash taxes) / (scheduled principal + interest).
- Equity: at least 25% of the price, plus 5 points for each turn (or part) of purchase multiple above 4x, up to 50% for deals above 8x.

### 4. Larger deals: sponsor-finance guidelines
- Senior first lien, base + 4.25% to 6.5%: "straight" under about 4.5x; "stretch" 4.5x to 5.5x; unitranche about 5.5x+ (or under 50% of EV). 1% a year amortisation plus excess cash flow sweep; 5 to 6 year term.
- Revolver usually undrawn at close; delayed-draw term loan for add-ons (about 24 months to draw).
- Second lien: base + 8% to 10% (about 4 points over senior), no amortisation.
- Subordinated / mezzanine: 10% to 14% coupon, possibly part PIK, no amortisation, matures after senior; about 1x EBITDA, total up to about 6.5x.
- Large LBOs recently ran about 6x debt, a bit over 40% of price; middle-market leverage has risen toward that.
- Lenders underwrite the sponsor first, then the deal.

### 5. Structure seniority
Stack from least to most risky (and cheapest to dearest, shortest to longest): revolver, first-lien term, second lien, subordinated, seller note, equity. Subordination works through collateral, payment priority, structure (which entity owes), and timing. An intercreditor agreement (standstill, forbearance) is heavily negotiated; if lenders cannot agree, the structure goes back to the drawing board.

### 6. What lenders look at
Cash-flow quality and FCCR; margin level and stability; how clean the EBITDA adjustments are (add-backs must be lender-approved); capex and working-capital needs; other cash drains (leases, seller notes, puttable preferred, earn-outs); management and systems depth; growth history and end markets; loan-to-value; the credit cycle; the sponsor's record. Lenders avoid binary risks (big customer concentration, contract cliffs, highly cyclical sectors), since their upside is capped at par.

### 7. Check the deal still works
Debt available, total interest, required amortisation, price and the resulting equity cheque must together give an acceptable risk-adjusted IRR. If FCCR fails, lengthen amortisation, swap some senior for interest-only sub debt or a seller note, cut price, or add equity.

### 8. References
- `cfo/references/acquisition-debt-capacity/debt-term-table.md`: tranche-by-tranche size, price, amortisation, maturity and covenants with the year each figure reflects; bank vs direct lender; lender process; post-close cap table layout; research cautions.

## Worked pattern

Target: EBITDA $4.0M; receivables $3.0M, inventory $1.0M, equipment (orderly liquidation value) $1.5M; price 6.0x = $24M.
- Revolver: 80% x 3.0 + 50% x 1.0 = $2.9M. Equipment term: 65% x 1.5 = $0.98M. Collateral total $3.9M (about 1.0x).
- Senior cap 2.5x = $10M, so a cash-flow term loan of about $6.1M fills to $10M.
- Sub debt 1.0x = $4M, total 3.5x = $14M. Equity $10M+ (42%); guideline minimum at 6x is 35%. Pass.
- FCCR test: EBITDA 4.0 - unfinanced capex 0.3 - cash tax 0.5 = 3.2. Senior $10M at 8% = 0.80 interest + 5-year amortisation 2.0 (conservatively treating the revolver as if it amortised, as a 100% sweep would); sub at 12% = 0.48. Debt service 3.28. FCCR 0.98x: fails.
- Fix: 7-year amortisation on senior (1.43 a year) gives service 2.71 and FCCR 1.18x, close to 1.2x; add a seller note with 2 years of deferred principal to get there, or cut senior by $1M.

## Common mistakes

- Sizing debt on adjusted EBITDA the lender will not accept.
- Counting ineligible receivables (aged, concentrated, related-party) in the borrowing base.
- Checking debt / EBITDA but not FCCR; amortisation, not interest, usually breaks small deals.
- Forgetting that a revolver drawn at close leaves no room for a working-capital swing.
- More leverage is not free: easier credit goes with higher prices and lower fund returns.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps

- Rate spreads are dated (each tagged with its year in the reference); refresh with current lender quotes.
