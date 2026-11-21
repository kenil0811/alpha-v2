# Inventory pooling and flexibility

> **Area:** `inventory-pooling-and-flexibility` · owned by the COO skill. **Use when:** Cut the buffer stock or spare capacity a business needs by pooling demand across locations, products or time, and by adding a small, well-placed amount of product flexibility, while watching for the single point of failure pooling creates. Use when deciding warehouse or stockroom setups, product variety, postponement, cross-training, or which plants or staff can make which products.

**Outcome:** the same service level with less inventory or capacity, by combining uncertain demands, plus a check that the pooled setup does not become one place where a single failure stops everything.

## When to use
- Several stores, warehouses or vans each hold their own safety stock.
- Many product variants (colors, sizes, country versions) each need their own buffer.
- Planning which plants, lines, shifts or people can switch between products or tasks.
- Consolidating to one warehouse or one supplier, or the reverse.

## Method

### 1. Why pooling works: means add, standard deviations don't
- Total demand mean = sum of means.
- **σ_total = √(σ1² + σ2² + 2ρσ1σ2)** for two sources (add every pair's 2ρσiσj for more). ρ is the correlation between demands.
- Pooled safety stock = z x σ_total (x √L for lead time), always <= the sum of separate safety stocks.
- **Square-root law:** N identical, independent locations pooled into one need √N times less safety stock (not N times).
- The saving shrinks as ρ rises; it is zero at ρ = 1 and largest when demands move opposite (ρ < 0).

### 2. Forms of pooling (pick what the business can run)
1. **Physical centralization:** one stockroom or DC serves all. Check transport cost and delivery time to far customers, and overhead.
2. **Virtual centralization / transshipment:** separate sites share live stock visibility and move stock between them; online orders filled from any store.
3. **Specialization:** each product stocked in one site only.
4. **Component commonality:** the same part across many products.
5. **Product substitution:** offer fewer, interchangeable variants; replace a sold-out item with a close one.
6. **Postponement:** keep the product generic and customize late (undyed goods, generic units localized at the DC, assemble to order).
7. **Vendor-managed inventory:** the supplier pools many customers' demand.
8. **Time pooling:** use prices to shift demand across periods and level production.

### 3. Flexibility: pooling capacity
- Flexibility = a plant, line or person that can make more than one product, so volume moves to where demand shows up. Each extra plant-product link costs tooling, qualification or training.
- **Full flexibility** (everything can make everything) is capacity pooling: biggest gain, most links.
- **Chaining:** with n plants and n products, give each plant one extra product so the links form a single closed loop (plant 1 makes A and B, plant 2 B and C ... last plant makes its own and A). With 2n links this captures nearly all of full flexibility's benefit.
- Rules: spread flexibility evenly (one super-flexible plant is weak, it is busy with its own work); close the loop (an open chain loses much of the gain); one long chain beats several short ones or isolated pairs.
- Flexibility pays most when forecasts miss a lot and when products' demands don't move together. With good forecasts, it and better forecasting are substitutes.
- The same chain also reroutes work when one plant goes down, which makes it a disruption tool too.
- Applies to people: cross-train staff in a chain across stations or skills (standard practice application).

### 4. Time flexibility (reactive capacity)
- A slow, cheap source commits before the season; a fast, dearer source commits after demand is seen.
- **Hybrid sourcing:** buy the demand you're sure of from the cheap, slow source; cover the uncertain volume from the fast one. Don't pay the fast premium on units you're certain to sell.
- Price the premium: convert a setup fee or lead-time gain into cost per unit of mismatch avoided.

### 5. The pooling paradox: check the tail
- Pooling cuts recurrent (everyday) risk but concentrates disruptive risk: the pooled site or sole supplier becomes a single point of failure.
- Compare designs on two numbers: average lost sales and the worst week in 100 (or the loss if the pooled site is down for a month). Pooling may keep the average similar and make the worst case much worse.
- Mitigate: a second site or supplier qualified in advance, transshipment ability, a strategic reserve sized by time to survive (see disruption-exposure-mapping).

## Worked pattern
Three shops each sell N(240, 60) units a week of an item, independent, 2-week lead time, 95% service.
- Separate: 3 x 1.645 x 60 x √2 ≈ 419 units of safety stock.
- One shared stockroom: 1.645 x √3 x 60 x √2 ≈ 242 units, 42% less.
- If the shops' demand is correlated at ρ = 0.3: σ_total = √(3 x 60² + 6 x 0.3 x 60²) ≈ 131/week, safety stock ≈ 306, still 27% less.
- Before closing the shops' backrooms, check: if the stockroom floods, how many days until each shop is empty, and is there a fallback?

## Common mistakes
- Assuming savings scale with the number of sites (they scale with the square root, and less with correlation).
- Ignoring correlated demand (shared weather, promotions, calendars).
- Pooling stock while transport time or cost to customers rises enough to wipe out the saving.
- Giving one plant or one person all the flexibility.
- Building isolated pairs instead of one loop.
- Consolidating to one site or one supplier without measuring the worst case.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- Vehicle routing, warehouse layout and cross-docking are not covered.
