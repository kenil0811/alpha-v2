# Market sizing and unit economics

> **Area:** `market-sizing-and-unit-economics` · owned by the CMO skill. **Use when:** Size a market (top-down and bottom-up, TAM/SAM/SOM, by scenario of need), segment it and choose which segment to target first (motivational fit, emotional readiness, resistance), check that each sale makes money (margins, break-even, customer acquisition cost and lifetime value), track customer growth (churn, retention, lifetime value, customer equity), and build a believable 3 to 5 year revenue forecast. Use when someone asks "how big is this market?", "who should we target first?", "does the math work?", "how many customers do we need to break even?" or needs projections for a plan or pitch.

**Outcome:** a defensible estimate of how many customers and dollars are reachable, proof that each customer is profitable, and a revenue forecast whose key drivers are explicit and testable.

## When to use

- Answering "who cares, and how many of them?" for a new product or venture.
- Pricing a product or channel; checking margins along a distribution chain.
- Deciding whether a fixed investment (an ad campaign, an endorsement, a hire) pays back.
- Building the financial slide of a pitch or the projections in an executive summary.
- An investor asks "show your work" on the market slide.
- Choosing a launch segment, or a segment keeps "liking" the product without buying.
- Setting up the customer metrics (churn, retention, lifetime value) a growing business reports.

## Method

### 1. Size the market two ways

**Bottom-up (preferred; investors trust it):**
Market = number of customers who have the pain × revenue per customer per year.
Build it as a funnel of filters, each with a source:
1. Population with the problem.
2. Share who seek a solution (or are reachable).
3. Share who can buy through your channel or at your price.
4. Revenue per customer per year (price × purchase frequency).

**Top-down (sanity check):** start from an industry total (industry reports, trade associations, government data) and narrow by segment, geography and price tier.

If the two differ by more than about 2 to 3 times, find out why before using either (standard practice).

**B2B funnel (professional or industrial buyers, long trial cycles):** use this instead of a top-down share when buyers are firms that test before they buy, decisions are slow and each account is worth a lot (standard practice):
1. Target accounts: a named, countable list of firms or sites that fit (size, application, region).
2. Trials per year: accounts that take a sample, trial or pilot. Capped by sales capacity: reps × trials each can run at once.
3. Adoption or spec-in rate: share of trials that adopt or write the product into their specification, after a lag equal to the trial cycle.
4. Reorder rate: share of adopting accounts still ordering each following year.
5. Account value: annual volume per adopting account × price, with a ramp from first order to full volume.

Revenue in a year = sum over each year's adopters still ordering × account value at their stage of ramp. The trial cycle sets the timing: a 12-month cycle means little revenue in year 1 whatever the market size. Direct selling only scales when an account's lifetime value exceeds what the salespeople cost to win it. Keep a top-down share as the cross-check.

**Layers:**
- TAM (total addressable): everyone who could use this category of solution.
- SAM (serviceable): those you can reach with your product, channel and geography.
- SOM (obtainable): what you can realistically win in 3 to 5 years given competitors and sales capacity. SOM must be backed by a go-to-market plan, not a percentage plucked from the air.

**Who-cares test:** state the market in customers and in dollars. A market that is big in dollars but made of a few customers who will not switch is small.

### 1b. Segment by need, then choose where to start
Size the market as **problem prevalence**, not a headcount of an industry or demographic.
1. **Scenarios of need:** list the circumstances that trigger the need (life events, lifestyle, setting changes, economics). Each has a job to be done and a desired outcome. Layer demographics, psychographics and behaviour onto each scenario; size each as people in the scenario × frequency × value.
2. **Who does, might, never:** sort groups by interest and resistance; name the segments you will not target.
3. **Resistance:** status quo bias, loss aversion, endowment effect, confirmation bias, complexity against current habits. A product of high perceived value that needs little behaviour change is the easiest launch; big change with little value fails.
4. **Score each segment** 1 to 5 on motivational fit (strong unmet motivation you meet), emotional readiness (open to change and ready to act now), your ability to deliver and reach it, and externalities (timing, culture, technology). Launch where all are high, then sequence the rest (`market-entry-and-go-to-market`, section on go-to-market sequencing).
5. **B2B:** add industry, firmographics, function, buying process, culture, circumstances (new leader, regulation, crisis) and offering maturity; segment by jobs to be done and map who champions, gates or blocks the purchase inside each account.
The biggest segment is rarely the first: the best target is where fit and readiness meet the product's current state. Profile template, B2B grid and resistance detail: `cmo/references/market-sizing-and-unit-economics/segmentation-and-targeting.md`.

### 2. Margins

- Unit margin (contribution) = price per unit − variable cost per unit.
- Margin % = unit margin ÷ **price** (never ÷ cost).
- Price needed for a target margin: price = cost ÷ (1 − margin %).
- Channel chain: each layer (maker, wholesaler, retailer) earns its margin on its own selling price. Work backwards from the consumer price to see what the maker actually receives. A $10 retail product may net the maker $7.50 or less.
- Fixed costs do not change with volume (rent, salaries, advertising); variable costs do (materials, shipping, payment fees, commissions).

### 3. Break-even

- Break-even volume = fixed costs ÷ unit margin.
- A new fixed spend pays off if it adds at least (added fixed cost ÷ unit margin) units.
- A per-unit fee (royalty, commission) lowers the unit margin and raises break-even volume; compare it with a one-time payment.
- Then ask whether break-even volume is a big or small share of the reachable market. Break-even at 40% share of the SAM is not a plan.
- **Customer acquisition spend is a named line, never left implicit.** Treat advertising as a fixed cost the margin must recover. Break-even volume = (fixed costs + acquisition spend) ÷ unit margin. Per customer: break-even customers = fixed costs ÷ (lifetime contribution per customer − CAC). In an NPV, each cohort's acquisition spend is a cash outflow in the year it is spent, before that cohort's margins arrive. A plan whose break-even ignores the cost of winning customers overstates profit by exactly that cost.

### 4. Customer economics (for subscription and repeat businesses)

The formulas below are standard practice; the same building blocks (churn, retention, CLV = m × r ÷ (1 + i − r), customer equity = CLV × customers) are set out with worked numbers in `cmo/references/market-sizing-and-unit-economics/growth-metrics.md`:
- CAC (customer acquisition cost) = sales and marketing spend in a period ÷ new customers won in that period. Include salaries, not just ad spend.
- Contribution per customer per month = monthly revenue × gross margin %.
- Expected lifetime (months) ≈ 1 ÷ monthly churn rate.
- LTV (lifetime value) = contribution per month × expected lifetime.
- LTV ÷ CAC: aim for 3 or more. Below 1 means every sale destroys money.
- CAC payback (months) = CAC ÷ contribution per month. Under 12 months is strong for small-business customers; over 24 is risky.
- Retention matters as much as acquisition: halving churn doubles LTV.
- Discounted version: LTV = contribution per month ÷ (monthly churn + monthly discount rate).
- **Growth arithmetic:** churn = customers lost ÷ customers at start; retention = 1 − churn; net growth = new customers added ÷ customers at start − churn. Report churn by segment and acquisition channel, never only on average.
- **Price against acquisition:** a higher price that wins more revenue can still lose if it raises CAC or cuts lifetime value; compare price options on profit, CAC and CLV together (`pricing-strategy`).

**Durable and repeat-purchase goods** (no contract; each purchase is a fresh decision; standard practice):
- m = gross margin per purchase = price received (after channel margins and returns) × gross margin %.
- r = probability a customer buys again within one purchase interval.
- T = purchase interval in years (replacement cycle for durables, reorder cycle for consumables).
- d = annual discount rate (the business's cost of capital).
- LTV = m × [1 + q + q² + ...] = m ÷ (1 − q), where q = r ÷ (1 + d)^T, counting the first purchase. Cap the number of repeats if the product or customer has a natural end.
- For durables with long replacement cycles (5+ years), q is small: LTV is close to the first sale's margin plus attached sales (consumables, parts, service). Count a replacement only with evidence of brand loyalty.
- Repeat probability rises when buying becomes habitual and reordering has little friction (see `consumer-behavior-marketing` on habits and friction); design for it, then measure it.

**Which formula:** subscription (churn) formula when the customer pays on a recurring contract and leaving is an event (cancellation). Repeat-purchase formula when there is no contract and every purchase must be won again. Mixed models (a durable plus a consumable refill): repeat formula for each, added.

**Credit-financed durables** (instalment, pay-as-you-go or lease-to-own; standard practice): the customer's value is a stream of contract payments, not one sale. Build it per contract, discounted at the business's monthly cost of capital:
- Cash in: deposit + scheduled payments × the share expected to be paid (from vintage data: payments lost = PD × payments unpaid at default) + expected recovery (PD × share of defaults repossessed × net resale value).
- Attribute revenue such as carbon credits: only the business's net share after verification and registry costs, timed when credits are issued and sold (often 12 to 30 months after the sale), never at signing.
- Cash out: unit cost, acquisition cost, servicing cost per month for the contract's life.
- Payback in months two ways. **Own cash:** (unit cost + CAC − deposit) ÷ net monthly collections. **Funded:** the same after a lender's advance, minus debt service; it looks short, but the business still holds the first loss on the book, so its capital need is the first-loss share of the receivables, not the cash payback. Losses and funding: `cfo/references/credit-analysis.md` and `cfo/references/capital-structure-decisions.md`.

**Gross versus net customers** (standard practice): before multiplying LTV by customer numbers, subtract customers who would have bought anyway through the business's existing channels or products (a cash sale, an older model, a dealer). Incremental value = new customers × LTV − displaced customers × the margin they would have given. Use net numbers for impact claims too (for example avoided emissions).

### 5. Revenue forecast (3 to 5 years)

1. Pick the one to three drivers the forecast is most sensitive to (for example stores × units per store per week × price; or new customers per month × churn × price).
2. Build revenue from those drivers, by year (quarterly if seasonal).
3. Tie each growth step to a cause: new channel, new region, more sales per customer, higher share.
4. Expect a "hockey stick" only if you can name what triggers the bend.
5. Add cost lines: cost of goods, customer acquisition as its own line (CAC × new customers, or trial and sales costs per target account in B2B), other marketing, salaries, then EBITDA.
6. Run sensitivity: change each key driver up and down 25% to 50% and show the effect.
7. State the two or three assumptions that would most change the answer, and how you will test them.

## Worked pattern

Scheduling software for HVAC contractors at $300 a month, 80% gross margin.

Market (bottom-up):
- About 120,000 US HVAC contracting firms × $3,600 a year = $432M TAM.
- Three launch states, firms with 3 to 15 technicians: 9,000 firms × $3,600 = $32M SAM.
- Year-3 goal of 5% of SAM = 450 customers = $1.6M a year SOM, supported by a plan of 2 sales reps closing 8 firms a month each.

Unit economics:
- Contribution = $300 × 80% = $240 a month.
- Monthly churn 2% → lifetime 50 months → LTV = $12,000.
- CAC $2,400 → LTV ÷ CAC = 5; payback = 10 months. Healthy.

Break-even:
- Fixed costs $600,000 a year; contribution per customer per year = $2,880.
- Break-even = 600,000 ÷ 2,880 ≈ 209 customers, about 2.3% of SAM. Plausible.

Sensitivity: if churn is 4% instead of 2%, LTV halves to $6,000 and LTV ÷ CAC falls to 2.5, so retention is the assumption to test first.

Repeat-purchase variant: a cookware line sells at $100 net to the maker, 40% gross margin, so m = $40. Repeat probability 30% every 2 years, discount rate 10%: q = 0.30 ÷ 1.21 = 0.248; LTV = 40 ÷ 0.752 ≈ $53. With CAC of $60, LTV ÷ CAC ≈ 0.9: each customer won loses money unless repeat rates or margin rise, though a break-even that left CAC out would have looked fine.

B2B variant: 400 target labs; 2 reps run 30 trials a year each, so 60 trials; 40% adopt after a 9-month trial, so 24 accounts, mostly ordering from year 2; 80% reorder each year; $15,000 a year per account. Year-2 revenue ≈ 24 × $15,000 = $360,000, year 3 ≈ (24 × 0.8 + 24) × $15,000 ≈ $650,000. The binding drivers are trial capacity and adoption rate, not market share.

Credit-financed variant: a solar irrigation pump sold for a deposit of $100 plus 24 monthly payments of $45 ($1,080 scheduled). Unit cost $600, CAC $80, servicing $2 a month. Lifetime default probability 15%, with about $585 of payments unpaid at default; 60% of defaults repossessed for $200 net. Carbon: 4 credits over the pump's life at $8 net, first cash after about 18 months.
- Expected payments = 1,080 − 0.15 × 585 ≈ $992; recovery = 0.15 × 0.6 × 200 = $18.
- Undiscounted: 100 + 992 + 18 + 32 − 600 − 80 − 45 servicing ≈ $417 per contract.
- Discounted at 1.5% a month: payments ≈ $828, recovery ≈ $16, carbon ≈ $22, servicing ≈ $40, so LTV ≈ 100 + 828 + 16 + 22 − 600 − 80 − 40 ≈ $246. Carbon is under 10% of it: the plan must work without it.
- Own-cash payback: (600 + 80 − 100) ÷ about $40 a month net ≈ 15 months, so each 1,000 pumps a month of growth ties up about $580,000 a month until funding arrives.
- Funded at a 60% advance ($540 at 14% a year, about $26 a month of debt service): own cash $40, residual about $14 a month, payback about 3 months; but the business keeps the first loss on the book.
- Gross versus net: of 1,000 pumps sold, 300 buyers would have bought a cash pump from the business's own dealers at $250 margin. Incremental value = 1,000 × 246 − 300 × 250 ≈ $171,000, not $246,000.

## Common mistakes

- "If we get just 1% of a huge market..." with no mechanism to win that 1%.
- Quoting a report's TAM and calling it your market; not showing the math.
- An SOM that no team could reach in the time stated.
- Sizing by industry or demographic instead of by the scenarios that trigger the need.
- Launching into the biggest segment rather than the one with the strongest motivational fit and readiness; never naming who you will not target.
- Reporting one average churn or CLV across segments and channels.
- Margin computed on cost instead of price.
- Ignoring channel margins, payment fees, returns and free shipping.
- Leaving salaries out of CAC; using a blended CAC that hides expensive paid channels.
- Revenue forecasts with no named drivers or no reason for the growth jump.
- No sensitivity analysis; a single-point forecast presented as fact.
- Annualising one good month (run-rate) as if it were a year.
- Using the churn formula for a product bought once every few years; it invents recurring revenue.
- Break-even or NPV with no customer-acquisition line.
- Giving a B2B product with a year-long trial cycle year-1 revenue from a top-down share.
- Counting a credit sale's full contract value as LTV, with no expected losses, servicing cost or discounting; booking carbon revenue at signing.
- Quoting funded payback as if no capital were at risk; counting gross customers when some were taken from the business's own channels.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps

- None noted beyond the scope above.
