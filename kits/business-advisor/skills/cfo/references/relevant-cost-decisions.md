# Relevant cost decisions

> **Area:** `relevant-cost-decisions` · owned by the CFO skill. **Use when:** Make short-term operating decisions (make or buy, accept a special order or price, drop a product or customer, use a scarce resource, keep or replace equipment, break-even volume) by comparing only the future costs and revenues that differ between the options. Use whenever a decision is being argued from full unit costs or allocated overhead.

**Outcome:** a business picks the option that actually leaves it with more cash and profit,
instead of the one that looks better on allocated unit costs.

## When to use

- Outsource a part or service, or keep it in-house?
- A customer offers an order below the usual price.
- A product, branch or customer "loses money" after overhead allocation.
- Capacity is tight: which jobs first?
- What sales volume covers our costs?

Much of this skill is standard practice: the definitions and the danger of allocated costs
come first, and the decision rules below are standard textbook method.

## Method

### 1. The rule

A cost or revenue is **relevant** only if it is (a) in the future and (b) different between the
options. Add **opportunity cost**: the contribution given up by not putting a scarce resource
to its next-best use.

- Sunk costs (already spent, such as book value of existing equipment or inventory) are never
  relevant. Future purchases of new equipment are.
- Not all variable costs are relevant; not all fixed costs are irrelevant. Ask of each line:
  will this change if we choose A instead of B?
- Allocated overhead that stays whatever you decide is irrelevant.
- Do not use unit costs directly: they hide fixed costs and change with volume. Work in totals.

### 2. Procedure

1. State the options (including "do nothing").
2. For each, list future revenues and costs that differ; ignore the rest.
3. Add opportunity costs of capacity or cash.
4. Compare totals; the difference is the decision's value.
5. Weigh qualitative factors (quality, reliability, know-how, confidentiality, staff morale,
   customer relationships) and how managers are measured: people choose what makes their
   measured results look good, so check the performance measure points the same way.
   For make or buy, turn the qualitative factors into a number where you can (section 6).

### 3. Standard decisions (standard practice)

- **Make or buy:** buy if purchase price < costs avoided by not making (variable cost plus any
  fixed cost that truly goes away) + contribution from the best use of freed capacity.
- **Special order, spare capacity:** accept if price > variable cost of the order (plus any
  order-specific fixed cost), and it does not undercut regular prices.
- **Special order, full capacity:** accept only if price > variable cost + contribution lost
  on displaced work.
- **Drop a product, branch or customer:** drop only if its contribution margin is less than
  the fixed costs avoided by dropping it. Unavoidable allocated costs stay and must be carried
  by the rest. Fix the cost-to-serve first (see `product-costing`).
- **Scarce resource:** rank products by contribution per unit of the constraint (per machine
  hour, per kg of material), not per unit of product. With several constraints, use linear
  programming.
- **Equipment replacement:** compare future operating savings and the new machine's cost with
  the old machine's disposal value; the old machine's book value is sunk.
- **Scrap or rework stock:** compare future revenue minus future cost of each option; past cost
  of the stock is irrelevant.
- **Inventory purchase quantity:** a bulk discount must beat the cost of the cash tied up and
  holding costs.

### 4. Cost-volume-profit

- Contribution margin (CM) per unit = price − variable cost per unit; CM ratio = CM / price.
- Break-even units = fixed costs / CM per unit; break-even revenue = fixed costs / CM ratio.
- Units for a target profit = (fixed costs + target profit) / CM per unit (use pre-tax target).
- Margin of safety = expected sales − break-even sales.
- Separate costs into fixed and variable using contracts or past months (high-low or regression
  on activity).

### 5. Absorption traps

Absorption unit costs include fixed overhead spread over production; they fall when you
produce more and rise when you produce less. Never price a special order or a make-or-buy on
them (see `variance-analysis`, section 5).

### 5b. Pricing from distorted full costs (from teaching cases)
- Prices set as full cost plus a mark-up inherit every error in the cost system: services
  over-charged with overhead lose volume, the overhead rate rises on what remains, and prices
  climb again. Before repricing or dropping a line, check the cost system (see
  `product-costing`).
- The cost of unused capacity in a new machine is a sunk consequence of the decision to buy it;
  it is not a reason to raise prices to the few users.
- Special quotes shaved from a "standard margin" are only as good as the standard cost behind
  them; lax standards make the shave a guess.
- A line kept unprofitable on purpose to offer a full range is a choice worth pricing: compute
  how much contribution elsewhere it must protect.

### 6. Make or buy: break-even premium erosion

Outsourcing a finished or visible product can change its origin, brand meaning or quality
control, and customers may then pay less or buy less. The textbook lists quality, lead times,
currency and public reaction as factors to weigh; this step prices them by finding the
erosion at which buying stops paying. It uses the textbook's indifference method (solve for
the value at which the options tie), applied to price and volume (standard practice).

Terms: P = price, Q = annual volume, v = variable cost to make, b = purchase price per unit,
F = fixed costs avoided by buying, O = contribution from the freed capacity.

- Saving from buying before any erosion: S = Q × (v − b) + F + O.
- Break-even price erosion (price falls on all units, volume holds): e_p = S ÷ (P × Q).
- Break-even volume erosion (price holds, units lost): e_v = S ÷ [Q × (P − b)].
- Both at once: buying pays only if Q(1 − e_v)[P(1 − e_p) − b] + O > Q(P − v) − F.
- Read e_p and e_v as the safety margin: if credible erosion is close to them, the saving is
  not worth the risk.

Estimating erosion, segment by segment (standard practice):
- Test before deciding: show the same product with the old and new origin or brand label to
  samples of buyers; run willingness-to-pay or choice surveys; pilot the bought-in product in
  one channel or region; interview distributors on what they would pay and stock.
- Professional buyers: judge on performance, specification and warranty; may need to requalify
  the product, and may ask for a discount or switch if quality control moves away.
- Consumers: origin and brand sensitivity varies by category; often small for commodities,
  large where origin signals quality or craft.
- Government and regulated buyers: domestic-content or origin rules can exclude the product
  outright: model as total volume loss in that segment, not a discount.
- Weight each segment's erosion by its share of revenue; compare the total with S.

Country-of-origin labelling (standard practice): origin generally follows
where the product was last substantially transformed. Moving production can remove a "made in"
claim (some markets allow it only if all or virtually all of the product is made there),
force packaging and marketing changes, alter tariffs and trade-agreement eligibility, and
exclude the product from public tenders. Check the rules in each market sold to.

Switching back and reversibility: once equipment is sold and skilled staff leave, returning to
making costs re-hiring, re-equipping, requalifying the product and rebuilding know-how. A
dependent buyer also loses bargaining power: the textbook warns that outsourcing raises
dependence, so the buyer needs assurance on quality, delivery and continued cost reduction,
often through a close partnership. Count expected switching-back cost (probability the supplier
fails × cost to return) against S, and prefer reversible steps: outsource part of the volume,
keep tooling, or keep one line in-house until erosion is measured.

## Worked pattern

A furniture maker makes a hinge: materials 3, labour 2, variable overhead 1, allocated fixed
overhead 4, full cost 10 per unit, 20,000 a year. A supplier offers 8. If it buys, it saves
the variable 6 and a supervisor's salary of 15,000; the freed space would let it make tables
earning 25,000 contribution a year.

- Make: 20,000 × 6 + 15,000 = 135,000, plus 25,000 forgone = 160,000.
- Buy: 20,000 × 8 = 160,000.
- Indifferent on cost; the full-cost comparison (10 vs 8) overstated buying by 40,000. Decide
  on supplier quality and reliability.

Premium erosion: a toolmaker sells 100,000 units at 50 (variable cost 30). A foreign supplier
offers them at 26; buying avoids fixed costs of 150,000 and frees space worth 50,000.
- S = 100,000 × 4 + 150,000 + 50,000 = 600,000.
- e_p = 600,000 ÷ 5,000,000 = 12%; e_v = 600,000 ÷ (100,000 × 24) = 25%.
- Customer tests: professionals (40% of units) want 15% off for the new origin, a loss of
  300,000; consumers (50%) about 3%, 75,000; government buyers (10%) are lost under
  domestic-content rules, 10,000 × 24 = 240,000. Total 615,000 > 600,000: buying does not
  pay, though each segment alone looked small. Outsource the consumer line only, or not at all.

## Common mistakes

- Comparing a supplier's price with the full allocated unit cost.
- Counting the book value of old equipment or the past cost of stock.
- Dropping a "loss-making" line whose contribution exceeds its avoidable fixed costs.
- Ranking products by margin per unit when a constraint binds.
- Ignoring the effect of a cheap special order on regular customers' prices.
- Ignoring how the decision-maker's own performance measure skews the choice.
- Leaving price or volume loss from a new origin or brand as a "qualitative factor" instead
  of computing the erosion at which buying stops paying.
- Averaging erosion across segments when one segment (often public buyers) is lost entirely.
- Treating outsourcing as reversible at no cost.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps

- Pricing strategy (target pricing, cost-plus, life-cycle costing) is not covered.
