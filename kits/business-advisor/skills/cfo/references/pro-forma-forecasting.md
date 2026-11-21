# Pro forma forecasting

> **Area:** `pro-forma-forecasting` · owned by the CFO skill. **Use when:** Project next year's (or the next several years') income statement and balance sheet from a small set of drivers (sales growth, margins, turnovers, leverage, payouts), with cash as the balancing item, and sanity-check the result. Use for budgets, funding needs, loan applications, scenario planning, and as the base of a valuation.

**Outcome:** a business gets a consistent set of projected statements, knows how much cash or
funding the plan needs, and can see which assumptions drive the answer.

## When to use

- Annual budget or a three-to-five-year plan.
- "How much will we need to borrow if we grow 20%?"
- Scenario and sensitivity questions (price cut, slower collections, bigger store).
- The forecast that feeds an equity valuation (see `equity-valuation`).

## Method

### 1. Six kinds of assumption

Every line in the forecast is one of these. Label each line with its type and source.

1. **Growth rate:** next = last × (1 + g). Usually sales.
2. **Proportion of another number:** cost of sales, SG&A as % of sales; tax as % of pre-tax
   income; interest as a rate × beginning debt.
3. **Ratio (turnover or days):** receivables, inventory, payables from turnover targets.
4. **Given number:** a planned capital project, a dividend, a buyback, a known contract.
5. **Articulation:** lines that follow from other statements (retained earnings = begin + NI −
   dividends; total assets = total liabilities + equity).
6. **Plug:** one line that balances the balance sheet, usually cash (or a revolving loan).

"Same as last year" is a legitimate assumption for small or stable lines.

### 2. Order of work

1. Sales: growth from history, industry growth, market share and capacity (see step 4).
2. Operating costs as % of sales; any given items.
3. Interest = rate × **beginning** debt (avoids circularity); tax = rate × pre-tax income.
4. Net income.
5. Working capital from turnovers, solving for the ending balance with averages:
   turnover = flow / ((begin + end) / 2), so **end = 2 × flow / turnover − begin**.
   - Receivables: flow = sales. From days: turnover = 365 (or 360) / days.
   - Inventory: flow = cost of sales.
   - Payables: flow = purchases = cost of sales + ending inventory − beginning inventory.
6. Fixed assets: begin + capital spending − depreciation, or a sales / net PPE turnover.
7. Debt and equity: given plans, or a target net debt / equity ratio.
8. Retained earnings = begin + NI − dividends; treasury stock changes by buybacks.
9. Total liabilities + equity; then **cash = total − all other assets**.
10. If cash comes out negative, that is the funding need: add a loan line and re-run.

### 3. Sanity checks

- Does the balance sheet balance without a hard-coded number?
- Implied ROE, margins and turnovers versus history and peers. Over several years, ROE should
  drift towards normal levels unless there is a lasting advantage.
- Does sales growth fit the asset base? Without a technology change, turnover is fairly
  stable, so big growth needs matching investment.
- Change one assumption at a time and watch every line it should move: higher margins via
  higher prices may slow sales; better service may need more assets. A spreadsheet will happily
  accept combinations that make no economic sense.

### 4. How the drivers usually behave

From evidence on large samples of US firms:

- **Sales growth** reverts towards a normal nominal rate (about 3–5%, or about real GDP growth
  plus inflation); faster for mature industries, slower for start-up industries still gaining
  share. Forecast the industry (demographics, GDP, market size) and then the firm's share;
  analysts tend to overweight firm-specific growth.
- **Margins** fade towards the industry average as competitors copy products and practices,
  and can be distorted short-term by spending such as R&D.
- **Turnovers** are fairly stable, except that very high turnovers tend to fall and small,
  fast-growing firms gain scale economies.
- **Leverage** is usually held constant; stable, profitable firms carry more.
- Keep the model simple: add detail only where you can forecast it.

### 4a. Clean the base year first

- Start from **income from continuing operations**; drop discontinued operations, gains on asset
  sales, LIFO liquidation profits, and restructuring and impairment charges unless they recur.
- Convert a LIFO user to FIFO before using its margins or inventory days as drivers.
- Tax: forecast with the company's guided rate or the statutory rate, not an effective rate
  distorted by a tax-law change or one-off settlements.
- Revenue: grow from **constant-currency** history; treat currency as a separate, unforecast
  swing. A falling deferred-revenue balance and slowing new prepayments point to slower revenue.
- Use management guidance (cost of sales %, expense ranges, tax rate, currency effect) as an
  input to test, not a forecast to copy.
- Capital spending: a high **percent used up** (accumulated depreciation / depreciable cost, well
  above 50%) means a replacement wave is due; R&D-driven firms need pipeline and patent-expiry
  schedules for revenue timing.
- Restate for 52/53-week years and for new accounting standards not applied to prior years.
- Adjusted items: `cfo/references/earnings-quality/non-gaap-and-red-flags.md`.

### 5. Present it

Show the statements side by side (last actual, forecast), with an assumptions column stating
the value and type of each driver, plus a short table of the three or four assumptions that
move the answer most and the range you tested.

## Worked pattern

Last year: sales 1,000; cost of sales 600; SG&A 250; receivables 120; inventory 90; payables
70; debt 300 at 6%; tax 25%; dividends planned 40.

- Sales +8% = 1,080. Cost of sales 60% = 648. SG&A 24% = 259.2. Operating income 172.8.
- Interest = 6% × 300 = 18. Pre-tax 154.8. Tax 38.7. NI 116.1.
- Receivables at 30 days: turnover 365/30 = 12.17; end = 2 × 1,080 / 12.17 − 120 ≈ 57.5.
  That is a big drop; check whether 30 days is realistic before keeping it.
- Inventory turnover 7: end = 2 × 648 / 7 − 90 ≈ 95.1.
- Purchases = 648 + 95.1 − 90 = 653.1; payables turnover 9: end = 2 × 653.1 / 9 − 70 ≈ 75.1.
- Retained earnings rise by 116.1 − 40 = 76.1; cash is the plug.

## Common mistakes

- Using the ending balance alone with a turnover defined on averages (or the reverse).
- Basing payables on cost of sales instead of purchases when inventory is changing.
- Charging interest on ending debt, which makes the model circular.
- Forgetting to roll dividends and buybacks through equity.
- Letting cash become a hidden negative number instead of a stated funding need.
- Projecting high growth and high margins and high turnover together without a reason.
- Adding line-by-line detail that cannot be forecast; it adds noise, not accuracy.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps

- No coverage of monthly cash budgets or seasonality; for a small business, apply the same
  method month by month (standard practice).
