# Process costing (weighted average and FIFO), ABC hierarchy, closing overhead

Drawn from standard cost-accounting textbook procedures, restated.

## Process costing in five steps
1. **Physical units:** beginning WIP + started (or transferred in) = completed + ending WIP.
2. **Equivalent units (EU)** per cost pool (direct materials, conversion, transferred-in):
   - Weighted average: EU = units completed + ending WIP × % complete for that pool.
   - FIFO: EU = (beginning WIP × % still to do) + units started and completed + ending WIP ×
     % complete. FIFO EU = weighted-average EU − beginning WIP × % already done.
3. **Costs to account for:** beginning WIP cost + costs added this period, per pool.
4. **Cost per EU:**
   - Weighted average: (beginning cost + cost added) / weighted-average EU.
   - FIFO: cost added this period only / FIFO EU (this period's efficiency, untouched by last
     period's costs).
5. **Assign:** completed units and ending WIP at the cost per EU (FIFO: completed units also
   carry the beginning WIP cost). Totals must equal step 3.
- Transferred-in costs from an earlier department are a separate pool, always 100% complete.
- The two methods agree when there is no beginning WIP; they differ more when input prices
  change and when WIP is large relative to output.
- Standard costs per EU avoid both calculations where many similar products share a process.

## Activity-based costing: the cost hierarchy
Pool overhead by the level at which it is caused, and choose a driver at that level:
- **Unit level:** varies with each unit (machine power, unit inspection). Driver: units, machine hours.
- **Batch level:** varies with batches (setups, purchase orders, material moves). Driver: setups,
  batches, orders.
- **Product-sustaining:** supports a product line regardless of volume (design, engineering
  changes). Driver: number of products, design hours.
- **Facility-sustaining:** keeps the plant open (rent, plant management). No good driver;
  often left unallocated or spread on a simple base and flagged as such.
Signs a single unit-level rate is distorting cost: products differ in batch size, complexity or
support; low-volume products look profitable and high-volume ones look costly; managers ignore
the cost numbers when pricing.

## Closing under- or over-applied overhead (normal costing)
- Write-off: all to cost of goods sold (simplest; fine when the amount is small).
- Proration: spread over ending WIP, finished goods and cost of goods sold in proportion to the
  overhead applied in each (most accurate), or to their ending balances.
- Adjusted allocation rate: recompute the rate on actual figures and restate every job (gives
  actual-costing results after the fact).

## Denominator choice for the overhead rate
Theoretical capacity (no downtime), practical capacity (allowing normal downtime), normal
capacity use (average demand over several years), or budgeted use (this year's demand).
Practical capacity shows the cost of unused capacity separately and avoids raising unit costs
when demand falls; budgeted use can set off a downward demand spiral (lower volume → higher
unit cost → higher price → lower volume).
