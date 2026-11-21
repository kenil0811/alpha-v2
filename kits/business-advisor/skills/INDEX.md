# Business skills, by executive role

82 areas of business method distilled from MBA course material, written on 15 November 2026 and grouped under six executive roles, so each has one owner for future work. The method is written in our own words; no source text is reproduced.

## Layout

- `chief-of-staff/SKILL.md`: the meta skill, used first. It picks the role and the area for a question, breaks ties between roles, and holds the cross-role plays (ordered area chains for work that spans roles) and the rules for every answer.
- `<role>/SKILL.md`: the role skill. Alpha's agents see its name and description; its body has a "Which area when" guide (usual questions, look-alikes told apart, areas often used together) and a routing table of the role's areas.
- `<role>/references/<area>.md`: one area, a full method (outcome, when to use, method, worked pattern, common mistakes, sources, gaps).
- `<role>/references/<area>/<topic>.md`: deeper detail for an area (formula sheets, model layouts, checklists, benchmark tables).
- Paths inside files are relative to this `skills/` folder.

New method goes into the owning role's existing area. A new area is added only when no existing area can hold it, and only by the role that owns it.

| Role | Owns | Areas | Area names |
|---|---|---|---|
| **CEO** (`ceo`) | Strategy, corporate strategy, competition, governance, negotiation, pitching | 13 | competitive-strategy · industry-analysis · platform-and-technology-strategy · competitive-moves · corporate-strategy · incentives-and-information · healthcare-business-economics · board-meetings · nonprofit-board-governance · consulting-engagement · negotiation-deal-making · complex-negotiations-and-disputes · business-plan-and-pitch |
| **CFO** (`cfo`) | Accounting, finance, valuation, credit, funding, currency, deals | 33 | build-financial-statements · cash-flow-analysis · ratio-analysis · earnings-quality · pro-forma-forecasting · equity-valuation · credit-analysis · acquisition-accounting · product-costing · variance-analysis · relevant-cost-decisions · capital-budgeting · cost-of-capital · dcf-valuation · valuation-multiples-and-deals · capital-structure-decisions · bond-and-debt-analysis · currency-and-international-finance · real-options · portfolio-construction · investment-performance-and-pricing · pe-deal-sourcing-screening · buyout-due-diligence · private-company-valuation · lbo-model-returns · acquisition-debt-capacity · deal-process-and-terms · value-creation-and-exit · small-business-acquisition-eta · buying-a-small-business · startup-valuation-and-deal-math · vc-deal-screening · raising-startup-capital |
| **COO** (`coo`) | Operations, supply chain, projects, risk and compliance | 15 | process-capacity-and-cycle-time · queue-and-service-capacity · inventory-replenishment-policy · one-shot-order-sizing · demand-forecast-distributions · inventory-pooling-and-flexibility · supply-contracts-and-coordination · quality-control-and-lean-operations · cost-and-capacity-decisions · disruption-exposure-mapping · disruption-response-planning · project-management · risk-decisions-under-uncertainty · risk-and-compliance · healthcare-quality-and-operations |
| **CMO** (`cmo`) | Markets and go-to-market, brand, digital channels, customers, pricing, forecasting, communication | 11 | market-entry-and-go-to-market · market-sizing-and-unit-economics · pricing-strategy · consumer-behavior-marketing · brand-and-positioning · digital-marketing-and-channels · new-product-forecasting · opportunity-validation · strategic-communication-plan · crisis-communication · business-storytelling |
| **CHRO** (`chro`) | Teams, leadership, change, influence, people analytics | 7 | team-launch-and-charter · team-conflict-trust-and-feedback · group-decision-making · leading-and-motivating-people · leading-change · power-and-influence · people-analytics |
| **CDO** (`cdo`) | Data preparation, analysis, inference, visualisation and dashboards | 3 | data-visualisation-and-dashboards · data-preparation-and-analysis · analytics-for-decisions |

## Which valuation area to use (CFO)

| The situation | The area |
|---|---|
| A whole business or project, valued on its cash flows | `cfo/references/dcf-valuation.md` |
| Quick comparables, or what to pay in a merger | `cfo/references/valuation-multiples-and-deals.md` |
| A public company's shares, the analyst's view | `cfo/references/equity-valuation.md` |
| A private company in a buyout | `cfo/references/private-company-valuation.md` |
| A startup round | `cfo/references/startup-valuation-and-deal-math.md` |
| A book of customer loans or receivables | `cfo/references/credit-analysis.md` |

## Changed after tests on real cases (15 November 2026)

- A market-entry case: added market entry (now under the CMO) and trade compliance (now broadened into the COO's `risk-and-compliance`); extended cash flow (entity versus group), unit economics (durable-goods customer value, acquisition spend, B2B funnel) and make-or-buy (break-even premium erosion).
- A pay-as-you-go energy finance case: extended credit analysis (consumer loan books), capital structure (asset-backed and blended finance), earnings quality (revenue received before it is earned, tax basis), unit economics (credit-financed contracts), risk and compliance (imported costs, carbon credits, compliance register) and decisions under uncertainty (critical assumptions by headroom to break-even).
- More material added the same day: new areas `corporate-strategy` (CEO), `currency-and-international-finance` (CFO), `brand-and-positioning`, `digital-marketing-and-channels`, `new-product-forecasting` (CMO), `people-analytics` (CHRO), `project-management` (COO), and a sixth role, the CDO, with `data-visualisation-and-dashboards`, `data-preparation-and-analysis` and `analytics-for-decisions`; `market-entry-and-go-to-market` became "Market entry and go-to-market"; foreign projects, foreign cost of capital and swaps went into existing CFO areas.
- Structure made explicit (15 November 2026): a meta skill, `chief-of-staff`, routes to the role and plans cross-role work; each role skill gained a "Which area when" section, and its routing rows were refreshed to match the area files.
- Existing areas strengthened with lessons from teaching cases (financial statement analysis, valuation, cost analysis, strategy, healthcare management, power and politics, business planning); no new areas.
- Still thin: public-tender bidding, workforce capacity planning, pay and incentive analytics.

## Where the skills are thin

- Consumer behaviour
- Strategic communication
- Business narratives
- Venture capital practice
- Operations teaching cases

Where a skill fills a gap with standard practice, it says so in the text. Each skill also lists its own gaps at the end.

## Grow next, when more material comes

- **Negotiation:** its deal-making half can split into preparation and live bargaining.
- **pricing-strategy:** can split into price setting and price structures such as bundles, tiers and two-part pricing.
- **dcf-valuation:** can split into building the forecast and the discount rate with the terminal value.
- **consumer-behavior-marketing:** can split once more material is added.
- **Corporate strategy and M&A integration:** a new skill once more material covers it.
