# Portfolio construction: risk, return, diversification, allocation

> **Area:** `portfolio-construction` · owned by the CFO skill. **Use when:** Build an investment portfolio for a business or owner - measure risk and return, diversify, find the best mix of risky assets, and set how much goes into safe assets given risk tolerance. Use for investing surplus cash, a reserve, a retirement or endowment fund, or reviewing an owner's concentrated holdings.

**Outcome:** a portfolio mix with stated expected return and risk, built so no other mix gives
more return for the same risk, and sized to the investor's tolerance for losses.

## When to use
- Investing a company's surplus cash or reserve fund beyond its operating needs.
- An owner whose wealth is concentrated in one business or one stock.
- Choosing a stock/bond/cash split, or adding an asset class.

## Method

### 1. Measure returns and risk
- Holding-period return = (P_1 − P_0 + D_1) / P_0 (capital gain + dividend yield).
- Arithmetic average: best estimate of next period's expected return.
- Geometric (time-weighted) average = [(1 + r_1)…(1 + r_n)]^(1/n) − 1: what was actually compounded.
  It is below the arithmetic average when returns vary.
- Dollar-weighted return = IRR of the investor's own deposits and withdrawals (rewards timing).
- Risk = standard deviation of returns (use n − 1 for sample estimates). Risk premium = expected
  return − r_f; excess return = actual return − r_f.
- Returns are roughly normal for diversified portfolios, but with fat tails and sometimes negative
  skew; standard deviation understates crash risk.

### 2. Diversify
- Total risk = systematic (market) + firm-specific. Spreading across many holdings removes the
  firm-specific part; the market part remains.
- Two assets: E(r_p) = w_1 E(r_1) + w_2 E(r_2);
  σ_p² = w_1² σ_1² + w_2² σ_2² + 2 w_1 w_2 ρ σ_1 σ_2.
- Correlation ρ = 1: no risk reduction. ρ < 1: portfolio risk below the weighted average.
  ρ = −1: a riskless hedge exists (w_1 = σ_2 / (σ_1 + σ_2)).
- Minimum-variance weight on asset D: w_D = (σ_E² − Cov) / (σ_D² + σ_E² − 2 Cov).

### 3. Find the optimal risky portfolio
- Efficient frontier: mixes with the highest return for each level of risk.
- With a risk-free asset, the best risky mix is the one with the **highest Sharpe ratio**
  (E(r) − r_f)/σ: the tangency portfolio. Everyone should hold the same risky mix; only the
  amount differs by risk tolerance.
- Two risky assets (R = excess returns):
  w_D* = [E(R_D) σ_E² − E(R_E) Cov] / [E(R_D) σ_E² + E(R_E) σ_D² − (E(R_D) + E(R_E)) Cov].
- Many assets: full mean-variance (Markowitz) needs n returns, n variances and n(n−1)/2
  covariances; small estimation errors give extreme weights. The single-index model needs only
  3n + 2 estimates (alpha, beta, residual variance per asset, plus market premium and variance)
  and usually gives similar, more stable results. See cfo/references/portfolio-construction/index-model.md.
- Many assets by hand: covariance-matrix variance, margin and short-sale mechanics, and index
  construction are in cfo/references/portfolio-construction/trading-mechanics-and-many-assets.md.
- Practical default: if you have no reliable view on mispricing, the low-cost diversified index
  is the risky portfolio (see `investment-performance-and-pricing`).

### 4. Allocate between risky and safe
- Complete portfolio: y in risky portfolio P, 1 − y in the risk-free asset.
  E(r_C) = r_f + y (E(r_P) − r_f); σ_C = y σ_P. This line is the capital allocation line; its slope
  is P's Sharpe ratio.
- Mean-variance utility U = E(r) − ½ A σ², with A = risk aversion (about 2–4 for typical investors).
- Optimal risky share: y* = (E(r_P) − r_f) / (A σ_P²). y* > 1 means borrowing to invest.
- Top-down order: capital allocation (risky vs safe), asset allocation (classes), security selection.

### 5. Business overlay (standard practice)
- Keep operating cash and near-term obligations out of the risky portfolio entirely.
- An owner's business is already a large, undiversified risky asset; the rest of their wealth
  should usually lean away from the same industry.
- Write the policy down: purpose, horizon, y, allowed asset classes, rebalancing rule.

## Worked pattern
Reserve fund choices: stocks E(r) 9%, σ 18%; bonds 4.5%, σ 7%; correlation 0.2; T-bills 3%.
- Excess returns 6% and 1.5%; Cov = 0.2 × 0.18 × 0.07 = 0.00252.
- Optimal risky mix: w_bonds = 56.6%, w_stocks = 43.4%; E(R_P) = 3.45% over bills, σ_P = 9.43%;
  Sharpe 0.37 (stocks alone 0.33, bonds alone 0.21).
- Risk aversion A = 4: y* = 0.0345 / (4 × 0.0943²) = 0.97 → about 97% in the risky mix, 3% in bills.
- Lowest-risk mix would be about 93% bonds; that is not the best risk-return trade.

## Common mistakes
- Using the geometric average as a forecast, or the arithmetic as past compounded growth.
- Judging an asset by its own risk instead of what it adds to the portfolio.
- Picking the minimum-variance portfolio as "best".
- Plugging raw historical means into Markowitz and trusting extreme weights.
- Mixing raw and excess returns in the optimal-weight formula (it uses excess returns).
- Investing cash the business will need within a year.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- Taxes, liquidity limits and constraints such as no short sales were not modelled.
