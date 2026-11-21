# Inventory replenishment policy

> **Area:** `inventory-replenishment-policy` · owned by the COO skill. **Use when:** Set how much to order, when to reorder and how much safety stock to hold for items that are bought again and again, and measure the service it delivers. Use when a business runs out of stock, carries too much, reorders by gut feel, or asks what service level it should target.

**Outcome:** for each repeat-purchase item, an order quantity, a reorder point (or order-up-to level) and a safety stock, with the service level they buy and the holding cost they carry, plus the levers that let the business hold less for the same service.

## When to use
- Items reordered from suppliers repeatedly (raw materials, spare parts, retail stock, packaging).
- Frequent stockouts, or cash tied up in slow stock.
- Choosing a service target, or checking whether one is worth its cost.
- Comparing suppliers with different lead times or reliability.

## Method

### 1. Gather the inputs (same time unit everywhere)
- λ: average demand per period. σ: standard deviation of demand per period (from history or forecast error).
- L: supplier lead time in periods; Var[L]: its variance if deliveries are unreliable.
- s: fixed cost per order (admin, delivery charge, setup). c: unit cost.
- h: cost to hold one unit for one period = i x c + v (i: holding rate including cost of capital; v: storage, insurance, shrinkage per unit).
- Shortage cost per unit: lost margin, goodwill, emergency supply premium.

### 2. Cycle stock: how much per order (EOQ)
- Total ordering plus holding cost per period = s x (λ/Q) + h x (Q/2).
- **Q* = √(2 x λ x s / h)**. Average cycle stock = Q*/2. Orders per period = λ/Q*.
- The cost curve is flat near the optimum: rounding Q to a pallet or case size costs little.
- Quantity discounts: compare total cost (including purchase cost) at Q* and at each price break (standard practice).

### 3. Safety stock: when to reorder (continuous review, (Q, R) policy)
- Lead-time demand (LTD) has mean λL and variance Lσ² (independent, Normal demand per period).
- **R = λL + z x σ x √L**. Safety stock = z x σ x √L. z from the standard normal table for the chosen service level (90%: 1.28; 95%: 1.645; 98%: 2.05; 99%: 2.33). Spreadsheet: =NORM.S.INV(service level).
- Unreliable supplier: **R = λL + z x √(L x σ² + λ² x Var[L])**. Lead-time variability is multiplied by λ², so it often dominates.
- Average inventory ≈ Q*/2 + safety stock.
- Policy: when inventory position (on hand plus on order minus backorders) falls to R, order Q*.

### 4. Choose the service level from costs, not habit
- **Service level = Cs / (Cs + Ce)**.
  - Cs: cost of being short one unit in a replenishment cycle (lost margin, goodwill, or premium paid to an alternative source).
  - Ce: cost of carrying one excess unit through a cycle = h x (Q/λ).
- 100% service is never optimal: safety stock rises steeply as the target nears 100%.
- If costs are hard to price, note that any target implies a shortage cost; state it and ask if the owner agrees.

### 5. Other policies
- **Periodic review (s, S):** check stock every period; if below s, order up to S. Use when stock is counted or orders are placed on a schedule. Protect over review period plus lead time (standard practice: safety stock = z x σ x √(T + L), T the review period).
- **Base stock:** order exactly what sold each period to keep on-hand plus on-order at B. Good for expensive items with low ordering costs.
- Continuous review needs less stock than periodic for the same service; use it where systems allow.

### 6. Measure service two ways
- **Service level (cycle service level):** share of periods or cycles with no stockout. Easy to measure from stock records.
- **Fill rate:** share of demand units filled from stock = expected min(stock, demand)/demand. More intuitive for customers but needs lost-demand data, which walk-away customers hide.
- Fill rate is always at least the service level; a 85% service level can mean a 99% fill rate. Say which one a target refers to.

### 7. Levers to hold less for the same service
1. Use a computed policy at all (many firms don't, and overstock).
2. **Cut forecast error** (σ): better data, customer information sharing. Forecasts are always wrong, change over time, worsen with horizon, and are better in aggregate.
3. **Cut demand variability you cause:** batch-inducing discounts, sporadic promotions, order minimums. Negotiate steadier ordering with large customers.
4. **Shorter and more reliable lead times:** nearer suppliers, help suppliers improve, vendor-managed inventory, cross-docking.
5. **Change the cost structure:** lower ordering costs (electronic orders, mixed truckloads) to order smaller; raise salvage (outlets) to make higher service cheaper.
6. **Pool stock** across locations or products (see inventory-pooling-and-flexibility).

## Worked pattern
A distributor sells 12,000 units a year of one item (240 a week, σ = 60 a week), cost $20, 25% annual holding rate (h = $5/yr), $90 per order, lead time 2 weeks.
- Q* = √(2 x 12,000 x 90 / 5) ≈ 657 units, about 18 orders a year; cycle stock ≈ 330.
- At 95%: safety stock = 1.645 x 60 x √2 ≈ 140; reorder point ≈ 480 + 140 = 620.
- If lead time varies (σ of L = 0.5 week): safety stock = 1.645 x √(2 x 60² + 240² x 0.25) ≈ 242, a 73% jump, worth paying a reliable supplier for.

## Common mistakes
- Mixing time units (annual holding cost with weekly demand).
- Setting safety stock from average demand instead of demand variability and lead time.
- Targeting 99 to 100% service on every item regardless of margin.
- Using sales as demand when stockouts hid lost sales.
- Ignoring supplier unreliability, which needs far more buffer than demand noise.
- Reporting "service level" without saying whether it is cycle service or fill rate.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- None noted beyond the scope above.
