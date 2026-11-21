# Supply contracts and coordination

> **Area:** `supply-contracts-and-coordination` · owned by the COO skill. **Use when:** Design buyer-supplier contracts (options, buy-back, revenue sharing, capacity reservation) that move demand and supply risk to whoever can carry it most cheaply, so both firms earn more, and reduce bullwhip swings through information sharing. Use when negotiating with suppliers or customers over order sizes, returns, reserved capacity or price, or when orders swing far more than end demand.

**Outcome:** a contract structure and terms that make the buyer order closer to what is best for the whole chain, a fair split of the extra profit, and less order volatility between firms.

## When to use
- A retailer or distributor under-orders a seasonal or perishable item because it carries all the leftover risk.
- A buyer faces uncertain needs and volatile spot prices for an input (commodities, freight, capacity).
- Negotiating returns, reserved capacity or a long-term supply agreement.
- Orders to a supplier swing much more than consumer demand (bullwhip).

## Method

### 1. Diagnose the wholesale-price problem (double marginalization)
- Under a plain wholesale price, the buyer bears all leftover risk and sets its order with its own critical ratio: (price - wholesale) / (price - salvage).
- The chain's best order uses the chain's ratio: (price - production cost) / (price - salvage). It is higher because each firm adds its margin.
- So the buyer orders too little, sells out too often, and the chain loses profit. Compute both orders and the expected profit gap (simulate or use Normal formulas) to know what's on the table.

### 2. Buy-back (returns)
- Supplier pays b for each unsold unit (and clears it).
- Buyer's Co becomes wholesale - b; set b so the buyer's ratio equals the chain's: **b = w - Cu x (1 - CR_chain) / CR_chain**, Cu = price - w (assuming the supplier's salvage equals the buyer's).
- **The buy-back price sets the order; the wholesale price sets the split.** Grow the pie first, then negotiate slices.
- Works when returns are cheap to verify and move; poor for perishables or hard-to-check goods.

### 3. Revenue sharing
- Supplier charges a low wholesale price (even below its cost) and takes a share of every sale (and of clearance revenue).
- With the buyer keeping share φ of revenue and paying φ x production cost per unit, the buyer's ratio matches the chain's for any φ; φ sets the split.
- Needs the supplier to see the buyer's sales. Weak when the buyer's sales effort matters, since it keeps only part of each extra sale.

### 4. Options (capacity reservation)
- Buyer pays a reservation fee per unit now for the right, not the obligation, to buy up to m units later at an exercise price.
- Combine: a firm base order (forward contract) for the sure volume, options for the uncertain part, spot as last resort.
- Reserve options while the next one's expected saving beats its fee. Use simulation when demand and spot price are both uncertain or move together.
- Options are worth more with more demand uncertainty, wider spot price swings, and when spot prices rise with your own demand (tight markets); worth less as the fee rises.
- Seller side: it keeps the fee and holds the reserve risk; fits a seller who can resell unused capacity easily. Common in aircraft, freight capacity, commodities and chip capacity agreements.

### 5. Pick the contract the chain can run

| | Options | Buy-back | Revenue sharing |
|---|---|---|---|
| Leftover risk carried by | supplier holds reserve, buyer pays fee | supplier takes back units | supplier shares sales and leftovers |
| Needs | supplier can hold and resell reserve cheaply | returns you can check and move | supplier sees buyer revenue |
| Works poorly when | reserve has no other buyer | goods perishable or hard to verify | buyer effort drives sales |

All cost more to administer than a wholesale price; if the chain gains little, keep it simple.

### 6. Contracts against disruptions
- Capacity reservation or dedicated-capacity agreements secure supply in shortages.
- Force majeure terms decide who carries a disaster's loss; read them before you need them.
- Insurance transfers tail losses the firm can't carry.
- Price each with a decision tree (see risk-decisions-under-uncertainty).

### 7. Bullwhip: orders swing more than demand
- Causes (standard practice): each stage forecasting from the orders it receives, order batching, price promotions and forward buying, and shortage gaming (inflating orders when rationed), worsened by long lead times.
- Remedies: share point-of-sale demand data with suppliers; vendor-managed inventory or continuous replenishment; smaller, more frequent orders (lower fixed order costs); everyday low pricing instead of deals; allocate shortages on past sales, not on orders; shorten lead times.
- Build trust and align incentives: partners share information only when they expect to gain.

## Worked pattern
A boutique buys a seasonal jacket at $18 to sell at $30; the maker's cost is $8; leftovers clear at $5; demand N(1,000, 300).
- Boutique's ratio = 12/(12 + 13) = 0.48, order ≈ 985. Chain's ratio = 22/25 = 0.88, best order ≈ 1,352.
- A buy-back at about $16.40 per unsold jacket makes the boutique's Co = $1.60 and its ratio 0.88, so it orders the chain's 1,352. The maker then adjusts the $18 wholesale price to share the gain so both are better off than before.

## Common mistakes
- Negotiating only the wholesale price, which can't fix the order quantity.
- Setting buy-back or revenue-share terms that move the order but leave one side worse off; check both firms' expected profits.
- Buying options on volume you are sure to need (buy it forward) or on volume you will never need.
- Using a formula when demand and price move together; simulate instead.
- Fighting bullwhip with bigger buffers instead of sharing demand data.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- Bullwhip is covered at summary level only; no quantitative model of order amplification.
