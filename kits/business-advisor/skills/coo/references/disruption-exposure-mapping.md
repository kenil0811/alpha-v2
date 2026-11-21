# Disruption exposure mapping

> **Area:** `disruption-exposure-mapping` · owned by the COO skill. **Use when:** Find where a business is exposed to supply chain disruptions (deep-tier suppliers, single plants, routes, cheap critical parts, software, unethical subcontractors) and size each exposure by time to survive versus time to recover and the money lost per week. Use when assessing supplier or route risk, before consolidating suppliers, or when a disruption in the news might reach the business.

**Outcome:** a ranked list of the suppliers, sites, routes and systems whose failure would hurt most, each with how long the business can keep shipping (time to survive), how long the failed node takes to come back (time to recover), and the expected loss, so mitigation money goes where exposure is, not where spend is.

## When to use
- A risk review of suppliers, logistics routes or IT systems.
- A fire, flood, strike, export ban, closure or cyber event hits somewhere in the world: "does this reach us?".
- Before moving to a single supplier, single warehouse or cheapest bidder.
- Customer, regulator or brand asks where products are made.

## Method

### 1. Place the risk on the spectrum
- **Recurrent:** frequent, small, measurable (demand and supply mismatch). Tools: probability models, buffers, pooling, contracts.
- **Disruptive:** rare, discrete, large, hard to put a probability on (fires, quakes, closures, bans, cyberattacks). Tools: preparedness, mapping, contingency plans.
- A likelihood x impact grid starts the conversation but hides the long tail: a few rare events cause most damage. Don't let "low likelihood" boxes drop off the agenda.

### 2. Map the chain beyond tier 1
- List tier-1 suppliers per part, then ask each for their sources, tier by tier, for critical items. Mark sites (city, plant) and routes (ports, straits, air hubs, land bridges).
- Look for **diamonds:** many suppliers that narrow to one plant or one material deep in the chain. The chain looks spread out at tier 1 and isn't.
- Look for **route dependence:** a plant can stop because a route closed though no supplier was touched (canal blockage, airspace closure, rerouting adding weeks at sea).
- Include **software and services** as tiers: shared libraries, hosting, ordering and shipping systems. A cyber event can halt shipping with every plant intact.
- Include **ethical and safety exposure:** unauthorized subcontracting, unsafe buildings, conflict minerals. You cannot answer for what you cannot see.
- Mapping serves resilience and responsibility at once. Some firms publish their supplier map.

### 3. Hunt for the "nail"
- Attention follows spend; exposure doesn't. Cheap parts with a single source and no quick substitute (a valve, a fastener, a gas, a chip costing cents) can stop the whole line.
- For each part ask: sole source? qualification time for a new source? substitute? stock on hand? Rank by consequence, not by annual spend.

### 4. Size each exposure: time to survive vs time to recover
- **Time to recover (TTR):** how long until the failed node ships again at normal volume. Give a range with probabilities; suppliers' first estimates are often too optimistic.
- **Time to survive (TTS):** how long the business can keep meeting demand at full rate after the node fails. Count every buffer between the failed node and customers: the failed firm's own stock, stock in transit (pipelines), every downstream stock, and your finished goods. Subtract what other sources keep supplying.
  - Losing one of two suppliers drains only the lost share. A deep-tier failure arrives later but can hit several components at once.
- **Loss ≈ max(TTR − TTS, 0) x units short per week x margin per unit** (plus penalties, recovery costs, lost customers). Nothing is lost while TTR < TTS.
- Run it for each critical node; work out the TTR distribution's expected loss and worst case.

### 5. Prioritize
- Rank nodes by expected loss and by worst case. Flag any node where TTR >> TTS.
- Ways to close the gap: raise TTS (strategic stock of the nail part, finished-goods buffer, more pipeline), cut TTR (second source qualified in advance, flexibility to reroute, supplier recovery plans), or cut units short (dual sourcing so only a share is lost).
- Beware the cheapest-supplier trap: price-only selection concentrates volume in suppliers with no fallback, and their failure becomes yours.

### 6. Keep it live
- Watch chokepoints and single plants; read signals from other industries that share them.
- Re-map when products, suppliers or routes change; ask key suppliers to notify changes in their own sources.

## Worked pattern
A furniture maker buys hinges from one supplier, whose plant makes them from steel strip bought from one mill.
- Hinge cost is 1% of spend but every cabinet needs them. Stock: 2 weeks on hand, 1 week in transit, supplier holds 1 week finished. TTS = 4 weeks.
- If the mill fails, the supplier has 2 more weeks of strip: TTS from a mill failure = 6 weeks.
- Supplier plant fire: TTR 6 to 16 weeks (say 50% at 8, 50% at 14). Weekly margin at stake $80k. Expected loss = 0.5 x (8 − 4) x 80k + 0.5 x (14 − 4) x 80k = $560k; worst case $800k+.
- Qualifying a second hinge supplier for $60k cuts TTR to about 5 weeks: expected loss falls to $80k. Clear priority over higher-spend but multi-sourced parts.

## Common mistakes
- Ranking risk by spend or by tier-1 count.
- Counting only own stock in TTS and ignoring pipeline and downstream buffers (or counting stock that other customers will also claim).
- Taking the supplier's first recovery estimate as a point value.
- Forgetting routes, software and subcontractors.
- Treating pooled or sole sources as safe because they've never failed.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- None noted beyond the scope above.
