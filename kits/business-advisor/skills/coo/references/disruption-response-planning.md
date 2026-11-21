# Disruption response planning

> **Area:** `disruption-response-planning` · owned by the COO skill. **Use when:** Detect a supply chain disruption early, escalate it, and build a response plan with options, triggers and signposts, then present it to leadership answer-first. Use when a supplier, route or market is disrupted now (fire, closure, export ban, cyberattack, lost customers), or to prepare a playbook before one hits.

**Outcome:** a fast, structured response that secures scarce capacity before competitors, a plan for both "it reopens soon" and "it lasts", and a one-page recommendation leadership can approve.

## When to use
- A supplier reports a fire, outage, force majeure or allocation cut.
- A route, port or market closes, or a government imposes a ban.
- A cyber incident threatens ordering, shipping or customer service.
- Building a playbook for the top exposures found in disruption-exposure-mapping.

## Method

### 1. Detect early
- Watch your own data for anomalies: orders, deliveries or confirmations that "don't add up" are often the first signal, before the supplier admits a problem.
- Keep a watch list of critical single-source parts and chokepoints; check them daily in a crisis.
- Make bad news travel fast: reward early escalation, not cover-ups. A technician-to-technician conversation is not escalation.

### 2. Escalate and move first
- Treat the supplier's first recovery estimate as optimistic; plan on a range.
- Escalate to senior leaders on both sides within days; form a cross-functional team (purchasing, operations, engineering, sales, finance).
- Claim the supplier's spare capacity, alternative plants and the broader market's free capacity before others do. In shortages, the first mover gets the allocation.
- Where you had cut backup suppliers to save money, you have no plan B: this is why to keep a second source qualified.

### 3. Quantify the exposure (see disruption-exposure-mapping)
- Time to survive (TTS) under current stock and supply.
- Time to recover (TTR) as scenarios with probabilities (early, base, late).
- Money at stake per week or month, including contract penalties and customers who won't come back.

### 4. Generate and compare at least three options
- Typical menu: buy spot or from brokers; new contracts or take-or-pay with other suppliers; qualify a substitute material or supplier; reduce use (recycling, redesign, yield); reroute (alternative ports, land bridges, air); re-mix markets or customers; add storage; slow production; escalate with the supplier for priority; government programs or stockpiles.
- **Prioritize scarce input by margin per unit of the scarce input**, then adjust for contract penalties, strategic customers and political fallout.
- For each option: cost, effect on the shortfall, timing (when it starts working), risks. Build a period-by-period balance (supply, use, stock) for each combination to see the month you run out.
- Use decision trees and breakevens to choose between committing now and buying options (see risk-decisions-under-uncertainty). Beware long lock-ins that hurt if the crisis ends early.

### 5. Write the plan in prevent-detect-respond form
- **Now:** actions to take this week.
- **Prepared, with triggers:** actions ready to launch, each with the observable signal that sets it off (for example "if supplier delivers below 30% for two weeks, activate the backup contract").
- **If it reopens / if it lasts:** what to unwind and what to scale.

### 6. Stress-test
- Worst case and how the plan survives it.
- Signposts to watch and how often.
- Who must agree: customers, suppliers, the board, lenders, regulators or government.
- Ask someone (or an AI tool) to play the CFO, the biggest customer and the supplier and attack the plan; fix what survives.

### 7. Present answer-first (eight slides or one page)
1. Recommendation in one line. 2. Exposure: TTS, TTR range with probabilities, stake per period. 3. Options compared. 4. Analysis behind the choice. 5. Plan with triggers. 6. What could make us wrong. 7. What changes permanently. Appendix: assumptions, calculations, sources.

### 8. Research discipline in a fast-moving crisis
- Keep company data and outside facts separate; say when you replace a company number with an outside one.
- Every outside fact gets a source and a date ("as of"); prefer primary and major sources; confirm key numbers in two sources; show conflicts.
- For a shipping-chokepoint crisis, benchmark costs (insurance, freight, bypass, policy responses) and how to handle conflicting reports are in `coo/references/disruption-response-planning/chokepoint-disruption-benchmarks.md`.
- AI tools are useful to catch up, widen options, recheck math and argue against you, but they invent numbers and links: open every source. Disclose tool use.

### 9. After the crisis
- Fix what the crisis exposed: dual sourcing, strategic stock of the nail parts, recovery systems that cut dependence, contracts with capacity reservation and clear force majeure terms, a live supplier map.
- Run a short review of how fast you detected, escalated and decided.

## Worked pattern
A bakery chain's sole packaging-film supplier has a fire; it says "back in a week".
- Day 1: buyers notice confirmations slipping; escalate to the owner; call the supplier's CEO; reserve two weeks of film from the supplier's other plant and a distributor.
- Exposure: 3 weeks of film on hand plus 1 in transit = TTS 4 weeks; TTR scenarios 2, 6, 12 weeks at 30/50/20%; margin at stake $25k a week.
- Options: broker film at 2x price; qualify a second film maker (3 weeks, $8k); switch low-margin lines to plain bags; ask customers to accept substitute packs.
- Plan: qualify the second maker now; trigger broker buying if the supplier misses its week-2 restart; prioritize film for the highest margin per roll; review weekly.
- Permanently: keep the second maker on 20% of volume.

## Common mistakes
- Waiting on the supplier's estimate before acting.
- Letting the problem sit at working level for weeks.
- Plans with actions but no triggers, or one scenario only.
- Rationing scarce input without regard to margin, penalties and relationships.
- Locking into long contracts that become costly if the crisis ends early.
- Unsourced or AI-generated facts on decision slides.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- None noted beyond the scope above.
