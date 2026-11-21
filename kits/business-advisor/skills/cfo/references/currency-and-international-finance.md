# Currency and international finance: FX quotes, parity, exposure and hedging

> **Area:** `currency-and-international-finance` · owned by the CFO skill. **Use when:** A business buys, sells, borrows or invests in a foreign currency: read FX quotes and forward points, check a bank's price, test covered interest parity, size the exposure (transaction, translation, economic) and choose a hedge (forward, money-market hedge, FX swap, currency swap, natural hedge). Use for any importer, exporter, foreign subsidiary or foreign-currency loan.

**Outcome:** every foreign-currency amount turned into a known home-currency amount (or a known
range), with the cheapest hedge chosen on a like-for-like basis and the bank's price checked.

## When to use
- "We owe a supplier €500k in 90 days. What will it cost in dollars, and should we lock it in?"
- "A customer pays us in CAD in six months. Forward or borrow-and-convert now?"
- "Is the forward rate the bank quoted fair?" (quotes, points, the bank's margin)
- "Our debt is in dollars but we earn in euros." (currency swap, natural hedge)
- Valuing a foreign project or setting a foreign discount rate: start here for the rates, then
  `capital-budgeting` (section 7) and `cost-of-capital` (section 7).
- Swapping fixed and floating debt in one currency: `bond-and-debt-analysis` (section 7).

## Key ideas
- **One idea holds it together: no arbitrage.** Cross rates are tied to dollar rates (triangular
  arbitrage); forward rates are tied to spot and the two interest rates (covered interest parity);
  a swap is a bundle of forward-type exchanges worth zero when it is struck.
- **The currency in the denominator is the one being priced.** JPY 150/USD: one dollar costs 150
  yen. Most rates are quoted as foreign currency per dollar; sterling ("cable") and the euro are
  usually quoted as dollars per unit. Write every rate with its units (USD/EUR = dollars per euro).
- **The dollar is the vehicle currency:** on one side of about 89% of trades, so a cross rate
  (two non-dollar currencies) is built from two dollar rates.
- **Spot settles in two business days** (USD against CAD and MXN: one). A forward settles on any
  later agreed date; 30, 60, 90 and 180 days are the liquid ones.
- **The high-interest currency trades at a forward discount; the low-interest one at a premium.**
  This is the check to run on every forward number.

## Method

### 1. Read and check the quote
- A two-way quote "1.3345–50" is bid–ask for the denominator currency: the dealer **buys** it at
  the bid (1.3345) and **sells** it at the ask (1.3350). You always get the worse side: you buy at
  the ask, sell at the bid; you borrow at the higher rate and lend at the lower.
- Spread cost = (ask − bid) ÷ mid. Interbank: a few pips (1 pip = 0.0001; 0.01 for yen pairs).
  Retail and airport cash: 5% or more. A business paying more than about 0.2–0.5% on a
  major currency is overpaying (that band is standard practice).
- **Cross rate:** EUR/GBP = EUR/USD × USD/GBP. With spreads, build the bid from the two bids and
  the ask from the two asks when the dollar cancels this way; otherwise invert and swap sides
  (formula sheet, section 2).
- **Triangular arbitrage:** if a quoted cross differs from the implied one, sell the currency
  where it is dear, buy it where it is cheap, and go round the triangle back to the start. With
  spreads, a gap exists only if the quoted bid is above the implied ask or the quoted ask is
  below the implied bid. For a business this is a test of a bank's price, not a trade.
- **Percentage change** refers to the denominator currency: (new − old) ÷ old. If USD/GBP goes
  1.25 → 1.30, the pound rose 4.0% but the dollar fell only 3.85%.

### 2. Turn forward points into an outright forward
Banks quote forwards as **swap points** to add to or subtract from spot.
- First number **smaller** than second (e.g. 20/25): **add** to spot bid and ask. The
  denominator currency is at a forward **premium**.
- First number **larger** (e.g. 25/20): **subtract**. The denominator currency is at a forward
  **discount**.
- Either way the forward spread comes out wider than spot. If it doesn't, you applied the
  points the wrong way.
- Annualised premium (+) or discount (−) on the denominator currency =
  [(F − S) ÷ S] × (360 ÷ N days).
- **The price to a customer** starts from the bank's outright ask (when the customer buys) or
  bid (when it sells), and the bank adds a margin for size and service. A small business should
  ask for spot and points separately and compare the outright with a screen rate.

### 3. Test covered interest parity (CIP)
With S and F in units of currency A per unit of currency B, and i_A, i_B the rates for the period:

F ÷ S = (1 + i_A × N/D_A) ÷ (1 + i_B × N/D_B)

- Scale annual rates to the period: N days ÷ 360 (dollar, euro) or ÷ 365 (sterling and some
  others). Check each currency's day count; mixing them is a common error.
- **Units check:** the numerator currency's rate goes on top. If the result says the
  high-interest currency is dearer forward, the units are upside down.
- **Covered interest arbitrage:** compare covered returns. Borrow where the covered return is
  low, lend where it is high, lock the conversion with the forward. No funds, no risk, so in
  equilibrium the profit is zero.
- **With costs:** borrow at the ask rate, lend at the bid, buy currency at the ask, sell at the
  bid. Most apparent gaps vanish once spreads are in. Test both directions.
- CIP held almost exactly before 2007 and broke down in the 2007–09 crisis. Apparent gaps reflect
  counterparty default risk, exchange controls, taxes or political risk, not free money.

### 4. Size the exposure
Three kinds.
- **Transaction:** a contracted foreign-currency payable or receivable whose home value moves
  with the spot rate until it settles. Importer with a foreign payable loses if the foreign
  currency rises; exporter with a foreign receivable loses if it falls.
- **Translation (accounting):** restating a foreign subsidiary's balance sheet and profit in the
  home currency moves reported equity and earnings without any cash moving. Hedge it only if
  covenants or reported ratios depend on it.
- **Economic (operating):** future sales, prices and costs shift with the exchange rate (a
  competitor's costs are in a weaker currency). Largest and slowest; managed mainly by where you
  make, buy, price and borrow.
- **Describe the transaction risk with a distribution.** Mean future rate = S × (1 + μ);
  standard deviation = S × σ, for the period. Under a normal curve about 68% of outcomes fall
  within one standard deviation and 95% within two; one standard deviation above the mean has
  about a 16% chance. Major currencies are roughly normal; emerging-market currencies have fat
  tails on the side of sudden devaluation, so the normal understates the loss.
- Exposure in home currency = amount × rate; loss at a bad-case rate = amount × (bad rate − mean).

### 5. Choose the hedge
| Tool | What it does | Fits |
|---|---|---|
| Outright forward | Fixes the rate for one future date | A known payable or receivable up to about a year |
| Money-market hedge (synthetic forward) | Borrow or lend the foreign currency now and convert at spot | Forward not offered, or cheaper after the rate check |
| FX swap (spot + reverse forward) | Swaps into a currency for a period and back | Temporary funding in another currency; rolling a hedge |
| Currency swap | Exchanges principal and interest in two currencies for years | Long foreign-currency debt or assets |
| Natural hedge | Matches currency of costs or debt to revenue | Ongoing exposure; cheapest when possible |
| Invoice in home currency | Moves the risk to the other side | When the buyer will accept it (standard practice) |
| Options | Caps the cost, keeps the upside, for a premium | Uncertain amounts, bids and tenders (standard practice) |

**Money-market hedge recipe** (both must match CIP to be equal):
- **Payable:** deposit the PV of the foreign amount now (amount ÷ (1 + i_foreign × N/D)); buy that
  foreign currency at spot; the home cost is spot × PV today, or that grossed up at the home rate.
- **Receivable:** borrow the PV of the foreign amount now; sell it at spot; the receivable repays
  the loan; invest the home proceeds.
- **Compare at the same date and in the same currency:** future-value the money-market result
  at the home rate (or discount the forward). Comparing today's money with money in 180 days is
  the most common error.
- The **indifference rate** is the foreign (or home) rate at which both hedges give the same
  result; it is the CIP-implied rate.

**Whether to hedge at all:**
- The **ex ante cost** of a forward is known: roughly the spread, if the forward is the market's
  best forecast. The **ex post cost** is the regret once the rate is known; it can be a gain or a
  loss. Judge the decision on the ex ante cost against the size and odds of the loss, like fire
  insurance, not on hindsight.
- A firm with thin margins, a fixed-price contract, debt covenants or one large exposure should
  hedge transaction risk; a firm with many small, offsetting flows may net them first (standard
  practice).
- Write a policy: what is hedged (contracted only, or forecast too), how much (for example 100%
  of contracted, 50% of forecast), with what, and who approves (standard practice).

### 6. Settlement and counterparty risk
- **Settlement (Herstatt) risk:** one side delivers its currency and the other fails before
  delivering. Reduced by simultaneous settlement (CLS), netting and limits per bank.
- A forward or swap with a bank is a credit exposure both ways; the bank will ask for a credit
  line or collateral, and a small firm should not accept unlimited margin calls (standard practice).

## Worked pattern
A US importer owes **€500,000 in 90 days**. Spot $1.0800/€, 90-day forward $1.0850/€, dollar rate
5.0% a year, euro rate 3.0% (both 360-day). Ignore spreads.
- **Check the forward:** the euro is the low-rate currency, so it should be at a premium: yes,
  (1.0850 − 1.0800) ÷ 1.0800 × 4 = **+1.85% a year**. CIP-implied forward = 1.08 × 1.0125 ÷ 1.0075
  = $1.08536/€, so the quoted forward is slightly cheap for a buyer of euros.
- **Unhedged:** cost depends on spot in 90 days. If the euro rises 5% to $1.134, the bill is
  $567,000.
- **Forward hedge:** 500,000 × 1.0850 = **$542,500**, paid in 90 days.
- **Money-market hedge:** deposit 500,000 ÷ 1.0075 = €496,278 now; buy it at spot for $535,980;
  in 90-day dollars at 5%: $535,980 × 1.0125 = **$542,680**.
- **Decision:** the forward is cheaper by about $180 in 90-day dollars, exactly because its rate
  sits below the CIP rate. Take the forward; the hedge locks out a loss of up to $24,500 on a 5%
  euro move for a known cost of roughly the spread.

## Common mistakes
- Mixing up which currency is priced (it is the denominator), or flipping a rate without
  flipping the bid and ask.
- Adding swap points when the first number is larger (they should be subtracted).
- Using an annual interest rate for a 30-, 90- or 180-day period, or a 360-day count for sterling.
- Saying the high-interest currency is at a forward premium.
- In arbitrage, borrowing where the covered return is high. Borrow where it is low.
- Comparing a forward result in 180 days with a money-market result today.
- Judging a hedge by hindsight (ex post regret) instead of its known ex ante cost.
- Taking the bank's outright forward without checking it against spot, points and CIP.
- Treating an unhedged foreign-currency loan as cheap because its interest rate is lower: the
  currency tends to move by the rate gap (see `capital-structure-decisions`, section 8).

## Depth
- `cfo/references/currency-and-international-finance/formula-sheet.md`: all formulas in one
  place, cross rates with spreads, arbitrage tests in both directions, and swap cash-flow layouts.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- Currency options and futures, purchasing power parity, uncovered interest parity and
  exchange-rate forecasting are not covered beyond the brief notes above.
