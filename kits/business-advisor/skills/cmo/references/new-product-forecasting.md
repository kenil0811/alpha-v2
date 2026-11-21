# New-product forecasting and promotion response

> **Area:** `new-product-forecasting` · owned by the CMO skill. **Use when:** Forecast how fast a new product or category will be adopted (Bass diffusion: when sales peak, how big, how price or advertising shift the curve), turn category sales into brand sales, split category sales among competing brands, and measure how price cuts, features, displays and advertising move a brand's sales (Scan*Pro, ad-response and Adstock models, media mix, word-of-mouth effects). Use when someone asks "how many will we sell in year 3?", "when will sales peak?", "is this promotion worth it?" or "what does a 1% price cut do to volume?"

**Outcome:** a year-by-year (or quarter, month, week) adoption forecast with its peak, built from data or from analogues; and a fitted response model that says what each promotion lever is worth, so promotions and ad budgets are chosen on profit, not on volume spikes.

## When to use
- Launching a durable, a subscription or a new category, and the plan needs a believable sales curve rather than a straight line.
- A product is a few periods in: "where are we on the curve, and how much is left?"
- Choosing between a high launch price and a lower one, or between launch ad budgets, and you need the effect on adoption timing.
- A retailer or brand manager asks whether a temporary price cut, a feature ad or an in-store display paid back.
- Setting an ad budget from weekly sales and spend history.

Related: `market-sizing-and-unit-economics` (the market size M and what each adopter is worth), `pricing-strategy` (the price itself and elasticity theory), `market-entry-and-go-to-market` (market entry and go-to-market) (sequencing segments, which shifts p and q), `demand-forecast-distributions` (COO: forecast error for stocking).

## Method

### 1. Separate the two demands
- **Primary demand:** how many people adopt the category over time. Forecast it with a diffusion model (steps 2 to 6).
- **Secondary demand:** which brand they choose and how marketing levers move that choice. Model it with response models (steps 7 to 9).
- Brand sales = category sales × brand share. Do not forecast a brand straight from its own short history when the category is still growing.

### 2. The Bass model
Terms:
- **M**: market size, the total number who will ever adopt.
- **p**: coefficient of innovation, the pull from outside (advertising, media, the product itself) on people who have not adopted.
- **q**: coefficient of imitation, the pull from people who already adopted (word of mouth, being seen).
- **A(t)**: cumulative adopters by the end of period t; **N(t)**: new adopters in period t.

Discrete form: N(t) = [p + q × A(t−1) ÷ M] × [M − A(t−1)]. Each period, the remaining market is converted at a rate that rises as more people have adopted.

Continuous form (more accurate; forecasts any period directly without running every earlier one):
- A(t) = M × (1 − e^(−(p+q)t)) ÷ (1 + (q/p) × e^(−(p+q)t)); N(t) = A(t) − A(t−1).
- Fractional t works, so a model fitted on quarters can give a month (t in steps of 1/3) or a week (steps of 1/13). Sub-period forecasts do not add exactly to the period's forecast, because the curve bends inside the period.

Shape rules:
- Peak time t* = ln(q/p) ÷ (p + q); peak sales = M × (p + q)² ÷ (4q) (standard results).
- q much larger than p: slow start, sharp late peak (word-of-mouth products). p close to q: sales start fast and decline early (heavily advertised, little social proof).
- Typical published averages are about p = 0.03 and q = 0.38 a year (standard practice); use them only as a last resort.

### 3. Estimate p, q and M from sales data
1. Collect at least 8 to 12 periods of adoptions (first purchases, not total sales). Estimates are stable only once the data include the peak of new adoptions; before it, small shuffles in early data move M a lot.
2. Fit by nonlinear least squares (any solver that minimises squared error on the continuous form works). The simpler, less precise route: regress N(t) on A(t−1) and A(t−1)² by ordinary least squares; with coefficients a, b, c, solve M from c·M² + b·M + a = 0 (take the positive root), then p = a ÷ M and q = −c × M.
3. Check significance (|t| of about 1.6 or more is a workable cut-off), fit (R² of predicted versus actual) and that M is plausible against the bottom-up size.
4. Forecast forward with the continuous form; state the peak period and the share of M already reached.

### 4. Forecast before launch (no data)
- **Analogues:** pick 2 to 4 past products for their product and market traits (buyer, benefit, price relative to income, visibility, revenue model, need for complementary infrastructure), never for the curve you hope to get. Score each analogue's similarity on 2 or more weighted criteria (say market structure 0.4, product traits 0.6, each scored 1 to 10), turn the scores into weights that sum to 1, and take the weighted average of p and q. A product similar on one criterion but not the other gets a middling weight.
- **If no analogue fits:** reason about what raises each coefficient. p rises with launch advertising, distribution reach and a low trial barrier; q rises with visibility of use, network effects and a strong, talkable advantage. Bracket a conservative and an aggressive pair.
- **M:** use the chain-ratio method (population × share with each precondition × share who would adopt, each step sourced) or purchase-intention surveys with a haircut (for example count most "definitely" and a fraction of "probably" answers; standard practice); intent surveys tend to overstate M. Count potential adopters, not purchases. Cross-check with `market-sizing-and-unit-economics`.
- **M depends on price:** a survey that asks intent at several hardware and subscription prices gives a grid of M values. Run the forecast at the plausible corners, especially for prices the firm does not control (a partner's device price, for example).
- **Sanity checks:** forecasts written as "x% of some installed base by year n" usually never state M and run far ahead of a Bass curve; ask which p would be needed to match them. Split the curve into innovator and imitator adoptions (p × remaining market versus the rest) to explain the shape: a high barrier to trying (new hardware, a new fee) means few innovators and a late, imitation-driven take-off.
- Re-estimate as soon as 6 to 8 periods of real data arrive.

### 5. Add price and advertising (Generalized Bass Model)
Quick form: multiply the period's Bass adoptions by Z(t) = 1 + α × (P(t) − P(t−1)) ÷ P(t−1), where α (usually negative) is the % change in adoption speed from a 1% price change. A rough α comes from the survey grid: % rise in M divided by % fall in price. The effect lasts one period only and treats innovators and imitators alike.

The fuller version replaces time t with "effective time" that runs faster when marketing is stronger:
- With price: replace (p + q)t with (p + q)t + b × ln(Price_t ÷ Price_1), where b is negative. Falling prices speed adoption; a price cut pulls adoptions forward but does not raise M.
- With advertising: same idea with an advertising term, b positive.
- Use it to compare launch price paths (skim then cut, versus low from the start) on timing of cash, not on total adopters.

### 6. Repeat and replacement purchases
- The Bass curve counts adopters. If the product is replaced every k periods, sales in period t = N(t) + N(t − k) + N(t − 2k) + ... (first-time replacers, second-time, and so on).
- To estimate the model from sales that already include replacements, first subtract the replacement purchases implied by earlier adopters, period by period, to recover adoptions; then fit.
- Consumables and subscriptions: use the Bass curve for trial (first adoption) and a separate repeat or churn model for ongoing volume (`market-sizing-and-unit-economics`).

### 6a. Competitors and data-driven forecasts
- Bass forecasts the category, not a firm. Before launch, with nothing to tell rivals apart, an even split is a placeholder only. With prototypes or descriptions, run a choice-based study (conjoint: attributes such as price, content, features, at set levels), sum each respondent's choice probabilities into shares, and apply them to the Bass category curve at each period.
- After a few years of sales, moving averages and exponential smoothing (forecast = β × last actual + (1 − β) × last forecast; high β reacts fast, low β smooths) forecast the next few periods well. They have no ceiling and run in a straight line unless trend or season terms are added (Holt, Winters), so use them as a rolling forecast of about five periods, refitted as each actual arrives, never for the long run.
- Which tool: Bass needs no product sales history and models adoption; Generalized Bass adds price and advertising; choice models give shares from preferences; smoothing needs the product's own history.

### 7. Brand share (logit)
- Model a brand's share against a base brand: ln(S_j ÷ S_base) = a_j + b × (A_j − A_base), where A is advertising (or any lever).
- a_j is the brand's own pull at equal spending; b is how much relative spending moves share.
- Unlike a straight line, the response flattens at very high or very low share. Brand sales forecast = category forecast (Generalized Bass) × predicted share.
- **Word of mouth works at three levels** (published research on durables): talk about the category in general grows the category (the Bass q); a brand's owners talking about what all brands share also grows the category; and their talk about what is unique to the brand grows that brand. So a brand's price cut or campaign wins buyers now, and those buyers bring more buyers later and enlarge the category. A model that holds the category fixed understated a price cut's brand gain by a large share in that research's simulation. Early entrants kept a sales edge after these effects were allowed for. Refit when the category changes shape (a new premium tier, for example), or the split between the levels is misread.

### 8. Promotion response (Scan*Pro)
Weekly store or chain data for a brand: unit sales Q, own price P, competitor price Pc, and 0/1 flags for a feature ad F and an in-store display D.
- Model: ln Q = a + b × ln P + c × ln Pc + g × F + d × D. Fit by ordinary regression on the logs. The full model uses a price index (actual ÷ regular price), one base level per store and a dummy per week for season and missing factors, and separate multipliers for feature only, display only, and both together; a competitor's feature multiplier below 1 is your loss (0.8 means 20% fewer units).
- **Own-price elasticity** = b (constant at every price). **Cross-price elasticity** = c (positive means the competitor is a substitute).
- **Feature multiplier** = e^g: sales are multiplied by this in a feature week, with price held fixed. **Display multiplier** = e^d.
- **Base brand strength** = e^a: sales at a price of 1 with no support; compare across brands or stores on the same data.
- Promotion profit test: (promo price − unit cost) × promo units − feature and display fees − units pulled forward from later weeks, versus (regular price − unit cost) × base units. A price cut alone rarely pays when elasticity is near −2 and margin is thin; it pays when combined with features and displays that multiply volume.
- Where the lift comes from: in published store studies roughly a third each came from rival brands, from buyers stocking up early, and from category growth; with a feature, stocking up can be about half. Add lead and lag price terms (the weeks before and after) to see it; shifts in timing were up to a quarter of the lift.
- Rules of thumb from that research: discounts under about 10% barely move sales (threshold) and depth beyond about 25% adds little (saturation); frequent or recent deep deals make buyers less responsive; display or feature alone often doubles sales; effects are asymmetric between brands.
- Fit on store-level data: a log model fitted to chain or market totals overstates the multipliers, more so when only some stores promote.
- Build in stages: start with the simple model managers can read, then add store differences, lead and lag terms or flexible deal curves as data grow and questions sharpen. Simple models estimate reliably on small samples; fuller ones cut bias once the data are large.

### 9. Advertising response
- Three ways to learn what advertising does: structured judgement (pooled executive estimates, quick but biased), experiments (spend differently in matched regions or audiences; the most reliable, but slow and narrow), and response models on history (complete, but need good data). Use models to cover the whole mix and experiments to check the big claims.
- Shape: response is normally concave (each extra dollar adds less); an S-shape (a threshold before spend works) exists but is the exception. Do not extrapolate a model beyond the spend range in the data.
- Linear model (Sales = a + b × Ad + g × Price) gives a different ad elasticity at every spend level. The multiplicative model ln Sales = a + b ln Ad + g ln Price gives a constant elasticity b, easier to plan with.
- **Carryover:** add last period's advertising (and the one before): ln Sales = a + b0 ln Ad_t + b1 ln Ad_t−1 + b2 ln Ad_t−2 + g ln Price. Total ad elasticity = b0 + b1 + b2. Each extra lag costs data and invites collinearity; stop when lags stop adding.
- Zero-spend weeks break logs: replace zero with 1% of the average non-zero spend (a common rule).
- **Adstock** (a practitioner shortcut): ad stock this period = a × last period's stock + (1 − a) × this period's spend, with decay a between 0 and 1; regress sales on the stock. Estimate a from the data (grid-search the best fit); a guessed decay tends to overstate the effect. Part of what looks like carryover is really repeat buying by customers the ad first won.
- Media mix: give each medium (TV, print, direct mail, search) its own elasticity and lags when spend patterns vary enough; add a 0/1 term for a new creative to test copy.
- Asymmetry and wear: a campaign's start can lift sales more than its continuation; a mature brand may not gain from more spend but lose from cuts; response can fade under constant spend (wear-out) and build over repeated exposure (wear-in). Advertising works more on trial than on repeat.
- Pitfalls in the data: use the finest interval available (weekly beats quarterly) and region-level rather than summed national data. Budgets often follow sales (last year's sales, matching rivals, spending more on expected hits), so a plain regression credits advertising with sales it did not cause; weekly data, lagged effects and experiments guard against this.
- Long run: an ad that shows no short-run lift rarely shows a long-run one; for ads that work, the long-run effect was about twice the first-year effect. Multi-equation (vector autoregression) models trace sales, own spend and rival spend together when the long run matters.
- Benchmarks: advertising elasticity averages about 0.1, around 0.3 for new products and near 0.01 for established ones; price elasticities are much larger (temporary price cuts often beyond −2). So a small price change often moves more volume than a large ad change. Smaller brands tend to spend a higher share of sales on advertising. Other payoffs worth measuring: awareness, price premium, distribution, sales-call success.
- Search keywords: model cost per click and click-through rate as functions of ad rank (log-linear in rank), then pick the rank whose extra clicks are worth their extra cost.

Formula sheet and worked steps: `cmo/references/new-product-forecasting/bass-and-response-formulas.md`.

## Worked pattern
A regional maker launches a smart water-leak sensor. Bottom-up size: 200,000 households will ever buy (M). No sales yet; analogues (home security cameras, smart thermostats) suggest p = 0.02, q = 0.35 a year.
- Continuous Bass: year 1 ≈ 4,700 adopters, year 2 ≈ 6,500, year 3 ≈ 8,600, year 5 ≈ 13,900. Peak at t* = ln(17.5) ÷ 0.37 ≈ 7.7 years, at about 19,600 a year. Half the market (100,000) is reached only in year 8.
- Plan consequence: a business plan with 20,000 units in year 2 assumes a curve three times steeper than the analogues; it needs a reason (a utility partner subsidy raising p, for example).
- Replacement every 6 years: from year 7, sales = new adopters + those who adopted 6 years earlier, so year 7 ≈ 18,500 + 4,700.
- Retail promotion, once on shelf: Scan*Pro fitted on store data gives ln Q = 6.0 − 2.2 ln P + 0.8 ln Pc + 0.6 F + 0.4 D. At $5 regular price, cost $3, base 1,000 units a week. A 10% cut alone: units × 0.9^−2.2 = 1,261, profit 1,261 × $1.50 = $1,891, below the base $2,000. The same cut with feature and display: 1,000 × 1.26 × 1.82 × 1.49 ≈ 3,430 units, profit ≈ $5,140 before fees; with a $1,500 fee and 400 units pulled forward from later weeks (−$800), net ≈ $2,840. The price cut is worth running only with the support.

## Common mistakes
- Fitting Bass to total sales that include repeat or replacement purchases.
- Trusting M from four early data points; it can swing by half with small changes.
- Reading a big launch spike as a big market (high p, not high M).
- Using a price cut in the Generalized Bass Model to "grow" the market; it moves adoptions earlier.
- Reporting a promotion's volume lift without its profit, fees and post-promotion dip.
- Using the linear ad model's elasticity at one spend level as if it held everywhere.
- Adding lag after lag of advertising until coefficients turn nonsensical (collinearity).
- Forecasting brand sales directly while the category is still diffusing.
- Picking analogues for the curve you want, or averaging them equally when some fit far better.
- Extrapolating exponential smoothing for years; it never stops growing.
- Fitting promotion models on chain totals, or reading every promoted unit as new demand.
- Treating ad spend as a cause when the budget was set from sales.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- Perceptual maps and brand switching are covered in `brand-and-positioning`.
- Infinite-carryover (Koyck) models are not covered.
- The brand-level word-of-mouth model is described, not given as a spreadsheet method; its estimation needs specialist software. The numbers in the worked pattern are invented.
