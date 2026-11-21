---
name: chief-of-staff
description: "Use first for any business question or task: picks which role skill to open (CEO for strategy, governance, negotiation and pitching; CFO for money, valuation, funding, credit and deals; COO for operations, supply, projects, risk and compliance; CMO for markets, customers, brand, pricing and communication; CHRO for teams, leadership, change and people analytics; CDO for data analysis and dashboards) and which area inside it, and plans work that spans several roles, such as entering a market, launching a product, buying a business, raising money, a board deck or a strategy case."
---

# Chief of staff: which skill to use when

**Outcome:** every business question goes to the right role and the right area, and work that spans roles runs in a sensible order, so the answer uses the library's methods instead of memory.

## How to route

1. Name the decision or the deliverable in one line ("set the price of X", "value Y", "a board deck on Z").
2. Pick the role that owns it from the role table; if two could, use the tie-breaks below.
3. Open that role's `<role>/SKILL.md` and use its "Which area when" section to choose the area or areas.
4. Open each area file (`<role>/references/<area>.md`) and follow its method.
5. If the work spans roles, follow a cross-role play below, in order, and skip steps that do not apply.
6. Say which areas were used.

Paths are relative to the `skills/` folder.

## The roles

| Role | Owns | Typical questions | Skill |
|---|---|---|---|
| CEO | Strategy, corporate strategy, competition, platforms, incentives, boards, negotiation, consulting, business plans and pitches | What is our strategy? Should we get into X, buy or partner? What will rivals do? How do I negotiate this? Write the pitch. | `ceo/SKILL.md` |
| CFO | Accounts, cash, ratios, forecasts, costing, investment decisions, discount rates, valuation, debt and credit, currency, funding, buying and selling companies, startup rounds | Is this worth doing? What is it worth? Where is the cash? How much debt? Should we raise, and on what terms? | `cfo/SKILL.md` |
| COO | Process capacity, queues, inventory, forecasts with a spread, supply contracts, quality, capacity economics, disruption, projects, risk and compliance | Why can't we handle more? How much to order? What if the supplier fails? How long will the project take? What does this import really cost? | `coo/SKILL.md` |
| CMO | Go-to-market and market entry, sizing and unit economics, pricing, consumer behaviour, brand, channels, new-product forecasts, validating ideas, communication | How big is the market? Who first? What should we charge? Where should the budget go? How do we tell the story? | `cmo/SKILL.md` |
| CHRO | Teams, group decisions, leading and motivating, change, power and influence, people analytics | How do we launch or fix this team? How do we get buy-in? How should we hire and rate people? | `chro/SKILL.md` |
| CDO | Data preparation, inference and experiments, regression, charts and dashboards | Our numbers don't match. Is this difference real? What drives sales? Build me a dashboard. | `cdo/SKILL.md` |

## When the question could belong to two roles

- **Pricing:** the CMO's `pricing-strategy` sets the price; the CFO values its effect on profit and cash (`pro-forma-forecasting`, `relevant-cost-decisions` for a one-off price).
- **Market entry:** the CMO leads (`market-entry-and-go-to-market`); the CEO checks the industry is worth it; the COO checks landed cost and compliance (`risk-and-compliance`); the CFO values it last.
- **Capacity expansion or outsourcing:** the COO sizes it (`process-capacity-and-cycle-time`, `cost-and-capacity-decisions`); the CEO decides make, buy or ally (`corporate-strategy`); the CFO values it (`capital-budgeting`).
- **Make or buy:** strategy in the CEO's `corporate-strategy`, cost in the CFO's `relevant-cost-decisions`, supplier terms in the COO's `supply-contracts-and-coordination`.
- **Forecasts:** full statements are the CFO's `pro-forma-forecasting`; revenue from customers is the CMO's `market-sizing-and-unit-economics`; adoption curves the CMO's `new-product-forecasting`; a forecast with a spread for stock or staff the COO's `demand-forecast-distributions`.
- **Data work:** the CDO, unless it is marketing analytics (CMO) or people analytics (CHRO).
- **Decks and messages:** the venture's investor documents are the CEO's `business-plan-and-pitch`; any deck that must win a decision is the CMO's `business-storytelling`.
- **Pay:** incentive design is the CEO's `incentives-and-information`; the measures it rests on are the CHRO's `people-analytics`.
- **Risk:** supply-chain exposure and response are the COO's; act-now-or-wait and critical assumptions are the COO's `risk-decisions-under-uncertainty`; the value of flexibility is the CFO's `real-options`.
- **Anything with money and a decision:** the CFO values it last, after the other roles have set the inputs.

## Cross-role plays

Each play is an ordered chain; skip steps that do not apply and say which were skipped.

- **Enter a new market or country:** `ceo/industry-analysis` → `cmo/market-entry-and-go-to-market` → `cmo/market-sizing-and-unit-economics` → `cmo/pricing-strategy` → `coo/risk-and-compliance` → `cfo/cost-of-capital` → `cfo/capital-budgeting` → `cfo/currency-and-international-finance` → `coo/risk-decisions-under-uncertainty`.
- **Launch a new product:** `cmo/opportunity-validation` → `cmo/market-sizing-and-unit-economics` → `cmo/brand-and-positioning` → `cmo/pricing-strategy` → `cmo/new-product-forecasting` → `coo/demand-forecast-distributions` → `cfo/capital-budgeting` → `cmo/digital-marketing-and-channels`.
- **Buy a small business or run a search:** `cfo/buying-a-small-business` (own money and a bank loan) or `cfo/small-business-acquisition-eta` (investors) → `cfo/pe-deal-sourcing-screening` → `cfo/buyout-due-diligence` → `cfo/earnings-quality` → `cfo/private-company-valuation` → `cfo/lbo-model-returns` → `cfo/acquisition-debt-capacity` → `cfo/deal-process-and-terms` → `ceo/negotiation-deal-making` → `cfo/value-creation-and-exit` → `chro/leading-change`.
- **Raise money for a startup:** `cmo/opportunity-validation` → `cmo/market-sizing-and-unit-economics` → `cfo/pro-forma-forecasting` → `cfo/raising-startup-capital` → `cfo/startup-valuation-and-deal-math` → `ceo/business-plan-and-pitch` → `ceo/negotiation-deal-making`.
- **Write a board or investor deck:** the areas the content needs → `cfo/cash-flow-analysis` and `cfo/ratio-analysis` for the numbers → `cmo/business-storytelling` → `cdo/data-visualisation-and-dashboards` → `ceo/board-meetings` for the agenda and motions.
- **Build a business plan:** `cmo/opportunity-validation` → `ceo/industry-analysis` → `ceo/competitive-strategy` → `cmo/market-sizing-and-unit-economics` → `cmo/market-entry-and-go-to-market` → `coo/risk-and-compliance` → `cfo/pro-forma-forecasting` → `cfo/raising-startup-capital` → `ceo/business-plan-and-pitch`.
- **Expand or outsource production:** `coo/demand-forecast-distributions` → `coo/process-capacity-and-cycle-time` → `coo/cost-and-capacity-decisions` → `ceo/corporate-strategy` → `cfo/relevant-cost-decisions` → `coo/supply-contracts-and-coordination` → `coo/risk-and-compliance` → `cfo/capital-budgeting` → `cfo/real-options`.
- **Fund a loan book or asset-backed finance:** `cfo/credit-analysis` → `cmo/market-sizing-and-unit-economics` (credit-financed customers) → `cfo/earnings-quality` (revenue received before it is earned) → `cfo/capital-structure-decisions` → `cfo/currency-and-international-finance` → `cfo/bond-and-debt-analysis` → `coo/risk-and-compliance` → `coo/risk-decisions-under-uncertainty`.
- **Respond to a crisis or disruption:** `coo/disruption-exposure-mapping` → `coo/disruption-response-planning` → `coo/risk-decisions-under-uncertainty` → `cfo/cash-flow-analysis` → `cmo/crisis-communication`.
- **Reorganise or lead a change:** `chro/power-and-influence` → `chro/leading-change` → `chro/team-launch-and-charter` → `cmo/strategic-communication-plan` → `chro/people-analytics` to track adoption.
- **Hire and measure people:** `chro/people-analytics` → `ceo/incentives-and-information` → `ceo/negotiation-deal-making` → `chro/leading-and-motivating-people` → `cdo/data-visualisation-and-dashboards`.
- **Build a KPI dashboard:** the owning role's area for what each measure means → `cdo/data-preparation-and-analysis` → `cdo/analytics-for-decisions` → `cdo/data-visualisation-and-dashboards`.
- **Set or change prices:** `cmo/pricing-strategy` → `cfo/product-costing` → `cmo/consumer-behavior-marketing` → `ceo/competitive-moves` → `cdo/analytics-for-decisions` to test → `cfo/pro-forma-forecasting` for the effect on profit and cash.
- **Answer a case competition or strategy case:** `ceo/consulting-engagement` (list every deliverable asked) → `ceo/industry-analysis` → `ceo/competitive-strategy` → the play the case calls for → `cfo/cost-of-capital` → `cfo/capital-budgeting` or `cfo/dcf-valuation` → `coo/risk-and-compliance` → `coo/risk-decisions-under-uncertainty` → `cmo/business-storytelling`. Lessons from two backtests: answer every deliverable, not the interesting ones; build the discount rate instead of assuming one; test each input against real costs (landed cost, real quotes); choose the critical assumptions by headroom to break-even.

## Rules for every answer

- Label every fact: **given** (from the user or their documents), **outside** (with its source), or **assumed** (with a range).
- Use the area's method, not memory, and say which areas were used.
- Check the critical assumptions' headroom: how far each can move before the decision flips.
- For rules, rates, tariffs and prices, verify them as of today; the library teaches method, not current figures.
- When the chain leaves a step out, say so and why.
