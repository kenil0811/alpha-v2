# Cost of capital formulas by debt policy

Symbols: E equity value, D net debt (debt minus excess cash), V = D + E, τ corporate tax rate,
β_U / r_U unlevered (asset), β_E / r_E equity, β_D / r_D debt.

## A. Firm keeps a target D/V ratio (debt rises and falls with value)
Tax shields are as risky as the business, so:
- r_U = E/V × r_E + D/V × r_D
- r_E = r_U + (D/E) × (r_U − r_D)
- β_U = E/V × β_E + D/V × β_D
- β_E = β_U + (D/E) × (β_U − β_D)
- WACC = E/V × r_E + D/V × r_D × (1 − τ); discount FCF at WACC.
This is the default for valuing ongoing firms and for the WACC method.

## B. Firm keeps a fixed dollar amount of debt forever
PV(tax shield) = τ × D, so replace D by D(1 − τ):
- r_U = E/(E + D(1 − τ)) × r_E + D(1 − τ)/(E + D(1 − τ)) × r_D
- r_E = r_U + D(1 − τ)/E × (r_U − r_D)
- With risk-free debt (β_D = 0): β_E = β_U × [1 + (1 − τ) × D/E]  ← the common textbook form.

## C. Some debt is predetermined, the rest adjusts to a target
Let T_s = PV of tax shields from the predetermined debt. Replace D with D − T_s in A.
Example: debt reset once a year to the target ratio → T_s = τ × D × r_D / (1 + r_D).

## Debt
- r_D = y − p × L (y YTM, p default probability per year, L loss rate given default).
- YTM is the IRR of promised payments; r_D is the IRR of expected payments; r_D ≤ YTM.

## Conversions
- D/V = (D/E) / (1 + D/E); E/V = 1 / (1 + D/E); D/E = (D/V) / (1 − D/V).

## Which discount rate
| Cash flow | Rate |
|---|---|
| Free cash flow, firm at target D/V | WACC |
| Free cash flow, all-equity or APV base case | r_U |
| Tax shields from predetermined debt | r_D |
| Tax shields from target-ratio debt | r_U |
| Free cash flow to equity, dividends | r_E |

## Public-data recipe for a listed company
1. **Beta:** last 60 monthly returns of the stock and of a broad market index fund; use a
   T-bill fund's return as r_f when forming excess returns. β = Corr(stock, market) ×
   σ_stock / σ_market (same as the regression slope).
2. **r_f for CAPM:** the current 10-year Treasury yield (FRED). **MRP:** an assumed 5%.
3. **Pre-tax r_D:** the market yield on a corporate bond index for the firm's credit rating
   (the ICE BofA option-adjusted yield series on FRED, by rating). Treat it as a YTM: for
   speculative grades subtract expected default loss.
4. **Weights:** equity = price × shares; EV = equity + preferred + minority interest + debt −
   cash; net debt / EV and equity / EV. Use market values, never book.
5. **Tax:** a flat 25% (21% federal plus a state allowance) unless the firm's cash tax rate is known.
6. WACC = E/EV × r_E + net debt/EV × r_D × (1 − τ). Preferred and minority interest can be given
   their own costs; a simpler choice folds them into the equity side of EV.

Reference levels (autumn 2025): 10-year Treasury about 4.1%; A-rated
corporate yields about 4.5–4.7%; BBB about 5.0%. Large-company betas in the sample ran from about
0.35 (staples, telecom, pharma) to about 1.8 (steel), with most between 0.8 and 1.2. These levels
date quickly; refresh them before use.
