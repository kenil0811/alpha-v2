# Strategy over time, and checking it with numbers

Use after the static analysis in SKILL.md (scope, value curve, practices, moats). This file covers how a
position changes, how incumbents should meet a new technology, and two numeric checks: does the business
earn more than its capital costs, and what is it worth to a buyer.

## 1. Game out short-run change (four steps)
1. Finish the snapshot: current position, operating model, sources of advantage, industry structure.
2. List the shocks, trends and changes, inside the firm (growing scale, new assets, experience) and outside
   (technology, regulation, rival strategies, customer tastes). Map each onto the snapshot: which choice,
   force or advantage does it touch?
3. Work out best responses to best responses: your likely move, each key player's move, and their response
   to yours. The result is a new pattern of competition, not one move.
4. Adjust for inertia: each player, you included, will respond late or partly. Revise the projected outcome.

Three sources of inertia to judge for each player:
| Source | What it looks like | Question to ask |
|---|---|---|
| Accumulation | Advantages (scale, culture, routines, networks) take years to build | Can it be bought (acquisition) for less than it is worth to us? |
| Structural | Vested interests, sunk assets, cannibalisation, tangled practices, careers and politics | Who loses if we change, and can they block it? |
| Cognitive | Success narrows what the firm scans for; leaders frame the new situation with the old model | Who in the firm is paid or placed to notice the change? |

Inertia in large incumbents is often the opening for a small, focused firm. Not every change needs a
response; strong leaders often ride out shocks.

## 2. Place the industry on its life cycle
Rough empirical sequence, with no claim about pace:
| Stage | What competition is about | Typical mistake |
|---|---|---|
| 1. Creation (a new enabling technology makes a new value proposition plausible) | Proving it works | Treating it as a fad, or as a sure thing |
| 2. Ferment | Search and experimentation; many entrants, little profit; rules and infrastructure missing | Expecting this crowded, low-profit phase to last |
| 3. Dominant design (a working model of the whole business, not just the product) | Uncertainty drops; adoption widens | No plan for what to do once the design settles |
| 4. Incremental improvement | Fast performance gains, investment, shakeout; winners gain power | Not preparing to survive the shakeout |
| 5. Maturity | Diminishing returns; focus shifts to cost and process; prices fall | Over-serving customers who no longer value more performance |
| 6. Discontinuity | A new approach "good enough" on core needs; possible substitution | Assuming it will stay inferior |

Draw performance against time as an S-curve: slow, then fast after the dominant design, then flattening.

## 3. Meet a technological discontinuity
- Sort each new technology: **reinforcing** (fits the current model; absorb it) or **discontinuous** (does not
  fit without major cost; treat it as a substitute and run the substitutes analysis in `industry-analysis`).
- Most discontinuities **attack from below**: worse on at least one traditional dimension at first. If one finds a
  viable model it will attract investment and improve, including on the dimensions it was worse on. Rare
  **attacks from above** are better on every dimension; the old curve is finished, though servicing the
  installed base can stay profitable for years.
- An incumbent has three choices, each with real costs: **defend** the existing business; **jump** to the new
  one and rebuild the company; or run **both** (separate unit, balanced resources). There is no default answer:
  run the numbers for each scenario. A separate unit is hard to sustain inside the parent; why, and when an
  alliance is the better home, is in `corporate-strategy`. Sticking with the old model can be the profit-maximising choice
  (financing, governance and the size of the existing business all matter).

## 4. Check the strategy earns more than its capital costs
A positive accounting profit is not enough. Rough economic profit (standard accounting data):
- Economic profit = operating income (after depreciation and amortisation, before interest and tax)
  − total assets employed × cost of capital (WACC).
- Use all assets employed, not only those financed by outside investors: the question is whether the assets
  would earn more elsewhere.
- Track it over years. Growth by acquisition can lift revenue, margins and net income while economic profit
  turns negative because the asset base jumped.
- If the strategy story says "advantage" but economic profit is at or below zero, the story is wrong or not yet true.

Quick breakeven checks also test a strategic move. Example with illustrative numbers: dropping a $2M-a-year licensing
deal to sell direct at $50 a year needs 40,000 subscribers to replace the lost income; a $10M platform
build needs 200,000 subscriber-years to recover. Compare those with the reachable market.

## 5. What is the company worth to a buyer
The sale price falls in a band:
- **Floor:** stand-alone value (discounted future cash flows). A seller should not take less, absent a personal reason.
- **Ceiling:** the buyer's value with the company minus its value without it. That includes synergies (better
  position, operating model or advantages; less rivalry; more bargaining power) and avoided losses (you stay a
  rival, or a rival buys you, or the buyer falls behind a trend).
- **Split:** set by bargaining power, mainly each side's alternatives (more bidders, more targets) and how much
  they will depend on each other afterwards.
Strategy moves all three: raise stand-alone value; position near a likely buyer's gaps or threats to raise the
ceiling; create alternatives before selling.

## 6. Read a rival's real strategy from where it spends (standard practice)
What a company says is weaker evidence than where its time and money go: hiring, vendors, partners,
investments, acquisitions, patents, capital spending. Map these for each key rival before guessing its next move.
