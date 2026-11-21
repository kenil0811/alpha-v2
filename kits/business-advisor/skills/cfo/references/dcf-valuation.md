# DCF valuation: free cash flow, terminal value, WACC / APV / FTE

> **Area:** `dcf-valuation` · owned by the CFO skill. **Use when:** Value a whole business, a business unit or a large project by forecasting free cash flows, adding a terminal value and discounting them (WACC, APV or flow-to-equity), then bridging from enterprise value to equity value per share. Use for selling or buying a company, raising equity, setting a price target or testing an offer.

**Outcome:** an enterprise value and an equity value for a business, with a forecast whose
drivers are explicit and a sensitivity table showing what moves the answer.

## When to use
- "What is this company worth?" (sale, purchase, buyout, investor entry, partner exit).
- Checking whether an offer price or a valuation from an advisor or VC makes sense.
- Valuing a big project that brings its own financing.
Pair it with `valuation-multiples-and-deals` as a cross-check and with `cost-of-capital` for the rate.

## Method

### 1. Forecast free cash flow (FCF)
FCF is the cash left from operations after taxes and investment, before any financing.
FCF = EBIT × (1 − τ) + depreciation & amortization − capex − increase in NWC
- EBIT × (1 − τ) is unlevered net income (NOPAT): tax on operating profit as if no debt.
  Leave out interest expense and interest income.
- Add back other non-cash charges (amortization; stock-based pay is non-cash but a real cost,
  so many analysts subtract it).
- Capex from the balance sheet if needed: capex = net fixed assets (end) − NFA (start) + depreciation.
- **NWC** = required operating cash + receivables + inventory + prepaid − payables − accrued
  expenses − deferred revenue. Operating items only: no excess cash, no short-term debt.
  An increase in NWC uses cash; subtract it.
- Drive the forecast from the business, not from a growth rate alone: revenue = volume × price
  (units = market size × share), costs as % of revenue or per unit, working capital as days
  (receivables = sales × days/365, inventory = cost × days/365, payables = purchases × days/365).
- If losses carry forward, compute cash taxes year by year instead of EBIT × τ.
- Negative FCF in early years is normal for a growing firm; it means the firm needs funding.

### 2. Choose the horizon and the terminal (continuation) value
- Forecast explicitly until the business reaches a steady state (often 5–10 years; longer for
  fast growers or until a big non-cash item like acquisition amortization runs off).
- Terminal value at year N (growing perpetuity): TV_N = FCF_{N+1} / (r − g).
- **g** is long-run growth of the cash flows. It cannot exceed long-run nominal growth of the
  economy (inflation + real growth); 2–4% is the usual range.
- **Estimate FCF_{N+1} separately; do not just multiply FCF_N by (1 + g).** When revenue moves from
  fast growth to g, the increase in NWC and net capex drop (their *levels* grow at g, so their
  *changes* shrink), and depreciation can fall off a cliff. Rebuild year N+1 line by line.
- A multiple of year-N EBITDA is an acceptable cross-check for TV (see `valuation-multiples-and-deals`).
- Tie g to reinvestment: g = return on new capital × reinvestment rate (net capex plus working
  capital build, over NOPAT). A high g with little reinvestment is a free lunch; check it.
- The TV is often 60–90% of value. Always show how much of EV comes from it.

### 3. Pick the method by how debt will behave
| Debt policy | Method | How |
|---|---|---|
| Debt kept at a target D/V ratio | **WACC** | Discount FCF at WACC → levered EV in one step |
| Debt levels fixed by a schedule (loan paydown, LBO, mortgage, permanent debt) | **APV** | V_U = PV(FCF at r_U); add PV(interest tax shields); V_L = V_U + PV(ITS) |
| Schedule now, target ratio later | **APV + WACC terminal** | APV for the scheduled years; TV computed with WACC (it already includes later tax shields) |
| Equity holders' view, complex capital structure | **FTE** | Discount FCFE at r_E → equity value directly |
- Interest tax shield in year t = τ × r_D × D_{t−1}. Discount predetermined shields at r_D;
  shields from target-ratio debt at r_U. Permanent fixed debt D: PV(ITS) = τ × D.
- FCFE = FCF − interest × (1 − τ) + net borrowing
  (= net income + depreciation − capex − increase in NWC + net borrowing).
- Done consistently, all three give the same value. Limit tax shields to years with taxable
  income, and note any cap on interest deductions (e.g. US limit near 30% of EBIT).

### 4. Discount
EV_0 = Σ FCF_t / (1 + r)^t + TV_N / (1 + r)^N.
For target-ratio debt, values roll back simply: V_t = (FCF_{t+1} + V_{t+1}) / (1 + WACC). Debt
capacity each year is D_t = (D/V) × V_t, which tells you how much to borrow to hold the ratio.

### 5. Bridge to equity and per-share value
- Enterprise value = equity + net debt; net debt = total debt − excess cash.
- Equity value = EV + excess cash − debt (− other claims: preferred, minority interests, leases
  if treated as debt; add non-operating assets such as stakes in affiliates, valued separately).
- Price per share = equity value / diluted shares outstanding.
- In practice treat all balance-sheet cash as excess unless the business clearly needs it.
- If you value at a future date (end of next year), the firm will burn or earn cash in between;
  do not present a future EV as today's price.

### 6. Sensitivity and sanity checks
- Two-way table of value against r and g (Excel Data Table); also against the main operating
  driver (margin, growth path).
- Compare implied EV/EBITDA and P/E with peers.
- Check FCF growth in the final forecast year is close to g, and margins are plausible.
- Ask who built the forecast and why; analysts have been seen to change inputs (a lower risk
  premium) to keep a target price unchanged.
- For a young, fast grower: build revenue from drivers (users × revenue per user), line up
  other analysts' rates, growth and cash flows to see the spread, and run a reverse DCF (what
  growth and margin today's price needs).
- Value non-operating assets apart (cash used to fund a deal, stakes in uncontrolled affiliates
  by a multiple of their earnings). Case lessons: cfo/references/dcf-valuation/case-lessons.md.

## Worked pattern
A regional services firm: revenue $10.0m, growing 8%, 6%, 4%, then 3% for good. EBIT margin 12%,
tax 25%, D&A 3% and capex 4% of revenue, NWC 15% of revenue. WACC 10%, net debt $2.0m, 1m shares.
| $m | Y1 | Y2 | Y3 | Y4 |
|---|---|---|---|---|
| Revenue | 10.80 | 11.45 | 11.91 | 12.26 |
| NOPAT | 0.97 | 1.03 | 1.07 | 1.10 |
| + D&A − capex | −0.11 | −0.11 | −0.12 | −0.12 |
| − ΔNWC | −0.12 | −0.10 | −0.07 | −0.05 |
| FCF | 0.74 | 0.82 | 0.88 | 0.93 |
- TV at Y3 = FCF_Y4 / (10% − 3%) = 0.927 / 0.07 = 13.25 (the naive 0.884 × 1.03 would give 13.00).
- EV = PV(Y1–Y3) + 13.25 / 1.1^3 = 2.02 + 9.95 = **$11.97m**; 83% of it from the TV.
- Equity = 11.97 − 2.0 = $9.97m → about **$9.97 per share**.

## Common mistakes
- Including interest or its tax saving in FCF and also using WACC (double counts the shield).
- Using levered net income where unlevered net income belongs.
- Growing the last year's FCF mechanically into the TV while NWC or depreciation is still shifting.
- A perpetual g above the economy's growth, or g ≥ r.
- Subtracting gross debt but forgetting to add excess cash (or counting cash twice).
- Using WACC when the debt is on a fixed paydown schedule (D/V drifts; use APV).
- Starting NWC at the target's level when the deal does not transfer working capital (or vice versa).
- Presenting one number with no sensitivity range.
- A terminal growth rate with no reinvestment to fund it.
- Taking a single analyst's DCF as the answer when published DCFs for the same firm disagree widely.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- Leases, pensions and minority interests in the equity bridge are covered only briefly (step 5,
  standard practice).
