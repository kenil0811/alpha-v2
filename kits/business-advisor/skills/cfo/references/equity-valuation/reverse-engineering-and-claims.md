# Reverse engineering the price, and valuing option claims

From Penman (2006, 2011) and Ohlson and Penman (2007), restated.
The idea: anchor on what you know (book value, near-term earnings), keep speculation about
long-term growth separate, and use the model to ask what the price assumes rather than to
produce one "true" value.

## 1. Split the price into three layers
With B_0 book value per share, r a hurdle rate, RE_t = EPS_t − r × B_{t−1}:
- Layer 1: book value B_0 (what is on the balance sheet).
- Layer 2: value of near-term earnings with **no growth**: RE_1 / (1 + r) + RE_2 / [(1 + r) × r]
  (year-2 residual earnings held flat forever). Roll book forward as B_t = B_{t−1} + EPS_t − DPS_t.
- Layer 3: price − (layer 1 + layer 2) = the amount the market pays for growth after year 2.
A large layer 3 is where the risk of overpaying sits. Use your own two-year forecasts if you
trust them more than consensus; use only one year ahead if two is already speculative.

## 2. Implied growth (given a hurdle rate)
Set price = B_0 + RE_1/(1 + r) + RE_2 / [(1 + r)(r − g)] and solve for g. Convert it into an
EPS growth path: RE_3 = RE_2 × (1 + g); EPS_3 = RE_3 + r × B_2; and so on. That path splits a
chart into a buy zone (you expect faster growth) and a sell zone (slower). Screening on implied
growth is better than screening on P/E or P/B alone. If you expect growth to fade, use a
weighted path: g_t = w × g_{t−1} + (1 − w) × long-run GDP growth, and solve for the w the
price implies.

## 3. Implied expected return (given a growth view)
With one-year-ahead earnings E_1 and price P_0:
- r = E_1 / P_0 + (1 − B_0 / P_0) × g
- This is the return you expect from buying at today's price if residual earnings grow at g
  (works when forward ROE exceeds g). It is not a required return.
- Build a **growth-return profile**: r for g = −3%, 0, 2%, 4%, 6%... Read the downside (return
  if growth disappoints) as well as the central case. Compare profiles across firms of similar
  risk, or against the market index computed the same way, and against a safe bond yield.
- With no growth, the expected return is just the forward earnings yield.
- Doing this on an unlevered basis (operating income and net operating assets) avoids paying
  for growth that comes only from leverage.

## 4. Why residual earnings rather than cash flow for this
Accrual accounting brings value forward (earnings recognise value before cash arrives), so less
of the value sits in the speculative terminal period. DCF works fine when free cash flow tracks
value creation (steady, low-investment firms), but heavy investors show low or negative FCF
while creating value. The approach depends on the accounting being factual: expensed R&D and
fair-value estimates weaken the anchor.

## 5. Employee stock options and other contingent equity claims
- Outstanding options (and warrants, convertibles) are claims on the shareholders: value them
  and subtract from equity value before dividing by shares.
- Value each grant tranche with Black–Scholes: inputs share price S, exercise price X, volatility
  σ, risk-free rate r (continuous), dividend yield q, time to expiry t.
  d1 = [ln(S/X) + (r − q + σ²/2) t] / (σ √t); d2 = d1 − σ √t;
  call = S e^(−qt) N(d1) − X e^(−rt) N(d2); put = X e^(−rt) N(−d2) − S e^(−qt) N(−d1).
- Multiply by options outstanding; reduce by the tax deduction the firm gets on exercise
  (value × (1 − τ)) (standard practice).
- Accounting expenses options only at grant; the later loss to shareholders when options are
  exercised in the money is never booked. The analyst's fix is to carry the options as a
  liability marked to market, with gains and losses through income, until exercise or lapse.
