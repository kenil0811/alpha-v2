# Bass and response models: formula sheet and spreadsheet layout

Part of `cmo/references/new-product-forecasting.md`.

## Bass model

| Quantity | Formula | Note |
|---|---|---|
| New adopters, discrete | N(t) = (p + q·A(t−1)/M)·(M − A(t−1)) | Run period by period from A(0) = 0 |
| Cumulative, continuous | A(t) = M·(1 − e^(−(p+q)t)) / (1 + (q/p)·e^(−(p+q)t)) | t can be fractional |
| New adopters, continuous | N(t) = A(t) − A(t−1) | For a month inside a quarterly fit: A(t) − A(t − 1/3) |
| Peak time | t* = ln(q/p) / (p + q) | Only exists if q > p |
| Peak adopters | M·(p + q)² / (4q) | Per period at the peak |
| Share adopted at peak | 1/2 − p/(2q) | Just under half when q ≫ p |
| Generalized Bass with price | replace (p+q)t by (p+q)t + b·ln(Price_t / Price_1) | b < 0; use Price_(t−1) for A(t−1) |
| Generalized Bass with advertising | add + b_Ad·(advertising term) the same way | b_Ad > 0 |

| Quick price effect | S(t) × Z(t), Z(t) = 1 + α·(P(t) − P(t−1))/P(t−1) | α < 0; one period only |
| Least-squares fit | N(t) = a + b·A(t−1) + c·A(t−1)²; M from c·M² + b·M + a = 0, p = a/M, q = −c·M | Needs data past the peak |

Discrete and continuous forms give slightly different numbers; the continuous one is what fitting software reports, so forecast with the form the parameters were fitted on.

## Spreadsheet layout (standard practice)

Columns: t · A(t) (continuous formula) · A(t−1) · N(t) = A(t) − A(t−1) · replacement purchases = N(t − k) + N(t − 2k) + ... · total units · price · revenue. Parameters p, q, M (and b) in named cells at the top, with peak time and peak sales computed beside them as a check. Add a second block with the conservative (p, q) pair and chart both.

## Weighting analogues (own numbers)

| Analogue | p | q | Market structure (×0.4) | Product traits (×0.6) | Score | Weight |
|---|---|---|---|---|---|---|
| A | 0.02 | 0.40 | 6 | 8 | 7.2 | 0.41 |
| B | 0.01 | 0.50 | 8 | 4 | 5.6 | 0.32 |
| C | 0.05 | 0.30 | 3 | 6 | 4.8 | 0.27 |
| Weighted | 0.025 | 0.40 | | | 17.6 | 1.00 |

Weight = score ÷ sum of scores; p and q are the weighted sums. With the Z(t) form, a 15% price cut and α = −1 lifts that period's adoptions by 15% (8,600 becomes about 9,900), and none of it is new market.

## Exponential smoothing (rolling, short horizon)
Forecast(t+1) = β·Actual(t) + (1 − β)·Forecast(t). Weights on past actuals are β, β(1−β), β(1−β)², ... Holt adds a trend term, Winters a seasonal one. Refit as each actual arrives and forecast about five periods ahead.

## Recovering adoptions from sales that include replacements
Work forward period by period: adoptions(t) = sales(t) − sum of adoptions(t − k), adoptions(t − 2k), ... already recovered. Then fit the Bass model on the recovered adoption series. If the replacement cycle is uncertain, try two values and keep the one whose recovered series is smooth and never negative.

## Scan*Pro

| Item | Formula |
|---|---|
| Model (linear in logs) | ln Q = a + b·ln P + c·ln Pc + g·F + d·D |
| Model (original) | Q = e^a · P^b · Pc^c · (e^g)^F · (e^d)^D |
| Own-price elasticity | b |
| Cross-price elasticity | c |
| Feature multiplier | e^g |
| Display multiplier | e^d |
| Effect of an x% price cut | Q multiplied by (1 − x)^b |

Fit one model per brand (and per store type if they differ). Use at least a year of weeks so seasons do not pose as promotion effects (standard practice).

## Advertising response

| Model | Ad elasticity |
|---|---|
| Linear: Sales = a + b·Ad + g·Price | b·Ad/Sales, changes with spend |
| Multiplicative: ln Sales = a + b·ln Ad + g·ln Price | b, constant |
| With carryover: add b1·ln Ad(t−1) + b2·ln Ad(t−2) | b + b1 + b2 (total) |

Zero-ad periods: set to 0.01 × average of non-zero spend before taking logs.

Adstock: Stock(t) = a·Stock(t−1) + (1 − a)·Ad(t), 0 < a < 1; regress ln Sales on ln Stock. Koyck (geometric lags): each lag's effect = λ × the previous lag's. Benchmarks: ad elasticity about 0.1 on average (about 0.3 new products, 0.01 established).

## Logit share

ln(S_j / S_base) = a_j + b·(A_j − A_base). Shares for all brands come from exponentiating each brand's right-hand side (base brand = 0) and dividing by the sum.
