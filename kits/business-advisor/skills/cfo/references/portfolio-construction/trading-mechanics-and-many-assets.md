# Trading mechanics and portfolios of many assets

## Margin purchase
- Investor puts up the initial margin (at least 50% in the US by Fed rule; brokers may ask
  more) and borrows the rest from the broker.
- % margin = equity in account / market value of shares = (n × P − loan) / (n × P).
- Margin call when % margin falls below the maintenance margin m. Call price:
  P* = loan / [n × (1 − m)].
- Return on equity is magnified both ways; the loan interest is a cost.

## Short sale
- Borrow shares, sell them, leave the proceeds plus initial margin with the broker; owe any
  dividends; cover by buying back.
- % margin = (proceeds + initial margin − n × P) / (n × P).
- Margin call price: P* = (proceeds + initial margin) / [n × (1 + m)].
- Profit = (sale price − cover price) × n − dividends owed − costs. Losses are unlimited.

## Indexes
- Price-weighted (Dow style): sum of prices / divisor. High-priced shares dominate.
- Value-weighted (S&P style): sum of market values / divisor. Large firms dominate.
- Divisor is adjusted for splits and constituent changes so the index does not jump.
- Fund net asset value (NAV) = (assets − liabilities) / shares. Open-end funds trade at NAV;
  closed-end funds and ETFs can trade at a premium or discount.

## Portfolio variance with many assets
- Covariance matrix Σ: variances on the diagonal, covariances elsewhere.
- σ_p² = wᵀ Σ w (in a spreadsheet: MMULT(TRANSPOSE(w), MMULT(Σ, w))). Equivalent to
  bordering the matrix with the weights, multiplying each cell by its row and column weights,
  and adding all cells.
- With factor models, expected return = r_f + Σ β_k × RP_k for each asset; weights carry through
  linearly (portfolio beta = weighted average beta).
- The optimal risky portfolio is the weight vector with the highest Sharpe ratio: use a solver
  (maximise Sharpe, weights sum to 1, add "no shorting" if needed) or the single-index shortcut
  in index-model.md.
- In the two-asset case every mix lies on the frontier; with three or more, single assets can
  sit inside it, so an asset that looks dominated (higher risk, lower return) can still earn a
  weight if its correlations are low.

## Estimates from data
- Use adjusted closing prices (dividends included) to compute returns.
- Sample mean, variance (n − 1), covariance and correlation; annualise monthly means × 12 and
  variances × 12 (σ × √12) (standard practice).
- A historical "optimal" portfolio is optimal for that sample only; out of sample it is usually
  beaten by simpler mixes because means are estimated with large error (standard practice).
