# Capital structure and payout decisions

> **Area:** `capital-structure-decisions` · owned by the CFO skill. **Use when:** Decide how much debt a business should carry and how to pay cash back to owners - the value of interest tax shields, the costs of financial distress, leveraged recapitalizations and buybacks, and dividends versus repurchases. Use when a business considers borrowing, refinancing into a buyback, or setting a payout policy; and to fund a receivables book with asset-backed and blended finance (SPV, advance rate, waterfall, DFI and first-loss layers, currency hedging, blended cost of funds).

**Outcome:** a reasoned debt level and payout plan, with the dollar value of the tax benefit,
the risks it adds, and the effect on share price, cost of equity and WACC.

## When to use
- "Should we borrow on our credit line and buy back shares / pay a special dividend?"
- "How much debt is too much?"
- An owner wants to take cash out; a lender offers more debt; a recap or buyout is proposed.
- Choosing between dividends and repurchases.

## Method

### 1. Start from the perfect-market benchmark (Modigliani–Miller)
With no taxes, no transaction or distress costs and fair prices:
- Firm value (debt + equity) does not depend on the debt mix (MM1).
- The cost of equity rises with leverage: r_E = r_U + (D/E)(r_U − r_D) (MM2), so the overall cost
  of capital stays at r_U.
Lesson: debt only creates value through frictions. "Debt is cheaper than equity" is not a reason
on its own, because adding debt makes the remaining equity riskier and more expensive.

### 2. Leverage and ROE: a trap
ROE = net margin × asset turnover × assets/equity, so more debt raises ROE. But shareholders also
demand a higher return for the extra risk, so a higher ROE alone creates no value. Judge debt by
its effect on value, not on ROE or EPS.

### 3. Value the tax benefit
- Interest is tax-deductible; payouts to equity are not. Annual saving = τ × r_D × D.
- Permanent (rolled-over) debt D: PV(tax shield) = τ × D (discount at r_D).
- Debt on a fixed schedule: discount each year's τ × interest at r_D. Debt that tracks value
  (target D/V): discount at r_U, or let the WACC carry it.
- The benefit is real only if the firm has taxable profits to shield, and may be capped
  (US rule limits net interest deduction to about 30% of EBIT).

### 4. Subtract the costs of financial distress (trade-off theory)
V_L = V_U + PV(tax shields) − PV(expected costs of financial distress)
- Distress costs: lost customers and suppliers, staff leaving, forced asset sales, legal fees,
  management distraction, under-investment. They grow fast as debt rises.
- Target the debt level where an extra dollar of tax saving is just offset by extra expected
  distress cost. Signs you are past it: thin interest cover, covenants near breach, a
  speculative-grade rating, volatile or cyclical cash flows, intangible assets that lose value in distress.
- Practical check (standard practice): stress-test interest and principal
  against a bad-year cash flow, and keep a liquidity cushion.

### 5. Walk through a leveraged buyback
1. On announcement, the market adds PV(tax shield) to value: new price = (V_U + τD) / shares.
2. The firm borrows D (cash and debt rise; equity value unchanged).
3. It repurchases shares at the new price: shares bought = D / new price.
4. After: equity = V_U + τD − D; price per share unchanged from step 1.
5. Relever beta and recompute r_E, EPS, P/E and WACC (see `cost-of-capital`). Note what the
   simple model omits: distress costs, lost flexibility, signalling.

### 6. Payout policy
- At fair prices, dividends and buybacks leave shareholders equally well off: a dividend lowers
  the share price by the dividend (ex-dividend); a buyback at market price leaves price per share unchanged.
- Total payout and dividends per share differ when share count changes; plan in per-share terms.
- Prefer flexible buybacks for uncertain or one-off cash; regular dividends for stable surplus
  (standard practice: dividend cuts are read badly by investors).
- Excess cash held inside the firm earns taxable interest and acts like negative debt.

### 7. Refinancing existing debt when rates fall
- A loan with a **prepayment** right can be paid off at its book balance (PV at the old rate); the
  borrower captures the rate drop.
- Without it (a straight bond), the borrower must buy the debt back at **market value** (PV at the
  new, lower rate), which hands the gain to the lender. Buying back at that price and reissuing is
  roughly zero NPV before costs.
- A **call** feature (right to redeem at about face value at set dates) gives the borrower the gain
  and lets it negotiate a lower buyback premium. Value of refinancing = PV(old payments avoided)
  − buyback price, net of new issue flows, at the new rate.
- Spreadsheet layouts for the recap (step 5) and the refinancing test: see
  cfo/references/capital-structure-decisions/recap-and-refinancing-models.md.

### 8. Asset-backed and blended finance
For a business whose main asset is a book of receivables (standard practice):
- **Pledge or sell:** borrow against the receivables (stays on balance sheet) or sell them into a
  bankruptcy-remote SPV; a **forward flow** commits a funder to buy new eligible receivables monthly.
- **Advance rate** = funding ÷ eligible receivables; **eligibility criteria** (not over 30 days late,
  concentration caps, at least one instalment paid) decide what counts. Ineligible loans need equity.
- **Waterfall:** cash pays fees, senior interest, reserves, senior principal, mezzanine, first loss,
  then the residual. Losses hit equity and first loss first, then mezzanine, then senior. Senior
  enhancement ≥ about 2 × the stressed loss rate.
- **Reserves and covers:** cash reserve of 3 to 6 months' senior interest; collateral and debt
  service cover; triggers that trap cash when arrears breach.
- **Blended layers:** DFIs in senior or mezzanine; concessional first loss or guarantees that make
  the senior safe for local banks; count reporting and fees as cost.
- **Currency:** hedging cost ≈ local rate minus dollar rate; compare every layer at its
  local-currency cost. Blended cost of funds = Σ share × all-in cost. Parity, forwards and
  hedge choice: `currency-and-international-finance`; currency swaps: `bond-and-debt-analysis`, section 7.

Example: 10m pool funded 70% local senior at 14%, 15% hedged dollar mezzanine at 17%, 10%
concessional first loss at 2%, 5% originator equity at 25%: blend 13.8%, about 14.5% with fees.
A drought loss of 14.7% uses up equity and first loss; senior and mezzanine stay whole.
Full method and the funding-versus-yield check:
`cfo/references/capital-structure-decisions/asset-backed-and-blended-finance.md`.

### 9. Acquisition debt and subsidised loans (from teaching cases)
- Acquisition leverage: lenders size opening debt by EBITDA-to-interest coverage and a cap on
  debt to value; plan to pay it down to the industry's normal ratio. Value with APV over the
  paydown, WACC after (see `dcf-valuation`, section 3).
- A below-market loan tied to an investment is worth the PV of the after-tax interest saving,
  added to the project's all-equity NPV; do not assume it will be there for the next project.
- Rights granted in contracts can raise your borrowing cost: a tenant's option to buy a building
  can make lenders charge more, because a sale could force early repayment. Count that cost when
  deciding whether to buy the right back (see `real-options`).

## Worked pattern
A debt-free firm worth $20m (1m shares at $20) borrows $5m permanently at 6% to buy back stock. Tax 25%.
- PV(tax shield) = 0.25 × 5 = $1.25m → price on announcement $21.25.
- Buyback: 5 / 21.25 = 235,294 shares; 764,706 remain.
- Equity after = 20 + 1.25 − 5 = $16.25m → $21.25 per share. Owners gained $1.25 a share.
- Annual interest $300k needs steady EBIT well above that in a bad year; if cash flow can fall
  below about 3x interest, the expected distress cost may eat the $1.25m.

## Common mistakes
- Saying debt is "cheap" while ignoring the rise in r_E.
- Chasing ROE or EPS growth from leverage.
- Counting tax shields in years with no taxable income.
- Re-weighting WACC with old r_E and r_D after a leverage change.
- Valuing a buyback of non-callable debt at face value instead of market value.
- Assuming dividends create value by themselves.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- Agency costs, signalling, pecking order and payout theory beyond neutrality are not covered.
