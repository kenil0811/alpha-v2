# Searcher buyout model and investor economics

How to lay out the model a searcher uses to price a deal and split the proceeds between investors and the searcher. The structure follows the Stanford search fund primer's economics chapter; the numbers below are our own.

## Model layout (one workbook)

1. **Inputs**
   - LTM revenue and adjusted EBITDA (lender-accepted add-backs only).
   - Purchase multiple; transaction fees.
   - Senior debt (x EBITDA, rate, amortisation); seller note (x EBITDA, rate, interest-only years); earn-out terms.
   - Search capital and its step-up on conversion (commonly 150% credit).
   - Investor security: Structure 1 or 2 (below), coupon or preferred return.
   - Searcher equity: total %, three tranches, vesting schedule, IRR hurdles.
   - Operating cases: revenue growth, annual margin change, working capital as % of revenue growth, capex per year, cash tax rate, exit multiple, exit year.
2. **Capitalisation table at close:** each source in $, x EBITDA and % of total. Investor capital is the plug (total uses less debt less seller financing). A typical search shape: senior about 1x, seller about 1x to 1.5x, investors about half or more.
3. **Projections, three cases:** optimistic, base, pessimistic. A primer-style set: growth 20% / 12.5% / 0%, margin +0.5 / +0.25 / 0 points a year, exit 7x / 5.5x / 4x. Free cash flow sweeps debt (and, under Structure 2, redeems the Series A).
4. **Exit waterfall:** exit EV less net debt = equity; pay redeemable preferred balance; pay participating preferred (with any accrued return); split the remaining common between investors and vested searcher equity.
5. **Returns:** investor ROI and IRR (net of searcher equity), searcher payout, searcher vested %. The vesting depends on investor IRR, which depends on vesting: solve by iteration (a circular reference or a small loop).

## Investor security choices

| | Structure 1 | Structure 2 |
|---|---|---|
| Form | All capital in non-redeemable participating preferred | Half redeemable preferred (Series A), half non-redeemable participating preferred (Series B) |
| Return | Preferred return of about 5% to 8% accrues on all capital | Series A coupon about 10% to 17%; Series B 0% |
| Investor upside | Full participation on all capital | Full participation via Series B; Series A can be redeemed early ("chips off the table") |
| Searcher view | Coupon on 100% of capital; in a middling, slow-growth case the accrual can wipe out the searcher's equity and demotivate | Only half accretes; paying down Series A early raises IRR, speeds performance vesting, works like paying down debt |
| Main risk | Misalignment in mid outcomes; may push the searcher to take big risks | In a long, middling hold the high Series A coupon becomes heavy |

Around three quarters of recent US search deals used Structure 2 (primer, 2020 and 2021 editions). The two are roughly equivalent at some combinations of rates. In the UK most capital goes into redeemable preference shares or loan notes and a tiny slice into ordinary shares, which lets capital come back out of retained earnings and makes cheap employee options possible. Ask local investors before copying the US form abroad.

## Searcher equity mechanics

- 20% to 30% of common (solo up to about 25%, pair about 30%), in three equal tranches: at close; over 4 to 5 years of service; on performance.
- Performance tranche: usually straight-line from 20% to 35% net investor IRR (0% vested at 20%, half at 27.5%, all at 35%). Some use steps (20/25/30%).
- IRR suits holds under about 5 years; for longer holds use an ROI table or an IRR ladder that steps down over time, since a 20% IRR for ten years can be worth more to investors than 35% for two.
- If no liquidity event by year 5, some agreements let the searcher ask for a third-party valuation to test the hurdle; otherwise the board decides.
- Cross-border deals: set hurdles in local currency and raise the ladder by the inflation gap to the investors' currency (for example 5% local vs 1% US inflation turns 20-35% into 24-39%).
- Investors always get their capital back (often with a small return) before common equity has value.

## Worked pattern (our numbers, Structure 1)

Investor capital $7.0M at 7% non-cash preferred return; searcher 25% of common (8.33% at close, 8.33% time-vested by exit, 8.33% on a 20%-35% IRR ladder); exit in year 5.

- Preferred balance at exit: 7.0 x 1.07^5 = $9.8M.
- **Base case, exit equity $25M:** common = $15.2M. Iterating, investor IRR settles near 26%, so about 40% of the performance tranche vests: searcher holds about 19.8% of common, about $3.0M. Investors receive about $22.0M, 3.1x.
- **Strong case, exit equity $40M:** investor IRR about 36%, all tranches vest (25%); searcher about $7.6M; investors about $32.5M, 4.6x.
- **Weak case, exit equity $9M:** below the preferred balance; investors take all $9.0M (1.3x, about 5% IRR); searcher receives nothing despite 16.7% "vested".

Lesson, as in the primer: operating performance and total gain dominate; the security choice moves the split at the margin, mainly in middling cases.

## Checks before sending to investors

- Debt service covered in the pessimistic case without new equity.
- Search-capital step-up and fees included in investor capital.
- Earn-out and seller note payments in the cash flow, not only in the price.
- Taxes modelled as cash out even for pass-through entities (owners need distributions to pay them).
- Vesting and IRR consistent (no hard-coded vesting %).
