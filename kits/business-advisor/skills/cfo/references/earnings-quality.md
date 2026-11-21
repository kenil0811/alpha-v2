# Earnings quality and accounting adjustments

> **Area:** `earnings-quality` · owned by the CFO skill. **Use when:** Judge whether a company's reported profit and balance sheet reflect its real economics, find where management judgement can shift profit between periods, and adjust the numbers before analysis. Use before trusting a target's, competitor's, customer's or borrower's accounts, when profit and cash diverge, or when a policy change (useful lives, capitalisation, reserves) moves earnings, when output (such as carbon credits) is sold or financed before delivery, or when a headline depends on a non-standard tax treatment.

**Outcome:** a business avoids paying for, lending against or benchmarking itself to profits
that are not real, and knows which accounts to question and how to restate them.

## When to use

- Due diligence on an acquisition, a large customer's credit, or a supplier's stability.
- Profit rising while operating cash flow does not.
- A company changes an estimate (asset lives, reserves) or capitalises a new kind of cost.
- Comparing two firms that account for the same thing differently.

## Method

### 1. Why quality falls

- **Limits of the rules:** accounting is slow to recognise gains (it wants proof of a
  transaction), and estimates (lives, collectability, obsolescence) can simply be wrong.
- **Manipulation:** needs a **motive** and the **means**.
  - Motives: meeting a benchmark (analyst forecast, zero profit, last year's figure), bonus
    targets, an upcoming share issue or loan, debt covenants. Distributions of reported
    earnings show a suspicious bunching just above zero and just above forecasts.
  - Means: accounts where the rules require judgement, and weak oversight.

### 2. Map the means: the four timing cases

Whenever cash and recognition happen at different times, a balance sheet account sits between
them, and its size is a management estimate. Over the life of the item, total expense or
revenue must equal total cash; judgement only moves it between periods.

| Case | Timing | Accounts | Overstated-profit risk | Detection |
|---|---|---|---|---|
| I | Cash paid before expense | Prepaids, inventory, PPE, capitalised costs (content, software, development) | Capitalising costs with no future benefit; lives too long; slow write-downs | Asset turnover falling; asset growing faster than sales |
| II | Expense before cash paid | Accruals, warranty, royalty, restructuring, contingent liabilities | Liability set too low; or set too high now ("cookie jar") to release later | Liability relative to sales or cost moving oddly |
| III | Revenue before cash | Receivables, allowance for doubtful accounts | Revenue booked early or not earned (channel stuffing, side deals); allowance too low | Receivables growing faster than sales; allowance falling relative to receivables |
| IV | Cash before revenue | Deferred (unearned) revenue | Recognising revenue before it is earned | Deferred revenue falling relative to sales |

For each, the effect of an aggressive choice: the asset is overstated (or the liability
understated), equity is overstated, current profit is overstated and future profit understated.
Conservative choices do the reverse.

### 3. Run the checks

1. From strategy, list the two or three accounts that matter most for this business
   (content for a streamer, receivables for a distributor, warranty for a manufacturer).
2. Turnover of each questionable account over time and against peers (sales / AR,
   cost of sales / inventory, sales / PPE, liability / sales).
3. Inventory: falling turnover with steady gross margin can mean slow write-downs; a big
   write-down followed by inflated gross margin can mean a "big bath".
4. Accruals: NI − CFO, its trend, and which accounts drive it (see `cash-flow-analysis`).
5. Notes: changes in estimates (useful lives, allowance rates), new capitalisation policies,
   contingent liabilities not recorded because "cannot be estimated", unusual year-end sales.
6. Motives in the current period: a share or debt issue, a near miss of a benchmark,
   compensation tied to the number.
7. Roll forward every reserve the notes give (returns, doubtful accounts, restructuring,
   deferred revenue): beginning + additions − uses = ending. Additions falling as a share of
   sales or receivables, uses exceeding additions for years, or reversals released into profit
   are the classic signs of a reserve run down to support earnings.
8. Asset estimates: average useful life (depreciable cost / depreciation) and percent used up
   (accumulated depreciation / depreciable cost) against peers; LIFO liquidations lifting margins;
   gains on disposals (past depreciation too high) and impairments (past depreciation too low).
9. Screen with the red-flag list and read any "adjusted" earnings against GAAP:
   `cfo/references/earnings-quality/non-gaap-and-red-flags.md`.

Depth for each account, with the tests and the adjustments:
`cfo/references/earnings-quality/revenue-and-receivables.md` (revenue recognition traps, returns
and doubtful-account allowances, deferred revenue, currency) and
`cfo/references/earnings-quality/operating-assets.md` (inventory and LIFO, PPE lives and
impairments, R&D, restructuring).

### 4. Adjust the numbers

- **Depreciation life change:** recompute depreciation on the economic life. Annual effect ≈
  depreciable base × (1/new life − 1/old life). Capitalised at the market's price/earnings or
  price/pre-tax-profit multiple, a small expense change can be a large value change.
- **Capitalised costs you would expense:** add the period's capitalised amount to expense,
  remove the year's amortisation, and write the asset off against equity.
- **Reserves:** restate the allowance or liability to a peer-like ratio of sales or receivables;
  the difference hits profit (this year's change) and equity (the balance).
- **Revenue timing:** move deposits and multi-period contracts back into deferred revenue.
- **Different policies across firms:** restate one to the other's policy before comparing
  (see `build-financial-statements`, step 7).
- **Allowances (returns, doubtful accounts):** reset each year to the multi-year average ratio
  (to gross sales or gross receivables); the yearly change moves profit, the cumulative after-tax
  change moves retained earnings.
- **LIFO to FIFO:** inventory + reserve; tax liability + reserve × t; retained earnings + reserve
  × (1 − t); cost of sales − increase in reserve.
- **Transitory items:** use income from continuing operations; spread large disposal gains,
  severance and write-downs back over the years they belong to when those years feed a forecast.

State the adjustment, its effect on profit, equity and key ratios, and whether it reverses.

### 5. Revenue paid before it is earned, and tax versus book timing

Standard practice (revenue rules in the style of IFRS 15 / ASC 606).

**Pre-sold or pre-financed output** (case IV at its sharpest): carbon credits sold forward,
offtake prepayments, pre-orders.

- Cash received for credits or goods not yet delivered is a **contract liability**, not revenue.
  Revenue comes when the promised thing is transferred: for carbon credits, when the registry has
  issued them and they move to the buyer's account (registries and verification:
  `coo/references/risk-and-compliance.md`).
- If under-delivery must be repaid in cash, or the price builds in a return to the buyer, the
  prepayment is closer to **debt**: show it with borrowings and accrue the implied interest.
- Ask: how many credits are contracted versus issued to date; what happens on shortfall; who bears
  a price fall; is any of the cash already spent. A model that books the full forward contract as
  income in the year of signing overstates profit and hides a liability.

**Tax basis versus book basis:**

- Tax law can time income differently from the accounts: cash or instalment basis for credit sales
  (taxed as cash arrives), advance receipts taxed when received, special reliefs for green income.
  Timing differences create deferred tax; they move cash between years, they do not remove tax.
- A headline (after-tax IRR, year-1 cash, payback) that rests on a non-standard treatment must be
  shown **both ways**: under the treatment claimed and under the standard one, with the status of
  any ruling. Only a written ruling or clear law makes the claimed case the base case.

Example: a business sells 1,000 of equipment on credit (gross profit 300, tax 30%) and receives a
200 carbon prepayment for credits to be issued next year. Under the standard treatment it pays
90 of tax on the sale this year (accrual basis) and 60 on the prepayment (taxed on receipt). Under
the claimed treatment (instalment basis with 55% collected this year; carbon taxed on delivery) it
pays 49.5 this year. Year-1 cash differs by 100.5; the plan must show both. In the accounts, the
200 stays a liability until the credits are issued; if only 70% are issued, revenue is 140 and 60
stays owed.

### 6. Conclude

Say whether, in your view, the statements fairly reflect performance, which items could distort
ratio and price/earnings comparisons, and what you would ask management.

## Worked pattern

A logistics firm extends the useful life of its 1,200 of vehicles from 4 to 6 years, the year
before raising new equity. Annual depreciation falls from 300 to 200, lifting pre-tax profit
from 500 to 600, a 20% rise. Fleet replacement records show trucks actually retired after
about 4.5 years.

- Motive: share issue. Means: an estimate the auditor will accept.
- Adjusted depreciation on a 4.5-year life ≈ 267; adjusted pre-tax profit ≈ 533, not 600.
- Value at 12 times pre-tax profit: the change adds about 1,200 of apparent value, about 800
  of which is not supported by the fleet data.
- Ask management: what evidence supports six years; what are resale values at year 5?

## Common mistakes

- Treating an estimate change as value creation; unless the asset is really used longer, cash
  and value are unchanged.
- Flagging every gap between profit and cash; growth and one-off events also create accruals.
  Find the source first.
- Ignoring liabilities: a too-small accrual, or a too-large reserve released later, moves
  profit as surely as an inflated asset.
- Missing operating costs hidden in investing cash flows.
- Judging capitalisation without judging the asset: whether capitalising content or software is
  appropriate depends on whether the asset will really produce future revenue.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps

- Income taxes in depth, leases, pensions and derivatives are not covered.
