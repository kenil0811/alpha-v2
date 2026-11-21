# Validating a people measure

Depth for `chro/references/people-analytics.md`, steps 1 to 3.

## Deficiency and contamination
A measure and the construct behind it overlap only partly (from published work on principles of good measurement):
- **Deficiency**: parts of the construct the measure misses. Measuring "a great place to work" by satisfaction with pay alone misses the job itself, managers and belief in the strategy.
- **Contamination**: things the measure picks up that aren't the construct. Measuring a bank teller's cross-selling skill by total branch sales picks up sales that had nothing to do with cross-selling.
- The overlap is the measure's construct validity.

Fixes: several measures for several dimensions of the construct (one retailer cut a 70-item survey to 10 items grouped as attitude to the job and attitude to the company), and for each measure ask what else moves it. A deficient measure also steers behaviour: score sales staff only on time spent with customers and they will drag out conversations. You can't measure A and hope for B.

## Four kinds of number
| Kind | What it tells you | People examples | What you can do with it |
|---|---|---|---|
| Nominal | Category only | Department, gender, contract type | Count; compliance reporting |
| Ordinal | Order, not distance | Rankings, "good / better / best", promotion lists | Say who is ahead, not by how much; fine for succession lists |
| Interval | Equal steps, no true zero | Agreement scales treated as 1 to 5 | Averages and differences, cautiously |
| Ratio | Equal steps and a true zero | Pay, days absent, units, time, headcount | "Half as much", rates, money |

Ratio measures are easy to collect and carry meaning, but easy is not the same as valid. Measurement quality is a continuum: pick the level of rigour the firm can actually reach.

## Good data: reliable, variable, valid
A simple screen from research on rating others; ask it of any data set put in front of you:
1. **Reliable**: it doesn't change when the thing measured hasn't (a thermometer that jumps 50 degrees in ten minutes is broken). Counted things (pay, days absent, units sold) are usually reliable. Check this first: no reliability, no validity.
2. **Variable**: it shows the real range. A scale where nearly everyone answers 4 or 5, or a five-point rating where managers never use 1 or 2, can't separate people. Ask for the scatter plot. Range created by forcing a curve or a calibration meeting is not real range.
3. **Valid**: its range predicts range in something else, measured another way (engagement scores predict who later stays).

## Classical test theory in four lines
- **X = T + E**: an observed score is the true score plus random error.
- **E(X) = T**: averaged over many measurements, the observed score equals the true score.
- **Var(X) = Var(T) + Var(E)**: spread in scores is real spread plus error spread.
- **Reliability = Var(T) / Var(X)**: the share of score variation that is real. 1.0 is perfect; 0.5 means half the differences you see are noise.

Assumptions behind it: the error is unrelated to the true score, errors of two different measures are unrelated to each other, and one measure's error is unrelated to another measure's true score. When raters or items share a bias, these fail and averaging stops helping.

## Averaging raters, items or occasions
More independent measures make the average more reliable (like stacking grainy film frames until the noise cancels). The standard formula (standard practice) is Spearman-Brown:

reliability of k averaged measures = k × r / (1 + (k − 1) × r), where r is the reliability of one.

| One rater's reliability | 2 raters | 3 raters | 5 raters |
|---|---|---|---|
| 0.40 | 0.57 | 0.67 | 0.77 |
| 0.60 | 0.75 | 0.82 | 0.88 |

So two structured interviewers scoring independently beat one; the gain shrinks after three to five.

**The limit of averaging.** This works only when each rater's error is independent and random. Rater-reliability research argues the opposite case hard: errors from a faulty instrument or a shared bias are systematic, and adding more of them adds error rather than cancelling it (its example is a satellite pointed wrong because one of its two averaged sensors was faulty). How to hold both:
- Averaging several raters does dilute each rater's personal leniency or harshness, because those differ between raters (standard practice).
- It does nothing for a bias the raters share, for raters who rarely see the work, or for a vague construct each defines differently. More raters of that kind give a precise wrong answer.

So fix the question and the raters' exposure to the work first (see `chro/references/people-analytics/hiring-and-performance-measures.md`), then average.

## Noise and regression to the mean (standard practice)
Because X = T + E, the people with the highest scores on any one occasion are, on average, partly lucky. Measure them again and they will usually score closer to the average, with no change in skill. Before concluding that a top performer "slipped" or a coaching programme "fixed" the bottom group:
1. Compare with a group that got no intervention.
2. Use several periods, not one.
3. Expect extreme scores to drift back by roughly (1 − reliability) of their distance from the mean.

Example: ratings have reliability 0.6 and average 3.0. Someone rated 4.5 this year is expected next year at about 3.0 + 0.6 × 1.5 = 3.9, before any real change.

## Building a composite
Rankings and scorecards combine components with weights. Each choice changes the answer: which components, their weights, how each is scaled, and who is in the pool. For each component, ask which part of the construct it captures and what else moves it (for example, an entry test score measures who was admitted, not what the programme added). A weighted average of several independent composites is usually more reliable than any one, but it inherits any bias they share.

## Reading a multi-trait multi-method (MTMM) matrix
Measure two or more traits with two or more methods (survey, essay, rater A, rater B, text analysis), correlate everything, and put reliabilities on the diagonal.

What to compare:
- **Validity diagonal** (same trait, different methods): should be clearly positive. This is convergent validity.
- **Same method, different traits**: if high, the method is driving scores (method effect).
- **Different trait, different method**: should be lowest.
- Judge by comparing correlations with each other, not by any one number; validity-diagonal values should beat the method-effect values.

Worked example (own numbers): two traits, "client care" and "technical skill", each rated by a team lead and measured by a client survey.

| | Lead: care | Lead: skill | Survey: care | Survey: skill |
|---|---|---|---|---|
| Lead: care | (0.85) | | | |
| Lead: skill | 0.78 | (0.88) | | |
| Survey: care | 0.22 | 0.15 | (0.80) | |
| Survey: skill | 0.10 | 0.25 | 0.18 | (0.82) |

Reading: the lead's two scores correlate at 0.78 but agree with the survey on the same trait at only 0.22 and 0.25. The lead's ratings mostly measure the lead's overall view of each person (a halo, or rater effect). The survey separates the traits (0.18) and is the better source on its own; the lead's ratings need behaviour anchors or a second rater.

The same check works for culture: score each firm's culture dimensions from review-site text, annual report language and an employee survey; if one source correlates highly across all its own dimensions, it is measuring its own tone, not culture.

## Common people metrics (standard practice)
- **Turnover rate** = leavers in period / average headcount. Split voluntary from involuntary, and regretted from non-regretted.
- **Early turnover** = leavers within 12 months of hire / hires in that cohort. A selection and onboarding signal.
- **Turnover cost** = leavers × cost per leaver (recruiting, vacancy cover, training, lost output). Rough guide: half a year's pay for entry roles, 1.25 times for mid-level, twice for senior.
- **Absence rate** = days absent / scheduled working days.
- For any metric: write the construct it stands for, its likely errors, and who could game it.
