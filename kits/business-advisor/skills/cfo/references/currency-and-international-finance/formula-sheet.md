# Currency formula sheet

Depth for `cfo/references/currency-and-international-finance.md`. Notation: a rate written A/B is
units of currency A per one unit of B (B is priced). S = spot, F = forward, N = days, D = the
currency's day-count year (360 for USD and EUR; 365 for GBP and some others), i = annual rate.

## 1. Quotes and changes
- Bid–ask "X–Y" on A/B: dealer buys B at X, sells B at Y. You buy at the ask, sell at the bid.
- Mid = (bid + ask) ÷ 2. Spread % = (ask − bid) ÷ mid.
- Invert: B/A bid = 1 ÷ (A/B ask); B/A ask = 1 ÷ (A/B bid).
- Change in B's value: s = (S_new − S_old) ÷ S_old. A's change is 1/(1 + s) − 1, not −s.

## 2. Cross rates
- Chain (dollar cancels): A/B = A/USD × USD/B. Bid = bid × bid; ask = ask × ask.
- Divide (dollar in the same place): A/B = (A/USD) ÷ (B/USD). Bid = bid(A/USD) ÷ ask(B/USD);
  ask = ask(A/USD) ÷ bid(B/USD).
- Check: the cross bid must be below the cross ask, and the spread wider than either leg's.
- Triangular arbitrage exists only if a quoted cross bid > implied ask (sell B to that bank) or
  a quoted cross ask < implied bid (buy B from that bank). Profit per unit = the gap.

## 3. Forwards
- Points first < second: add to spot bid and ask (B at a premium). First > second: subtract
  (B at a discount). Points are in pips: 0.0001, or 0.01 for yen.
- Annualised premium on B = [(F − S) ÷ S] × (D ÷ N).
- Forward FX swap (into B now, out later): buy B spot at the spot ask, sell B forward at the
  forward bid (or the reverse). The net difference in A reflects the interest gap for the period.
- Forward-forward swap: the same with two forward dates.

## 4. Covered interest parity
- F(A/B) ÷ S(A/B) = (1 + i_A × N/D_A) ÷ (1 + i_B × N/D_B).
- Premium form: (F − S) ÷ S = (i_A,period − i_B,period) ÷ (1 + i_B,period).
- Implied rate in A that removes arbitrage: i_A,period = (F ÷ S) × (1 + i_B,period) − 1, then
  annualise × D_A ÷ N.
- Multi-year forward for planning: F_t = S × [(1 + i_A) ÷ (1 + i_B)]^t,
  with annual rates for maturity t from each currency's yield curve.

## 5. Covered interest arbitrage tests, with spreads
Start with one unit of A. Use ask rates to borrow, bid rates to lend.
- **Out of A, into B:** borrow A at i_A,ask; buy B at S_ask; lend B at i_B,bid; sell B forward at
  F_bid. Profit if (1/S_ask) × (1 + i_B,bid) × F_bid > 1 + i_A,ask.
- **Out of B, into A:** borrow B at i_B,ask; sell B at S_bid; lend A at i_A,bid; buy B forward at
  F_ask. Profit if S_bid × (1 + i_A,bid) ÷ F_ask > 1 + i_B,ask.
- If neither holds, there is no arbitrage after costs. Scale all rates to the period first.

## 6. Hedging a transaction
| Position | Forward hedge | Money-market hedge |
|---|---|---|
| Payable of X in B, in N days | Buy B forward: cost X × F_ask (in A, at day N) | Deposit X ÷ (1 + i_B × N/D_B) in B now; buy it at S_ask; cost today in A, grossed up at (1 + i_A × N/D_A) to day N |
| Receivable of X in B, in N days | Sell B forward: proceeds X × F_bid (at day N) | Borrow X ÷ (1 + i_B × N/D_B) in B now; sell it at S_bid; invest the A proceeds to day N |

- Compare both at day N in currency A. Equal when CIP holds.
- Indifference rate: solve CIP for the rate that makes them equal (section 4).

## 7. Distribution of the future spot rate
- Period mean = S × (1 + μ); period standard deviation = S × σ (μ, σ for the period).
- z = (threshold − mean) ÷ sd. One sd: 68.3% inside, about 15.9% in each tail. Two sd: 95.4%
  inside, about 2.3% in each tail.
- Value at risk on an exposure X: X × z × sd at the
  chosen confidence, read from the side that hurts.

## 8. Interest rate swaps (one currency)
- Fixed swap rate = Treasury yield of that maturity + swap spread. Quote "bid–ask" spread
  over Treasury: the bank **pays** fixed at Treasury + bid, **receives** fixed at Treasury + ask.
- Floating leg on a reference rate (SOFR now; LIBOR in older contracts), reset each period.
- Per period (semiannual): fixed leg = 0.5 × fixed rate × notional; floating leg = 0.5 × reference
  × notional. No principal changes hands; only the **net** difference is paid by whichever leg is
  higher.
- Fixed-rate borrower who wants floating: receives fixed, pays floating. Floating-rate borrower
  who wants fixed: pays fixed, receives floating.
- Value at inception is zero; afterwards one side's gain is the other's loss. Exit by an
  offsetting (mirror) swap or by paying the market value to terminate.

## 9. Currency swaps
- Quotes are fixed rates in each currency against the same dollar floating rate; when you take
  one currency's fixed leg and the other's, the floating legs cancel.
- You receive fixed at the bank's **bid** and pay fixed at the bank's **offer**.
- Start: exchange principals at spot (you give the currency you have, receive the one you want).
- Each period: you **pay** interest on the currency you received, **receive** interest on the one
  you paid: 0.5 × rate × that currency's principal.
- Maturity: re-exchange the same principals at the original spot rate (not the spot then). The
  difference from the then-spot is where the swap gains or loses value.
- The interest you receive services your existing debt; the residual is the gap between your
  debt's coupon and the swap rate you receive.

## 10. Rates and projects across currencies
- Converting a discount rate: (1 + r_B) = (1 + r_A) × (1 + i_B) ÷ (1 + i_A), with i the risk-free
  rates (or expected inflation) of each currency. Same project risk, different currency unit.
- Home-currency NPV = Σ (foreign cash flow_t × F_t) ÷ (1 + r_home)^t.
- Foreign-currency NPV = [Σ foreign cash flow_t ÷ (1 + r_foreign)^t] × S. Equal to the home NPV
  when F_t and r_foreign come from the same parity conditions.
