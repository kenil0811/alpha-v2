---
name: cfo
description: "The CFO's business skills: building and reading financial statements, cash flow, ratios, earnings quality, forecasting, costing and variances, make-or-buy, capital budgeting, cost of capital, valuation (DCF, multiples, equity, private and startup), capital structure, debt and credit (corporate and consumer loan books), asset-backed and blended funding, currency and international finance (FX quotes, forwards, interest rate parity, FX exposure and hedging, interest rate and currency swaps, foreign projects), real options, portfolios and fund returns, and buying, financing and selling companies (private equity, search funds, small-business purchases, venture rounds). Use for any money, valuation, funding, credit, currency or deal question."
---

# Chief financial officer: accounting, finance, valuation and deals

**Outcome:** one owner for every business method this role needs. Each area below is a full method (outcome, when to use, method, worked pattern, common mistakes, sources, gaps) kept in its own reference file.

## How to use

1. Find the area or areas that match the task with "Which area when", then confirm in the table below.
2. Open each matching file and follow its method. Paths are relative to the module's `skills/` folder.
3. A name in backticks that is not in this table belongs to another role; the list at the end says which, and its file is `<role>/references/<name>.md`. Work that spans roles starts from `chief-of-staff/SKILL.md`.
4. Say which area the method came from.

## Which area when

**The usual questions**

- "Are the books right? How do I record this?" → `build-financial-statements`
- "We made a profit, so where is the cash?" → `cash-flow-analysis`
- "How well are we doing against peers, and which lever do we pull?" → `ratio-analysis`
- "Can I trust these accounts?" → `earnings-quality`
- "What does next year look like, and how much funding do we need?" → `pro-forma-forecasting`
- "What does this product, job or customer really cost?" → `product-costing`
- "Why did we miss budget?" → `variance-analysis`
- "Make or buy, take this order, drop this line?" → `relevant-cost-decisions`
- "Should we buy this equipment, open this site, lease or buy?" → `capital-budgeting`
- "What discount rate or hurdle rate?" → `cost-of-capital`
- "What is it worth?" → see the valuation line below
- "How much debt should we carry? Dividend or buyback?" → `capital-structure-decisions`
- "Which loan offer is cheaper? Should we refinance?" → `bond-and-debt-analysis`
- "Will this customer or borrower pay? How is our loan book doing?" → `credit-analysis`
- "We buy or sell in another currency: what is the exposure and the hedge?" → `currency-and-international-finance`
- "What is the right to wait, expand or walk away worth?" → `real-options`
- "Where do we put surplus cash? Is this fund any good?" → `portfolio-construction`, `investment-performance-and-pricing`
- "Should we raise, from whom, on what terms?" → `raising-startup-capital`; "Is $X for Y% fair?" → `startup-valuation-and-deal-math`
- "Should I invest in this startup?" → `vc-deal-screening`
- "I want to buy a small business" → `buying-a-small-business` (own money and a bank loan) or `small-business-acquisition-eta` (investors behind you)

**Look-alikes, told apart**

- **Valuation:** `dcf-valuation` values a whole business or project on its forecast cash flows; `valuation-multiples-and-deals` prices it fast from comparables and sets what to pay in a deal (synergies, walk-away); `equity-valuation` values a public company's shares (P/E, dividends, residual income); `private-company-valuation` values a private buyout target on adjusted EBITDA times a multiple, checked by an LBO; `startup-valuation-and-deal-math` prices a venture round (pre- and post-money, dilution, SAFEs); `credit-analysis` values a book of loans or receivables (expected loss).
- `capital-budgeting` values a fixed plan; `real-options` adds the value of changing the plan later; the COO's `risk-decisions-under-uncertainty` decides act-now-or-wait when the odds come from judgement.
- `credit-analysis` asks whether a borrower will pay; `bond-and-debt-analysis` prices and compares the instrument itself (rates, yields, swaps); `capital-structure-decisions` sets how much debt we carry and how to fund a receivables book; `acquisition-debt-capacity` sizes debt for a buyout.
- `relevant-cost-decisions` is short-term (only the costs that differ); `capital-budgeting` is multi-year with discounting; `product-costing` allocates full cost; the COO's `cost-and-capacity-decisions` is the economist's view (marginal cost, output, market prices).
- `product-costing` says what things cost; `variance-analysis` says why actual differs from standard.
- `cash-flow-analysis` tells the cash story; `ratio-analysis` explains performance; `earnings-quality` decides whether the numbers can be trusted; run it first on anyone else's accounts.
- `pro-forma-forecasting` projects full statements; the CMO's `market-sizing-and-unit-economics` builds the revenue line from customers; the CMO's `new-product-forecasting` shapes adoption over time; the COO's `demand-forecast-distributions` gives a forecast with a spread for orders and buffers.
- `raising-startup-capital` is the founder's choice of source and terms; `startup-valuation-and-deal-math` is the arithmetic; `vc-deal-screening` is the investor's yes or no.
- Foreign projects: the rate lives in `cost-of-capital`, the NPV in `capital-budgeting`, the hedge in `currency-and-international-finance`.

**Often used together**

- Buy a company: `pe-deal-sourcing-screening` → `buyout-due-diligence` → `earnings-quality` → `private-company-valuation` → `lbo-model-returns` → `acquisition-debt-capacity` → `deal-process-and-terms` → `value-creation-and-exit`; after closing, `acquisition-accounting`.
- Value a business: `earnings-quality` → `pro-forma-forecasting` → `cost-of-capital` → `dcf-valuation` → `valuation-multiples-and-deals` as the cross-check.
- Approve an investment: `pro-forma-forecasting` → `cost-of-capital` → `capital-budgeting` → `real-options`, then the COO's `risk-decisions-under-uncertainty` for critical assumptions by headroom.
- Health check of a business or borrower: `cash-flow-analysis` → `ratio-analysis` → `earnings-quality` → `credit-analysis`.
- Fund a loan book: `credit-analysis` → `capital-structure-decisions` → `currency-and-international-finance` → `bond-and-debt-analysis`.
- Monthly review: `variance-analysis` → `product-costing` → `relevant-cost-decisions`.

## Areas

| Area | Use when | File |
|---|---|---|
| `build-financial-statements` | Record transactions and turn them into a correct balance sheet and income statement: when to recognise revenue, expenses, assets and liabilities, inventory cost flow (FIFO, LIFO, average), depreciation and impairment, adjusting entries, inferring missing figures and correcting errors. | `cfo/references/build-financial-statements.md` |
| `cash-flow-analysis` | Build a statement of cash flows from two balance sheets and an income statement, and read it to judge whether a business funds itself, can pay its way and reports earnings backed by cash; entity versus group cash. | `cfo/references/cash-flow-analysis.md` |
| `ratio-analysis` | Measure and explain profitability with ROE decompositions (DuPont and the operating ROA model, with the operating versus non-operating split), common-size statements, margins, turnovers and the cash conversion cycle, benchmarked over time and against peers. | `cfo/references/ratio-analysis.md` |
| `earnings-quality` | Judge whether reported profit and the balance sheet reflect real economics and adjust them before analysis: revenue-recognition traps, reserve roll-forwards, LIFO and asset-life adjustments, non-GAAP measures and warning signs, output sold before delivery (forward carbon credits), and headlines resting on a non-standard tax treatment. | `cfo/references/earnings-quality.md` |
| `pro-forma-forecasting` | Project the income statement and balance sheet from a few drivers (growth, margins, turnovers, leverage, payouts) with cash as the balancing item, after cleaning the base year first, and sanity-check the result; for budgets, funding needs, loan applications and as a valuation's base. | `cfo/references/pro-forma-forecasting.md` |
| `equity-valuation` | Estimate what a company's equity is worth with multiples (P/E, forward P/E, PEG), discounted dividends, free cash flow to equity and residual income, a CAPM cost of equity and a sensitivity range. | `cfo/references/equity-valuation.md` |
| `credit-analysis` | Assess the risk that a company fails to pay its debts (liquidity, solvency, coverage, bankruptcy score) as a lender, supplier or customer; and track, stress and value a consumer or small-business loan book (vintages, PAR, recoveries, expected loss). | `cfo/references/credit-analysis.md` |
| `acquisition-accounting` | Show how buying a stake appears in the buyer's accounts (fair value, equity method, consolidation with goodwill and non-controlling interest) and read group accounts that contain such stakes. | `cfo/references/acquisition-accounting.md` |
| `product-costing` | Work out what each product, job, batch, service line, order or customer really costs (job, process, operations or activity-based costing), and redesign a system that cross-subsidises. | `cfo/references/product-costing.md` |
| `variance-analysis` | Set standard costs and flexible budgets, split actual-versus-budget gaps into price, efficiency and volume variances, see how absorption versus variable costing moves profit, and judge when cost variances or operating measures (quality, throughput) should run control. | `cfo/references/variance-analysis.md` |
| `relevant-cost-decisions` | Short-term operating choices (make or buy, special order, drop a product or customer, scarce resource, keep or replace equipment, break-even) argued only on future costs and revenues that differ. | `cfo/references/relevant-cost-decisions.md` |
| `capital-budgeting` | Decide whether to spend now for cash later (equipment, a site, a product, lease or buy, invest abroad) with incremental cash flows and NPV, including long-lived assets, inflation, subsidised financing and foreign-currency projects. | `cfo/references/capital-budgeting.md` |
| `cost-of-capital` | Estimate the discount rate for a business, division or project (CAPM, cost of debt, unlevered cost, WACC), including private firms and foreign projects (rate conversion, country risk). | `cfo/references/cost-of-capital.md` |
| `dcf-valuation` | Value a whole business, unit or large project from forecast free cash flows and a terminal value (WACC, APV or flow-to-equity), then bridge enterprise value to equity per share. | `cfo/references/dcf-valuation.md` |
| `valuation-multiples-and-deals` | Price a business fast from comparable companies or transactions (EV/EBITDA, EV/revenue, P/E) and decide what to pay or accept in a deal: synergies, walk-away price, cash versus stock, equity given to an investor. | `cfo/references/valuation-multiples-and-deals.md` |
| `capital-structure-decisions` | Decide how much debt to carry and how to return cash to owners (tax shields, distress costs, recaps, dividends versus buybacks); fund a receivables book with asset-backed and blended finance (SPV, advance rate, waterfall, first-loss and DFI layers, currency hedging, blended cost of funds). | `cfo/references/capital-structure-decisions.md` |
| `bond-and-debt-analysis` | Price and compare bonds, loans and notes: convert quoted rates, loan payments and payoffs, yield versus expected return, default and interest-rate risk, and interest rate and currency swaps. | `cfo/references/bond-and-debt-analysis.md` |
| `currency-and-international-finance` | Buy, sell, borrow or invest in a foreign currency: FX quotes and forward points, a bank's price, covered interest parity, transaction, translation and economic exposure, and the hedge (forward, money-market, FX swap, currency swap, natural). | `cfo/references/currency-and-international-finance.md` |
| `real-options` | Value flexibility (expand, abandon, wait, buy later) or a contract's purchase, renewal or exit right with decision trees and binomial trees using risk-neutral probabilities. | `cfo/references/real-options.md` |
| `portfolio-construction` | Build a portfolio for surplus cash, a reserve or an owner: risk and return, diversification, the best risky mix and the safe share for a risk tolerance. | `cfo/references/portfolio-construction.md` |
| `investment-performance-and-pricing` | Judge whether a fund or manager earned its return (Sharpe, Treynor, alpha, information ratio, M-squared), what an asset should earn (CAPM, multifactor), and whether beating the market is realistic. | `cfo/references/investment-performance-and-pricing.md` |
| `pe-deal-sourcing-screening` | Find and rank companies worth buying with an investment thesis, quantitative screens and a qualitative short-list; decide which inbound deals deserve time. | `cfo/references/pe-deal-sourcing-screening.md` |
| `buyout-due-diligence` | Diligence a chosen target before the LOI is final or the agreement is signed, so price, terms and the plan reflect what was found. | `cfo/references/buyout-due-diligence.md` |
| `private-company-valuation` | Value a private company for a buyout or sale on adjusted EBITDA and a multiple justified against comparables, checked by an LBO return test. | `cfo/references/private-company-valuation.md` |
| `lbo-model-returns` | Build a leveraged buyout model: IRR, MOIC, credit statistics, sensitivities and where the return comes from. | `cfo/references/lbo-model-returns.md` |
| `acquisition-debt-capacity` | Size the debt an acquisition can carry, from which lenders, in which tranches and on what terms, tested against coverage limits. | `cfo/references/acquisition-debt-capacity.md` |
| `deal-process-and-terms` | Run an acquisition from teaser to closing (NDA, IOI, LOI, purchase agreement) and structure terms: price adjustments, seller notes, earn-outs, escrow, rollover, reps, indemnities, asset versus stock. | `cfo/references/deal-process-and-terms.md` |
| `value-creation-and-exit` | Plan value creation after an acquisition (100-day plan, growth, cost, add-ons, deleveraging) and prepare and choose the exit. | `cfo/references/value-creation-and-exit.md` |
| `small-business-acquisition-eta` | Buy and run a company of roughly $1.5M to $5M EBITDA with investors behind you (search fund, independent sponsor, family office, long-hold vehicle): vehicle, searcher economics, winning the seller, structure, handover. | `cfo/references/small-business-acquisition-eta.md` |
| `buying-a-small-business` | Become an owner-operator by buying a small business of roughly $0.5M to $3M EBITDA with your own money and a bank (SBA) loan: start or buy, criteria, search funnel, add-backs, debt coverage, handover. | `cfo/references/buying-a-small-business.md` |
| `startup-valuation-and-deal-math` | Value an early-stage company and work out what an investment buys: pre- and post-money, ownership, dilution, SAFE and note conversion, MOIC, IRR, fund impact. | `cfo/references/startup-valuation-and-deal-math.md` |
| `vc-deal-screening` | Screen, diligence and decide on an early-stage investment as an angel, fund or corporate investor, and write the investment memo. | `cfo/references/vc-deal-screening.md` |
| `raising-startup-capital` | Help a founder decide whether to bootstrap or raise, where to raise (friends and family, angels, accelerators, VC, debt, grants), pick the instrument (SAFE, note, priced equity), structure debt and the deal, and negotiate the term sheet. | `cfo/references/raising-startup-capital.md` |

## Areas owned by other roles

- **CEO** (`ceo`): `competitive-strategy`, `industry-analysis`, `platform-and-technology-strategy`, `competitive-moves`, `corporate-strategy`, `incentives-and-information`, `healthcare-business-economics`, `board-meetings`, `nonprofit-board-governance`, `consulting-engagement`, `negotiation-deal-making`, `complex-negotiations-and-disputes`, `business-plan-and-pitch`
- **COO** (`coo`): `process-capacity-and-cycle-time`, `queue-and-service-capacity`, `inventory-replenishment-policy`, `one-shot-order-sizing`, `demand-forecast-distributions`, `inventory-pooling-and-flexibility`, `supply-contracts-and-coordination`, `quality-control-and-lean-operations`, `cost-and-capacity-decisions`, `disruption-exposure-mapping`, `disruption-response-planning`, `project-management`, `risk-decisions-under-uncertainty`, `risk-and-compliance`, `healthcare-quality-and-operations`
- **CMO** (`cmo`): `market-entry-and-go-to-market`, `market-sizing-and-unit-economics`, `pricing-strategy`, `consumer-behavior-marketing`, `brand-and-positioning`, `digital-marketing-and-channels`, `new-product-forecasting`, `opportunity-validation`, `strategic-communication-plan`, `crisis-communication`, `business-storytelling`
- **CHRO** (`chro`): `team-launch-and-charter`, `team-conflict-trust-and-feedback`, `group-decision-making`, `leading-and-motivating-people`, `leading-change`, `power-and-influence`, `people-analytics`
- **CDO** (`cdo`): `data-visualisation-and-dashboards`, `data-preparation-and-analysis`, `analytics-for-decisions`
