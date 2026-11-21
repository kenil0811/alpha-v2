# Staged options and licensing

Depth for `corporate-strategy` step 6. Use it when a firm holds a technology, product or rights and must
choose between licensing them out, developing further first, or commercialising itself; and more generally
for any scope move that unfolds in stages with uncertain results.

## Method
1. **Draw the decision tree.** Squares are your decisions (license now, develop then license, go it alone,
   license part of the rights), circles are chance events (trial passes or fails, approval, demand high or low).
   End each branch with its cash flows and their dates.
2. **Put numbers on every branch:** costs, licence fees, milestone payments, royalties, sale proceeds,
   probabilities at each chance node. State where each number comes from.
3. **Choose the discount rate** for the risk. Early-stage, high-uncertainty work deserves a high rate. If the
   tree already weights technical failure with explicit probabilities, do not also add that risk to the rate;
   keep the rate for market and timing risk (standard practice).
4. **Fold back:** at each chance node take the probability-weighted value; at each decision node take the
   best branch; discount to today. That gives an NPV per option.
5. **Find the breakeven:** the probability, price or cost at which the best and second-best options swap.
   A ranking that flips on a small change is a coin toss; say so.
6. **List what NPV leaves out**, then weigh it. The question to ask: how much would you rely on the NPV
   alone? Usually: for ranking and for the breakevens, not for the final call.

## The shape of the choices in a typical licensing case (generalised)
A young firm with one promising product must decide how to supply early trials and how to commercialise:
- **Early stage:** build a small pilot facility, contract the work out, or license everything now for an
  upfront fee plus a small royalty. Licensing now raises cash and lets the firm focus, but gives away most
  of the upside; staff may see it as mortgaging the future.
- **Late stage (if the early stage succeeds):** either build the full-scale plant and supply the marketing
  partner at cost in return for a much higher royalty, or license manufacturing and marketing too for a
  middle royalty and a milestone payment. The extra royalty is the return on the plant investment and the
  manufacturing risk; compare it with what the plant costs and how likely approval is.
- Keeping the rights through the early stage is what keeps the later choices open. Licensing one use and
  keeping others (other indications, other regions) splits the difference.

## What NPV leaves out (a checklist)
- **Option value of waiting:** each passed milestone raises what a licensee will pay; selling all rights
  now hands the upside to the buyer. Staged deals keep the option (link: `real-options` in the CFO role).
- **Bargaining power:** a firm that can credibly go alone negotiates better terms; one that must license does not.
- **Capability building:** developing a step yourself builds know-how you keep for the next product.
- **Leakage and control:** sharing data with licensees and partners; who owns improvements; whether a
  licensee may shelve your product to protect its own.
- **Financing risk:** can the firm fund the path to the next milestone, and at what dilution?
- **People:** will the scientists or founders stay if the rights go elsewhere?
- **Partial licences:** a region, an indication or a field of use can be licensed while the rest is kept.
- **Licensee quality:** its sales reach, its commitment (diligence clauses, minimum royalties, return of rights).

## Worked pattern (own numbers)
A small firm owns a new compound. Discount rate 20%; two years to the next readout (factor 1/1.2² = 0.694).
- **A. License all rights now:** $6M upfront plus milestones and royalties worth $4M today, risk-weighted. NPV = **$10.0M**.
- **B. Run the next trial, then license:** spend $4M now; 50% chance of success. Success: $30M upfront plus
  royalties worth $12M at that date. Failure: the asset sells for $1M.
  Value at year 2 = 0.5 × 42 + 0.5 × 1 = 21.5; today 21.5 × 0.694 = 14.9; NPV = 14.9 − 4 = **$10.9M**.
- **C. Develop and sell alone:** as B, but on success build a $20M plant for a business worth $48M at year 2.
  Value at year 2 = 0.5 × 28 + 0.5 × 1 = 14.5; today 10.1; NPV = **$6.1M**. Also needs sales and manufacturing it lacks.
- **Breakeven for B over A:** 0.694 × (41p + 1) − 4 = 10 gives p ≈ 0.47. B wins only if the trial's odds are above 47%.
- **Call:** B on the numbers, by a thin margin. The omitted factors (option value kept, stronger bargaining
  after data, know-how built) also favour B; financing the $4M and the risk of a weak trial favour A. If cash
  is tight, license one region now to fund the trial and keep the rest.

## Common mistakes
- Valuing each option as a single cash-flow line instead of a tree with decisions after the news arrives.
- Double-counting risk: a high discount rate on cash flows already cut by failure probabilities.
- Treating the NPV ranking as the answer when the gap is inside the error of the inputs.
- Forgetting that licensing everything now ends the firm's chance to learn and to bargain later.
