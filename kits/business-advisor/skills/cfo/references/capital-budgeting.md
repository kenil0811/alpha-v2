# Capital budgeting: NPV decisions on investments

> **Area:** `capital-budgeting` · owned by the CFO skill. **Use when:** Decide whether a business should spend money now for cash later (buy equipment, open a location, launch a product, lease or buy, invest abroad) by turning the choice into incremental cash flows and an NPV, including foreign-currency projects. Use for any invest/don't-invest, choose-between-options, or rent-versus-buy question.

**Outcome:** a yes/no (or which-one) answer on a spending decision, backed by an NPV that a
business owner can check line by line.

## When to use
- "Should we buy this machine / open this store / take this contract?"
- Choosing between options that do the same job (lease vs buy, rent vs own, vendor A vs B).
- Ranking projects when cash or capacity is limited.
- Checking what return a deal actually implies (an offered loan, a private investment).

## Method

### 1. Lay out the cash flow timeline
- Put each cash flow at a point in time: t = 0 is now, t = 1 is one period from now.
  Inflows positive, outflows negative. State whose view it is (the buyer's outflow is the seller's inflow).
- A cash outflow is not a loss and an inflow is not a profit: a loan is an inflow today and outflows later.
- Use **expected** cash flows when they are uncertain: sum of (probability × cash flow).

### 2. Count only incremental cash flows
Incremental = cash flows if we act minus cash flows if we don't.
- **Sunk costs:** ignore money already spent (past R&D, a study already paid for).
- **Opportunity costs:** charge the project for what an asset could earn elsewhere (land you own
  could be sold or leased; your $120k down payment could be invested instead).
- **Cannibalization:** subtract sales the new thing takes from existing products, but only if
  those sales would not be lost anyway (to a competitor who could easily enter).
- **Synergies:** add sales or savings the project creates for existing lines.
- Use after-tax operating cash flow, not accounting profit (see the `dcf-valuation` skill for
  the free cash flow formula: add back depreciation, subtract capex and working capital build).
- Leave financing out of the cash flows (interest, loan proceeds); the discount rate handles it.

### 3. Pick the discount rate
- Use the expected return on investments with the **same risk as the cash flows**, not the
  firm's borrowing rate and not a hurdle picked for comfort.
- Risk-free cash flows: risk-free rate. Risky ones: risk-free rate + risk premium (see
  `cost-of-capital`). Higher risk means a higher rate and a lower value of future inflows.
- Match the rate to the period. Convert quoted rates first:
  - periodic rate r with k periods a year: APR = k × r; EAR = (1 + r)^k − 1.
  - Discount with the periodic rate or the EAR, **never with the APR** (it ignores compounding).
  - With an EAR and sub-year cash flows, use fractional years as exponents (1.08^0.25 for a quarter).
- Mid-year convention: if cash comes in evenly during the year, discount as if at mid-year
  (multiply the end-of-year PV by (1 + r)^0.5).

### 4. Compute the value
- PV of one cash flow: C_t / (1 + r)^t. Future value at time n: PV × (1 + r)^n.
- NPV = sum of PVs of all cash flows, including the t = 0 outlay.
- Shortcuts (first payment at t = 1):
  - Level perpetuity: C / r.
  - Growing perpetuity: C_1 / (r − g), only if g < r.
  - Annuity for N periods: (C / r) × (1 − 1/(1 + r)^N).
  - Stream starting later: value it one period before its first cash flow, then discount back
    (a perpetuity starting at t = 4 is valued at t = 3, then divided by (1 + r)^3).
- Excel: NPV(rate, range) assumes the first cash flow is at t = 1, so add the t = 0 flow separately.
  PV/FV/PMT/RATE expect payment and PV to have opposite signs.

### 5. Decide with the NPV rule
- Stand-alone project: accept if NPV > 0.
- Mutually exclusive options: take the highest NPV (for cost-only choices like rent vs buy,
  the least negative NPV).
- Limited budget: pick the combination with the highest total NPV.
- **IRR** (the rate where NPV = 0) is fine to report and to read implied returns from a loan or
  deal. Use it to decide only when: cash flows change sign once, outflows come first, the
  options are the same size, and an IRR exists. Otherwise it misleads:
  - For loans (inflow first), a higher IRR is worse.
  - Multiple sign changes can give several IRRs.
  - IRR ignores scale: a small project with a high IRR can add less value than a big one.
- When unsure, use NPV. It always gives the right ranking.

### 6. Stress the answer
- Show NPV at a few discount rates (an NPV profile) and under a low/base/high case for the
  key driver (price, volume, holding period, exit value).
- With mixed inflows and outflows, a higher rate can raise or lower NPV; don't assume the direction.
- List what the numbers leave out (control, flexibility, hassle, reputation) next to the NPV.
  Flexibility to expand or quit later can be valued: see `real-options`.

### 6b. Long-lived assets, inflation and special financing
(Generalised from two project cases; see cfo/references/capital-budgeting/case-lessons.md.)
- A contract that covers only the first years of an asset's life does not justify the asset;
  value the later years at a forecast market price, by year of the asset's age (lower rates,
  more downtime, bigger overhauls as it ages).
- The holding period is a decision: compare selling before a costly overhaul with keeping to
  the end of physical life, and take the higher NPV.
- Put staged purchase payments on the timeline when paid.
- Real cash flows at a real rate, nominal at a nominal rate; depreciation tax shields are fixed
  in nominal terms, so model them nominally.
- A project in a different line of business uses that business's rate, from its listed peers.
- Subsidised financing tied to the project (tax-exempt bonds, development loans): value the
  project all-equity, then add the PV of the after-tax interest saving at the debt rate (APV).
- "It lowers our average return on equity" is not a reason to reject a positive-NPV project.

### 7. Foreign-currency projects
The forward rates come from covered interest parity (see
`currency-and-international-finance`); the two-approach procedure is standard practice.
- Forecast the project's cash flows **in the currency they arise in** (foreign revenue, foreign
  costs, foreign capex), plus any home-currency flows (fees, royalties, head-office costs).
- **Home-currency approach:** convert each year's foreign flow at the forward rate for that year,
  F_t = S × [(1 + i_home) ÷ (1 + i_foreign)]^t (or quoted forwards where they exist), then discount
  at the home-currency rate for the project's risk.
- **Foreign-currency approach:** discount the foreign flows at the foreign-currency rate,
  (1 + r_foreign) = (1 + r_home) × (1 + i_foreign) ÷ (1 + i_home), then convert the NPV at spot.
- Both give the same NPV when the forwards and the foreign rate come from the same parity. Doing
  both is the check. Never discount foreign-currency flows at a home-currency rate.
- **Project versus parent:** value the cash the parent can actually get. Count withholding tax on
  dividends, blocked or delayed remittances, and transfer-pricing limits; if cash can't leave,
  value it when it can (see `cash-flow-analysis` on cash held abroad).
- **Country risks** (expropriation, convertibility, war) go into the cash flows as scenarios
  with probabilities where you can; add a country premium to the rate only for what is left
  (see `cost-of-capital`, section 7).
- **Stress the rate:** rerun the home-currency NPV with the foreign currency 10–20% weaker than the
  forward path. A project that only works on a strong foreign currency is a currency bet.
- Hedge the contracted part (a fixed-price contract, the capex bill) with forwards; fund foreign
  assets with foreign-currency debt or a currency swap as a natural hedge (see
  `bond-and-debt-analysis`, section 7).

## Worked pattern
A bakery can buy a $40,000 oven that saves $11,000 a year (after tax) for 5 years and sells
for $5,000 at the end. Similar-risk investments return 9%.
- PV of savings: 11,000 × (1 − 1.09^−5) / 0.09 = 11,000 × 3.890 = 42,786.
- PV of resale: 5,000 / 1.09^5 = 3,250.
- NPV = 42,786 + 3,250 − 40,000 = **+$6,036** → buy.
- IRR ≈ 14.4%, above 9%, which agrees here because the flows are conventional.
- Stress: savings would have to drop to about $9,450 a year before NPV hits zero.

Rent vs buy for a workspace follows the same steps: two timelines (rent payments; down
payment + mortgage + upkeep + sale price − loan payoff), the same horizon, and the comparison
of NPVs. Add the opportunity cost of the down payment, let rent and value grow over long
horizons, and consider a higher rate for the riskier owning flows.

**Foreign project.** A US firm spends €10m now for €4m a year for 3 years. Spot $1.08/€; one-year
rates 5% in dollars, 3% in euros; the project's dollar rate is 10%.
- Forwards: 1.08 × (1.05/1.03)^t = $1.1010, $1.1223, $1.1441/€. Dollar flows: −10.80, +4.40,
  +4.49, +4.58m. NPV at 10% = **+$0.35m**.
- Check: euro rate = 1.10 × 1.03/1.05 − 1 = 7.90%; euro NPV = €0.326m × 1.08 = **$0.35m**. Same.
- Trap: discounting the euro flows at 10% and converting at spot gives −$0.06m and a wrong "no".

## Common mistakes
- Discounting with an APR, or mixing monthly cash flows with an annual rate.
- Counting sunk costs, or forgetting the opportunity cost of an asset already owned.
- Using IRR to pick between projects of different size or with flows that change sign twice.
- Forgetting that Excel's NPV starts at t = 1.
- Adding the t = 0 cash flow of a perpetuity that starts now into the perpetuity formula
  (value the t = 1 onward stream, then add the t = 0 payment).
- Using the firm's cost of capital for a project much riskier or safer than the firm.
- Ignoring that a growing perpetuity needs g < r.
- Discounting foreign-currency cash flows at a home-currency rate, or converting them all at
  today's spot rate.
- Discounting a forecast without inflation at a nominal rate (or the reverse).
- Justifying a long-lived asset on a short contract, or assuming you keep it to the end of its life.
- Rejecting a positive-NPV project because it lowers the average ROE.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- Payback period and profitability index are not covered; if needed, treat them as secondary
  screens only (standard practice).
