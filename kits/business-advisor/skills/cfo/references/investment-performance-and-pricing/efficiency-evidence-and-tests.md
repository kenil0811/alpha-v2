# Market efficiency: tests, evidence and arbitrage logic

## Event study (did an announcement move the price?)
1. Estimation window (e.g. a year of daily returns before the event): regress the stock's return
   on the market's, r_t = a + b × r_M,t + e_t.
2. Event window (days around the announcement): expected return = a + b × r_M,t.
3. Abnormal return AR_t = actual − expected; cumulative abnormal return (CAR) = sum over the window.
4. Efficient-market pattern: a jump on the announcement day and no drift after. Drift before
   suggests leakage; drift after suggests under-reaction.
Uses for a business: the market's verdict on a deal, a pricing change or a guidance cut
(for a listed acquirer or peer).

## Why "beating the market" claims mislead
- Magnitude: small mispricings are only worth exploiting for very large portfolios.
- Selection bias: only failed schemes get published; working ones stay private.
- Luck: among many managers some will win by chance. Survivorship hides those that closed.
- Grossman–Stiglitz: if prices were perfectly efficient no one would pay for research, so
  markets are efficient only up to the cost of information. Expect small rewards for real research.

## Anomalies to know (and to discount)
Small-firm (and January) effect; neglected-firm and illiquidity premiums; high book-to-market
(value) beating low; momentum over 3–12 months and reversal over 3–5 years; post-earnings-
announcement drift; return predictability of the whole market from dividend yield, earnings yield
and credit spreads. Two readings: risk premiums (Fama–French) or mispricing (behavioural). Many
weaken after publication or vanish once trading costs are counted; some may be data mining.
Insiders do earn abnormal returns on their own stock (illegal to trade on inside information;
insider filings are public within two days).

## Judging funds and managers
- Benchmark: the four-factor model (market, size, value, momentum). A manager's "alpha" that
  disappears once these factors are included is a style tilt you can buy cheaply.
- Evidence: average fund alphas are about zero before fees and negative after; persistence is
  weak and short-lived. Berk–Green: skilled managers attract money until costs push alpha to zero,
  so investors capture little of the skill.
- Analyst ratings lean optimistic.

## Arbitrage pricing (APT) worked logic
- Expected return of a well-diversified portfolio: r_f + Σ β_k × RP_k. With two portfolios and
  r_f you can solve for each factor premium.
- Arbitrage test: build a mix of a portfolio and the risk-free asset with the same factor betas
  as another portfolio. If the two expected returns differ, buy the higher, short the lower,
  in equal amounts: zero net investment, zero factor risk, positive expected profit.
- Two-state pricing: with two risky assets and two states, find the weights that give the same
  payoff in both states (a riskless hedge); it must earn r_f, which fixes the price of the
  second asset given the first.
- Limits: real arbitrage needs capital, can be blocked by short-sale limits, and the gap can widen
  before closing (fundamental risk). Twin shares, carve-out stubs and closed-end fund discounts
  have stayed off parity for long periods.

## Bubbles and the dividend model
P = D_1 / (k − g) makes price very sensitive to g near k: a small cut in the growth assumption
can explain a large fall in the index without anyone being irrational. Bubbles are clear only
after they burst and are hard to time.

## Measuring your own portfolio over a short window
1. Daily return = (value_t − value_{t−1}) / value_{t−1}, from the account's daily values.
2. Daily risk-free rate = average one-month Treasury bill rate (annual, %) / 360.
3. Daily Sharpe = (mean daily return − mean daily r_f) / standard deviation of daily returns.
4. Beta: regress daily portfolio excess returns on daily index excess returns (index returns from
   adjusted closes); the slope is beta, the intercept the daily alpha.
5. A few weeks of data say little about skill; report the numbers with that caveat.
