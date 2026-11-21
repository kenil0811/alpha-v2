# Multiples and deal valuation

> **Area:** `valuation-multiples-and-deals` · owned by the CFO skill. **Use when:** Price a business quickly from comparable companies or recent transactions (EV/EBITDA, EV/revenue, P/E), and work out what to pay or accept in a deal - acquisition synergies, walk-away price, cash versus stock, and how much equity to give an investor. Use for offers, fundraising, buy-side or sell-side pricing.

**Outcome:** a fast, market-based value range for a company, and a negotiating position for a
deal: the most a buyer should pay, the least a seller should take, and how the payment form
shifts risk.

## When to use
- A first-pass value before (or as a check on) a DCF.
- "Is this asking price / this offer reasonable?"
- Planning an acquisition, merger or buyout; valuing synergies; picking cash or stock.
- Raising equity: how much ownership an investor needs for their money.

## Method: multiples

### 1. Pick comparables
Same industry, business model, growth stage, size and risk. Stage matters: value a recent IPO
against peers soon after their own IPOs, not against mature firms. Fewer good comps beat many poor ones.

### 2. Pick the multiple
- **Enterprise value multiples** (EV/EBITDA most used; EV/EBIT; EV/revenue; industry-specific ones
  such as EV/broadcast cash flow or EV per subscriber). Less distorted by different debt levels.
  EV/revenue is the fallback when earnings are negative.
- **Equity multiples** (P/E = price per share / EPS; price-to-book). P/E is distorted by
  depreciation and by leverage (leverage changes r_E), and meaningless when earnings are negative.
- **Forward** multiples use next year's forecast; **trailing** use the last twelve months. Match the
  comp multiple and the target metric on the same basis, and strip one-off items.
- **Trading** multiples come from listed peers' market values. **Transaction** multiples come from
  prices paid in recent deals and include control premiums and expected synergies, so they run higher.

### 3. Apply and bridge
- EV multiple: EV_target = multiple × target metric; equity = EV − net debt; per share = equity / shares.
- P/E: price = P/E × EPS directly.
- Use the median (less hurt by outliers) and show the range across comps and across multiples.
- Step-by-step comps procedure and dated sector ranges (EV/EBITDA, P/E, EV/revenue by sector,
  autumn 2025): cfo/references/valuation-multiples-and-deals/comps-procedure-and-benchmarks.md.

### 4. Read the multiple, don't just copy it
From a growing perpetuity, EV/EBITDA = (FCF_1/EBITDA_1) / (WACC − g) and forward
P/E = payout ratio / (r_E − g). So a higher multiple means more cash conversion, lower risk or
higher growth. If the target differs on these, adjust or explain. A low P/E is not automatically
cheap ("value"), nor a high one automatically a growth signal.

### Pros and limits
Quick, uses market forecasts, hard to game with a complex model. But: only as good as the comps,
only a relative value (a whole sector can be overpriced), and hard to run what-ifs. Treat as a
benchmark and a check on DCF, not a substitute.

## Method: deals

### 5. Value the deal for the buyer
- Combined value V_AT = V_A + V_T + PV(synergies).
- Synergies: cost savings (scale, shared overhead, cheaper inputs), revenue gains (cross-selling,
  bundles), and avoided losses (a rival not getting the target). Forecast them from their
  drivers, after tax, with a discount rate matching their risk. If synergies raise debt
  capacity under a target D/V, discount at WACC to pick up the extra tax shields.
- **Most the buyer should pay** = target stand-alone value + PV(synergies) + PV(losses avoided by
  winning the deal). Any price below that is NPV for the buyer.
- The seller needs at least stand-alone value, so all the buyer's gain must come from synergies.
- **Don't use your own trading multiple to value the target.** Your multiple may already include the
  market's expectation of this deal; paying it can hand all the value to the seller.
- Expected market reaction: buyer's share price should move by (value gained − price paid) / shares.
- **Bid range for a contested asset sale:** floor = the targets' stand-alone DCF value (high
  enough to pre-empt other bidders); ceiling = the price that leaves the buyer's value per share
  unchanged. Check the ceiling is not inflated by the market already pricing in this deal.
- In an asset purchase the buyer usually funds opening working capital and must add per-unit
  maintenance capex; industry profit measures that exclude corporate overhead overstate what
  a multiple of them buys. Case lessons: cfo/references/dcf-valuation/case-lessons.md.

### 6. Cash or stock
With A, T, S the stand-alone values of acquirer and target and synergies, the acquirer gains if
T + S > n × P_A + C (n new shares at price P_A, cash C).
- Paying cash: the buyer keeps all the upside if its view is right.
- Paying stock: target owners share in the combined firm, including synergies and any
  mispricing of the buyer's own shares. Use stock when your shares are overvalued or the
  outcome is uncertain (it shares risk); use cash when you are confident and your shares are cheap.

### 7. Equity for an investor (startup or expansion round)
- Investor needs fraction M with M × post-money value (by the **investor's** valuation) ≥ amount invested.
- Owner keeps (1 − M) × value (by the **owner's** valuation). Compare each option with the owner's
  value from not raising at all. The best plan for the owner may be a smaller raise, because the
  investor's lower valuation sets the price of the stake.
- Owner and investor values differ (forecasts and discount rates: a diversified investor may need a
  lower rate). Earnouts or milestone-based stakes can bridge the gap.

## Worked pattern
A buyer considers a local competitor with forward EBITDA $1.5m and net debt $2.0m. Comparable
private-company deals traded at 6.5x–7.5x EBITDA (median 7.0x).
- EV = 7.0 × 1.5 = $10.5m; equity = 10.5 − 2.0 = **$8.5m** (range $7.75m–$9.25m).
- Buyer's DCF of the target alone: equity $10m; PV of after-tax cost savings: $3m. Walk-away
  price for the equity = **$13m**.
- Offer $11.5m in cash: buyer gains 10 + 3 − 11.5 = $1.5m.
- If paid in stock instead (buyer: 2m shares at $20, fairly priced): 0.575m new shares; combined
  equity (40 + 10 + 3) / 2.575m = $20.58 a share; target holders get $11.8m, buyer gains $1.2m.
  Stock gives part of the synergies to the seller.

## Common mistakes
- Mixing an EV multiple with net income, or a P/E with EBITDA.
- Applying a multiple to EV and forgetting to subtract net debt (or adding cash twice).
- Using comps in a different stage or business model.
- Using transaction multiples for a minority stake, or trading multiples for a control deal, without saying so.
- Paying the buyer's own multiple for the target.
- Counting synergies before tax, or with no cost to achieve them.
- Ignoring that the stock-for-stock exchange ratio depends on post-deal prices.
- Applying an EV/EBITDA multiple to an industry profit measure (station or store cash flow)
  that leaves out corporate overhead.
- Valuing only the biggest growth option when funding it costs the owner more in dilution.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- Sector ranges are dated; refresh comparables for each use.
- Fairness opinions and earnout design are not covered here (for sources and uses and LBO models
  see `lbo-model-returns`).
