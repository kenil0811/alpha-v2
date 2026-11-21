# Credit analysis

> **Area:** `credit-analysis` · owned by the CFO skill. **Use when:** Assess the risk that a company will fail to pay its debts, using liquidity, solvency, coverage, profitability, size and volatility measures and a bankruptcy-probability score, from a lender's point of view. Use when extending trade credit to a customer, lending to or borrowing for a business, checking a supplier's survival risk, or negotiating covenants; and to track, stress and value a consumer or small-business loan book (vintages, PAR, recoveries, expected loss).

**Outcome:** a business can judge how likely a customer, supplier or borrower is to default,
what would protect it if they did, and which covenant or credit limit fits the risk.

## When to use

- Setting payment terms or a credit limit for a large customer.
- A supplier you depend on looks shaky.
- Applying for a loan: seeing your business as the bank will.
- Agreeing or monitoring loan covenants.

## Method

### 1. Think like a lender

- Shareholders get max(0, V − P); lenders get min(V, P), where V is the value of the firm's
  assets and P the promised debt payments. Lenders have no upside beyond P.
- So lenders care about the bad outcomes: the health of current operations, the liquidation
  value of assets (receivables lend better than specialised equipment; assets others can use
  lend better than assets only this firm can use), and who ranks ahead of them.
- Growth matters to a lender only as evidence that today's operations are healthy.
- Near distress, owners' and lenders' interests split: owners gain from riskier bets (asset
  substitution), may refuse to fund good projects whose gains go mostly to lenders
  (underinvestment), and may pay out cash before the end. Covenants exist to stop these.
- Lenders still need the same strategy, profitability and earnings-quality work as investors
  (see `ratio-analysis`, `earnings-quality`).

### 2. Measures

Liquidity (short-term cash):

- Current ratio = current assets / current liabilities.
- Quick ratio = (cash + short-term investments + receivables) / current liabilities.
- Cash ratio = (cash + marketable securities) / current liabilities.
- Operating cash flow ratio = CFO / current liabilities.
- Receivables and inventory turnover (quality of the current assets).
- For a subsidiary or other group company, first run the entity-versus-group step in
  `cash-flow-analysis` (section 4): cash pools, related-party balances, upstream dividends,
  guarantees and which entity the covenants test can make own-entity liquidity ratios
  meaningless in either direction.

Solvency (long-term):

- Liabilities / equity; debt / equity = (short + long-term debt) / book equity.
- Debt / market value of equity (stronger predictor: market value carries more information
  about future profit than book value).

Coverage:

- Interest coverage (earnings) = (NI + interest + tax) / interest.
- Interest coverage (cash) = (CFO + interest paid + tax paid) / interest.

Also: profitability (ROA, margins), size, and volatility of the share price (for listed firms).

### 3. What predicts default

Evidence from large samples:

- Current ratios correlate weakly with default: efficient firms run lean working capital, and
  profitable firms can borrow through a short squeeze. A low current ratio in a profitable firm
  with credit lines and a good rating is not alarming.
- Debt-to-equity correlates strongly (less cushion, more variable income); debt to market
  equity even more.
- Profit relative to interest (coverage) predicts better than profit alone.
- Larger firms default less (longer track record, more resilient profit).
- More volatile share prices mean more volatile assets and a higher chance V falls below P.
- Bottom line: firms default when they cannot run operations profitably. Forecasting
  profitability is the core of credit work.

### 4. A bankruptcy probability score

Use an updated Altman-type model (coefficients re-estimated in later research):

Z = −0.08 × WC/TA + 0.04 × RE/TA − 0.10 × EBIT/TA − 0.10 × market value of equity / TL
    + 0.06 × sales/TA − 4.34

Probability = e^Z / (1 + e^Z). Higher Z means higher risk. WC = working capital, TA = total
assets, RE = retained earnings, EBIT = NI + tax + interest, TL = total liabilities. Its
explanatory power is low (about 6%), so use it as one signal among several. For a private firm
without a market value, substitute book equity and say so (standard practice).

### 5. Decide and protect

- Credit limit or loan size consistent with coverage and the cushion of equity.
- Covenants: minimum interest coverage (for example above 4 times), maximum leverage, limits on
  dividends and asset sales, reporting duties. Loan agreements
  typically hold: lender approval for mergers, dividends and buybacks; ratio floors and ceilings
  (leverage, current and quick ratios, minimum equity or working capital); a ban on pledging assets
  to new lenders; and remedies on default up to seizing assets or forcing bankruptcy.
- Before lending against reported numbers, check the reserves (doubtful accounts, returns,
  restructuring) and the inventory method: a run-down allowance or a LIFO liquidation can lift
  coverage ratios for a year (`cfo/references/earnings-quality.md`).
- For a lender's own book: credit-loss provisions are booked when losses become expected, so in a
  downturn they rise before defaults do; read the provision trend, not just write-offs (case
  lessons: `cfo/references/ratio-analysis/case-lessons.md`).
- Security: receivables and fungible assets; check what ranks ahead.
- Ratings downgrades carry information; monitor them for listed counterparties.

### 6. Consumer and small-business loan books

Sections 1 to 5 judge one corporate borrower. A business that sells on credit to many small
borrowers (instalment or pay-as-you-go equipment, small loans) needs a portfolio method instead
(standard practice):

- **Vintage analysis:** track each monthly cohort's cumulative collection and loss rates by month
  on book; compare cohorts at the same age, never a blended rate on a growing book.
- **PAR30 / PAR90:** whole outstanding principal of loans more than 30 (90) days late ÷ total
  outstanding principal. A written **write-off rule** (for example 180 days past due) before the
  first loan.
- **Collection rate vs on-time rate:** cash collected ÷ cash due drives value; share paid by the
  due date drives liquidity. Lumpy payers can show 92% and 50%.
- **Recovery:** remote lock-out first (track the cure rate), then repossession; net recovery =
  resale − finding, transport and refurbishment, times the share of defaults actually recovered.
- **Seasonality:** judge arrears against a harvest-shaped schedule and the same months last year.
- **Correlated stress:** a drought or price shock raises defaults and cuts resale values together;
  stress both at once.
- **Pilot gates:** go / pause / stop thresholds on collection rate, PAR30, PAR90, cure rate and
  recovery, set before launch; scale only after three cohorts pass.
- **Value:** expected loss = PD × LGD × exposure at default; book value = PV of scheduled
  payments − PV of expected losses − PV of servicing, at the holder's required return.

Example: 900 financed at 45 a month for 24 months, PD 15%, exposure at default 500, net recovery
per repossession 200 on 60% of defaults: LGD 76%, EL 57 (6.3%); value at 1.5% a month ≈ 811, 90%
of face. Doubled PD with lower resale gives EL 132 (14.7%).

Full method, tables and the yield-versus-funding check:
`cfo/references/credit-analysis/consumer-loan-books.md`. Funding such a book:
`cfo/references/capital-structure-decisions/asset-backed-and-blended-finance.md`.

## Worked pattern

A customer asks for 90-day terms on 200 of orders a month. Its accounts: current ratio 0.9;
debt / equity 2.5 (industry about 1.0); EBIT 30, interest 12, so coverage 2.5 times; CFO
negative last year as receivables grew; revenue 3,000, equity 120.

- Liquidity alone is not the worry; coverage at 2.5 times and leverage at 2.5 times the norm
  are. Negative CFO from a receivables build-up suggests it is funding its own customers.
- Decision: 30-day terms, a limit of one month's orders, review on quarterly accounts, and
  stop shipping if coverage falls below 2 times.

## Common mistakes

- Relying on the current ratio.
- Treating fast growth as comfort; lenders do not share the upside.
- Ignoring the value of assets in default and the ranking of other creditors.
- Using book leverage when market values are available.
- Forgetting that owners near distress may take risks at the lender's expense.
- Judging a group company's liquidity, or setting its covenants, on its own accounts without
  checking the group's cash pool, guarantees and the entity the covenants measure.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps

- No coverage of bank lending practice, trade-credit insurance or small-business credit scoring.
