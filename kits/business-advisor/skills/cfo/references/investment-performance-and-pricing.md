# Investment performance and asset pricing

> **Area:** `investment-performance-and-pricing` · owned by the CFO skill. **Use when:** Judge whether an investment, fund or manager actually earned its return (Sharpe, Treynor, Jensen's alpha, information ratio, M-squared), what return an asset should earn (CAPM, multifactor and Fama-French models), and whether beating the market is realistic (market efficiency, behavioral biases). Use when reviewing a fund, an adviser, a stock pitch, or an active versus passive choice.

**Outcome:** a risk-adjusted verdict on past performance and a grounded expectation of future
return, so a business or owner pays for skill only when there is evidence of it.

## When to use
- "Our adviser / fund returned 11% - was that good?"
- Choosing between an active manager and an index fund.
- Someone pitches a stock or strategy as "can't lose" or "undervalued".
- Estimating the required return on a stock (see also `cost-of-capital`).

## Method

### 1. Expected return models
- **CAPM:** E(r_i) = r_f + β_i (E(r_M) − r_f). Only systematic risk (beta) is priced. Plotting
  E(r) against beta gives the security market line; an asset above it has positive alpha.
  Assumes price-taking, mean-variance investors with the same views, one period, no taxes or costs.
  Portfolio beta = weighted average of betas.
- **Multifactor / APT:** E(r_i) = r_f + β_i1 RP_1 + β_i2 RP_2 + … with factors such as GDP surprises,
  inflation or interest rates. Rests on no arbitrage: if two diversified portfolios have the same
  factor exposures, they must offer the same expected return, otherwise short one and buy the other.
  A portfolio with zero factor exposure (hedge portfolio) should earn r_f.
- **Fama–French three-factor:** market + SMB (small minus big) + HML (high minus low book-to-market).
  Small and value firms have earned more historically; use when judging a manager who tilts that way.

### 2. Risk-adjusted performance (use averages over the same period)
- **Sharpe** = (r̄_P − r̄_f) / σ_P: return per unit of total risk.
- **M²** = r_P* − r_M, where P* is P mixed with T-bills to the market's σ: Sharpe in return points.
- **Treynor** = (r̄_P − r̄_f) / β_P: return per unit of market risk.
- **Jensen's alpha** = r̄_P − [r̄_f + β_P (r̄_M − r̄_f)]: return above what CAPM predicts.
- **Information ratio** = α_P / σ(e_P): alpha per unit of tracking (diversifiable) risk.
Which to use:
- The portfolio is the investor's whole risky holding → Sharpe or M².
- It is one piece of a larger diversified pool → Treynor or alpha.
- Choosing an active sleeve to add to an index → highest information ratio.
Report time-weighted returns for the manager (they don't control flows); dollar-weighted for the investor's own experience.

### 3. Is outperformance plausible? (market efficiency)
(Event-study steps, the anomaly list, fund evidence and APT arbitrage logic are in
cfo/references/investment-performance-and-pricing/efficiency-evidence-and-tests.md.)
- Prices react to new information quickly, so price changes look like a random walk.
- Weak form: past prices and volume are in the price → technical analysis should not pay.
  Semi-strong: all public information is in the price → fundamental analysis of public data
  should not pay on average. Strong: even private information is priced (evidence says no; insider
  information can earn excess returns but trading on it is illegal).
- Efficiency does not mean no profit: investors still earn the risk premium. It means no reliable
  excess return after adjusting for risk and costs.
- Evidence: most active managers fail to beat low-cost index funds consistently after fees; past
  winners rarely persist. Default to passive, low-cost diversification; pay for active management
  only with long, risk-adjusted evidence and a credible information edge.

### 4. Behavioral finance: why prices and people err
- Information errors: limited attention (under/overreaction), overconfidence, conservatism (slow
  updating), confirmation bias, seeing patterns in small samples.
- Decision biases: framing, mental accounting, regret avoidance, affect (liking a brand or
  home-country stock), prospect theory (loss aversion, risk-seeking to avoid locking in losses).
- Limits to arbitrage keep mispricings alive: fundamental risk (mispricing can widen before it
  closes), costs and short-sale limits, and model risk. Cases such as twin shares trading off parity
  show the law of one price can break for long periods.
- Use: build rules (rebalancing schedules, position limits, written theses) that guard the owner
  against these biases (standard practice).

### 5. Private equity and venture funds
For judging PE and VC funds as an investor (IRR vs TVPI/DPI, PME, J-curve, fees and waterfall, manager
selection, the denominator effect), see `cfo/references/investment-performance-and-pricing/private-markets-returns.md`.

## Worked pattern
An adviser's fund: average return 11%, σ 16%, β 1.1. Market 9%, σ 14%. T-bills 3%.
- Sharpe: fund 8/16 = 0.50; market 6/14 = 0.43.
- M²: fund scaled to 14% σ earns 3% + 0.875 × 8% = 10% → +1.0 point over the market.
- Treynor: fund 8/1.1 = 7.3; market 6.0.
- Alpha: 11% − (3% + 1.1 × 6%) = **+1.4%**.
Verdict: better than the market on every measure for this period. Before paying higher fees, check
over 5+ years, after fees, and whether a small/value tilt (Fama–French) explains the alpha.

## Common mistakes
- Comparing raw returns without adjusting for risk.
- Using Treynor or alpha for an undiversified portfolio (ignores its firm-specific risk).
- Treating one good year as skill; ignoring survivorship of funds that closed.
- Confusing "market is efficient" with "stocks can't lose money".
- Assuming a mispricing will close in time to profit from it.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- Private-markets return data are point-in-time; only the conclusions are kept, so refresh figures before use.
