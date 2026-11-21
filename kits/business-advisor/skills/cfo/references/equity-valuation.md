# Equity valuation

> **Area:** `equity-valuation` · owned by the CFO skill. **Use when:** Estimate what a company's equity is worth using multiples (P/E, forward P/E, PEG), discounted dividends, discounted free cash flow to equity and residual income, with a cost of equity from CAPM and a sensitivity range. Use when buying, selling or investing in a business, pricing a stake, judging whether a share price is reasonable, or valuing the effect of a growth plan.

**Outcome:** a business gets a defensible value range for a company (its own or another), knows
which assumptions drive it, and can tell whether growth plans actually create value.

## When to use

- Buying or selling a business or a stake; a funding round; an owner buy-out.
- "Is this share price cheap or expensive relative to peers?"
- "Will growing sales by X add value, given the investment it needs?"

## Method

### 1. Frame it

- Resources = claims: core operations + non-operating (financial) assets = debt + other
  capital (preferred, options) + common equity. Value one side to value the other.
- **Equity value** = present value of flows to shareholders, discounted at the cost of equity
  (ke). **Enterprise value** = value of operations, discounted at the weighted average cost of
  capital (WACC); equity = enterprise value + financial assets − debt − other claims.
  WACC = D/(D+E) × kd × (1 − t) + E/(D+E) × ke, with D and E at market or target weights.
- Markets are mostly efficient: a large gap between your value and the price is more likely an
  error in your assumptions than a bargain. Look for the reason before acting.

### 2. Cost of equity (CAPM)

ke = risk-free rate + beta × equity risk premium. One common choice is the 10-year government bond
yield and a 7.5% premium, with beta from a public source. Cost of capital estimates are
imprecise and have a large effect on value: always show a range. For a private small firm,
there is no traded beta; use a listed peer's beta, unlevered and relevered for its debt,
plus a size or illiquidity premium (standard practice).

### 3. Present value tools

- Single sum: PV = CF / (1 + k)^n.
- Perpetuity: PV = CF / k. Growing perpetuity: PV = CF(next year) / (k − g), with g < k.
- Terminal value: the growing-perpetuity value of everything after the forecast horizon,
  discounted back from the horizon.

### 4. Multiples (quick, relative)

- With earnings as cash to owners and constant growth: **P/E = 1 / (ke − g)**. So P/E is higher
  for faster growth and lower risk, and lower when earnings overstate cash to equity (heavy
  reinvestment, aggressive accounting) or when the price is wrong.
- Implied growth: given P/E and ke, g = ke − 1 / (P/E).
- **Forward P/E** = price / next year's forecast EPS: removes one-offs and includes near growth.
- **PEG** = P/E / (expected long-term growth in %). Controls only partly for growth; it is
  distorted at very low and very high growth and meaningless when growth is near zero or
  negative. PEGY adds the dividend yield to growth.
- Compare a firm only with close peers, and explain differences by growth, risk, accounting or
  mispricing.

### 5. Discounted dividends

Value = PV of expected dividends. Correct in theory, weak in practice: payouts are management
choices, so they give little guidance, and most of the value usually sits in the terminal
value, which is very sensitive to the growth rate assumed.

### 6. Discounted free cash flow to equity (FCFE)

- **FCFE = net income − increase in common equity book value** (= NI − investment in net
  operating assets + new net debt). Build it from pro forma statements (see
  `pro-forma-forecasting`) over 5 to 10 years, then a terminal value.
- Drivers and their direction: sales growth (mixed: more profit but more investment), NOPAT
  margin (+), net interest rate (−), working capital turnover (+), long-term asset turnover (+),
  net debt / equity (more leverage looks good in the spreadsheet because kd < ke; in reality ke
  rises with leverage).
- **Value of extra sales**, one-time investment, permanent margin:
  assets needed = Δsales × (long-term assets / sales + net working capital / sales);
  new debt = assets × net debt / capital; new equity = assets − new debt;
  extra NI = Δsales × NOPAT margin − new debt × after-tax interest rate;
  FCFE in year 1 = extra NI − new equity; value ≈ −new equity + extra NI / ke (both at year
  end, discount once more by (1 + ke) if being precise). Growth is often FCFE-negative at first.
- At some point growth must slow so investment slows and FCFE turns positive; check that the
  implied ROE drifts towards ke rather than rising forever.

### 7. Residual income (preferred for intuition)

- **Residual income (RI)** = NI − ke × beginning book equity = (ROE − ke) × beginning book
  equity. Enterprise version: NOPAT − WACC × beginning NOA.
- **Value = book equity today + PV of expected future RI.** Book value next year = book value +
  NI − dividends.
- Equivalent to discounted dividends, robust to accounting that shifts income between periods
  (understated book value now is offset by higher RI later), and it shows that growth adds value
  only when ROE exceeds ke.
- Steps: EPS forecasts for years 1 to 2 (consensus or your model), grow at a 3-to-5-year growth
  rate to year 5; book value per share from the latest balance sheet; payout ratio = dividends /
  EPS (trailing); roll book value and RI forward; terminal value under one of:
  1. ROE stays at the year-5 level: RI as a growing or level perpetuity (high);
  2. ROE fades linearly to ke over the next five years, terminal RI = 0 (low);
  3. treat year-2 RI as a perpetuity (a simple anchor).
- Competition should drive ROE to ke, but conservative accounting (R&D and brands expensed,
  unrecorded assets) keeps book value low, so ROE stays above ke even in a steady state. Allow
  for that, or the terminal value will be too low for intangible-heavy firms.
- Compare price / value across peers rather than trusting one point estimate.
- Reverse engineering (what growth or return the price implies, and the no-growth anchor): see
  cfo/references/equity-valuation/reverse-engineering-and-claims.md.

### 8. Other claims (when relevant)

- Employee stock options: the value of a call option rises with the volatility of the share,
  since the upside grows and the downside is floored at zero. Intrinsic value = price − exercise
  price (if positive). Treat options as a claim that reduces common equity value. Black–Scholes
  inputs and the liability treatment are in cfo/references/equity-valuation/reverse-engineering-and-claims.md.

### 8a. Read the statements before valuing them

- Forecast from operating drivers: research finds that the two parts of operating
  return (NOPAT margin and net operating asset turnover) explain future profit and share returns
  better than earnings alone (`cfo/references/ratio-analysis/operating-classification.md`).
- Value on cleaned earnings: continuing operations, FIFO-equivalent inventory, normal reserves
  and tax rates (`cfo/references/earnings-quality.md`). A management "adjusted EPS" is a claim to
  test, not an input.
- Firms with heavy expensed R&D or brand spending trade far above book value because the asset is
  unrecorded; do not call them overvalued on price-to-book alone.
- A high-growth share prices in its growth: when a leading indicator (subscribers, bookings)
  turns, the price can fall by half or more though the year's EPS barely moves. Ask what growth
  the price assumes and what would break it (case lessons:
  `cfo/references/ratio-analysis/case-lessons.md`).

### 9. Report

Value range from at least two methods, the key assumptions (ke, growth, margins, horizon ROE),
a sensitivity table on ke and g, and the reason your value differs from price, if it does.

## Worked pattern

A distributor: book equity 50, ke = 4% + 1.0 × 7.5% = 11.5%, NI next two years 8 and 9 (ROE
16%, then about 16.5%), payout 40%, after which ROE fades to ke.

- BV1 = 50 + 8 − 3.2 = 54.8. RI1 = 8 − 0.115 × 50 = 2.25. RI2 = 9 − 0.115 × 54.8 = 2.70.
- If RI then fades to zero over the next few years (as an estimate, the year-3 to year-5 RI of
  about 2.0, 1.3 and 0.7), value ≈ 50 + 2.25/1.115 + 2.70/1.115² + 2.0/1.115³ + 1.3/1.115⁴ +
  0.7/1.115⁵ ≈ 50 + 2.0 + 2.2 + 1.4 + 0.8 + 0.4 ≈ 56.9.
- Check with a multiple: 56.9 / 8 ≈ 7.1 times forward earnings. Peers trade at 9 times.
  Either peers have more durable advantages, or the fade assumption is too harsh: test it.

## Common mistakes

- Dividing by (ke − g) with g close to or above ke.
- Using current-year rather than next-year cash flow in the growing perpetuity (state which).
- Raising leverage in the model without raising ke or the interest rate.
- Raising margins without the investment or volume effects that would come with them.
- Calling a high-P/E growth firm overvalued; fairly valued fast growers have high P/Es.
- Assuming ROE falls to exactly ke for firms with large unrecorded intangibles.
- Valuing equity by discounting income without subtracting reinvestment.
- Mixing equity flows with WACC, or firm flows with ke.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps

- Small private-company valuation (illiquidity, owner pay normalisation) is not covered here; see
  `private-company-valuation`.
