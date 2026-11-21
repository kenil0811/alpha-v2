# Analytics for decisions

> **Area:** `analytics-for-decisions` · owned by the CDO skill. **Use when:** Turn a business question into something the data can answer, then say how sure the answer is: estimate from a sample with a confidence interval, test a difference against a break-even or between groups, size a sample or survey, check whether a new metric actually measures what it claims, and find which drivers move an outcome with regression. Use when someone asks "is this difference real?", "how many customers do we need to survey?", "will this clear break-even?", "does our brand score mean anything?", "what really drives sales?" or "should we roll this out?".

**Outcome:** a decision backed by an estimate with its margin of error, a stated level of confidence, and a clear line between what is statistically real, what is big enough to matter, and what the data cannot tell.

## When to use

- A survey, pilot, trial or sample of records stands in for the whole customer base or market.
- A launch, price or process change must clear a break-even number before it is worth doing.
- Two or more groups look different (regions, rounds, age bands, product categories) and someone wants to act on it.
- A score or index (brand equity, satisfaction, risk) is proposed as a management metric.
- A manager wants to know which of several factors drives an outcome (score, sales, churn, margin).
- After `data-preparation-and-analysis` has produced a clean table and its descriptive view; before a dashboard in `data-visualisation-and-dashboards` reports the result. A trial with money at stake also goes to `risk-decisions-under-uncertainty` (COO).

## Method

### 1. Frame the question as an analytics problem

1. Name the **decision** and the **action** each answer would trigger (launch or not, which region first).
2. Name the **population** (all current customers, all stores, all brands) and the **unit** (one customer, one player, one brand).
3. Name the **outcome measure** and the **threshold** that changes the decision (break-even sales per customer, target score).
4. Choose the type of analysis by the question (standard practice):

| Question | Type | Typical method |
|---|---|---|
| What happened? | Descriptive | Totals, means, distributions (`data-preparation-and-analysis`) |
| Why, or is it real? | Diagnostic | Confidence intervals, tests between groups, correlation |
| What will happen, or what drives it? | Predictive | Regression on drivers, forecasts |
| What should we do? | Prescriptive | Compare options on the predicted outcome against break-even and risk |

5. Write down what result would change your mind before looking at it.

### 2. Get a sample that represents the population

- Sample when a census is impossible, impractical or too costly. The same logic covers a **process** (the long-run defect rate of a line) and a **total** (multiply the estimated mean or share by the population size).
- **Random** sampling is the only reliable route to a representative sample: every member of the population has an equal chance of selection, drawn from a complete list. A customer or mailing list you hold is one of the few frames where a truly random sample is easy.
- Three sources of error, only one of which shrinks with sample size:
  - **Sampling error:** the luck of the draw; measured by the standard error.
  - **Response bias:** people change their minds, do not do what they say, cannot realistically answer (how much will you spend next year?), and answer the wording rather than the question (a positively and a negatively worded version of the same statement can flip the majority). Asking the identical question repeatedly still tracks change over time; a jump that coincides with a reworded question is probably the wording.
  - **Non-representativeness:** out-of-date lists, not-at-homes, refusals and low response (mail surveys often lose most of the sample). Whether it matters depends on whether the people missed differ on the thing measured: evening callers miss people who are out in the evening, which ruins a viewing study but may not touch a taste test.
- Replacing a non-respondent with someone of the same age, gender, income and so on removes demographic distortion, but not any link between willingness to respond and the answer. Judge whether such a link is plausible.
- A huge sample from a biased list is still biased; size never repairs selection.
- Population size barely matters: a sample of 100 gives almost the same precision for 1,000 or 1,000,000 people. Apply the **finite population correction**, √((N − n) ÷ (N − 1)), only when the sample is more than about a tenth of the population (at a tenth it changes the standard error by about 5%).

### 3. Estimate with a confidence interval

From the sample: size n, mean m, standard deviation s (divide the sum of squared deviations by n − 1, not n, because one degree of freedom is used up estimating the mean; it matters only for samples of about 10 or fewer, and more in regression where each driver uses one up).
- **Point estimate:** the sample mean, provided the values are fairly symmetric with no extreme outliers (otherwise check the median as well; standard practice).
- **Standard error** = s ÷ √n. It falls as the sample grows and as the answers cluster.
- The **confidence distribution** of the true mean is roughly bell-shaped around m with the standard error as its spread, whatever the shape of the data. Rough intervals: m ± 1 SE (68%), m ± 2 SE (95%), m ± 3 SE (99.7%). Exact z values (1.645 for 90%, 1.96 for 95%, 2.576 for 99%) and t values for small samples are refinements that rarely change a business decision (standard practice).
- **Shares** (would buy, would vote, defected): code each answer 1 or 0; the share f is the mean, s ≈ √(f(1 − f)), and everything above applies. s stays between 0.4 and 0.5 whenever f is between 0.2 and 0.8, so use 0.5 as the worst case when planning.
- **Confidence against probability:** read the interval as a probability statement about the true value only when you have no other information. If past years or common sense make the interval implausible (spend per customer has never been above half its lower bound), trust that knowledge and treat the sample as an unlucky draw or a biased one.

### 4. Test against a threshold

1. Name the critical value c that changes the decision (break-even sales per head, a 50% share, a target).
2. Either check whether c falls outside the confidence interval, or compute **t = (m − c) ÷ (s ÷ √n)**. The two give the same answer.
3. Read this one-sided, because the decision only cares which side of c the truth is on: t beyond ±2 (c outside the 95% interval) is significant at the 2½% level; t beyond ±3 (outside the 99.7% interval) at about 0.15%. The level states the remaining confidence that the truth lies on the other side of c.
4. Report the result and its level together ("above break-even, significant at 2½%"). A two-sided test doubles the level; use it when either direction would change the decision (standard practice).

### 5. Statistical against practical significance

- The true value is almost never exactly c, so a large enough sample nearly always comes out significant and a small one often does not. Significant does not mean big enough to pay; not significant means the data cannot tell, not that there is no effect.
- Read each option's **interval against the break-even**. A tight interval just above break-even is a safe, small win. A wide interval with a much higher centre and a lower bound under break-even has more downside and far more upside; unless the business is very averse to risk, the second can be the better choice even though it is not significant. Decide on the business's appetite for risk and the cost of more data, not on the significance label.

### 6. Size the sample before collecting

- Fix the full **length L** of the interval you can live with (from low end to high end) and the confidence, then: n = 4s² ÷ L² (68%), **n = 16s² ÷ L² (95%)**, n = 36s² ÷ L² (99.7%). These are the ±1, 2 and 3 SE rules solved for n.
- s is not known before sampling: guess it from a small pilot, past data or the worst case (0.5 for a share), and check how sensitive n is to the guess.
- For a share at 95% with a length of 5 points (± 2½): 16 × 0.25 ÷ 0.05² = 1,600, which is why national polls of about that size quote a margin of error of about 2½ points.
- Halving L needs four times the sample; doubling L cuts it by four. Iterate between precision and cost.

### 7. Compare groups and categories

| Situation | Method (standard practice where noted) |
|---|---|
| Same units measured twice (each player's first and last round, each store before and after) | **Paired t-test** on the differences (standard practice) |
| Two separate groups (younger against older, two brands) | **Two-sample t-test**; the unequal-variance form unless spreads are clearly alike (standard practice) |
| Three or more groups on a measure (four rounds, several brands on one rating) | One-way **ANOVA**, then pairwise tests on the few pairs that matter (standard practice) |
| Two categorical variables (brand against high or low loyalty; region against loyal or not) | **Crosstab** of counts and row percentages, with a chi-square test of independence (the test is standard practice) |

- Check group sizes and spreads first; a gap built on a handful of cases or one outlier is not a finding.
- Rerun with and without unusual categories (a brand that is not really in the market, a niche player) and report whether the conclusion survives.

### 8. Check that a metric measures what it claims

Before a constructed score (brand equity, satisfaction, engagement, health) steers money:
1. **Define the concept and pick the kind.** Brand equity, for example, has a financial form (value carried for the brand on the balance sheet) and a marketing form (what the name adds through loyalty, willingness to pay a premium and resistance to competitors). Measure one, and say which.
2. **List the dimensions** and how each is asked. A typical design rates several statements on a 1 to 10 agreement scale: familiar with the brand, unique, fits my lifestyle, the only brand for me, popular.
3. **Set the record grain.** A survey where each respondent rates several brands is reshaped to one row per respondent per brand, with the respondent's profile (region, gender, age, children, income band) repeated on each row (shape it as in `data-preparation-and-analysis`).
4. **Decide on top-box coding.** Turning a 1 to 10 rating into high (8 to 10) or low (1 to 7) makes crosstabs and shares easy to read; it throws away the spread within each band, treats a 7 and an 8 as opposites and makes the result hinge on the cut-off. Keep both versions and say what each shows.
5. **Spread and discrimination:** the score must vary across brands, and brands known to differ (a leader against a weak brand) must differ significantly on it (step 7).
6. **Who holds it:** relate the score to respondent profile (are younger or higher-income customers more loyal?) with crosstabs or a regression.
7. **Link to outcomes and redundancy:** the score should move with what it claims to predict (price premium, repeat purchase, share), and two dimensions that are almost perfectly correlated add nothing (standard practice).
8. **Verdict:** keep, revise or drop the measure, and say why. A metric that fails steps 5 to 7 is "not yet valid"; it is not tuned until it looks right.

### 9. Find the drivers with regression

1. **Turn the debate into testable questions.** Opinions about what drives an outcome ("conditions are set up to be easier on the last day", "older players are not competitive", "length beats accuracy", "putting matters more than driving") each become one comparison or one regression term.
2. **Build the table at one grain** (one row per player, store or customer), with the outcome measures (average score, money won per event, ranking points) and candidate drivers in actionable units: average distance, share of attempts on target, share reaching a milestone on time, conversions when the milestone is reached, attempts per period, success rates by difficulty band, age. Note how the table was filtered (only those who completed every stage), because that restricts what it can say.
3. **Answer the comparison questions first** (step 7): stage against stage is paired; younger against older is two groups.
4. **Plot each driver against the outcome**; look for curves, outliers and groups.
5. **Run a multiple regression.** Read each driver's **coefficient** (change in the outcome per one-unit change, others held fixed), its **t-statistic** (beyond about ±2 means distinguishable from zero, the same logic as step 4) and the **R-squared** (share of variation explained). Each driver uses up a degree of freedom, so keep the model small relative to the rows.
6. **Compare drivers fairly:** measured in different units, compare the effect of a realistic change in each (one standard deviation, or the gap between an average and a top performer), not the raw coefficients.
7. **Watch correlated drivers** (long hitters often land fewer drives on target): coefficients can swap sign or lose significance when both are in; report it rather than dropping one silently.
8. **Association is not cause.** Claim cause only with a controlled test or a strong mechanism (standard practice).

### 10. Run an experiment when you can

When the business controls the lever (price, offer, email, layout), a randomised test beats any analysis of historical data (standard practice):
1. Fix the metric, the minimum effect worth acting on and the sample size (step 6) before starting.
2. Randomise units into control and treatment; run both at the same time.
3. Do not stop early when the result first looks significant.
4. Analyse with step 7, decide with step 5.

### 11. Report the result for a decision

- Lead with the decision and the number: "average order is $47.80, 95% interval $45.10 to $50.50, above the $44 break-even".
- Say the confidence level, the sample and its known biases, and what the data cannot answer.
- Show intervals on charts as error bars or bands (`data-visualisation-and-dashboards`).
- A leader's job is to ask for the interval, the sample and the alternative explanation every time; a data-driven culture is one where those three questions are routine (standard practice).

Formula sheet and spreadsheet functions: `cdo/references/analytics-for-decisions/inference-formulas.md`.

## Worked pattern

A regional bakery chain pilots a $6 lunch bundle in a random 120 of its 2,400 weekday loyalty customers. The bundle breaks even if the average extra spend per customer per week is $2.50.

1. Frame: decision is roll out to all stores or not; unit is one loyalty customer; threshold is $2.50 per week.
2. Sample: n = 120 drawn at random from the loyalty list, m = $3.10, s = $2.40. The sample is 5% of the population, under a tenth, so no finite-population correction.
3. Standard error = 2.40 ÷ √120 = $0.219. 95% interval = 3.10 ± 2 × 0.219 = $2.66 to $3.54.
4. Test against break-even: t = (3.10 − 2.50) ÷ 0.219 = 2.74, above 2: significant at the 2½% level.
5. Practical: the whole interval sits above $2.50; the low end still adds $0.16 a customer a week, about $380 a week across 2,400 customers. Response bias is low because spend was measured at the till, not asked.
6. Groups: under-35s average $3.90 (n = 50), others $2.53 (n = 70); a two-sample t-test gives t of about 3.2, so the gain comes mostly from younger customers.
7. Drivers: a regression of extra spend on visits per week and distance to store gives $0.85 per extra visit (t = 4.1) and no distance effect (t = 0.6); R-squared 0.31.
8. Decision: roll out, promote to frequent younger visitors first, and re-measure in eight weeks with an interval no longer than $0.50: n = 16 × 2.40² ÷ 0.50² = 369, so 400 to allow for drop-outs.

## Common mistakes

- Treating a convenience sample (volunteers, best stores) as random; a larger biased sample is still biased.
- Asking people what they will spend or do and treating the answer as behaviour; changing a question's wording and reading the shift as a change in opinion.
- Reading an interval as a probability when past data says the range is implausible.
- Collapsing ratings to top-box and forgetting that the cut-off, not the customers, may drive the result.
- Reporting a point estimate with no interval, or an interval with no confidence level.
- Calling a significant result important, or a non-significant result proof of no effect.
- Testing against zero when the decision depends on a break-even threshold.
- Using a two-sample test on paired data (same players, same stores), which throws away power.
- Running many group comparisons and reporting the one that came out significant.
- Comparing raw regression coefficients of drivers measured in different units.
- Reading a regression coefficient as cause, or dropping a correlated driver without saying so.
- Adopting a new index because it has a name and a formula, before checking that it discriminates and predicts.
- Sizing the sample after the data is in.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps

- Logistic regression (for a high or low loyalty outcome), time-series forecasting and segmentation are not covered.
