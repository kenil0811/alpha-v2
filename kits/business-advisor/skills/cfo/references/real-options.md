# Real options: valuing flexibility

> **Area:** `real-options` · owned by the CFO skill. **Use when:** Value flexibility in a business decision - the option to expand, abandon, wait, or buy an asset later - with decision trees and binomial trees using risk-neutral probabilities. Use when a plan can change after new information arrives, or a contract holds a purchase, renewal or exit right.

**Outcome:** a value for the "we can change course later" part of a decision, so a project with a
negative static NPV is not wrongly rejected and contract rights (purchase options, break clauses)
are priced in negotiations.

## When to use
- A pilot or first store that, if it works, unlocks expansion.
- A lease or contract with a break clause, renewal right or purchase option.
- A project that is negative NPV today but could become positive if prices, rates or demand move.
- Startups whose value is mostly future opportunities.

## Method

### 1. Map the decision tree
- Squares: decisions. Circles: information arriving (with probabilities).
- Put the cash flows on each branch. Mark when you learn something and what you can do then.

### 2. Solve backward
- At the last decision node, pick the best action on each branch (expand only if its incremental
  NPV at that point is positive; abandon if salvage beats the value of continuing).
- Roll values back: value at a node = expected value of the next nodes, discounted one period.
- Value of the option = NPV with flexibility − NPV of the fixed plan.

### 3. Pick the discount approach
- Simple cases (and quick estimates): true probabilities and the project's cost of capital.
  Strictly, cash flows with different risk deserve different rates (e.g. a fixed later outlay at r_f).
- Better for options on a traded or valuable asset: **risk-neutral probabilities** discounted at r_f.
  - One period: asset worth S now, goes to uS or dS, pays a yield θ (rent, dividend) per period:
    ρ = (1 + r_f − θ − d) / (u − d).
  - Option value = [ρ × C_up + (1 − ρ) × C_down] / (1 + r_f).
  - ρ is found from the asset's own price, so no risk premium for the option is needed. An option
    to buy is much riskier than the asset, so discounting its expected payoff at the asset's rate
    overstates its value; use ρ and r_f instead.
- Where the uncertainty is interest rates, back out ρ from a bond or annuity whose price depends on rates.

### 4. Multi-period binomial tree (e.g. a purchase option)
1. Build the asset price tree (multiply by u or d each period).
2. At expiry: option value = max(asset price − strike, 0).
3. Earlier nodes: continuation = [ρ C_u + (1 − ρ) C_d]/(1 + r_f). If you may exercise then too,
   value = max(continuation, price − strike at that date).
4. The root is today's value. Setting u = 1 + μ − θ + σ and d = 1 + μ − θ − σ (equal true odds)
   ties the tree to an expected return μ and volatility σ.

### 5. Read the result
- Option value rises with uncertainty (upside kept, downside cut) and with time to decide.
- For a purchase option, a higher r_f raises value (paying the strike later costs less in PV).
- Types: expand ≈ call on future cash flows; abandon ≈ put; wait ≈ timing option; purchase right ≈ call.
- In negotiation, the most to pay to cancel a counterparty's option = its value plus any other
  savings the cancellation brings.

### 6. Patterns from teaching cases
Staged development with milestone payments, rights to follow-on products across a whole slate,
and an out-of-the-money purchase option in a lease: see
cfo/references/real-options/case-lessons.md.

## Worked pattern
**Abandonment.** A $120k product launch earns $18k a year forever if demand is strong, $5k if weak
(50/50, learned after year 1), at 12%. Static NPV = −120 + 11.5/0.12 = −$24.2k → reject.
With the right to sell the equipment for $100k after year 1: weak branch = (5 + 100)/1.12 = 93.75;
strong = 18/0.12 = 150. NPV = −120 + 0.5 × 150 + 0.5 × 93.75 = **+$1.9k** → launch. The exit right is
worth about $26k.

**Purchase option.** Land worth $50k may move to $60k (×1.2) or $42.5k (×0.85) in a year; r_f 4%,
no income. ρ = (1.04 − 0.85)/(1.2 − 0.85) = 0.543. An option to buy at $52k pays 8 or 0:
value = 0.543 × 8 / 1.04 = **$4.18k**, even though the land today is below the strike.

## Common mistakes
- Valuing only the fixed plan and rejecting projects that open later choices.
- Discounting an option's payoffs at the underlying asset's rate.
- Ignoring that an option can be exercised at several dates (take the max at each node).
- Using the beta of a mature firm for a firm made of growth options (its true beta is higher).
- Treating a negative-NPV-today opportunity as worthless.
- Valuing an option as "most aggressive scenario minus strike" from a sensitivity table instead
  of with volatility and a tree.
- Valuing rights over a portfolio from the average item, when the value comes from the few hits.
- Raising the discount rate for technical (non-market) risk instead of lowering the probability.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- Black–Scholes and continuous-time option pricing are not covered.
