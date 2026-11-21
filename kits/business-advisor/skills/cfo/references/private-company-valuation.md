# Private company valuation (EBITDA multiples)

> **Area:** `private-company-valuation` · owned by the CFO skill. **Use when:** Value a private company for a buyout or sale using adjusted EBITDA and a multiple justified against comparables, checked by an LBO return test. Use when setting an offer price, judging an asking price, or explaining a valuation to partners, lenders or a seller.

**Outcome:** an enterprise value range and a one-paragraph valuation thesis ("we pay X times adjusted EBITDA because...") that holds up in negotiation and in the investment committee.

## When to use

- "What should we offer for this business?"
- "Is the seller's asking multiple reasonable?"
- "Why do our comps say 8x when the banker says 11x?"
- Writing the valuation section of an IOI, LOI or deal memo.
- Marking a holding to fair value at quarter end.

## Method

Depth: `cfo/references/private-company-valuation/multiple-drivers.md` (metric and period choice, dated benchmark multiples by size, tax-deductible goodwill adjustment, method by situation, the OUTSX check, research on fair-value marks).

### 1. Know what the multiple is for
- Fair market value: the price between a willing, informed, unpressured buyer and seller at arm's length.
- In theory, value is the present value of future free cash flow. In practice, buyers use EBITDA multiples because they are fast, give everyone a common language, use data that is easy to find, and need few inputs.
- The weakness: not all EBITDA dollars are equal (trailing or forward, reporting quality, adjustments), EBITDA ignores capex, and one number hides many assumptions. Diligence and a model still have to back it.
- Multiple x EBITDA gives **enterprise value**. Equity price = EV minus debt repaid plus cash acquired (on a cash-free, debt-free basis, the seller keeps cash and repays debt).

### 2. Order of work
1. Build comparable sets: precedent M&A transactions and comparable public companies.
2. Derive a starting multiple (median, then reasoned adjustments).
3. Adjust EBITDA (see `buyout-due-diligence`).
4. Build the LBO model: new capital structure, projections (see `lbo-model-returns`).
5. Check the return. Re-tune assumptions, including the multiple, until price and return agree.

DCF is standard in theory but rarely drives a buyout price: most value sits in the terminal value and the discount rate is contested. Use it where cash flows are contractual or finite (standard practice view).

### 3. Adjust the multiple for 15 factors
Each factor below moves the multiple when all else is equal. The most important are marked *.

| Factor | Higher multiple when... | Why |
|---|---|---|
| *Growth rate (of EBITDA) | faster growth | future cash flow is larger relative to today's EBITDA |
| *Capex need | lower capex | more of EBITDA becomes free cash flow |
| Return on invested capital | higher ROIC | reinvestment produces more cash per dollar |
| *Leverageability | more can be borrowed | lower cost of capital; less equity per dollar of EBITDA |
| Taxes | lower effective tax rate | more free cash flow (interest deductibility limits can bite LBOs) |
| Future performance | buyer expects improvement under new ownership | most other factors can change with management |
| Public vs private | public | no illiquidity discount (gap is large: about 18x vs 14x in 2020 data) |
| *Size | larger | smaller firms are riskier, less liquid; US buyout multiples ran from about 4x for $2M to $5M deals to over 12x for $250M+ |
| Geography | North America, then Western Europe | observed, not well explained |
| Platform potential | can anchor add-ons | platforms reported at about 20%+ premium to add-ons |
| Cost of capital | lower | higher present value of the same cash |
| *Exit opportunities | many likely buyers | more exit routes, chance of multiple expansion |
| *Industry | varies widely | bundles growth, capex and risk; start from industry tables (e.g. Damodaran) |
| *Entry multiple | already high | less room to expand; more capital lost per dollar of EBITDA decline |
| *Risk (broad) | lower risk | lower WACC; much of diligence is measuring risk |

Rules:
- Many factors move together (small firms are riskier and have fewer exit buyers; capex depends on industry). Do not count one weakness twice or three times.
- A shortcut: learn the industry's range, then place the target above or below peers factor by factor.
- Use a risk grid (higher / moderate / lower) across customers, management depth, recurring revenue, supplier dependence, cyclicality, systems, to place the target in the range.

### 4. Write the valuation thesis
One paragraph, for example: "We propose 6.25x adjusted TTM EBITDA, a quarter turn below the comp median, because customer concentration is above peers and capex is heavier; faster growth offsets part of that. Platform potential is upside we are not paying for."

### 5. Remember price is set by the process
Valuation work sanity-checks the price against similar deals, supports the expected return, anchors negotiation and focuses diligence and post-close goals. The final price comes from the auction or the negotiation. One practitioner's summary: the valuation is what it takes to win the deal, so know your walk-away price.

Other cross-checks practitioners use: levered free-cash-flow yield, a lender's leverage read, sum of the parts, add-on synergies and multiple arbitrage, and tax assets (for example tax-deductible goodwill in an asset deal lowers the effective multiple).

### 5b. When a private-company discount applies
A discount to public values for being private is mainly about illiquidity (plus agency costs,
size and financial health). It fits small owners who cannot easily sell. Do not apply it to a
large, profitable firm that could list or be sold readily; listing costs (about a tenth of the
equity raised) bound how big any discount can be for such a firm. (From a wireless-carrier
acquisition case; see cfo/references/dcf-valuation/case-lessons.md.)

### 6. After closing
Funds must report holdings at fair value each quarter and pass an annual audit (ASC 820; AICPA PE valuation guide, 2019). Regulators have fined firms for loose marks. Use the same multiple logic, refreshed for current comps.

## Worked pattern

Target: commercial HVAC services, $5.0M adjusted EBITDA, 7% growth, capex 1.5% of revenue, top customer 22% of sales.
- Comps: 9 precedent deals of $20M to $60M EV, median 6.5x; public peers 11x (too large and liquid to use directly).
- Adjustments: growth above peers (+0.25x); light capex (+0.25x); concentration above peers (-0.5x); smaller than most comps (-0.25x). Net -0.25x, so 6.25x.
- EV = 6.25 x $5.0M = $31.25M. Seller has $4M of debt and $0.5M cash: equity price about $27.75M on a cash-free, debt-free basis.
- LBO check: 3% fees ($0.94M); debt 3.5x ($17.5M); equity $14.69M. EBITDA grows 7% a year to $7.01M; exit at the same 6.25x = $43.8M; $11M of debt repaid, so $6.5M left. Equity proceeds $37.3M, MOIC 2.54x, IRR about 20.5%, just over a 20% hurdle. Offer range $30M to $32M; little room to pay more.

## Common mistakes

- Applying a public-company multiple to a small private company.
- Multiplying unadjusted (or seller-adjusted, unverified) EBITDA.
- Treating EV as the cheque to the seller: forgetting debt, cash and the working-capital peg.
- Counting correlated factors separately.
- Assuming the exit multiple will rise; base case should exit at or below entry.
- Paying for run-rate or projected earnings that have not happened yet.
- Higher leverage tends to come with higher prices and lower fund returns; cheap credit makes buyers overpay.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps

- Comparable data come from Capital IQ, PitchBook or similar; benchmark multiples in the reference are dated (2019 to 2023) and need refreshing.
