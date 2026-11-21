# Pricing strategy

> **Area:** `pricing-strategy` · owned by the CMO skill. **Use when:** Set and structure prices from customer demand - estimate elasticity, find the profit-maximising price, and capture more value with segment prices, versions, two-part tariffs, bundles and capacity (yield) controls; price a new product for launch (channel waterfall, goals, acquisition cost and lifetime value) and judge promotions. Use when a business asks "what should we charge?", "should we raise or cut prices?", "should we offer a discount, a membership or a bundle?", or "how many seats/slots should we hold back for full price?"

**Outcome:** a price (or price structure) grounded in how customers respond, a forecast of the effect on
revenue and profit, and a check that the structure can be enforced and won't backfire.

**When to use**
- Launching a product, changing a list price, answering a rival's price move (for the rival's reaction, also use `competitive-moves`).
- Revenue is flat and someone proposes a discount, a membership, tiers, or a bundle.
- Customers differ a lot in what they would pay.
- Capacity is fixed and perishable (seats, rooms, appointment slots, rental days).

## Method

### 1. Learn demand
Demand is the link between price and quantity: at each price, how much customers will buy. It also moves
with rivals' prices (substitutes, +), complements' prices (-), income (+ for normal goods, - for inferior),
advertising, season and number of customers. B2B buyers respond to their own customers' demand, not income.

Three ways to estimate it, each with a trap:
| Method | Trap |
|---|---|
| Surveys and conjoint (trade-offs among feature bundles at prices) | People say one thing and do another; they may shade answers to get lower prices |
| Historical sales data | Must hold other drivers constant; the future may not match the past, especially after your own change |
| Test markets / A-B price tests | Customers stockpile during a visible test; rivals ignore a small test but respond to a rollout |

Market demand is the sum of individual demands at each price (add quantities horizontally; segments drop out above their maximum price).

### 2. Measure elasticity
Own-price elasticity = % change in quantity / % change in price (negative).
- Between 0 and -1: **inelastic** (raise price, revenue rises).
- Below -1: **elastic** (cut price, revenue rises).
- At -1: revenue is at its maximum.
Elasticity is higher when there are close substitutes, the item is a big share of spending, the buyer has
time to adjust, and it is not a necessity.
Related measures: **cross-price elasticity** (> 0 means substitutes, and helps define who your rivals are);
**income elasticity** (which products grow as customers get richer).
For a linear demand curve, elasticity changes along the curve; quote it at the current price.

### 3. Find the best single price
- Marginal revenue (MR) = P + (dP/dQ) x Q. To sell one more unit you must cut price on all units.
  Shortcut for linear inverse demand P = a - bQ: MR = a - 2bQ.
- Revenue is maximised where MR = 0 (elasticity = -1). That is not the goal unless costs are truly zero.
- **Profit** is maximised where MR = marginal cost (MC). Then:
  (P - MC) / P = -1 / elasticity (the inverse-elasticity markup rule).
  Inelastic customers support big margins; elastic customers get thin margins and you make it up on volume.
- Comparative statics: demand up -> higher output, price and profit. Variable cost up -> lower output, higher price, lower profit. Fixed cost up -> same price and output, lower profit (do not pass fixed costs into price).
- Cost-plus pricing (markup on cost) ignores demand; use it only as a cross-check.

### 4. Charge different customers different prices (price discrimination)
Three conditions must all hold: (1) you have pricing power; (2) at least two groups with different
elasticities; (3) you can prevent resale between groups. Price differences must come from demand, not
from different costs to serve (if costs differ, it is cost-based pricing).

| Type | What you know | How it works | Examples |
|---|---|---|---|
| **1st degree** | Each customer's maximum | Each pays close to their maximum | Negotiated B2B deals, aid packages, data-driven personalised offers |
| **2nd degree** | Nothing before purchase; customers reveal themselves by choice | A menu of quantities or qualities; customers self-select | Volume tiers, good/better/best, seat classes, day-of discounts |
| **3rd degree** | An observable trait before purchase | Separate price per group: set MR = MC in each group | Student, senior, regional, time-of-day prices |

Rules of thumb: in 3rd degree, the less elastic group pays more. In 2nd degree, design versions so the
high-value customer still prefers the premium version (the cheap version must be worse in a way they care about).

### 5. Two-part tariffs (fee + per-use price)
- One customer type: per-use price = marginal cost; entry fee = the customer's consumer surplus at that price.
- Several types: a high fee excludes low-value customers. Compare (high fee x number of high types) with
  (low fee x all customers) and pick the larger; the fee should equal the surplus of the marginal buyer you want to keep.
- Revenue rises with the fee at first, then falls as more customers drop out.

### 6. Bundling
- Pure bundling raises revenue when customers' valuations are **negatively correlated** (each group loves a different item). It does nothing when correlation is positive.
- Method: compute each customer type's total value for the bundle; test each candidate bundle price (customers willing x price); pick the highest.
- **Mixed bundling** (bundle plus items sold separately) avoids forcing a sale below cost on a customer who values one item below its cost.
- Other legitimate reasons: production or distribution efficiency, quality assurance. Tying purely to extract profit can raise antitrust issues.
- Coupons given with one purchase for use on another work like a bundle and can't be resold.

### 7. Perishable capacity (yield management)
With fixed capacity, a high fare and a low fare, and uncertain high-fare demand, protect seats for the
high fare while (probability high-fare demand reaches that seat) x high fare > low fare. Equivalently,
build a table: rows = seats protected, columns = possible high-fare demand, cells = revenue; average each
row with its probabilities and pick the best row. (The probability rule is the standard Littlewood rule; the
table gives the same answer.) Price matching a rival's low fare is a separate decision: ask which customers would
switch, how many full-fare customers would trade down, and what restrictions keep segments apart.

### 8. Watch the behavioural traps
- **Anchoring:** the first price customers see sticks. Launching high and cutting later can fail; launching low makes raises painful.
- **Mental accounting:** customers budget in buckets and may not let a favourite item subsidise another in a bundle.
- **Decoy effect:** adding a clearly worse third option shifts choices between the other two.
- **Endowment effect:** people value what they already have more than the same thing not yet theirs; free trials and "keep it" offers exploit this, and taking a feature away hurts more than adding it pleased.
- **Hyperbolic discounting:** people overweight now versus later, so urgency (limited-time offers, pay-later plans) moves buyers; it also means they underweight future running costs.

### 9. Price a new product for launch
Many new products miss revenue and profit goals, and most that miss leave money on the table by pricing too low:
- **Agree the goal first.** Executives tend to weigh profit and revenue; sales and account managers weigh volume and share. Write down which one this launch serves, then test each price against it: how does the price change volume, and how does that change profit?
- **Build the unit waterfall per channel.** Shelf price minus retailer margin, market-development funds, expected returns, platform or royalty fees, and unit cost at the realistic production volume. A price that works at full volume can lose money per unit at launch volumes; a lower shelf price can turn the unit negative once percentage fees are taken.
- **Lay out a price-volume-profit table** (price, units, revenue, variable cost, fixed cost, profit) across 5 to 7 price points; revenue and profit usually peak at different prices.
- **Bring in acquisition and lifetime value.** Compare options on profit, margin, CAC and CLV together: a lower price can win more customers and revenue yet lose if those customers are cheaper to win but worth less, or the reverse (`market-sizing-and-unit-economics`).
- **Research inputs:** purchase-likelihood curves at several prices by segment; constant-sum surveys (spread 100 points across features such as price, speed, service) clustered into segments that care most about price, about delivery, or about everything.
- **Pricing models as adoption levers:** pay-for-what-you-use turns a large up-front cost into a variable one, lowers the barrier to trial, ties spending to the value received and lets customers scale up; it suits a product whose value grows with use.
- **Promotions:** judge a temporary price cut, feature or display with a promotion-response model (`new-product-forecasting`, Scan*Pro), on profit after fees and the post-promotion dip.

## Worked pattern
A training company sells online courses. Demand: Q = 1,000 - 20P per month; marginal cost (platform fee, support) $10 per seat.
- Inverse demand P = 50 - 0.05Q; MR = 50 - 0.1Q. MR = MC: Q = 400, P = $30. Profit contribution (30 - 10) x 400 = $8,000.
- Check: elasticity at P = 30 is -20 x 30/400 = -1.5; markup rule gives (30 - 10)/30 = 0.67 = 1/1.5. Consistent.
- Two segments are observable (corporate vs individual). Corporate: P = 40 - 0.1Q -> MR = 40 - 0.2Q = 10 -> Q = 150, P = $25. Individual: P = 24 - 0.05Q -> MR = 24 - 0.1Q = 10 -> Q = 140, P = $17. Contribution (15 x 150) + (7 x 140) = $3,230 for these two segments; compare with the single price on the same two demand curves before switching.
- Bundle test: course plus coaching. Customer A values them $100/$40, B $70/$80. Best separate prices: $70 and $40 -> $220. Bundle at $140 -> both buy -> $280. Negative correlation makes bundling pay.
- Membership: per-learner demand for live workshops q = 20 - 2p, cost $2 each. Price workshops at $2 (16 attended); fee = surplus = 0.5 x 16 x (10 - 2) = $64/month.
- Launch waterfall: a $149 course kit sold through a retailer loses 35% retailer margin, 6% marketing funds, 8% returns and 3% fees (52% in all), leaving $71.52; unit cost $45 at 5,000 units gives about $27 a unit. At $119 the same percentages leave $57.12, about $12 a unit. At a launch run of 2,000 units the unit cost is $70: the $149 kit makes about $1.50 and the $119 kit loses about $13 a unit, so the cheaper price only works at scale.
- Capacity: a cohort of 60 seats; full price $300, early-bird $120; full-price demand equally likely 20-40. Protect the k-th seat while P(demand >= k) > 120/300 = 0.4. P(D >= 32) = 9/21 = 0.43, P(D >= 33) = 0.38, so hold 32 seats for full price.

## Common mistakes
- Setting a launch price before agreeing whether the goal is profit, revenue or share; ignoring channel fees and returns in the unit math.
- Maximising revenue (MR = 0) instead of profit (MR = MC).
- Passing fixed-cost increases into price.
- Price discrimination with no resale barrier, or calling cost-driven price differences discrimination.
- Bundling items most customers value alike.
- Trusting a survey's stated willingness to pay, or a small test's "no rival response".
- Confusing a shift in demand (income, tastes) with a movement along it (price), or WTP with affordability.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- None noted beyond the scope above.
