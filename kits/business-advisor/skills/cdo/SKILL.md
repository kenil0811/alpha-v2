---
name: cdo
description: "The chief data and analytics officer's business skills: data analysis, framing a business question for analytics, sampling and surveys, confidence intervals, significance tests, A/B tests and experiments, regression on business drivers, validating a new metric, charts and data visualisation, dashboards and scorecards, KPI and metrics design, data cleaning and preparation (joins, unions, pivots, Tableau Prep, Power Query), calculated fields, maps, and the analytics tools (Tableau, Power BI, Excel, Google Sheets, Python and R). Use for any question about analysing a business's data, whether a difference or a sample result is real, what drives an outcome, how big a sample to take, choosing or critiquing a chart, building a dashboard, or getting messy data ready for analysis."
---

# Chief data officer: data analysis, inference, visualisation and dashboards

**Outcome:** one owner for every business method this role needs. Each area below is a full method (outcome, when to use, method, worked pattern, common mistakes, sources, gaps) kept in its own reference file.

## How to use

1. Find the area or areas that match the task with "Which area when", then confirm in the table below.
2. Open each matching file and follow its method. Paths are relative to the module's `skills/` folder.
3. A name in backticks that is not in this table belongs to another role; the list at the end says which, and its file is `<role>/references/<name>.md`. Work that spans roles starts from `chief-of-staff/SKILL.md`.
4. Say which area the method came from.

## Which area when

**The usual questions**

- "Our numbers don't match; combine these spreadsheets; every region sends a different format" → `data-preparation-and-analysis`
- "Rank our branches; how many days does shipping take?" → `data-preparation-and-analysis`
- "Is this difference real? Will this clear break-even?" → `analytics-for-decisions`
- "How many customers do we need to survey?" → `analytics-for-decisions`
- "What really drives sales? Should we roll this out after the test?" → `analytics-for-decisions`
- "Does this new metric or score mean anything?" → `analytics-for-decisions`
- "How should I show this? Is this chart any good?" → `data-visualisation-and-dashboards`
- "Build me a dashboard or KPI scorecard; which tool should we use?" → `data-visualisation-and-dashboards`

**Look-alikes, told apart**

- The three areas are one pipeline: `data-preparation-and-analysis` gets the data clean and describes it; `analytics-for-decisions` says how sure an answer is and what drives it; `data-visualisation-and-dashboards` shows it.
- The CDO owns general data method. Marketing models stay with the CMO: promotion and ad response, media mix and adoption curves in `new-product-forecasting`, churn and customer value in `market-sizing-and-unit-economics`, funnel metrics in `digital-marketing-and-channels`. People measures stay with the CHRO in `people-analytics`. Demand forecasts with a spread are the COO's `demand-forecast-distributions`; control charts are the COO's `quality-control-and-lean-operations`; financial ratios are the CFO's `ratio-analysis`.

**Often used together**

- KPI dashboard: `data-preparation-and-analysis` → the owning role's area for what each KPI means → `analytics-for-decisions` for targets and noise → `data-visualisation-and-dashboards`.
- Test a change: `analytics-for-decisions` (sample size, experiment) → `data-preparation-and-analysis` → `analytics-for-decisions` (significance, practical size) → the CMO's `business-storytelling`.

## Areas

| Area | Use when | File |
|---|---|---|
| `data-visualisation-and-dashboards` | Turn a business question and its data into the right chart, a clean dashboard or scorecard with KPI targets, and an interactive data story: choose the chart by purpose, encode and declutter, design filters and actions, and pick the tool (Tableau, Power BI, Excel, Python or R). | `cdo/references/data-visualisation-and-dashboards.md` |
| `data-preparation-and-analysis` | Get messy data from several files or systems into one clean, trusted table and analyse it: profile, clean, join, union, blend, pivot, aggregate, add calculated fields and spatial fields, in Tableau Prep, Tableau or Power Query, then describe and rank what the data shows. | `cdo/references/data-preparation-and-analysis.md` |
| `analytics-for-decisions` | Turn a business question into an analytics problem and say how sure the answer is: sample and size a survey, estimate with a confidence interval, test against break-even or between groups (paired, two-sample, ANOVA, crosstabs), separate statistical from practical significance, validate a new metric, find drivers with regression, and run an experiment. | `cdo/references/analytics-for-decisions.md` |

## Areas owned by other roles

- **CEO** (`ceo`): `competitive-strategy`, `industry-analysis`, `platform-and-technology-strategy`, `competitive-moves`, `corporate-strategy`, `incentives-and-information`, `healthcare-business-economics`, `board-meetings`, `nonprofit-board-governance`, `consulting-engagement`, `negotiation-deal-making`, `complex-negotiations-and-disputes`, `business-plan-and-pitch`
- **CFO** (`cfo`): `build-financial-statements`, `cash-flow-analysis`, `ratio-analysis`, `earnings-quality`, `pro-forma-forecasting`, `equity-valuation`, `credit-analysis`, `acquisition-accounting`, `product-costing`, `variance-analysis`, `relevant-cost-decisions`, `capital-budgeting`, `cost-of-capital`, `dcf-valuation`, `valuation-multiples-and-deals`, `capital-structure-decisions`, `bond-and-debt-analysis`, `currency-and-international-finance`, `real-options`, `portfolio-construction`, `investment-performance-and-pricing`, `pe-deal-sourcing-screening`, `buyout-due-diligence`, `private-company-valuation`, `lbo-model-returns`, `acquisition-debt-capacity`, `deal-process-and-terms`, `value-creation-and-exit`, `small-business-acquisition-eta`, `buying-a-small-business`, `startup-valuation-and-deal-math`, `vc-deal-screening`, `raising-startup-capital`
- **COO** (`coo`): `process-capacity-and-cycle-time`, `queue-and-service-capacity`, `inventory-replenishment-policy`, `one-shot-order-sizing`, `demand-forecast-distributions`, `inventory-pooling-and-flexibility`, `supply-contracts-and-coordination`, `quality-control-and-lean-operations`, `cost-and-capacity-decisions`, `disruption-exposure-mapping`, `disruption-response-planning`, `project-management`, `risk-decisions-under-uncertainty`, `risk-and-compliance`, `healthcare-quality-and-operations`
- **CMO** (`cmo`): `market-entry-and-go-to-market`, `market-sizing-and-unit-economics`, `pricing-strategy`, `consumer-behavior-marketing`, `brand-and-positioning`, `digital-marketing-and-channels`, `new-product-forecasting`, `opportunity-validation`, `strategic-communication-plan`, `crisis-communication`, `business-storytelling`
- **CHRO** (`chro`): `team-launch-and-charter`, `team-conflict-trust-and-feedback`, `group-decision-making`, `leading-and-motivating-people`, `leading-change`, `power-and-influence`, `people-analytics`
