---
name: coo
description: "The COO's business skills: process capacity and bottlenecks, queues and service levels, inventory and order sizing, demand forecasting, pooling and flexibility, supplier contracts, quality and lean, capacity and cost decisions, supply-chain disruption mapping and response, decisions under uncertainty (including which assumptions are critical by break-even headroom), project management (scoping and work breakdown, scheduling and critical path, three-point estimates and buffers, crashing, earned value, project risk registers, delivery models and contracts, rescuing troubled projects), and risk and compliance (landed cost of any imported or cross-border input such as hardware, components or finished goods, tariffs, origin and government-buying rules, licences and permits, product certification and safety marks, data protection, ESG reporting and green-claims substantiation, carbon-credit and environmental-attribute revenue, forced-labour files, compliance and risk registers), plus healthcare operations. Use for any operations, supply, capacity or project question, and for any plan or model with an imported cost, a compliance duty, a permit, a certification, an ESG claim or carbon-credit revenue."
---

# Chief operating officer: operations, supply chain, risk and compliance

**Outcome:** one owner for every business method this role needs. Each area below is a full method (outcome, when to use, method, worked pattern, common mistakes, sources, gaps) kept in its own reference file.

## How to use

1. Find the area or areas that match the task with "Which area when", then confirm in the table below.
2. Open each matching file and follow its method. Paths are relative to the module's `skills/` folder.
3. A name in backticks that is not in this table belongs to another role; the list at the end says which, and its file is `<role>/references/<name>.md`. Work that spans roles starts from `chief-of-staff/SKILL.md`.
4. Say which area the method came from.

## Which area when

**The usual questions**

- "Why can't we handle more orders? Why does this take so long? Which products should we push?" → `process-capacity-and-cycle-time`
- "Customers wait too long. How many staff on the desk?" → `queue-and-service-capacity`
- "We keep running out, or carry too much, of items we reorder" → `inventory-replenishment-policy`
- "How many should we order for the season, the event, the one batch?" → `one-shot-order-sizing`
- "We need a forecast with a range for stock, staff or capacity" → `demand-forecast-distributions`
- "One warehouse or several? How much variety? Cross-train?" → `inventory-pooling-and-flexibility`
- "What contract with the supplier: buy-back, revenue share, reserved capacity? Why do orders swing so much?" → `supply-contracts-and-coordination`
- "Defects and rework are rising; work piles up between steps" → `quality-control-and-lean-operations`
- "Take this order, stay open, hire or buy a machine, expand?" → `cost-and-capacity-decisions`
- "Where could a supplier or route failure hurt us, and how badly?" → `disruption-exposure-mapping`
- "A supplier or route is disrupted now; what is our plan?" → `disruption-response-planning`
- "How long will this project really take, are we on budget, which contract with the builder?" → `project-management`
- "Pre-buy, book backup capacity, insure, or wait? Which assumptions in this model are critical?" → `risk-decisions-under-uncertainty`
- "Any plan with an imported cost, a permit, a certification, data protection, an ESG claim or carbon-credit revenue" → `risk-and-compliance`
- "Our clinic has safety problems, long waits or burnt-out staff" → `healthcare-quality-and-operations`

**Look-alikes, told apart**

- `process-capacity-and-cycle-time` is a steady flow and its bottleneck; `queue-and-service-capacity` is random arrivals and waiting, so it needs spare capacity; `cost-and-capacity-decisions` is the economics of how much to produce and whether to add capacity.
- `inventory-replenishment-policy` is items bought again and again; `one-shot-order-sizing` is one order before uncertain demand; `inventory-pooling-and-flexibility` is where stock and capacity sit and how flexible they are. `demand-forecast-distributions` feeds all three.
- `disruption-exposure-mapping` finds and sizes exposure before anything happens; `disruption-response-planning` acts when it does (or writes the playbook); `risk-decisions-under-uncertainty` prices act-now-or-wait with judgemental odds and picks critical assumptions by headroom; `risk-and-compliance` covers duties, landed cost, permits and the risk register.
- `project-management` is one-off work with an end date; recurring work is process work (`process-capacity-and-cycle-time`, `quality-control-and-lean-operations`).
- `quality-control-and-lean-operations` is any process; `healthcare-quality-and-operations` is care delivery, where measures must not distort care.
- `supply-contracts-and-coordination` designs the contract terms; the CEO's `negotiation-deal-making` bargains over them.
- `cost-and-capacity-decisions` is the economist's view; the CFO's `relevant-cost-decisions` is the accountant's short-term test and `capital-budgeting` the multi-year NPV. Use the CFO areas when money must be signed off.

**Often used together**

- Stocking: `demand-forecast-distributions` → `inventory-replenishment-policy` or `one-shot-order-sizing` → `inventory-pooling-and-flexibility` → `supply-contracts-and-coordination`.
- Expand capacity: `demand-forecast-distributions` → `process-capacity-and-cycle-time` → `cost-and-capacity-decisions` → the CFO's `capital-budgeting`.
- Supply resilience: `disruption-exposure-mapping` → `risk-decisions-under-uncertainty` → `disruption-response-planning`.
- Import or cross-border plan: `risk-and-compliance` (landed cost) → `risk-decisions-under-uncertainty` (headroom) → the CFO's `currency-and-international-finance`.
- Big one-off build: `project-management` → `risk-and-compliance` (permits) → the CFO's `capital-budgeting`.

## Areas

| Area | Use when | File |
|---|---|---|
| `process-capacity-and-cycle-time` | Find the bottleneck in any recurring business process, compute its capacity and cycle time, choose the profit-maximizing product mix, and pick the cheapest levers to produce more or deliver faster. | `coo/references/process-capacity-and-cycle-time.md` |
| `queue-and-service-capacity` | Estimate waiting times and queue lengths for a service desk, call center, clinic or order queue, and decide how much spare capacity, staffing and variability reduction it needs. | `coo/references/queue-and-service-capacity.md` |
| `inventory-replenishment-policy` | Set how much to order, when to reorder and how much safety stock to hold for items that are bought again and again, and measure the service it delivers. | `coo/references/inventory-replenishment-policy.md` |
| `one-shot-order-sizing` | Decide how much to buy or make when there is one chance to order before uncertain demand (seasonal, perishable, event, fashion, or a capacity commitment), by weighing the cost of too much against the cost of too little. | `coo/references/one-shot-order-sizing.md` |
| `demand-forecast-distributions` | Turn sales history or people's judgment into a demand forecast with a center and a spread, correct for sales lost to stockouts, and combine several opinions so the forecast can size buffers, orders and capacity; also for new products with no history. | `coo/references/demand-forecast-distributions.md` |
| `inventory-pooling-and-flexibility` | Cut buffer stock or spare capacity by pooling demand across locations, products or time and adding a little well-placed flexibility (postponement, cross-training, which plants make what), while watching for the single point of failure pooling creates. | `coo/references/inventory-pooling-and-flexibility.md` |
| `supply-contracts-and-coordination` | Design buyer-supplier contracts (options, buy-back, revenue sharing, capacity reservation) that move risk to whoever carries it most cheaply, and reduce bullwhip swings through information sharing. | `coo/references/supply-contracts-and-coordination.md` |
| `quality-control-and-lean-operations` | Keep a process stable and defect-free with control charts, process capability, stop-and-fix rules and Six Sigma problem solving, and organize work as a lean pull system with low inventory and self-balancing teams. | `coo/references/quality-control-and-lean-operations.md` |
| `cost-and-capacity-decisions` | Decide how much to produce, whether to keep operating, how to mix labour and equipment, and whether to add capacity, using marginal and average costs, opportunity and sunk costs, and how competitive markets settle. | `coo/references/cost-and-capacity-decisions.md` |
| `disruption-exposure-mapping` | Find where a business is exposed to supply chain disruption (deep-tier suppliers, single plants, routes, cheap critical parts, software, unethical subcontractors) and size each exposure by time to survive versus time to recover and money lost per week. | `coo/references/disruption-exposure-mapping.md` |
| `disruption-response-planning` | Detect a supply chain disruption early, escalate it, and build a response plan with options, triggers and signposts, then present it to leadership answer-first. | `coo/references/disruption-response-planning.md` |
| `project-management` | Plan, schedule and control a one-off project: scope and work breakdown, critical path, three-point estimates and buffers, crashing, resource levelling, earned value, project risk registers prioritised by value at stake, delivery models and contracts (fixed price, cost-plus, guaranteed maximum, shared-risk alliance), go-live verification, and continue-or-stop calls on troubled projects. | `coo/references/project-management.md` |
| `risk-decisions-under-uncertainty` | Decide whether to act now, buy the right to act later, or wait, when a disruption might or might not happen, using decision trees, breakeven probabilities and the value of information; pick a model's critical assumptions by break-even headroom. | `coo/references/risk-decisions-under-uncertainty.md` |
| `risk-and-compliance` | Any plan or model with an imported or cross-border cost (landed cost, or a fallback range when no quote exists), tariffs and eligibility, licences and permits, product certification, data protection, ESG and green claims, carbon-credit or other environmental-attribute revenue, and the compliance and risk registers with owners. | `coo/references/risk-and-compliance.md` |
| `healthcare-quality-and-operations` | Improve how a healthcare provider delivers care: cause maps, Lean/PDSA improvement, quality aims and measures that don't distort care, an improvement culture, patient experience, and clinical staff and data. | `coo/references/healthcare-quality-and-operations.md` |

## Areas owned by other roles

- **CEO** (`ceo`): `competitive-strategy`, `industry-analysis`, `platform-and-technology-strategy`, `competitive-moves`, `corporate-strategy`, `incentives-and-information`, `healthcare-business-economics`, `board-meetings`, `nonprofit-board-governance`, `consulting-engagement`, `negotiation-deal-making`, `complex-negotiations-and-disputes`, `business-plan-and-pitch`
- **CFO** (`cfo`): `build-financial-statements`, `cash-flow-analysis`, `ratio-analysis`, `earnings-quality`, `pro-forma-forecasting`, `equity-valuation`, `credit-analysis`, `acquisition-accounting`, `product-costing`, `variance-analysis`, `relevant-cost-decisions`, `capital-budgeting`, `cost-of-capital`, `dcf-valuation`, `valuation-multiples-and-deals`, `capital-structure-decisions`, `bond-and-debt-analysis`, `currency-and-international-finance`, `real-options`, `portfolio-construction`, `investment-performance-and-pricing`, `pe-deal-sourcing-screening`, `buyout-due-diligence`, `private-company-valuation`, `lbo-model-returns`, `acquisition-debt-capacity`, `deal-process-and-terms`, `value-creation-and-exit`, `small-business-acquisition-eta`, `buying-a-small-business`, `startup-valuation-and-deal-math`, `vc-deal-screening`, `raising-startup-capital`
- **CMO** (`cmo`): `market-entry-and-go-to-market`, `market-sizing-and-unit-economics`, `pricing-strategy`, `consumer-behavior-marketing`, `brand-and-positioning`, `digital-marketing-and-channels`, `new-product-forecasting`, `opportunity-validation`, `strategic-communication-plan`, `crisis-communication`, `business-storytelling`
- **CHRO** (`chro`): `team-launch-and-charter`, `team-conflict-trust-and-feedback`, `group-decision-making`, `leading-and-motivating-people`, `leading-change`, `power-and-influence`, `people-analytics`
- **CDO** (`cdo`): `data-visualisation-and-dashboards`, `data-preparation-and-analysis`, `analytics-for-decisions`
