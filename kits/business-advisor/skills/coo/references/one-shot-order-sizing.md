# One-shot order sizing (newsvendor)

> **Area:** `one-shot-order-sizing` · owned by the COO skill. **Use when:** Decide how much to buy or make when there is one chance to order before uncertain demand (seasonal, perishable, event, fashion, or a capacity commitment), by weighing the cost of too much against the cost of too little. Use for any "how many should we order?" question with leftovers or lost sales at stake.

**Outcome:** an order quantity that maximizes expected profit for a single buying decision, the chance it sells out, and how the answer moves if prices, salvage or forecast error change.

## When to use
- Seasonal or holiday stock, fashion, perishables, event catering, print runs, textbooks, one-off production runs.
- Committing capacity, staff or freight before demand is known.
- Any repeated cycle where each cycle's stocking decision stands alone (it applies again each replenishment cycle).
- Someone proposes ordering "the forecast".

## Method

### 1. Price a unit short and a unit left over
Use per-unit terms:
- r: selling price; c: unit cost; v: salvage per leftover (negative if disposal costs); h: extra cost to hold a leftover; p: penalty per unit short (goodwill, contract penalty).
- **Cost of too little (Cu, also Cs):**
  - Sale lost: Cu = r - c + p.
  - Shortfall covered by an alternative source at price a: Cu = a - c (the margin is not lost, only the premium).
- **Cost of too much (Co, also Ce):** Co = c - v + h.

### 2. Critical ratio
- **CR = Cu / (Cu + Co).** Order so that P(demand <= order) = CR.
- Cu > Co: order above the mean. Cu < Co: below the mean. Equal: the mean.
- The ratio does not depend on the demand distribution; the quantity does.

### 3. Turn the ratio into a quantity
- Normal demand N(μ, σ): **Q = μ + z x σ**, z = NORM.S.INV(CR); or Q = NORM.INV(CR, μ, σ).
- Empirical history (discrete): build the cumulative frequency table and take the smallest quantity whose cumulative probability reaches CR (always round up to cover the ratio).
- Marginal logic, if a table helps: add one more unit while P(demand <= Q) x Co < P(demand > Q) x Cu.

### 4. Check expected outcomes (simulate if unsure)
- Expected profit(Q) = average over demand scenarios of: sales x r + leftovers x v - Q x c - shortfall x p.
- In a spreadsheet: draw demand with =NORM.INV(RAND(), μ, σ), compute profit, repeat 1,000+ times (data table), average. Freeze draws with paste-values.
- Report: order, expected profit, chance of selling out (1 - CR), average leftovers, average lost units.

### 5. When costs change during the season
- Early in a long season a leftover is not dumped, only carried: Co is just a month's holding cost, so the ratio is high and you produce above the mean. Near the end Co becomes cost minus liquidation value; cut back. Recompute the ratio at each decision point.
- If you can reorder after seeing early sales (a faster, dearer supplier, a second production run), buy the sure base cheaply now and keep the uncertain part for later (see demand-forecast-distributions and supply-contracts-and-coordination).

### 6. Levers that raise profit
- Raise salvage (outlets, secondary buyers, returns to supplier) to cut Co; this raises the best service level.
- Find a cheaper backup source to cut Cu.
- Shrink σ with better forecasts; every unit of σ costs safety buffer.
- Share the risk with the supplier by contract (buy-back, options, revenue sharing).

## Worked pattern
A garden center orders holiday wreaths once: price $60, cost $25, unsold wreaths sold to a florist at $10. Demand forecast N(500, 120).
- Cu = 60 - 25 = $35; Co = 25 - 10 = $15; CR = 35/50 = 0.70.
- Q = NORM.INV(0.70, 500, 120) ≈ 563. Sells out in about 30% of seasons, by design.
- If a nearby wholesaler can supply last-minute wreaths at $40, Cu falls to $15, CR = 0.5, and the order drops to the mean, 500.

## Common mistakes
- Ordering the point forecast. A forecast is a distribution; the order depends on its spread and the cost ratio.
- Counting the margin as lost when an alternative source covers the shortfall.
- Forgetting salvage or disposal in Co.
- Fitting demand from sales that were capped by stockouts (see demand-forecast-distributions).
- Expecting zero stockouts: with a low ratio, selling out most seasons is correct.
- Judging the order by one season's outcome instead of the logic.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- None noted beyond the scope above.
