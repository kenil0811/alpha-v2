# Process capacity and cycle time

> **Area:** `process-capacity-and-cycle-time` · owned by the COO skill. **Use when:** Find the bottleneck in any recurring business process, compute its capacity and cycle time, choose the profit-maximizing product mix, and pick the cheapest levers to produce more or deliver faster. Use when a business asks "why can't we handle more orders?", "why does this take so long?", or "which products should we push?".

**Outcome:** a map of how work flows through the business, the one step that limits output, how long a job takes end to end, and a ranked list of cheap fixes before anyone hires or buys equipment.

## When to use
- Output is capped: orders back up, the team is "always busy", demand exceeds what ships.
- Lead time is long: quotes, onboarding, claims, repairs or fulfilment take days or weeks.
- Several products or services share the same people or machines and the owner must choose what to sell.
- Before an investment in staff, machines or software, to check it lands on the bottleneck.

## Method

### 1. Draw the process flow
- List every activity in order, with: average activity time, number of resources doing it in parallel, and average waiting time before it.
- Note which steps run in parallel and which must be sequential, and which resources serve several activities.
- Use one unit of flow (a customer, an order, a claim) and one time unit throughout.

### 2. Little's law (holds for any stable process)
- **Inventory = Throughput x Cycle time** (INV = λ x CT).
  - INV: average number of units inside the process (work in process, customers in the building, open tickets).
  - λ (throughput): average units completed per unit of time.
  - CT (cycle time): average time a unit spends inside, waiting plus being worked on.
- Use it to get the third number from any two. Count open jobs and weekly completions and you know the average lead time without tracking any job.
- Consequence: at the same throughput, more WIP always means longer cycle times. Cutting WIP cuts lead time.

### 3. Capacity and the bottleneck
- **Capacity of an activity = number of resources / activity time.** (Assumes each extra resource adds capacity linearly.)
- Self-service step: capacity = maximum number served at once / time each takes (Little's law again).
- **Capacity bottleneck:** the activity with the lowest capacity. **Process capacity = bottleneck capacity.** Ties mean several bottlenecks.
- **Utilization** of a step = throughput / its capacity. The bottleneck runs nearest 100%.
- When one resource does several activities, add up its minutes per unit across them before dividing.

### 4. Levers to raise capacity (cheapest first; investment is the last resort)
Rule: **raising capacity anywhere but the bottleneck changes nothing.** After each change, recompute; the bottleneck moves.
1. **Raise bottleneck availability:** run it through breaks, move maintenance off-shift, cut setup and changeover time, never let it starve (feed it from a buffer) or get blocked (clear space after it).
2. **Make activities self-service:** let customers do the step (forms, kiosks, portals).
3. **Cut bottleneck activity time:** remove duplicate checks, standardize inputs, give better tools or training, fix quality so rework disappears. Look for the 20% of cases causing 80% of the effort (exceptions, mismatches).
4. **Shift work off the bottleneck** to a step with slack (kitting parts in advance, pre-checking files).
5. **Combine and parallelize:** merge sequential steps A and B into one job done by both workers in parallel. Capacity goes from min(1/A, 1/B) to 2/(A+B), never lower. Also gives one person the whole job, which customers often prefer.
6. **Invest** in more people, machines, overtime or a second shift. Fast to do, but expensive.
Levers 5 and 6 balance the line; levers 2 to 4 simplify work.

### 5. Product mix under a shared bottleneck
- Do not push the product with the highest unit margin by default. The right mix depends on how much scarce capacity each product eats.
- **One binding resource:** rank products by **contribution margin per minute of bottleneck time**, fill demand in that order (standard practice).
- **Several resources or demand caps:** solve as a linear program (spreadsheet Solver):
  - Maximize: sum of (contribution per unit x units) for each product.
  - Subject to: for each resource, sum of (minutes per unit x units) <= minutes available; units <= demand; units >= 0.
  - Round down to whole units and check feasibility.
- Share the result with sales: marketing must sell what operations can make most profitably.

### 6. Cycle time and the critical path
- **Critical path:** the longest path (activity plus waiting time) a unit must travel through the flow. Its length is the cycle time. Parallel branches off the critical path don't add time.
- Expect waiting to dominate: in office processes it is often over 90% of elapsed time. Measure both columns.
- Levers to shorten it:
  1. **Shift work off the critical path:** pre-process (menus of pre-approved options, pre-set pricing rules, pre-qualified customers) or run steps in parallel instead of in series (start production while a rarely-failing credit check runs).
  2. **Cut critical activity time:** eliminate work with one-time investments (standard configurations, pricing guidelines in the order system), work faster with better systems, or shift the mix toward simpler jobs.
- Capacity and cycle time are different problems: the bottleneck limits throughput, the critical path limits speed. A step can be on one and not the other.
- For a one-off project (not a repeating flow), schedule with the network method, slack, three-point estimates and crashing in `project-management`.

### 7. Check the plan
- Recompute the bottleneck and critical path after every proposed change.
- Confirm demand is really there before buying capacity.
- Price each lever: cost per extra unit of capacity, or per day removed.

## Worked pattern
A repair shop: intake 10 min (1 clerk), diagnosis 30 min (2 techs), repair 45 min (4 techs), final check 12 min (1 person).
- Capacities per hour: intake 6, diagnosis 2/0.5 = 4, repair 4/0.75 = 5.3, check 5. Bottleneck: diagnosis, 4 jobs an hour, 32 a day.
- 20 jobs are in the shop on average, so by Little's law cycle time = 20 / 4 = 5 hours.
- A third diagnostic tech lifts diagnosis to 6/hr, but the shop then makes only 5/hr: the bottleneck moves to the final check. Cheaper first: have intake run a standard checklist (shift work off diagnosis, say 30 to 24 min gives 5/hr) and have repair techs do their own final check (combine and parallelize).
- Product mix: an oil service earns $40 and uses 6 diagnosis minutes ($6.7/min); a full service earns $120 and uses 30 ($4/min). When diagnosis is full, fill oil-service demand first.

## Common mistakes
- Adding people at a step that is not the bottleneck.
- Forgetting the bottleneck moves after one fix, so the promised gain never shows up.
- Choosing the mix by unit margin instead of margin per bottleneck minute.
- Confusing capacity with demand: a step can be idle because work arrives unevenly, not because it has slack.
- Ignoring waiting time and only timing the work; most of the cycle time is queues.
- Treating investment as the first lever when availability, rework or duplication fixes cost far less.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- None noted beyond the scope above.
