# Cost of capital: CAPM, beta, cost of debt and WACC

> **Area:** `cost-of-capital` · owned by the CFO skill. **Use when:** Estimate the discount rate for a business, division or project (cost of equity with CAPM, cost of debt, unlevered cost of capital, and WACC), including for private firms with no stock price and for foreign projects. Use whenever a valuation, NPV or hurdle rate needs a defensible rate.

**Outcome:** a discount rate that matches the risk of the cash flows being valued, with every
input sourced and the leverage adjustments done right.

## When to use
- Setting the rate for a DCF, a project NPV or an acquisition.
- Valuing a private company (no beta of its own) or a new line of business.
- Asking how the rate changes if the business takes on more or less debt.
- Checking a rate someone else proposed.

## Key ideas
- The discount rate is the return investors require on assets of the **same risk**. Discount
  rate, required return and opportunity cost of capital are the same thing.
- Only market-wide (systematic) risk earns a premium. Firm-specific risk can be diversified away,
  so it does not raise the rate. (A sole owner with all wealth in one firm is not diversified,
  which is why owners often apply higher rates than diversified investors such as VCs.)
- Beta measures sensitivity to the market: beta 2 means about twice the market's moves.

## Method

### 1. Cost of equity with CAPM
r_E = r_f + β_E × MRP
- **r_f, the risk-free rate:** a Treasury yield. Either short-term (matches the return data) or
  matched to the horizon of the cash flows (e.g. 10-year for a long project). Pick one and say which.
- **MRP, the market risk premium:** expected market return minus r_f. Practitioners commonly use
  about 4–6%. If you are given E(R_M), subtract r_f first.
- **β_E, equity beta:** slope from regressing the stock's excess returns on the market's
  (5 years monthly, 2 years weekly or 1 year daily are common). β = Corr × σ_stock / σ_market.
  Estimates are noisy; averages across comparable firms are more stable than one firm's beta.

### 2. Cost of debt
- If debt is close to risk-free, r_D ≈ yield to maturity (YTM).
- If debt is risky, YTM overstates the expected return because it assumes every payment is made:
  r_D ≈ y − p × L, where y = YTM, p = annual default probability, L = expected loss rate in default.
- Or use CAPM with a debt beta. Rough debt betas by rating: A and above under 0.05; BBB about 0.10;
  BB about 0.17; B about 0.26; CCC about 0.31.

### 3. Unlever, then relever (comparables method)
Use when the firm has no reliable beta (private, recent IPO, new line) or when leverage changes.
1. For each comparable with similar **business** risk, compute its unlevered (asset) beta.
   With a target debt ratio (debt kept proportional to value):
   β_U = E/(D+E) × β_E + D/(D+E) × β_D
   Simpler common form assuming risk-free debt and fixed permanent debt:
   β_U = β_E / [1 + (1 − τ) × D/E]
   (State which one you use; the formula depends on debt policy. See cfo/references/cost-of-capital/formulas.md,
   which also has a public-data recipe and dated reference levels for r_f, r_D and betas.)
2. Average (or take the median of) the comparables' β_U. That is the target's β_U.
3. Relever to the target's own D/E: β_E = β_U + (D/E) × (β_U − β_D).
4. r_E from CAPM. Equivalently, r_U = r_f + β_U × MRP and r_E = r_U + (D/E) × (r_U − r_D).
- D is **net debt** (debt minus excess cash). A firm with more cash than debt has negative net
  debt, and its equity beta sits **below** its asset beta.
- Divisions: a conglomerate's β_U is the value-weighted average of its divisions' β_U. Use
  pure-play comparables for the division you are valuing, not the parent's beta.
- A project in a new line of business (a home-delivery arm, a processing plant) takes the asset
  beta of firms in that line. When peers carry heavy debt, unlever with a small positive debt
  beta (often about 0.25) rather than zero: β_U = E/V × β_E + D/V × β_D.

### 4. WACC
r_WACC = E/(D+E) × r_E + D/(D+E) × r_D × (1 − τ)
- E = market value of equity; D = market value of net debt; τ = marginal corporate tax rate.
- The (1 − τ) puts the interest tax shield in the rate, so the cash flows must exclude it.
- Weights are debt-to-**value**, not debt-to-equity. Convert: D/V = (D/E)/(1 + D/E);
  D/E = (D/V)/(1 − D/V).
- Use **market** values and the **target** capital structure the firm will hold going forward.
- If the firm will not pay taxes for years (loss carryforwards), the tax shield is delayed and a
  WACC built on the full τ overstates it.

### 5. Which rate for which job
- Firm's WACC fits a project only if the project has the firm's average risk **and** the firm keeps
  its target debt ratio. Otherwise build a project rate from comparables (step 3) with the
  project's own financing.
- All-equity project or APV method: discount free cash flow at r_U.
- Equity cash flows (dividends, FCFE): r_E.
- Predetermined debt tax shields: r_D. Tax shields from debt kept at a target ratio: r_U.

### 6. Adjusting WACC when leverage changes
Do not just re-weight the old r_E and r_D. Instead: (1) back out r_U at current leverage;
(2) set the new r_D for the new rating; (3) r_E = r_U + (D/E)_new × (r_U − r_D,new);
(4) recompute WACC. r_U stays fixed because the business is unchanged.

### 7. Foreign projects: currency and country adjustments
Standard practice; the interest-rate link is covered interest parity (see `currency-and-international-finance`).
- **The rate must be in the currency of the cash flows.** Same risk, different unit:
  (1 + r_foreign) = (1 + r_home) × (1 + i_foreign) ÷ (1 + i_home), with i the risk-free rates of
  each currency at the matching maturity. A high-interest currency gets a higher rate.
- **Or build it locally:** local risk-free rate + β × MRP, with the β from comparables in the same
  business (section 3). Cross-check against the conversion above.
- **Cost of debt abroad:** a cheaper foreign loan rate is not a cheaper loan unless the currency
  risk is hedged or matched by foreign revenue; compare at the hedged cost
  (`capital-structure-decisions`, section 8).
- **Country risk premium:** diversified investors add little for risks they can spread, so first
  put expropriation, convertibility and conflict into the cash flows as probability-weighted
  scenarios. If a premium is still used, take it from the spread of the country's dollar
  sovereign bonds over US Treasuries, apply it once, and say so. Do not also cut the cash flows
  for the same risk.
- Taxes: use the tax rate where the interest is deducted, and count withholding tax on cash
  sent home in the cash flows, not the rate.

## Worked pattern
A private 40-person distributor plans a target D/E of 0.25 (D/V = 20%). Two listed peers:
peer A β_E 1.30 at D/E 0.5; peer B β_E 1.00 at D/E 0.2. Treat peer debt as near risk-free.
- Unlever: A 1.30 × (1/1.5) = 0.867; B 1.00 × (1/1.2) = 0.833. Average β_U = 0.85.
- r_f 4%, MRP 5.5% → r_U = 4% + 0.85 × 5.5% = 8.68%.
- Bank quotes 7%; with a 1% yearly default chance and 50% loss → r_D ≈ 7% − 0.5% = 6.5%.
- r_E = 8.68% + 0.25 × (8.68% − 6.5%) = 9.22%.
- WACC = 0.8 × 9.22% + 0.2 × 6.5% × (1 − 0.25) = **8.35%**.
Present the range: ±0.1 on β_U moves WACC by about ±0.55 points.

## Common mistakes
- Using a single company's raw beta without checking its leverage or its standard error.
- Using D/E where the WACC needs D/V, or gross debt where net debt belongs.
- Using YTM as the expected return on risky (junk) debt.
- Using book values of equity in the weights.
- Applying the firm's WACC to a project in a different line of business.
- Treating one analyst's WACC as fact: for the same company, published rates can differ by
  several points; show the range and what it does to value (see
  cfo/references/dcf-valuation/case-lessons.md).
- Raising leverage and keeping r_E unchanged: equity gets riskier as debt rises, so r_E rises.
- Treating the MRP as E(R_M) (forgetting to subtract r_f).
- Using the beta of a mature firm for one whose value is mostly growth options; option-like
  assets carry more systematic risk (see `real-options`).
- Discounting foreign-currency cash flows at a home-currency rate, or counting country risk
  twice (in a haircut to the cash flows and again in the rate).

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- Size or company-specific premiums for small private firms are not covered; if used, flag them
  as a judgement add-on.
- International CAPM is not covered.
