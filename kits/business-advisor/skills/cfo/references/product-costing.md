# Product and customer costing

> **Area:** `product-costing` · owned by the CFO skill. **Use when:** Work out what each product, job, batch, service line, order or customer really costs by allocating direct and indirect costs through a costing system (job, process, operations or activity-based), and design a better system when the current one cross-subsidises. Use when pricing work, judging product or customer profitability, valuing inventory, or when overhead is spread on a single crude base.

**Outcome:** a business knows the cost and profit of each thing it sells and each customer it
serves, and stops losing money on work that a crude cost system makes look profitable.

## When to use

- Quoting or pricing jobs; deciding which products or services to push.
- "Which customers or orders actually make us money?"
- Valuing work in progress and finished goods.
- Overhead is large and spread on one base (labour hours, revenue) while products or customers
  differ a lot in what they use.

## Method

### Vocabulary

- **Cost object:** what you want a cost for (product, job, batch, department, order, customer).
- **Direct cost:** traceable to the object (materials, the labour on it). **Indirect:** shared
  (overhead), so it must be allocated.
- **Product (inventoriable) cost:** manufacturing cost that sits in inventory until sold.
  **Period cost:** selling and administration, expensed when incurred (but can still be
  assigned to customers for profitability analysis).
- **Cost driver:** what causes the cost to vary. **Cost pool:** a group of costs allocated
  with one driver.

### The seven steps (any system)

1. **Physical flow.** Units: begin + started (or transferred in) = end + completed (or sold).
   Critical when there is work in progress.
2. **Cost objects.** What are they, and how do they differ (labour content, completion,
   departments passed through, number of orders)? If they do not differ, you do not need a
   cost system.
3. **Total costs to allocate.** Include everything relevant (including costs carried in
   beginning inventory); exclude what does not belong (period costs, when costing inventory).
4. **Cost pools by behaviour.** Separate costs that will be allocated differently (direct vs
   indirect; added at the start vs continuously; used by some products only; different
   drivers). Too few pools gives wrong answers (the serious error); too many wastes effort.
5. **Driver rates** = pool cost / driver volume. Use budgeted figures for a predetermined rate
   (normal costing) so costs are known when work is done. Use practical capacity as the
   denominator when you want idle capacity to show as its own cost rather than loading it on
   products.
6. **Apply** rates to each object; add up. If you costed all objects, the totals must equal step 3.
7. **Over- or under-applied overhead** (actual − applied under normal costing) goes to cost of
   sales at period end (simplest; prorating to inventory is the alternative).

### Which system
(FIFO and weighted-average process costing in full, the ABC cost hierarchy, ways to close
over- or under-applied overhead and the capacity denominator choice: see
cfo/references/product-costing/process-costing-and-abc-detail.md.)

- **Job costing:** distinct jobs (custom orders, projects, patients). Direct costs traced; one
  or more overhead rates.
- **Process costing:** identical units flowing through departments (chemicals, food, seats).
  The only difference between objects is completion. Driver = **equivalent units (EU)** =
  units × % complete, computed per pool (materials often 100% at start; conversion
  continuous). Weighted-average method: (beginning cost + cost added) / (completed + EU in
  ending WIP).
- **Operations (hybrid) costing:** batches with their own materials passing through different
  operations. Materials traced per batch; each operation's conversion cost per EU of the units
  that pass through it.
- **Activity-based costing (ABC):** pools by activity (setups, orders, inspections, machine
  time) with drivers that cause them. Worth it when objects vary a lot in what they use.

### Customer and order profitability (cost to serve)

- Split selling and admin and support costs by what drives them: per unit (volume), per order,
  per special (non-stocked) order, per delivery.
- Revenue − direct cost − volume costs − order costs − special-order costs = profit per order
  or customer.
- Typical finding: small, frequent and custom orders, spread by revenue in the old system, are
  heavily subsidised by large, standard orders; a few customers are big losses.
- Act on it: price the drivers (minimum order size, charges for custom orders), steer
  customers to cheaper behaviour, cut the cost of the activity, and only then consider dropping
  a customer, using relevant costs (see `relevant-cost-decisions`).

### Judging a cost system

- Does it reflect real differences in resource use? Cross-subsidy arises when one base spreads
  cost evenly over objects that use resources unevenly (equipment-heavy services costed on
  labour, for example).
- Accuracy versus cost of running it: add pools only where objects differ.
- Does it fit the strategy (for example, a strategy built on custom orders needs custom orders
  costed correctly)?

### Case lessons
A single labour-based overhead rate in an automated service business (and the pricing death
spiral it causes), staged fixes with equipment pools, idle capacity, and order-versus-volume
cost drivers for customer profitability: cfo/references/product-costing/case-lessons.md.

## Worked pattern

A print shop: monthly overhead 60,000, allocated on press hours (2,000), so 30 per hour.
Analysis shows 24,000 of it is setup and prepress, driven by jobs (400 jobs a month).

- New system: setup 24,000 / 400 = 60 per job; press 36,000 / 2,000 = 18 per hour.
- A 50-business-card job (1 press hour): old overhead 30, new 60 + 18 = 78.
- A 10-hour catalogue job: old 300, new 60 + 180 = 240.
- Small jobs were priced as if they cost much less than they do. Introduce a setup fee or
  minimum order.

## Common mistakes

- Forgetting costs in beginning work in progress.
- Including period costs in inventory cost.
- Combining pools whose equivalent units differ (materials and conversion with different
  completion).
- Allocating idle capacity to products, making them look costlier and inviting price rises that
  cut volume further.
- Allocating by revenue, which hides cost-to-serve differences.
- Keeping a labour-based overhead rate after automation: a rising rate per labour dollar is the
  warning sign.
- Changing the cost system without the managers who must use it; they will not trust the
  new numbers.
- Using a full allocated unit cost for a short-term decision.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps

- Spoilage, rework and scrap are not covered.
