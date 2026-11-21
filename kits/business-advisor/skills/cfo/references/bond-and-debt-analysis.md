# Bond and debt analysis

> **Area:** `bond-and-debt-analysis` · owned by the CFO skill. **Use when:** Price and compare bonds, loans and notes - convert quoted rates, compute loan payments and payoff balances, find yield to maturity versus expected return, judge default and interest-rate risk, and reshape debt with interest rate and currency swaps. Use when a business borrows, refinances, invests surplus cash in fixed income, or compares loan offers.

**Outcome:** the true cost of a loan or bond, its fair price, and a clear view of its two main
risks (default and interest rate), so a business borrows or invests on comparable terms.

## When to use
- Comparing loan or lease offers quoted in different ways.
- Working out a loan payment, an amortization table or a payoff amount.
- Pricing a bond or note, or judging if a yield is worth the risk.
- Deciding whether to refinance (see also `capital-structure-decisions`, step 7, and its
  cfo/references/capital-structure-decisions/recap-and-refinancing-models.md for the prepay, buyback and reissue worksheet).

## Method

### 1. Put every rate on the same footing
- Periodic rate r, k periods a year: APR = k × r; EAR = (1 + r)^k − 1 = (1 + APR/k)^k − 1.
- Quote with APR; discount with the periodic rate or EAR. Bonds quote coupon rates and yields as
  APRs with semiannual compounding (k = 2).
- Real vs nominal: real ≈ nominal − inflation. Rates are nominal unless stated.

### 2. Loans
- Payment: solve PV = PMT × (1 − (1 + r)^−N) / r for PMT (Excel PMT), with r per period.
- Amortization table: interest = rate × opening balance; principal = payment − interest; the
  balance ends at exactly zero.
- Balance at any time = PV of remaining payments at the **loan's own rate**.
- Implied rate of an offer with irregular payments: IRR of the borrower's cash flows.

### 3. Bonds: terms and cash flows
- Face value (usually $1,000), coupon rate (APR, semiannual), maturity. Fixed at issue.
- Coupon per period = coupon rate / 2 × face. Zero-coupon bonds pay only face at maturity.
- Price = PV of coupons (annuity) + PV of face, at the periodic yield.
- Coupon rate = YTM ⇔ price = face. YTM above coupon → price below face (discount), and vice versa.

### 4. YTM vs expected return
- **YTM** = IRR of the **promised** payments (×2 to state as APR). It is what you earn only if every
  payment arrives and coupons are reinvested at the YTM.
- **Expected return** = IRR of the **expected** payments. With default risk it is below YTM.
  Rough rule: r_D ≈ YTM − p × L (p yearly default probability, L loss given default).
- Never say you "expect" to earn the YTM on a risky bond.

### 5. Default (credit) risk
- Ratings (S&P / Moody's / Fitch) cover default risk only. AAA–BBB is investment grade; BB and
  below is speculative ("high yield", "junk").
- Investment-grade default rates stay well under 1% a year even in recessions; speculative grade
  can exceed 10% in bad years. Recovery on defaulted corporate bonds runs roughly 25–50%.
- A falling price on a risky bond with unchanged promised payments means the YTM rose.

### 6. Interest-rate risk
- When market yields rise, existing bond prices fall (fixed payments, better rates elsewhere).
- Longer maturity → more sensitive. Long Treasuries have no default risk but large rate risk;
  the two risks are separate.
- Term structure: yields by maturity (yield curve). Short rates follow the central bank; long
  rates reflect expected future rates, inflation and a term premium. Liquidity risk adds a premium too.
- Match the maturity of investments of surplus cash to when the cash is needed (standard practice).

### 7. Swaps: change the shape of debt without refinancing
A swap exchanges two streams of payments on a notional amount, like two bonds traded against
each other, under an ISDA master agreement. It is worth zero when struck; afterwards rate or
currency moves make one side's gain the other's loss.
- **Interest rate swap (one currency):** fixed against floating (SOFR; LIBOR in older deals). No
  principal changes hands; each period only the net difference is paid.
  - Fixed-rate borrower who wants floating: **receive fixed, pay floating**. Floating-rate
    borrower who wants fixed: **pay fixed, receive floating**.
  - Quote: swap spread bid–ask over the Treasury yield of that maturity. The bank pays fixed at
    Treasury + bid and receives fixed at Treasury + ask; you get the worse side.
  - Per half-year: fixed leg 0.5 × fixed rate × notional; net payment 0.5 × (fixed − floating) ×
    notional, paid by whichever is higher.
  - Why: match debt to how cash flows move (a business whose cash falls in downturns may prefer
    fixed, so payments don't rise when it is weakest; short-term floating debt can also be cut off);
    lock today's rate before a rise; shave funding cost. A view on rates is speculation, not a hedge.
- **Currency swap:** exchange principals at spot at the start, pay interest on the currency you
  received, receive interest on the one you paid, and re-exchange the same principals at
  maturity. It turns existing debt in one currency into debt in another, to match revenue in that
  currency or to borrow where the firm gets better terms. Quotes are fixed rates in each currency
  against the same dollar floating rate; receive at the bank's bid, pay at its offer.
- **Exit:** a mirror swap with another bank, or pay or receive the market value to terminate.
- **Forerunners:** parallel loans (two contracts, no right of offset) and back-to-back loans (with
  offset); a swap is one contract and nets on default.
- Formulas and layouts: `cfo/references/currency-and-international-finance/formula-sheet.md`,
  sections 8–9.

## Worked pattern
A company can buy a 5-year note: face $1,000, 6% coupon (semiannual), market yield 7% APR.
- Coupon = $30 per half-year; periodic yield 3.5%; 10 periods.
- Price = 30 × (1 − 1.035^−10)/0.035 + 1,000/1.035^10 = 249.5 + 708.9 = **$958.42** (a discount).
- EAR of the yield = 1.035² − 1 = 7.12%.
- If the issuer has a 2% yearly default chance with 60% loss: expected return ≈ 7% − 1.2% = 5.8%,
  so compare it with safer 5-year paper, not with the 7% headline.

**Swaps.** A firm has a $20m 5-year floating loan and wants fixed. The bank quotes a 5-year swap
spread of 0.50–0.55% over a 4.00% Treasury. The firm pays fixed at 4.55% and receives SOFR: fixed
leg 0.5 × 4.55% × $20m = $455,000 a half-year; if SOFR is 4.0% that period, the firm pays a net
$55,000. Its all-in cost is 4.55% plus its loan's margin over SOFR.
A US firm with $40m of dollar debt now earns in euros (spot $1.08/€; bank quotes USD 4.40–4.50%,
EUR 2.80–2.90% against SOFR). Start: it pays $40m, receives €37.04m. Each half-year: receives
0.5 × 4.40% × $40m = $880,000 (toward its dollar coupon), pays 0.5 × 2.90% × €37.04m = €537,037.
Year 5: pays €37.04m, receives $40m to repay the loan. Net: euro debt matched to euro revenue; if
its dollar coupon is 5.0%, the 0.60% gap stays a dollar cost.

## Common mistakes
- Discounting with the APR or forgetting to halve the coupon and the yield.
- Treating YTM as the expected return on risky debt.
- Assuming a high rating means low rate risk (it says nothing about maturity).
- Paying off a straight bond "at face" when only a buyback at market value is possible.
- Comparing loans by APR when fees or compounding differ (compare EAR or IRR of all flows).
- In a swap, taking the bank's better side of the quote, or forgetting that only the net
  interest moves in a one-currency swap but full principals move in a currency swap.
- Calling a swap a hedge when it creates the exposure (paying floating on fixed-rate debt
  because rates "should" fall).

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- Duration and convexity, callable-bond pricing and yield-curve models are not covered (only
  intuition on maturity and calls).
- Default and recovery ranges are summarised; use current rating-agency studies for figures.
- Swap valuation after inception (pricing each leg off the yield curve) is not covered.
