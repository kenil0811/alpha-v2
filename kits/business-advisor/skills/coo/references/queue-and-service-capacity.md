# Queues and service capacity

> **Area:** `queue-and-service-capacity` · owned by the COO skill. **Use when:** Estimate waiting times and queue lengths for a service desk, call center, clinic or order queue, and decide how much spare capacity, staffing and variability reduction it needs. Use when customers wait too long, when staffing a front line, or when someone proposes running people at near-full utilization.

**Outcome:** a number for how long customers wait at a given staffing level, the staffing (or variability cut) that hits a waiting-time target, and the cost trade-off between idle capacity and lost or annoyed customers.

## When to use
- Call center, help desk, clinic, counter, drive-through or back-office queue with complaints about waits.
- Deciding how many agents, chairs or lines to staff by hour.
- Someone argues utilization should be close to 100% "for efficiency".
- Customers hang up, walk away or never join a long line (balking, abandonment).

## Method

### 1. Collect four numbers per time block (for example per hour)
- λ (arrival rate): average arrivals per unit time; ta = 1/λ is the average time between arrivals.
- ts: average service time per customer; μ = 1/ts is one server's capacity.
- c: number of servers working in parallel from one shared line.
- Variability, as squared coefficients of variation (SCV): Ca² = (std dev of inter-arrival time / its mean)², Cs² = (std dev of service time / its mean)².
  - Rough reading: below 0.5 low to moderate, 0.5 to 1 moderate to high, above 1 very high.
  - Many independent customers arriving on their own gives Ca² close to 1. Machine-like, scripted services have Cs² well below 1; a mix of easy and hard cases is often near 1.

### 2. Utilization
- ρ = λ / (c x μ) = λ x ts / c. Must be below 1 or the queue grows without limit.

### 3. Waiting-time formulas (approximations, more accurate as ρ nears 1; exact for M/M/1)
- Single server (G/G/1): **CTq ≈ ((Ca² + Cs²)/2) x (ρ/(1-ρ)) x ts**
  - CTq: average wait in line before service. Cycle time CT = CTq + ts.
- Exponential arrivals and service (M/M/1, Ca² = Cs² = 1): CTq = ts x ρ/(1-ρ); CT = 1/(μ - λ).
- Several servers, one shared line (G/G/c): **CTq ≈ ((Ca² + Cs²)/2) x (ρ^(√(2(c+1)) - 1) / (1-ρ)) x (ts/c)**. The exponent form is the standard published approximation (standard practice). Good for 1 to tens of busy servers.
- Queue lengths by Little's law: INVq = λ x CTq; people in system INV = λ x CT.

### 4. Read the three drivers
1. Wait is proportional to service time.
2. **Utilization effect:** wait rises faster and faster as ρ approaches 1. Going from 80% to 90% busy roughly doubles waiting; 90% to 95% doubles it again.
3. **Variability effect:** wait rises with both arrival and service variability, even with spare capacity.
So short waits need **safety capacity**, and more of it the more variable the process.

### 5. Choose the staffing level
- Set a cost per hour of capacity (wage, desk) and a cost of waiting (lost sales, abandonment, goodwill, penalty per minute over a service target).
- Total cost = capacity cost + waiting cost. Compute for c, c+1, c+2... and pick the minimum. Running at full utilization is almost never the cheapest point.
- Staff by hour of day: rerun with each block's λ.

### 6. Levers to cut waiting (besides adding servers)
- **Pool queues:** one shared line feeding several servers beats separate lines per server at the same staffing.
- **Cut service time:** scripts, better tools, self-service for simple requests, triage to specialists.
- **Cut service variability:** standardize work, split simple from complex cases into separate lanes.
- **Smooth arrivals:** appointments, time slots, call-back offers, off-peak pricing.
- **Flex capacity:** cross-trained staff who move to the line when it grows.
- **Manage perceived wait** (standard practice): tell people the expected wait, keep them occupied, explain delays, serve in a visible fair order.

### 7. Balking, abandonment and finite space
- Real systems have limits: customers don't join if K people are already waiting (balking), leave after waiting a while (reneging/abandonment), or switch lines (jockeying). Phone lines and waiting rooms cap the queue.
- These lower measured waits but lose customers. Track lost arrivals as well as wait time.
- Formulas get messy here: use a simulation (spreadsheet Monte Carlo or a discrete-event tool) to compare designs. Run many replications and compare averages and spreads, not single runs.

## Worked pattern
A support line gets 50 calls an hour; a call takes 6 minutes on average (ts = 0.1 hr); arrivals are random (Ca² = 1) and calls fairly uniform (Cs² = 0.5).
- 6 agents: ρ = 50 x 0.1 / 6 = 0.83, average wait about 2.7 minutes.
- 7 agents: ρ = 0.71, wait about 0.8 minutes. 8 agents: ρ = 0.63, wait about 0.3 minutes.
- If the target is "under one minute on average", 7 agents. One extra agent cut waits by 70%, which an 83%-busy team can't get from working harder.
- Single-server check: a counter with 10 customers an hour and 5-minute service (ρ = 0.83, Ca² = Cs² = 1) averages a 25-minute wait; making service steadier (Cs² = 0.25) cuts it to about 16 minutes with no added staff.

## Common mistakes
- Planning to average demand: capacity equal to average arrivals gives exploding queues.
- Judging a team as "underused" at 70 to 80% utilization when that slack is what keeps waits short.
- Separate lines per server when one shared line is possible.
- Ignoring variability: two desks with the same averages can have very different waits.
- Measuring only served customers' waits and missing the ones who hung up.
- Trusting one simulation run.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- None noted beyond the scope above.
