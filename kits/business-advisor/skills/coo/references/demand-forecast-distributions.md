# Demand forecasts as distributions

> **Area:** `demand-forecast-distributions` · owned by the COO skill. **Use when:** Turn sales history or people's judgment into a demand forecast with a center and a spread, correct for sales lost to stockouts, and combine several opinions so the forecast can size buffers, orders and capacity. Use whenever a stocking, staffing or capacity decision needs a forecast, or for new products with no history.

**Outcome:** a forecast stated as a distribution (mean and standard deviation, or a fitted shape) that feeds order sizes, safety stock and capacity plans, with known biases removed.

## When to use
- Before any newsvendor, safety-stock, pooling or flexibility calculation (they all need μ and σ).
- A new product, store or season with little or no history.
- Buyers or managers set forecasts by committee or by "agreed number".
- History contains sold-out periods.

## Method

### 1. Remember the four laws
1. Forecasts are always wrong: carry a buffer for the error.
2. Forecasts change as information arrives: keep updating.
3. The further out, the less reliable.
4. Aggregates are more accurate than parts (product family beats single SKU, region beats store).

### 2. From data: fit in four steps
1. **Collect** history you believe resembles the future: this item, or similar items, stores or seasons.
2. **Pick a shape:** Normal for steady, high-volume items; skewed shapes (gamma, lognormal) for slow movers or items that can't go below zero with big upside.
3. **Fit** by moment matching: μ = AVERAGE(sales), σ = STDEV.P(sales). For the Normal this equals maximum likelihood.
4. **Check the fit where you'll use it:** if you stock to the 98th percentile, count how often history exceeded that level. Close is good enough. Formal scores (AIC: lower is better) can compare shapes; don't chase decimals.

### 3. Sales are not demand
- When an item sells out, sales stop at the stock level; turned-away customers never appear in the data.
- Fitting raw sales then under-forecasts exactly the best sellers, so the next order is smaller and they sell out again.
- Fixes:
  - Treat each sold-out period as "demand of at least the stock level" (a censored observation) and fit with a method that handles it (standard practice: censored maximum likelihood; spreadsheet Solver can do it).
  - Rebuild lost demand from the sales pace of similar items that didn't sell out (for example, hourly sales curves).
  - Track walk-aways, back-orders and "out of stock" searches where possible.
- More data of the same censored kind does not fix the bias.

### 4. From judgment (no history)
- Ask an expert two questions: "most likely?" and "a range you're 90% sure of?".
- Normal approximation: μ = most likely (or the range midpoint); **σ = (high - low) / 3.29** for a 90% range (divide by 2.56 for an 80% range). Spreadsheet: =(high-low)/(2*NORM.S.INV(0.95)).
- People's ranges are too narrow (overconfidence). Widen them, or ask several people.

### 5. Combine opinions: average, don't force consensus
- Get each person's forecast independently and in writing first; share anonymously (Delphi style). Then average (the median resists outliers).
- The average of independent guesses usually beats most individuals; big errors cancel.
- It only works when errors are independent: groupthink, a dominant voice or shared data sources leave a floor of error no crowd size removes.
- Keep the spread across forecasters: wide disagreement is a signal of high σ. A consensus number throws that signal away.
- An ensemble of good models beats one good model. Internal prediction markets are another way to pool views.

### 6. Keep the forecast separate from the plan
- The forecast is the best estimate of demand. The plan (order, stock, staffing) applies costs on top of it.
- Never shade a forecast up or down "to be safe": record the clean forecast so accuracy can be tracked, then decide stock from it.

### 7. Reduce forecast error where it pays
- Read early sales and re-forecast: a small share of the season's sales can cut forecast error sharply; pair this with a fast reorder option.
- Share point-of-sale data up the chain.
- Forecast at the aggregate level and split by historic shares.
- Price the value of better information before buying it (see risk-decisions-under-uncertainty).

## Worked pattern
A café chain launches a new seasonal drink in 12 stores. No history.
- Three managers, asked separately: 400, 520, 700 cups a week per store; average 540. The spread is wide, so σ is large.
- The regional manager says most likely 500, 90% sure between 300 and 700: σ = 400/3.29 ≈ 122. Forecast N(520, 125) after blending.
- After two weeks, cups sold to sell-out on four days: treat those days as "at least" the stock and refit before the next ingredient order.

## Common mistakes
- Reporting a single number with no spread.
- Fitting stockout-capped sales as if they were demand.
- Committees agreeing on one number and losing the disagreement.
- Taking an expert's range at face value; it is too narrow.
- Mixing the forecast with the order decision.
- Averaging forecasts that all come from the same source and calling it a crowd.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- None noted beyond the scope above.
