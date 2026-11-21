# Risk decisions under uncertainty

> **Area:** `risk-decisions-under-uncertainty` · owned by the COO skill. **Use when:** Decide whether to act now, buy the right to act later, or wait, when a disruption might or might not happen, using decision trees, breakeven probabilities and the value of information. Use for choices like pre-buying stock, booking backup freight or capacity, qualifying a second supplier, buying insurance or a forecast, when the odds come from judgment rather than history.

**Outcome:** a recommended strategy (what to do now and what to do when the uncertainty resolves), its expected cost and worst case, the range of probabilities over which it stays best, and a ceiling on what information or warnings are worth.

## When to use
- A possible disruption (closure, strike, ban, supplier failure, price spike) before a deadline.
- Choosing between mitigation, a contingency (option) and waiting.
- Someone offers a forecast, briefing or consultant study and you must decide whether it's worth the price.
- Probabilities are uncertain and people disagree.

## Method

### 1. Frame the three ways to pay (prevent, detect, respond)
- **Mitigation:** paid every time, lowers likelihood or impact (safety stock, firm backup booking, second supplier used daily).
- **Contingency:** a small payment now for the right to act later if triggered (capacity option, pre-qualified backup supplier, reserved freight). Needs capability built before the event.
- **Crisis management:** act after the event at crisis prices with whatever is left (spot buying, expediting, brokers, redesign).

### 2. Lay out the numbers in one table
- Each action's costs and when they're paid (now, later, only if exercised), refunds and cancellation fees, penalties, the crisis price, and p, the chance of the event by the date you'll know.
- p comes from judgment: base rates (how often such events happen), current signals, several independent estimates (median).

### 3. Draw the tree
- Square = decision, circle = chance (branch probabilities sum to 1), end = total cost of that whole path.
- Time runs left to right: decide, learn, decide again. Include the later decision (exercise or lapse, spot or air) under each first-move branch.
- Each end counts every outflow on the path: premiums are paid whether or not used; fees only if you cancel.
- A payoff matrix lists only today's actions; the tree finds plans with a second decision, which is often the winner.

### 4. Fold back (right to left)
- At a decision node keep the cheapest branch; at a chance node take the expected value.
- The root's best branch plus the later choices = the recommended strategy, for example "buy the option; exercise only if disrupted".

### 5. Breakevens: how wrong can p be?
- Write each plan's expected cost as a line in p and solve where they cross. Report: "below p1 wait; between p1 and p2 the option; above p2 mitigate".
- You don't need the exact p, only which side of the breakeven you're on. A wide middle band means the decision is robust.
- Run a sensitivity check (tornado) on the other inputs; the ones that move the answer are where to spend research.

### 5b. Choose the critical assumptions by headroom, not tornado rank (standard practice)
A tornado drawn with the same ±10% on every input ranks inputs by slope, not by danger. An input with a gentle slope but a wide plausible range (an imported cost with no quote, a tariff, a carbon price, an exchange rate) can flip the decision while sitting low on the chart.
1. For each input, solve for its **break-even value**: the value, others held at base, where the decision flips (NPV = 0, or two plans' expected values cross).
2. **Headroom** = (break-even − base) ÷ base, as a percentage, in the direction that hurts.
3. Set each input's **plausible range** from evidence (quotes, history, dated price ranges), not a uniform ±10%. Inputs with no quote get wide ranges.
4. **Critical** = any input whose plausible range reaches or crosses its break-even, whatever its tornado rank. Flag "watch" when the range comes within a few points of it.
5. Research, hedge or contract the critical inputs first, and carry them into the risk register (`risk-and-compliance`, step 17).

Worked numbers: a plan's base NPV is $500k; each input moves NPV linearly.

| Input | NPV change per 1% move | Swing at ±10% (tornado rank) | Break-even headroom | Plausible range | Verdict |
|---|---|---|---|---|---|
| Sales volume | $40k | ±400k (1) | −12.5% | ±10% | Watch: 2.5 points spare |
| Unit price | $30k | ±300k (2) | −16.7% | ±5% | Safe |
| Operating cost | $20k | ±200k (3) | +25% | ±10% | Safe |
| Imported hardware cost | $18k | ±180k (4) | +27.8% | −10% to +45% (no quote; tariff and FX exposure) | **Critical**: range crosses break-even |

Taking the top three tornado bars as the "key assumptions" misses the one input that can turn the plan negative: hardware at +45% gives NPV = 500 − 45 × 18 = −$310k.

### 6. Value of information
- **Perfect information (EVPI):** re-solve as if told the outcome first; EV with perfect info = sum over outcomes of p x best cost given that outcome. EVPI = best EV now − that. Never pay more than this for any forecast.
- **Imperfect information (EVSI):** a signal with known accuracy P(signal | state).
  1. Joint table: prior x likelihood for each state and signal; column totals give P(signal).
  2. Posterior P(state | signal) = cell / column total (Bayes).
  3. Re-solve the tree for each signal with its posterior p; weight by P(signal).
  4. EVSI = best EV now − that weighted value. Buy if EVSI > its price.
- Information is worth only what it changes: if no signal would change the decision, it's worth zero.

### 7. Beyond the expected value
- Show each plan's worst case. A firm that can't absorb the bad outcome may pay more for a certain cost (mitigation) even below the breakeven.
- Simulate many repetitions: the best plan can cost more than waiting in most individual outcomes and still be best on average.
- Note what the tree leaves out (a qualified second source stays useful after the crisis; relationships; reputational costs) and adjust judgment.
- Judge decisions by their logic and information at the time, not by the outcome ("resulting"). Record the reasoning when deciding.

## Worked pattern
An importer's next container could be hit by a port strike (p = 0.25). Options, in $k: wait (0 if no strike; airfreight 200 if strike); pre-buy 6 weeks of buffer stock now (60 either way); pay 15 to reserve an alternate port and supplier, exercised for 50 more only if the strike happens.
- Expected costs: wait 50; buffer 60; option 15 + 0.25 x 50 = 27.5. Recommend the option, exercise if the strike happens.
- Breakevens: option beats waiting when 15 + 50p < 200p, p > 0.10; beats the buffer when p < 0.90.
- Perfect warning: told "no strike", wait (0); told "strike", pre-buy the buffer (60, cheaper than the option's 65). EV = 0.75 x 0 + 0.25 x 60 = 15; EVPI = 27.5 − 15 = 12.5.
- A labor-relations briefing that says ALERT in 80% of strikes and 10% of non-strikes: P(ALERT) = 0.275; P(strike | ALERT) = 0.73, P(strike | CLEAR) = 0.07. Best after ALERT: option ≈ 51.4; after CLEAR: wait ≈ 13.8. Weighted 24.1; EVSI ≈ 3.4. Worth buying only if it costs under $3.4k.

## Common mistakes
- Comparing only "act now" vs "wait" and missing the option.
- Forgetting the premium is sunk in both branches, or charging cancellation fees the contract refunds.
- Arguing over the exact p instead of locating the breakevens.
- Picking key assumptions by tornado rank on a uniform ±10%, instead of by headroom against each input's plausible range.
- Paying for forecasts above EVPI, or treating P(signal | state) as P(state | signal).
- Ignoring worst cases and the firm's ability to absorb them.
- Grading the decision by how it turned out.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- Risk attitude is handled by judgement on the worst case; no utility functions or certainty equivalents.
