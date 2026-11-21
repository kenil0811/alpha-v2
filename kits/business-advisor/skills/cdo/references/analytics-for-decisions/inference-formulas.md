# Inference formula sheet

Depth for `cdo/references/analytics-for-decisions.md`. Symbols: n sample size, N population size, m sample mean, s sample standard deviation, f sample share (mean of a 0/1 variable), c critical value (break-even or target), L full length of the confidence interval.

## Rough rules

| Item | Rule |
|---|---|
| Sample standard deviation | Square each value's deviation from m, sum, divide by n − 1, take the square root (spreadsheet `STDEV`, not `STDEVP`, which divides by n and suits a whole population) |
| Share as a mean | Code yes = 1, no = 0; f is the mean; s ≈ √(f(1 − f)) (exactly √(f(1 − f) × n ÷ (n − 1)), which matters only for n of about 10 or fewer) |
| Standard error | s ÷ √n |
| Confidence intervals | m ± 1 SE: 68% · m ± 2 SE: 95% · m ± 3 SE: 99.7% |
| Test against c | t = (m − c) ÷ (s ÷ √n); beyond ±2 significant at 2½% (one-sided), beyond ±3 at about 0.15% |
| Sample size for a length L | 68%: n = 4s² ÷ L² · 95%: n = 16s² ÷ L² · 99.7%: n = 36s² ÷ L² |
| Worst-case s for a share | 0.5 (s is between 0.4 and 0.5 for any f from 0.2 to 0.8) |
| Finite-population correction | Multiply the standard error by √((N − n) ÷ (N − 1)); ignore below about a tenth of the population |
| Population total | Estimated mean or share × N; scale the interval the same way |

## Exact values (standard practice)

| Confidence | Two-sided z | One-sided z |
|---|---|---|
| 90% | 1.645 | 1.282 |
| 95% | 1.960 | 1.645 |
| 99% | 2.576 | 2.326 |

Use the t value for n − 1 degrees of freedom instead of z when n is under about 30.

## Group comparisons (standard practice)

- Two separate groups: t = (m₁ − m₂) ÷ √(s₁² ÷ n₁ + s₂² ÷ n₂).
- Paired: compute each unit's difference d; t = d̄ ÷ (s_d ÷ √n).
- Crosstab: expected count per cell = row total × column total ÷ grand total; chi-square = Σ (observed − expected)² ÷ expected, with (rows − 1) × (columns − 1) degrees of freedom.

## Regression reading

| Output | Meaning | Rule of thumb |
|---|---|---|
| Coefficient | Change in the outcome per one-unit change in the driver, others held fixed | Translate into a realistic change before comparing drivers |
| Standard error and t-statistic | How precisely the coefficient is pinned down | abs(t) above about 2 is significant, as for a mean |
| R-squared | Share of the outcome's variation the drivers explain | A low R-squared can still hold a useful, significant driver |
| Adjusted R-squared | R-squared penalised for each driver (each uses a degree of freedom) | Use it to compare models with different numbers of drivers |
| Residual plot | What the model misses | Patterns mean a missing driver or a curve |

## Spreadsheet functions

| Task | Excel or Google Sheets |
|---|---|
| Mean, standard deviation | `AVERAGE(range)`, `STDEV(range)` |
| Standard error | `STDEV(range)/SQRT(COUNT(range))`, or the Descriptive Statistics tool in the Data Analysis add-in |
| Interval half-width | `CONFIDENCE.NORM(alpha, s, n)` or `CONFIDENCE.T(alpha, s, n)` |
| p-value for two groups | `T.TEST(range1, range2, tails, type)`: type 1 paired, 2 equal variance, 3 unequal variance |
| Crosstab and chi-square | Pivot table of counts, then `CHISQ.TEST(observed, expected)` |
| Regression | Data Analysis add-in, Regression; or `LINEST(y, x_range, TRUE, TRUE)` |
| ANOVA across groups | Data Analysis add-in, Anova: Single Factor |
