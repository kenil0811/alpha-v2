# Ratio analysis

> **Area:** `ratio-analysis` · owned by the CFO skill. **Use when:** Measure and explain a business's profitability with ROE decompositions (DuPont and the operating ROA model), margins, turnovers and the cash conversion cycle, benchmarked over time and against peers. Use when asked how well a business is performing, why its returns differ from a competitor's, or which operating lever (price, cost, asset use, leverage) to pull.

**Outcome:** a business learns how much return it earns on the money invested, what drives it
(margin, asset use, leverage), and how that compares with its own past and its competitors.

## When to use

- "Are we doing well?" "Why does the competitor earn more on the same sales?"
- Before a forecast or valuation: ratios become the forecast drivers.
- Choosing where to act: margins, working capital, fixed assets or financing.

## Method

### 0. Start from the question and the business

Define what you want to know, then understand how the firm makes money (strategy, customers,
segments), then pick the measures. Ratios without a story are a list, not an analysis. Use
segment data to find the parts of the business that produce the profit.

### 1. Use averages and consistent periods

Flows (income) cover a period; balances (assets, equity) are points. Divide a flow by the
**average** of beginning and ending balances. For a multi-year ratio, sum the flows and average
all the balances in the window, then convert to a per-year figure.

### 2. Basic DuPont

- **ROE** = NI / average SE: the return to owners; the headline measure.
- ROE = ROA × financial leverage = (NI / avg total assets) × (avg total assets / avg SE).
- ROA = return on sales × asset turnover = (NI / sales) × (sales / avg total assets).

Different business models produce the same ROA in different ways: grocers and wholesalers run
thin margins and high turnover; utilities and miners the reverse. Benchmark within an industry.

### 3. Operating ROA model (preferred)

Basic ROA mixes what equity holders receive (NI, after interest) with what both debt and
equity holders invested (total assets), and mixes operating with financial assets. Fix both:

- **NOPAT** (net operating profit after tax) = operating income × (1 − t),
  or = NI − non-operating income × (1 − t) (add back after-tax net interest expense).
  - t: the statutory rate (federal plus state). Avoid the effective rate for the interest tax
    shield: it mixes in foreign rates and one-off tax items.
  - Decide what is operating with judgement: a gain on selling part of the business can be
    operating; interest income on spare cash is not.
- **Net debt** = short-term debt + long-term debt (+ lease liabilities) − cash and marketable
  securities.
- **Net operating assets (NOA)** = (total assets − cash and investments) − (total liabilities
  − debt) = operating assets − operating liabilities = net debt + equity.
  Payables and accruals are netted out because their financing cost is already inside the
  operating expenses; deferred taxes are free financing.
- **Operating ROA** = NOPAT / avg NOA = NOPAT margin (NOPAT / sales) × NOA turnover
  (sales / avg NOA).
- **ROE = Operating ROA + (Operating ROA − after-tax net interest rate) × (net debt / equity)**.
  The bracket is the **spread**; net debt / equity is **net financial leverage**.
  After-tax net interest rate = net interest expense × (1 − t) / avg net debt.
  Leverage raises ROE only when the spread is positive, and it raises risk either way.

Adapt the definitions to the question: for a bank, financial assets are the operations, so
interest income stays in NOPAT; for common shareholders, treat preferred stock as debt.

Line-by-line classification (leases, derivatives, equity-method income, "other" items, IFRS
statements), the textbook's names (NNO, FLEV, NNEP), cash-rich firms where ROE falls below
operating ROA, the non-controlling-interest ratio, negative equity after buybacks and
company-defined ROIC: `cfo/references/ratio-analysis/operating-classification.md`.

**Margin versus turnover.** Many margin-turnover pairs give the same operating ROA. Capital-heavy
industries (utilities, railways, oil and gas, IP-heavy technology and biotech) need high margins
to offset low turnover; retailers and household-goods firms live on thin margins and fast
turnover. A higher margin across industries is not better management. A conglomerate's ratios
are a weighted mix of its industries: split by segment. Research finds the two
components predict future profit and share returns better than earnings alone.

### 4. Drill below margin and turnover

Margins: gross profit / sales, SG&A / sales, NOPAT / sales, any cost line that the strategy
says matters (advertising for a brand, R&D for a technology firm).

Turnovers and days (use 365 or 360 consistently):

- Receivables turnover = sales / avg AR; days receivable = 365 / turnover.
- Inventory turnover = cost of sales / avg inventory; days inventory = 365 / turnover.
- Payables turnover = purchases (or cost of sales) / avg AP; days payable.
- **Cash conversion cycle** = days inventory + days receivable − days payable. Negative is
  possible and good (customers pay before suppliers are paid).
- **Cash freed by a shorter cycle** = change in days × sales per day (receivables) or cost of
  sales per day (inventory, payables). Then ask whether the gain is too good: tighter credit,
  thinner ranges or "leaning on the trade" buy cash now at the cost of sales and suppliers later.
- Gross margin falling: price pressure, an ageing product line, input costs not passed on, a mix
  shift to cheaper lines, or lower volume spreading fixed overhead. Expense margin falling: check
  it is not a cut to R&D, marketing or pay that will cost share later.
- Leverage: liabilities / equity and times interest earned (EBIT / gross interest), read with the
  covenants in the loan agreements (see `credit-analysis`).
- Fixed asset turnover = sales / avg net PPE; working capital turnover = sales / avg operating
  working capital.

### 5. Benchmark and explain

- Compare over time (the firm's own history), across firms (close competitors), and against a
  budget or plan.
- Returns differ for three reasons: **performance, risk, and mismeasurement** (accounting).
  Before praising a high ratio, rule out the other two.
- Expect reversion: very high or very low ROEs drift towards normal levels (roughly 10–15% for
  US firms historically) as competition responds. A one-year outlier is weak evidence.
- Strip out unusual items (asset sales, impairments, restructuring) before comparing.
- If the business mix differs (a retailer that also runs a credit-card book), restate one firm
  without the unlike segment before comparing.
- Separate real improvement from accounting improvement: longer depreciation lives or buybacks
  lift reported ratios without creating value.
- Common-size the statements (income lines as % of sales, balance sheet lines as % of total
  assets) and track them over time; a growing dollar figure can be a shrinking share. For a
  year-on-year % change from a negative base, divide by the absolute value of the base.
- Know the limits: brands, know-how and R&D are mostly off the balance sheet; assets sit at
  historical cost; acquisitions, divestitures, strategy shifts, life-cycle stage, seasonality and
  52/53-week years break comparisons. Restate before comparing.
- Case lessons (a retailer restated across a turnaround, two banks in a crisis year, a streaming
  service whose growth stalled): `cfo/references/ratio-analysis/case-lessons.md`.

### 6. Write the conclusion first

State a conclusion, then the three or four ratios that support it, linked to the strategy.
Do not tour every ratio.

## Worked pattern

A small chain: sales 2,000; operating income 160; net interest expense 20; tax rate 25%;
NI = (160 − 20) × 0.75 = 105. Average NOA 1,000; average net debt 400; average equity 600.

- NOPAT = 160 × 0.75 = 120. Check: 105 + 20 × 0.75 = 120.
- NOPAT margin 6.0%; NOA turnover 2.0; operating ROA 12.0%.
- After-tax net interest rate = 15 / 400 = 3.75%; spread = 8.25%; net leverage = 0.667.
- ROE = 12.0% + 8.25% × 0.667 = 17.5%. Check: 105 / 600 = 17.5%.
- A peer with the same ROE but operating ROA 9% and leverage 1.5 is earning its ROE through
  borrowing, not operations: weaker and riskier.

## Common mistakes

- Using ending instead of average balances, or mixing annual flows with multi-year averages.
- Calling a mechanically lower days-payable "bad" without asking whether paying suppliers sooner
  buys discounts or supply security.
- Assuming lower margin and lower turnover means anything other than lower ROA (it does mean
  lower ROA when both firms are profitable).
- Assuming more leverage always raises ROE; it depends on the spread.
- Treating all of cash as non-operating when the business genuinely needs it (this understates
  NOA and overstates operating ROA).
- Reading a ratio change as performance when it came from an accounting choice, a segment
  sale or a buyback.
- Comparing ratios across industries without a reason.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps

- No current industry benchmarks (ROA medians, reversion data); published medians date quickly,
  so source peers (Compustat or similar) for each analysis.
