# LBO model and returns

> **Area:** `lbo-model-returns` · owned by the CFO skill. **Use when:** Build a leveraged buyout model and compute equity returns (IRR, MOIC), credit statistics and sensitivities, and explain where the return comes from. Use when testing whether a purchase price and financing structure meet a return hurdle, or when deciding to invest or pass.

**Outcome:** an integrated model that shows sources and uses, a post-close balance sheet, 5+ years of projections, a debt schedule, coverage ratios and equity returns by exit year, plus a return bridge that says how much comes from growth, margins, debt paydown and multiple change.

## When to use

- "If we pay 6x with 3.5x of debt, what do we make?"
- "What is the most we can pay and still clear 20%?"
- "Can the company service this debt in a bad year?"
- Defending an invest or pass recommendation (a pass needs a full model too, showing returns below the hurdle).

## Method

### 1. Know the return equation
- Initial equity = entry multiple x opening EBITDA - debt raised (+ fees).
- Equity proceeds = exit multiple x ending EBITDA - ending debt (+ cash).
- Return = proceeds - initial equity, +/- any interim dividends or extra equity.

Levers, by term:
- Entry: buy at a lower multiple; scrutinise (lower) the EBITDA you pay for; borrow more to shrink the cheque.
- Exit: grow revenue; widen margins; expand the multiple; use cash flow to repay debt.

**MOIC** (multiple on invested capital) = total equity received / equity invested.
**IRR** = the discount rate that makes the net present value of the equity cash flows zero. With one cash-in and one cash-out: IRR = MOIC^(1/years) - 1.
Rules of thumb (standard practice): 2.0x in 3 years is about 26%; 2.0x in 5 years about 15%; 3.0x in 5 years about 25%. IRR rewards speed; MOIC rewards size of gain. Look at both.

### 2. Build the model (layout in `cfo/references/lbo-model-returns/model-layout.md`)

Return bridge math, exit-year choice, return evidence and the memo frame: `cfo/references/lbo-model-returns/returns-attribution.md`. Bottom-up operating build for a small company: end of `cfo/references/lbo-model-returns/model-layout.md`.
An LBO model is an integrated three-statement model plus four LBO pieces: sources and uses, balance-sheet adjustments, debt schedule, exit analysis.

1. **Purchase price.** EV = multiple x LTM EBITDA. Equity purchase price = EV - existing debt + cash acquired. Fees (about 3% of EV; lender fees 0.25% to 1% of their loan) add to total capital required.
2. **Sources and uses.** Uses: repay old debt, buy equity, fees. Sources: each debt tranche (sized as multiples of EBITDA, see `acquisition-debt-capacity`), seller note or rollover if any, and sponsor equity as the single plug.
3. **Goodwill.** Equity price - book value of net assets (fair-value step-ups aside). Simple models leave it unamortised.
4. **Pro forma balance sheet.** Opening balance sheet + deal adjustments: old debt out, new debt in, goodwill in, old equity replaced by sponsor equity less expensed fees. Nothing is a plug: if the opening sheet balances and the adjustments balance, the result balances.
5. **Pro forma income statement** for the last historical year, as if the new debt existed.
6. **Projections.** Revenue growth and margins (yours, not just management's; extend them to cover all exit years). Working capital at constant days (DSO, DIO, DPO). Capex as % of sales; D&A from the fixed-asset schedule. Tax at a stated rate.
7. **Cash flow and debt schedule.** Cash available for debt repayment = cash from operations + cash from investing (after keeping minimum cash). Pay mandatory amortisation first; then sweep excess to the revolver, then to the term loan; then, only once senior debt is gone, dividends. If cash falls short, draw the revolver up to its limit. The revolver is the balancing mechanism.
8. **Interest.** On opening balances (avoids circularity), or on average balances with iteration on.
9. **Credit statistics** each year: debt / EBITDA; EBITDA / interest; fixed charge coverage = (EBITDA - unfinanced capex - cash taxes) / (cash interest + scheduled principal). Lenders want about 1.2x FCCR or better.
10. **Returns.** For each possible exit year: exit EV, less net debt, equals equity value; MOIC and IRR on the sponsor's cash flows.
11. **Sensitivities.** Tables of IRR against entry multiple and exit multiple, against growth and margin cases, and leverage. Run at least base, downside and upside cases.

### 3. Decide
- Compare IRR to the hurdle (the fund's target; historically 20%+ and lower recently). Check MOIC too.
- Check downside: can the company pay its debt if EBITDA drops 20%? If coverage breaks, reduce debt or price.
- Sanity-check equity share: lenders expect at least 25% equity, plus 5 points per turn of purchase multiple above 4x, up to 50%.
- Write the return bridge so the committee sees which lever carries the deal. If most of the return is multiple expansion, the deal is fragile.

## Worked pattern

Buy a company with $4.0M EBITDA at 6.0x.
- EV $24.0M; fees 3% = $0.72M; total uses $24.72M.
- Debt 3.5x = $14.0M (senior $10M, sub $4M). Equity $10.72M (43%; the guideline minimum at 6x is 35%).
- EBITDA grows 5% a year: year 5 = $5.105M. Exit at 6.0x = $30.63M.
- Debt repaid from cash flow over 5 years: $8.0M, leaving $6.0M.
- Equity proceeds $24.63M. MOIC = 24.63 / 10.72 = 2.30x. IRR = 2.30^(1/5) - 1 = about 18.1%.
- Bridge of the $13.91M gain: EBITDA growth at a constant multiple +$6.63M; debt paydown +$8.00M; fees -$0.72M; multiple change $0.
- Verdict: below a 20% hurdle. Options: pay 5.5x (IRR rises to about 21%), find margin gains, or pass.

Check the 5.5x case: EV $22.0M, fees $0.66M, debt $14.0M, equity $8.66M; same exit $30.63M less $6.0M debt = $24.63M; MOIC 2.84x; IRR about 23%. (Lenders may cut debt at a lower price; re-test coverage.)

## Common mistakes

- Plugging the balance sheet. Every pro forma line has a source.
- Forgetting cash and debt when moving from EV to equity price; forgetting fees in uses.
- Letting cash pile up while debt is outstanding, or paying dividends before senior debt is repaid when the credit agreement forbids it.
- Using management's projections untested; not extending them to the exit year.
- Assuming exit multiple above entry in the base case.
- Showing only IRR: a quick dividend recap can lift IRR while lowering MOIC.
- Ignoring the downside case. Leverage that looks safe at plan can become 13 to 14 turns if EBITDA falls (Caesars, 2008).
- Spending effort on a pretty model instead of on what drives the deal: information advantage, not the spreadsheet, makes money.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps

- No full investment-memo template; the return bridge and invest-or-pass frame above are the core of it.
