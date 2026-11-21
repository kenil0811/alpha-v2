# Project scheduling and control: formula sheet

> Depth for `coo/references/project-management.md`. All formulas are standard practice. Numbers are illustrative.

## 1. Critical path (activities on nodes)
- **Forward pass:** ES = largest EF of all predecessors (0 for the first); EF = ES + duration.
- **Backward pass:** LF = smallest LS of all successors (the project end for the last); LS = LF - duration.
- **Total slack** = LS - ES (= LF - EF). Zero slack = critical. **Free slack** = smallest ES of successors - EF (delay that harms no other task).
- Project duration = largest EF. The critical path is the zero-slack chain; there can be more than one.

Worked network (weeks):

| Activity | Duration | After | ES | EF | LS | LF | Slack |
|---|---|---|---|---|---|---|---|
| A lease and permits | 3 | - | 0 | 3 | 0 | 3 | 0 |
| B fit-out | 5 | A | 3 | 8 | 3 | 8 | 0 |
| C system set-up | 4 | A | 3 | 7 | 7 | 11 | 4 |
| D migrate stock | 6 | B | 8 | 14 | 8 | 14 | 0 |
| E train staff | 3 | C | 7 | 10 | 11 | 14 | 4 |
| F go-live | 2 | D, E | 14 | 16 | 14 | 16 | 0 |

Critical path A-B-D-F, 16 weeks. C and E share 4 weeks of slack (using it on C leaves none for E).

## 2. Three-point (PERT) estimates
- a = optimistic, m = most likely, b = pessimistic.
- Mean te = (a + 4m + b) / 6. Standard deviation σ = (b - a) / 6. Variance = σ².
- Path mean = sum of te; path variance = sum of variances (assumes independent activities).
- P(finish ≤ D) = Φ((D - path mean) / path σ), Φ = standard normal cumulative.
- Date for a confidence level: D = mean + z × σ (z = 1.28 for 90%, 1.645 for 95%).

| Critical activity | a | m | b | te | σ² |
|---|---|---|---|---|---|
| A | 2 | 3 | 4 | 3.0 | 0.11 |
| B | 4 | 5 | 9 | 5.5 | 0.69 |
| D | 4 | 6 | 11 | 6.5 | 1.36 |
| F | 1 | 2 | 3 | 2.0 | 0.11 |

Mean 17.0, variance 2.28, σ 1.51. P(≤16) = 25%, P(≤17) = 50%, P(≤19) = 91%. Right-skewed estimates push the mean past the most-likely plan.

Cautions:
- Checking only the critical path understates risk where near-critical paths join it (merge bias). Run the same sum on any path within about 2σ of the critical one, or simulate.
- Correlated activities (same team, same supplier) make the true spread wider than the sum of variances shows.

## 3. Buffers (critical-chain style)
- Cut each task to its median (about 50% chance) estimate; the removed safety per task is roughly (b - m).
- Project buffer ≈ half the sum of removed safety, or the root of the sum of squares of each task's safety (smaller on long chains).
- Feeding buffer of the same kind where a non-critical chain joins the critical one.
- Track buffer burn against chain completion: trouble when buffer used % runs well ahead of work done %.

## 4. Crashing (time-cost trade-off)
- Cost slope = (crash cost - normal cost) / (normal time - crash time), per period saved.
- Value of a period = indirect cost per period + penalty avoided (or bonus earned) per period.
- Loop: crash the critical activity with the lowest slope by one period; recompute paths; repeat while slope < value of a period. When two paths are both critical, crash both together (sum their slopes) or crash a shared activity.

Example: overhead $2,000/week. B can lose 1 week at $1,500; D 2 weeks at $2,500/week; A 1 week at $3,000.
- Crash B one week: saves $500 net, 15 weeks. Other path is 12, still slack.
- D at $2,500 > $2,000: stop, unless a $1,500/week penalty applies beyond 14 weeks, then $2,500 < $3,500 and D goes one week to 14.

## 5. Resource levelling
- Draw a resource histogram (people per week by skill) from earliest starts.
- Shift non-critical tasks within free slack, then total slack, to flatten peaks; priority to tasks with least slack.
- If peaks remain, either add capacity or extend the date; the resource-constrained critical path can differ from the time-only one.

## 6. Earned value
- BAC = budget at completion. PV = planned value of work scheduled to date. EV = budgeted value of work actually done. AC = actual cost to date.
- CV = EV - AC (negative = over cost). SV = EV - PV (negative = behind, in money).
- CPI = EV / AC. SPI = EV / PV.
- EAC (if past cost performance continues) = BAC / CPI. If the overrun was one-off: EAC = AC + (BAC - EV). If both cost and schedule pressure persist: EAC = AC + (BAC - EV) / (CPI × SPI).
- ETC = EAC - AC. VAC = BAC - EAC.
- TCPI = (BAC - EV) / (BAC - AC): the cost efficiency needed on remaining work to land on budget. Above about 1.1 is rarely achieved.
- Rough time forecast = planned duration / SPI; confirm against the critical path.

Example, week 8 of 16, BAC $120k: PV $60k, EV $50k, AC $58k. CV -$8k, SV -$10k, CPI 0.86, SPI 0.83, EAC $139k, VAC -$19k, TCPI 1.13, rough finish 19 weeks.

Measuring EV: use 0/100 for tasks under a reporting period, 50/50 for short tasks, physical units (sites done ÷ sites) for repetitive work. Never "percent complete" by feel.

## 7. Risk scoring
- Expected impact = probability × impact (money or days). Keep a separate flag for low-probability, high-impact items.
- Probability bands (example): low under 20%, medium 20 to 80%, high above 80%. Money bands sized to the project (example: under $10k, $10k to $50k, above $50k).
- Value-at-stake by implementation-risk grid for sub-projects: engage, watch, delegate, let run (see the area file, step 8).
- P10/P50/P90: ask owners for the value they are 90%, 50% and 10% sure to exceed (or fall short of; state which). Combine sub-projects by simulation, not by adding the P10s (that overstates the downside).

## 8. Shared-risk contract payout (target cost with a profit pool)
Terms (example): target cost $2.0m billed at cost; contingency 5% ($100k); team profit pool at risk $200k; savings into contingency, owner keeps 40% of the final contingency and 60% goes to the pool; quality score moves the pool by up to ±20%.

| Final cost | Contingency left | Pool after overrun or share-in | Pool after quality +10% | Owner pays (cost billed + team profit) |
|---|---|---|---|---|
| $1.95m (under by $50k) | $150k: owner keeps $60k, $90k to pool | $290k | $319k | $2.269m |
| $2.05m | $50k: owner keeps $20k, $30k to pool | $230k | $253k | $2.303m |
| $2.25m | $0; $150k of overrun taken from the pool | $50k | $55k | $2.305m |
| $2.40m | $0; pool fully consumed | $0 | $0 | $2.400m (team earns no profit) |

Read: the team earns most by landing under target with high quality; the owner's budget is target + contingency + pool ($2.3m), and, apart from a quality bonus, it pays above that only once overruns exceed contingency plus the whole pool. (A real contract defines whether the quality adjustment applies to a reduced pool; settle that before signing.)
