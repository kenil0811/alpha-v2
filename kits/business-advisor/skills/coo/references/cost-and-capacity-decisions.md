# Cost and capacity decisions

> **Area:** `cost-and-capacity-decisions` · owned by the COO skill. **Use when:** Decide how much to produce, whether to keep operating, how to mix labour and equipment, and whether to add capacity, using marginal and average costs, opportunity and sunk costs, and how competitive markets settle. Use when a business asks "should we take this order / stay open / close a line?", "hire people or buy a machine?", "what does a price drop or a new tax do to us?", or "should we expand?"

**Outcome:** the right output level and input mix for current prices, a clear produce/shut-down/exit call,
and a capacity decision that accounts for how the market will react.

**When to use**
- A price falls below "full cost" and someone wants to stop selling.
- Choosing between more staff and more equipment or automation.
- Planning capacity, a new site, or a scale-up.
- Wages, input prices, taxes or a price cap change.
- A project is behind plan and the team wants more money "to catch up".

## Method

### 1. Use the right costs
- **Opportunity cost** counts: the net benefit of the best alternative use of money, time, space or staff. Accounting statements leave it out.
- **Sunk cost** does not count: money spent or committed that can't be recovered whatever you decide.
- Fixed costs (FC) don't vary with output in the short run; variable costs (VC) do. Some fixed costs are **avoidable** if you shut down (a lease you can sublet); count those as relevant to the shut-down decision.
- Marginal cost (MC) = change in total cost from one more unit. Average cost (AC) = total cost / units. Both are U-shaped: early units get cheaper (specialisation, spreading fixed cost), later units dearer (diminishing returns, congestion). MC crosses AC at AC's minimum.
- Cost allocations (overhead charged per unit) hide which costs really move with volume. Rebuild the cost per unit from what actually varies.

### 2. Set output: MR = MC
Produce while the next unit adds more revenue than cost. For a business that can't affect price
(commodity, contract rate), MR = price, so produce up to where P = MC. For a business with pricing power,
see `pricing-strategy`.

### 3. Decide whether to operate
| Horizon | Keep producing if | Otherwise |
|---|---|---|
| Short run | Price >= average variable cost + average avoidable fixed cost | Shut down temporarily: you lose less |
| Long run | Price >= average total cost (including a normal return on capital) | Exit, or change the model |

Between the two lines, keep operating: each sale covers its variable cost and contributes to fixed cost, but plan to fix or exit.

### 4. Choose the input mix
- Short run: equipment and space are fixed, so to change output you can only change labour. Hire while the extra revenue from a worker (price x marginal product) >= wage.
- Long run: everything is variable. Cost-minimising mix: output per dollar is equal across inputs,
  i.e. marginal product of labour / wage = marginal product of capital / rental cost of capital.
  If a dollar on equipment buys more output than a dollar on wages, shift spending toward equipment, and vice versa.
- The same rule allocates money across business units: move budget to whichever unit and input give the highest return per dollar until returns even out.
- When an input's price rises: short run, the budget rises; long run, substitute away from that input.
  When the output target rises: short run, add labour (expensive); long run, re-balance toward capital.

### 5. Think about scale
- Returns to scale: double all inputs; does output more than double (increasing), double (constant), or less (decreasing)? Most businesses have increasing returns when small and decreasing when large.
- **Minimum efficient scale (MES)** = the output where long-run average cost bottoms out. It is the lowest price at which the business can make a profit. Below MES you face a structural cost disadvantage.

### 6. Expect the market to respond
In a competitive market, profits attract entrants until price falls to the efficient producers' average
cost (economic profit zero). A demand boom raises price only temporarily. So a capacity decision must use
the price after entry (yours and others'), not today's. For commodity-style markets, build the industry
supply curve (see `industry-analysis`, step 6) and compute your return at the post-expansion price and the
price needed for your target return.

### 7. Read government interventions
- A per-unit tax drives a wedge between what buyers pay and sellers keep. Who bears it depends on elasticities: buyers' share = supply elasticity / (supply elasticity + |demand elasticity|); sellers' share = the rest. The less elastic side pays more. It makes no difference who legally pays.
- Taxes and subsidies cut or raise output and create deadweight loss (trades that no longer happen).
- Price ceilings below market cause shortages; floors above market cause surpluses; quotas create rents for those who hold them.

### 8. Guard against cost biases
- Sunk-cost fallacy and **escalation of commitment**: adding money to a failing project to "catch up". Re-decide from today using only future costs and benefits; for a troubled project, set written go/no-go criteria and a cheap test first (`project-management`, step 13).
- Status quo bias, "if all you have is a hammer", not-invented-here: they block better production methods.

## Worked pattern
A cabinet shop: capacity 50 jobs/month. Monthly fixed costs $40,000 (lease $15,000 sublettable at $10,000; equipment payments $25,000 sunk). Variable cost $1,800 per job. A downturn cuts the going price to $2,300 and demand to 40 jobs.
- Average variable cost $1,800. Average avoidable fixed cost if it subleases: $10,000 / 40 = $250. Threshold $2,050 < $2,300: keep operating. Contribution = (2,300 - 1,800) x 40 = $20,000 vs $10,000 sublease income. Operating is $10,000 better.
- Long run: AC = 1,800 + 40,000/40 = $2,800 > $2,300. Losing $20,000 a month on a full-cost basis; the business must cut cost, raise price through differentiation, or plan exit before the lease renews.
- Input mix: a CNC router at $3,000/month would replace one $5,500/month worker with the same output. Output per dollar is higher on the machine; buy it. New AC at 40 jobs = (40,000 + 3,000)/40 + 1,800 - 5,500/40 = $2,737.
- A bigger shop proposal: three rivals are also expanding, so expect price near the efficient AC of about $2,200; size the plan to that price.

## Common mistakes
- Shutting down because price is below full cost when it still covers variable and avoidable costs.
- Including sunk costs (past equipment spend, sunk R&D) in a go/no-go.
- Ignoring opportunity cost (owner's time, space that could be rented).
- Planning expansion on current prices in a market where entry is easy.
- Spreading overhead per unit and then treating it as variable.
- Adding labour in the long run when equipment gives more output per dollar.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- Cost accounting detail (activity-based costing, product costing) is in the accounting skills: see `product-costing` and `relevant-cost-decisions`.
