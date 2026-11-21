# DCF model layout and the dividend discount model

## Spreadsheet layout (one sheet per block, inputs coloured, nothing hard-coded)
1. **Assumptions:** revenue drivers (volume, price, share), margins, D&A and capex as % of revenue
   or schedules, working capital days, tax rate, r_f, MRP, β_U, r_D, target D/V, g.
2. **Income statement** (unlevered): revenue → costs → EBITDA → D&A → EBIT → tax on EBIT → NOPAT.
3. **Working capital:** each item from days or % of sales; NWC level; increase in NWC.
4. **Capex and depreciation:** schedule by vintage if assets are depreciated straight-line
   (each year's capex depreciated over its life).
5. **Free cash flow:** NOPAT + D&A − capex − ΔNWC.
6. **Debt and tax shields** (APV/FTE): debt balance by year, interest = r_D × prior balance,
   ITS = τ × interest.
7. **Valuation:** discount factors, terminal value (FCF_{N+1} built separately), EV, net debt,
   equity, per share.
8. **Sensitivity:** data tables for (r, g) and (key driver, r).
9. **Optional three-statement check:** balance sheet balances; cash-flow statement ties; dividends
   = FCFE when all excess cash is paid out.

Tips: keep units consistent; label the timing (end-year vs mid-year); show % of EV from the TV.

## Equivalent accounting forms (same answer when consistent)
- EVA: EVA_t = NOPAT_t − r × invested capital_{t−1}; EV = invested capital_0 + PV(EVA at WACC).
- Residual income: RI_t = net income_t − r_E × book equity_{t−1}; equity = book equity_0 + PV(RI at r_E).

## Dividend discount model (for steady dividend payers)
- Price = PV of expected dividends per share at r_E.
- Constant growth: P_0 = Div_1 / (r_E − g), g = growth of dividends **per share** (buybacks or
  issuance make total dividends and per-share dividends grow at different rates).
- Two-stage: P_0 = Σ_{t=1..N} Div_t / (1 + r_E)^t + [Div_{N+1} / (r_E − g)] / (1 + r_E)^N.
  Forgetting the 1/(1 + r_E)^N on the second stage is the classic error.
- Dividends and buybacks at fair prices neither help nor hurt shareholders: the price drops by the
  dividend on the ex-dividend date; a fair buyback leaves the price per share unchanged.
- Best for mature payers; for non-payers use FCF methods.

## Quick four-year screen of a listed company
A one-row-per-company layout useful for screening many firms against their price.
1. **Inputs per firm:** beta, r_E (CAPM), pre-tax r_D, price, shares, preferred, minority
   interest, debt, cash, tax rate, WACC (see `cost-of-capital`), long-term growth g.
2. **Anchors:** take a near-year forecast (year 1) and a published longer-range forecast
   (year 4) for each driver (dividends per share; or revenue, EBITDA margin, capex, D&A, tax
   rate, working capital). Fill years 2 and 3 by straight-line interpolation between them, and
   show the implied compound growth from year 1 to 4 as a sanity check against g.
3. **Dividend model:** value = NPV at r_E of dividends in years 1–4 + [D_4 × (1 + g) / (r_E − g)]
   × (1 + r_E)^−4. Compare with price: price / value − 1 = over- or undervaluation.
4. **FCF model:** FCF = (EBITDA − D&A)(1 − tax) + D&A − capex − increase in working capital.
   EV = NPV at WACC of years 1–4 + [FCF_4 × (1 + g) / (WACC − g)] × (1 + WACC)^−4.
   Equity = EV − net debt − minority interest − preferred; per share = equity / shares.
5. **Long-term g:** anchor on long-run nominal GDP growth. The US Congressional Budget Office's
   March 2025 long-term outlook projects nominal GDP growth falling to about 3.4–3.5% a year in
   the 2040s–2050s (real about 1.4%, inflation about 2%); 4% is a common placeholder.
   Go lower for mature or shrinking industries. Never above r.
6. **Summary:** a table (and bar chart) of the share-price estimates from dividends, FCF, P/E
   and EV/EBITDA beside the market price, with a one-line verdict. Expect wide dispersion; the
   value of the exercise is seeing which assumption drives each estimate.
