# Returns attribution, exit-year choice and the investment memo

## 1. The value-creation bridge (standard practice, built on the return equation)

The return equation (entry EV less debt = equity in; exit EV less debt = equity out) splits the
equity gain into levers. Compute each term separately so the committee sees what carries the deal.

| Term | Formula | What it shows |
|---|---|---|
| Revenue growth | (exit revenue - entry revenue) x entry margin x entry multiple | value of selling more at today's margin and price |
| Margin change | exit revenue x (exit margin - entry margin) x entry multiple | value of cost, pricing or mix work |
| Multiple change | (exit multiple - entry multiple) x exit EBITDA | re-rating; the least controllable lever |
| Deleveraging | net debt at entry - net debt at exit | cash the business generated and used to repay debt |
| Leakage | - fees and expenses at entry (+ interim dividends, - extra equity) | cost of doing the deal; early cash back |

The terms add up exactly to equity out minus equity in. If they do not, an input is wrong.

Worked check (own numbers): revenue 100 to 130, margin 10% to 12%, so EBITDA 10.0 to 15.6. Entry 8.0x (EV 80),
debt 45, fees 2, equity 37. Exit 8.5x (EV 132.6), net debt 20, equity 112.6. Gain 75.6.
- Revenue 30 x 10% x 8 = 24.0 (32%)
- Margin 130 x 2% x 8 = 20.8 (28%)
- Multiple 0.5 x 15.6 = 7.8 (10%)
- Deleveraging 45 - 20 = 25.0 (33%)
- Fees -2.0 (-3%)
- Total 75.6. MOIC 3.04x; IRR about 25% over 5 years.

Reading the bridge:
- A deal where multiple change carries more than about a quarter of the gain is fragile (standard practice
  threshold); re-run it at an exit multiple equal to or below entry.
- Deleveraging is real value only if the cash flow behind it is real: tie it to the FCCR in the model.
- Present the bridge for base, downside and upside cases side by side.

## 2. Choosing the exit year
- Run returns for every year from 1 to 7. In a typical model, IRR peaks around year 2 to 3
  and then falls slowly while MOIC keeps rising: equity grows in dollars every year but at a falling rate.
- Rule (standard practice): hold another year only if the expected growth in equity value over that year
  beats the fund's target IRR, after costs and risk; otherwise prepare the sale.
- A fund also cares about MOIC and about how much capital it can keep working; a long-hold vehicle
  weighs these differently (see `cfo/references/value-creation-and-exit/exit-route-evidence.md`).

## 3. What the evidence says about where returns come from
- Eras of the industry: to about 1990, leverage and financial engineering; about 1990 to
  2009, cost cutting, selling non-core assets and general management; since about 2010, growth,
  technology and transformation.
- A Bain comparison of projected vs actual deal results (2010s) found multiple expansion
  explained most of the overperformance: planned operating gains were less reliable than planned.
- A 2026 practitioner deck citing Bain: in 2010 to 2021 about two thirds of buyout value creation came from
  leverage and multiple expansion; with those tailwinds weaker, buying well and operating gains matter more.
- The same deck citing Apollo: deals in the lowest entry-multiple quartile exited far more often (about 67%
  vs 31% for the highest quartile) and returned 1.3x to 2.5x more proceeds.
- Puche and Braun (2015, 2,174 deals): buying below and selling above the market multiple for the segment
  both raise returns; selling well was worth about twice as much as buying well.

## 4. Cross-checks on price beside IRR
- Year-1 levered free-cash-flow yield on equity (free cash flow after interest and debt service / equity).
  In one example it fell from about 12.7% to 11.7% as the price rose by about 5%.
- Leverage read: what lenders will lend tells you what they think the business is worth.
- Scenario table: return by financial case (growth plus margin, steady, flat) against price. One example
  table showed the same price giving about 28% IRR in a growth case and about 12% if growth stopped:
  the case matters more than a small change in price.

## 5. The investment memo and committee presentation
Build an invest-or-pass recommendation in five roughly equal parts:
1. Due diligence: findings from the materials, and what still needs checking.
2. Valuation: method, adjustments to EBITDA, comparable multiples.
3. Structure, terms and leverage: debt amounts and types, key terms, and why any term departs
   from market standard.
4. Exit analysis: projections to exit and their assumptions, exit metrics, named likely
   acquirers and their motives, estimated returns.
5. Overall case: a defended thesis, consistent numbers between memo and model, own research.
A pass still needs a full model that shows the return falls short.
