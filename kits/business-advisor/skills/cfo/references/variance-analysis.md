# Standard costing and variance analysis

> **Area:** `variance-analysis` · owned by the CFO skill. **Use when:** Set standard costs and flexible budgets, split the gap between actual and budgeted results into price, efficiency and volume variances for revenue, materials, labour and overhead, and understand how fixed overhead treatment (absorption versus variable costing) changes reported profit. Use for monthly performance reviews, explaining why profit missed budget, controlling operations, or checking whether profit was boosted by overproduction.

**Outcome:** a business can explain, in money, why results differ from plan (prices paid,
efficiency, volume) and assign each part to the person who controls it, without being fooled by
inventory-driven profit.

## When to use

- Monthly or quarterly results versus budget.
- "Costs are up: is it prices, waste, or just more volume?"
- Setting standards for quoting and control.
- Profit moved but sales did not: check production volume and fixed overhead.

## Method

### 1. Costing types

Cost = output × input per output × cost per input (A = actual, S = standard):

| System | Direct costs | Overhead |
|---|---|---|
| Actual | A × A × A | A × A × A |
| Normal | A × A × A | A × A × S (predetermined rate) |
| Standard | A × S × S | A × S × S |

Predetermined overhead rate = budgeted overhead / budgeted driver volume. If the driver is
output itself, input per output = 1.

### 2. The five-column table (variable items)

Work right to left, changing one dial at a time:

| (1) Actual | (2) Actual input at standard price | (3) Flexible budget | (4) Applied | (5) Static budget |
|---|---|---|---|---|
| A out × A in/out × A price | A × A × S | A × S × S | = (3) | planned out × S × S |

- (1) vs (2): **price (rate, spending) variance** = (actual price − standard) × actual input.
- (2) vs (3): **efficiency (quantity, usage) variance** = (actual input − standard input for
  actual output) × standard price.
- (3) vs (5): **sales volume variance** = (actual − planned output) × standard cost per unit.
- (1) vs (3): flexible budget variance = price + efficiency.
- (1) vs (5): static budget variance = all three.
- Revenue: price variance = (actual − budget price) × actual units; volume variance =
  (actual − budget units) × budget price.
- With several products sharing a driver, compute standard inputs per product and sum.

Favourable or unfavourable only says the direction against the standard, not good or bad: a
favourable labour rate from cheaper, less skilled staff can cause a bigger unfavourable
efficiency variance.

### 3. Fixed overhead
(Variable overhead spending and efficiency, the four-, three- and two-variance formats, mix and
yield variances, ideal versus attainable standards and throughput costing are in
cfo/references/variance-analysis/mix-yield-overhead-and-capacity.md.)

| (1) Actual | (2) = (5) | (3) = (5) | (4) Applied | (5) Static budget |
|---|---|---|---|---|
| actual cost | budget | budget | A out × S in/out × predetermined rate | budget |

- (1) vs (5): **spending (budget) variance**.
- (3) vs (4): **production-volume variance**: budgeted fixed cost not absorbed because output
  differed from the budgeted level. It reflects capacity use, not spending control.

### 4. Three common questions

| Question | Columns | Variable costs | Fixed costs |
|---|---|---|---|
| Actual vs flexible budget | (1) vs (3) | price + efficiency | spending |
| Actual vs static budget | (1) vs (5) | price + efficiency + volume | spending |
| Over- or under-applied (estimation error) | (1) vs (4) | price + efficiency | spending + production volume |

Close the over- or under-applied amount to cost of sales (most firms); some spread it between
inventory and cost of sales.

### 5. Absorption versus variable costing

- **Absorption:** fixed manufacturing overhead is a product cost, held in inventory until sold.
- **Variable:** fixed manufacturing overhead is expensed in the period.
- Inventory flow: begin + produced = sold + end. Profit differs only when inventory changes:
  absorption profit − variable profit = fixed overhead in ending inventory − fixed overhead in
  beginning inventory.
- Under absorption, producing more than you sell lowers unit cost and parks fixed cost in
  inventory, raising profit without any sale. Unit costs move with production volume, not sales
  volume. Under variable costing, unit costs move with sales volume and profit fully reflects
  changes in fixed costs.
- Use variable costing (contribution) for internal decisions and to remove the overproduction
  incentive; absorption is required for external reporting. Watch inventory build-ups when
  managers are paid on absorption profit.

### 6. Use variances to manage

- Investigate large or persistent variances, and the pattern across variances, not each alone.
- Assign each variance to who controls it (purchasing for material price, the line for usage).
- Fit the control system to the operation: frequent detailed variance reports suit stable,
  standardised operations; teams in flexible, continuously improving plants may need
  operational measures (quality, throughput) more than cost variances.
- Revise standards when processes change; stale standards make all variances noise.
- Keep the costing standard separate from any incentive baseline; lax standards inflate product
  costs and build hidden favourable variances that can be used to smooth earnings.
- Case lessons from a traditional plant, a team-based plant and a division with lax standards:
  cfo/references/variance-analysis/case-lessons.md.

## Worked pattern

A bakery planned 10,000 loaves using 0.5 kg flour each at 1.00 per kg. It made 9,000 loaves,
used 4,800 kg and paid 1.10 per kg.

- (1) 9,000 × 0.533 × 1.10 = 5,280. (2) 4,800 × 1.00 = 4,800. (3) 9,000 × 0.5 × 1.00 = 4,500.
  (5) 10,000 × 0.5 × 1.00 = 5,000.
- Price 480 U; efficiency 300 U; volume 500 F; static budget variance 280 U.
- The static budget comparison (280 U) understates the problem; against the flexible budget,
  flour cost 780 more than it should have for the output made.

## Common mistakes

- Comparing actual cost with the static budget and calling the difference "overspend".
- Changing two dials at once, or computing efficiency at actual price.
- Forgetting that applied equals flexible budget for variable costs but not for fixed.
- Treating the fixed overhead volume variance as a spending problem.
- Reading favourable as good without looking at the related variances.
- Converting annual budgets to monthly ones inconsistently.
- Reading an unfavourable variance in one account as bad when it lowered total cost.
- Holding a plant to labour variances when labour is in practice a fixed cost.
- Letting favourable variances pile up in inventory until year end.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps

- Sales-mix and market-size/share variances are not covered.
