# Customer growth metrics and lifetime value

Part of `cmo/references/market-sizing-and-unit-economics.md`. Funnel and channel metrics (ROAS, CPC, lead scoring): `cmo/references/digital-marketing-and-channels/channel-metrics.md`.

## Growth, churn and retention
| Metric | Formula |
|---|---|
| Growth rate | (customers this period − customers last period) ÷ customers last period |
| Churn rate | customers lost in the period ÷ customers at the start |
| Retention rate | (customers at end − new customers added) ÷ customers at start = 1 − churn |
| Gross acquisition rate | new customers added ÷ customers at start |
| Net growth | gross acquisition rate − churn rate |
Some practitioners call the gross figure the "effective growth rate" and the net figure the "compounding growth rate" (for example 50% gross adds − 30% churn = 20% net). Check which one a dashboard shows: a growth rate computed on customer counts is already net.

Example (own numbers): 1,200 customers at the start of the month, 90 leave, 150 join. Churn 7.5%, retention 92.5%, gross adds 12.5%, net growth 5%.

Diagnose churn by segment, product, location and acquisition channel, not on average; ask why leavers left and what resistance they had compared with those who stayed.

## Lifetime value: three quick forms
| Business pattern | Formula | Example (own numbers) |
|---|---|---|
| Many small purchases | profit per visit × visits per year × years | $1.50 × 80 × 4 = $480 |
| Few large purchases | profit per purchase × purchases per year × years | $4,000 × (2 purchases ÷ 10 years) × 10 = $8,000 |
| Recurring plan | profit per month × 12 × average years | $9 × 12 × 3 = $324 |

## Lifetime value with retention and discounting
CLV = m × r ÷ (1 + i − r)
- m = margin per customer per period, r = retention rate per period, i = discount rate per period.
- Counts margins from the next period onward (the customer is retained first). Add m to include the current period.
- Example: m = $500 a year, r = 80%, i = 10%: CLV = 500 × 0.8 ÷ 0.3 ≈ $1,333.
- This matches the churn formula in the main file when r = 1 − churn.

## Customer equity
Customer equity = CLV × number of customers, per segment, summed. It is the value of the customer base and the right yardstick for comparing acquisition and retention budgets.

## Rules
- Spend to acquire only up to a share of CLV (the main file uses LTV ÷ CAC of 3 or more).
- Retention usually costs less than acquisition; budget both explicitly.
- Never use one average CLV: compute by segment and channel, since some customers are worth several times others.
- Look past vanity metrics (followers, sign-ups) to repeat and margin.
- Capture the fields needed (first order date, channel, segment, orders, margin) from the first customer onward.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.
