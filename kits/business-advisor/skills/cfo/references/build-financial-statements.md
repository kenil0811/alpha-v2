# Build and read the financial statements

> **Area:** `build-financial-statements` · owned by the CFO skill. **Use when:** Record a business's transactions and turn them into a correct balance sheet and income statement, including when to recognise revenue, expenses, assets and liabilities. Use when bookkeeping is in doubt, when an entry or error must be corrected, or when a missing figure (cash collected, dividends, write-offs) must be inferred from the statements.

**Outcome:** a business gets statements it can trust: every transaction recorded in the right
period, every balance explainable, and missing numbers worked out from what is published.

## When to use

- "Did we make money this month, and why does the bank balance not match?"
- Deciding whether a deal, deposit, order or prepayment belongs on the books yet.
- Correcting an entry that was missed or booked wrongly, and seeing its effect on assets,
  liabilities, equity and profit.
- Inferring a figure the statements do not show directly (cash collected from customers, rent
  paid, dividends declared, bad-debt write-offs, impairment).
- Reading a set of accounts for the first time (annual report, 10-K, a supplier's accounts).

## Method

### 1. Know the map

- **Balance sheet** (a point in time): Assets = Liabilities + Shareholders' equity (SE).
  SE = contributed capital + retained earnings (RE).
- **Income statement** (a period): Revenue − Expenses = Net income (NI). NI flows into RE.
- **Statement of shareholders' equity:** RE(end) = RE(start) + NI − dividends declared.
- **Cash flow statement:** explains the change in cash (see the `cash-flow-analysis` skill).
- In an annual report, start with the business description, then the income statement and
  balance sheet, then the notes for anything large or unusual.

### 2. Recognition tests

- **Asset:** a probable future benefit, that the firm controls, from a past transaction.
- **Liability:** a probable future sacrifice (an obligation), from a past transaction, that
  can be measured with reasonable reliability.
- **Unexecuted contracts** (an order placed, nothing delivered or paid on either side) create
  neither. Once one side performs (delivery or payment), record the asset and the obligation
  for the part performed only.
- **Revenue:** recognise when it is earned (the goods or service delivered) and collection is
  reasonably assured. Cash timing does not matter. Cash before delivery is a liability
  (deferred or unearned revenue); delivery before cash is a receivable.
- **Expense:** recognise when the resource is used up to earn revenue (matching). Cash paid in
  advance is an asset (prepaid); cost used but not yet paid is a liability (accrued, payable).
- **Long jobs:** percentage of completion recognises revenue and cost as work progresses
  (commonly measured by cost incurred over total expected cost); completed contract waits until
  the end. Policy must be applied consistently.
- **Uncollectible accounts:** estimate bad-debt expense when the sale is made (allowance);
  a later write-off moves amounts between the allowance and receivables, with no new expense.

### 3. Record every transaction as an entry

Use the equation, with the sign of each effect: (+A), (−A), (+L), (−L), (+SE), (−SE).
Revenue is +SE, expense is −SE. Every entry must keep the equation balanced.

Common patterns:

| Event | Entry |
|---|---|
| Owner puts in cash or equipment | +A (cash, PPE) / +SE (contributed capital) |
| Buy on credit | +A (inventory, PPE) / +L (payable) |
| Pay a supplier | −L (payable) / −A (cash) |
| Pay next month's rent | +A (prepaid) / −A (cash) |
| Use up prepaid rent | −SE (expense) / −A (prepaid) |
| Wages earned, not paid | −SE (expense) / +L (wages payable) |
| Sell on credit | +A (receivable) / +SE (revenue); and −SE (cost of sales) / −A (inventory) |
| Customer pays in advance | +A (cash) / +L (deferred revenue) |
| Declare a dividend | −SE (RE) / +L (dividends payable); not an expense |
| Sell an asset below book value | +A (cash), −A (asset at book value), −SE (loss) |

### 4. Close the period with adjusting entries

At period end, check: prepaid items used up, wages and utilities owed, revenue earned on
deposits received, depreciation and amortisation, bad-debt estimate, inventory counted. Then
draw up income statement, then RE, then balance sheet. Check A = L + SE.

### 5. Infer missing figures with a T-account

Any balance obeys: **Beginning balance + additions − reductions = Ending balance.**
Pick the account that holds the unknown (not cash, which mixes everything), write all the
flows that touch it, and solve.

- Cash collected from customers = AR(begin) + credit sales − AR(end) − write-offs.
- Cash paid for rent = prepaid(end) + rent expense − prepaid(begin).
- Dividends declared = RE(begin) + NI − RE(end).
- Dividends paid = dividends payable(begin) + declared − dividends payable(end).
- Write-offs = allowance(begin) + bad-debt expense − allowance(end).
- Impairment of an asset not depreciated = begin + purchases − disposals − end.
- Purchases = cost of sales + inventory(end) − inventory(begin).

### 6. Correct errors in three lines

Write (a) the entry actually made, (b) the correct entry, (c) the adjustment = (b) − (a).
Read the adjustment's effect on total assets, liabilities (split current and non-current if
asked), equity and NI. Then restate the reported totals: reported + adjustment.

Rules of thumb: an error that touched only the balance sheet leaves NI unchanged; an error in a
past period's NI shows up in this period's RE, not this period's NI; ignore taxes unless asked.

### 7. Restate to an alternative policy

To compare a firm with a peer that uses a different method (cash basis for restructuring
costs, immediate revenue recognition instead of deferral):

- Find the balance sheet account the policy creates (accrued restructuring, deferred revenue).
- Alternative NI = reported NI ± the change in that account over the year (for example,
  removing a deferral raises NI by the increase in deferred revenue).
- Alternative balance sheet: remove the account; move its full balance into RE.

### 8. Record the judgement-heavy operating accounts

The standard textbook treatment of revenue and operating assets:

- **Revenue:** recognise when control passes, in five steps (contract, distinct promises, price,
  allocation by stand-alone prices, delivery). Net sales = gross sales − expected returns and
  discounts. Cash received first is deferred revenue (a liability). Long-term contracts: revenue
  = contract price × costs to date / expected total costs; costs beyond billings are a contract
  asset, billings beyond revenue a contract liability.
- **Receivables:** record the estimated uncollectible amount as bad-debt expense and an allowance
  (aging method: loss rates rising with days past due). A write-off reduces receivables and the
  allowance together and leaves profit unchanged.
- **Inventory:** cost of sales = beginning inventory + purchases − ending inventory, with the cost
  of units sold picked by FIFO, LIFO or average cost. Write inventory down to market when lower;
  the loss goes in cost of sales. A LIFO user discloses its LIFO reserve (FIFO − LIFO inventory).
- **PPE:** capitalise all costs to put the asset in use; depreciate (cost − salvage) over the
  useful life (straight line unless use is uneven). On sale, gain or loss = proceeds − net book
  value. If expected undiscounted cash flows fall below book value, write down to fair value.
- **R&D:** expense as incurred (US GAAP), except general-use facilities and equipment.
- **Restructuring:** accrue severance and exit costs when the plan is approved; write down the
  affected assets; pay the accrual down later.

Tests and analyst adjustments for each: `cfo/references/earnings-quality/revenue-and-receivables.md`
and `cfo/references/earnings-quality/operating-assets.md`.

## Worked pattern

A workshop starts the year with receivables of 40 and a deferred-revenue balance of 10. During
the year it bills 500 on credit, ends with receivables of 70, and ends with deferred revenue of
25 (customers' deposits for jobs not yet done).

- Cash collected on credit sales = 40 + 500 − 70 = 470.
- An entry for a 12 deposit was booked as revenue in December, but the job is in January.
  Actual: +A 12 / +SE (revenue) 12. Correct: +A 12 / +L 12. Adjustment: −SE 12 / +L 12.
  Effect: assets unchanged, liabilities +12, equity −12, NI −12.
- To compare with a competitor that books deposits as revenue on receipt: NI would be higher by
  the increase in deferred revenue (25 − 10 = 15); liabilities lower by 25; equity higher by 25.

## Common mistakes

- Treating a signed order as an asset or liability before anyone performs.
- Recording a dividend as an expense, or recording a dividend paid as the dividend declared.
- Solving inference problems in the cash account; use the account that holds the unknown.
- Forgetting the matching entry for cost of sales when a sale is recorded.
- Booking all of a prepayment or annual policy as this period's expense; split by months used.
- Treating a gain or loss on an asset sale as the cash received (the cash is the sale price).
- Confusing write-offs with bad-debt expense.
- When correcting errors, giving the change instead of the restated amount, or vice versa; check
  which one is needed.
- Restating to another policy and forgetting the balance sheet side (the cumulative effect
  sits in retained earnings).

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps

- Taxes (deferred taxes) and leases are not covered.
