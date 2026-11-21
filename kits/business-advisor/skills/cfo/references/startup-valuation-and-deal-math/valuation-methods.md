# Valuation methods for early-stage companies

From VC practice (2019-2020). Use several methods together:
valuation is a tool for negotiating and planning, and the price is finally set by auction or negotiation.

## The menu
| Method | When | How |
|---|---|---|
| Comparables (public or private deals) | Any stage with peers | Revenue or EBITDA multiples of similar companies. Used but rarely relied on early: few true peers, no earnings. |
| DCF | Later stage, steady cash flows | Used but rarely relied on early: forecasts are guesses. |
| Berkus | Pre-revenue, pre-seed or seed | Only for a company that could reach about $20M revenue in five years. Assign up to a fixed amount each for: sound idea, prototype, quality of team, strategic relationships, product rollout or sales. Sum is the pre-money. |
| Scorecard | Pre-revenue, seed | Start from the median pre-money for similar funded deals in the region and stage. Score the company against a typical funded deal on weighted factors (team, market size, product, competition, channels, other), each as a percent of typical; the weighted sum times the median is the pre-money. Typical weights (standard practice): team 30%, market 25%, product 15%, competition 10%, channels 10%, other 10%. |
| VC method | Any venture round | Exit value discounted at a target return gives post-money (see SKILL.md section 1). |
| Option-pricing model and backsolve | 409A and accounting valuations | Treats each share class as a call option on the company; backsolve infers the whole-company value from the latest round's price. Rarely used by VCs to price deals. |
| PWERM (probability-weighted expected return) | Several distinct outcomes | 1) list outcome states (IPO, sale, flat, failure); 2) give each a probability; 3) estimate exit value in each; 4) run each through the capital structure (preferences, conversion); 5) weight by probability and compute the investor's expected multiple. |

## VC haircuts on the founder's plan
Before running the VC method, VCs typically discount the founder's forecast: cut the exit value by about
half, push the exit about two years later, double the capital needed, and assume more dilution in later
rounds. Run the founder's case and the haircut case side by side.

## Target returns, as VCs say them
Early-stage: "can it return the fund?" or about 10x. Later-stage: about 3x in five years. A deal's target
must be higher than the fund's goal, because fees, follow-on reserves, the J-curve and failed deals all
eat into fund returns.

## Management top-up before a round
If the team must hold a target share after the new round, solve for new management shares y before the
round: (existing management + y) / (all shares + y + new investor shares) = target. Because the new
investor's percentage is fixed, solve for y on the pre-round share base first, then issue the investor's
shares. Example in our own numbers: 1M shares, management holds 0.4M; investor will own 30% post; team must
hold 35% post, so it needs 0.35/0.70 = 50% of the pre-round base: (0.4M + y)/(1M + y) = 0.5 gives y = 0.2M.

## Typical stage benchmarks (US, about 2017-2020; recheck)
- About 18 to 24 months between rounds. Round sizes roughly: seed $0.5-2M, Series A $3-10M, B $7-20M, C $15-25M.
- Of a 2008-2010 seed cohort: about two-thirds never raised another round or exited; about 30% exited; about 1%
  became unicorns.
- Earlier entry can give higher multiples on success (median about 15x from seed in one dataset), and earlier
  exits often give higher IRRs than waiting.
