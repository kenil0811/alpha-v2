# Operating versus non-operating: classification and the full ROE split

Depth for sections 3 and 5 of `cfo/references/ratio-analysis.md`. From standard textbook material on profitability analysis, restated. Operations create most of the value, so
split every line into operating or non-operating before computing returns.

## 1. Balance sheet

Rule of thumb: a liability that bears interest, or an asset that earns interest or dividends, is
non-operating. Everything the business needs to make and sell its product is operating.

| Operating assets | Operating liabilities |
|---|---|
| Trade receivables; financing receivables when lending is part of the model (a retailer's own card, a manufacturer's finance arm) | Accounts payable, accrued expenses |
| Inventory, prepaid expenses | Deferred (unearned) revenue |
| PPE, including right-of-use lease assets | Income taxes payable, deferred tax liabilities |
| Goodwill and intangibles | Pension and retiree health obligations |
| Deferred tax assets | "Other" liabilities, unless the notes say otherwise |
| Equity-method investments (joint ventures, associates) | |
| "Other" assets, unless the notes say otherwise | |

| Non-operating assets | Non-operating liabilities |
|---|---|
| Cash and cash equivalents (by convention, all of it) | Short- and long-term borrowings, current maturities |
| Marketable securities | Lease liabilities (debt in substance) |
| Derivative assets | Interest and dividends payable; derivative liabilities |
| Assets held for sale or of discontinued operations | Liabilities held for sale or of discontinued operations |

- **NOA** = operating assets − operating liabilities.
- **NNO** (net non-operating obligations) = non-operating liabilities − non-operating assets.
- Check: NOA = NNO + total equity (including non-controlling interest).
- Leases: the asset is operating however it is financed; the obligation is debt.
- Derivatives: treat all as non-operating; an outsider rarely can tell a raw-material hedge from
  an interest-rate swap.
- If a known part of cash is genuinely needed to run the business (a cash-heavy retailer, a
  firm holding customer float), move that part to operating and say so (standard practice).

## 2. Income statement

- Operating: sales, cost of sales, SG&A, R&D, depreciation and amortisation, restructuring,
  litigation, impairments of operating assets, income from equity-method investments, gains and
  losses on selling operating assets, "other operating" items.
- Non-operating: interest expense (debt and leases), interest and dividend income, gains and
  losses on securities, gains and losses on retiring debt, discontinued operations, "other"
  income shown after the operating subtotal.
- A company's own "operating income" line may not match yours; rebuild it from the lines.

## 3. Tax on operating profit

- Tax on operating profit = tax expense + (pre-tax net non-operating expense × statutory rate).
  The bracket is the **tax shield**; if non-operating income exceeds expense, the shield is
  negative and still added.
- **NOPAT** = operating profit before tax − tax on operating profit.
- Cross-check: **NNE** (after-tax net non-operating expense) = pre-tax net non-operating
  expense × (1 − statutory rate); NOPAT = NI + NNE.
- Use the **statutory** rate (federal plus state, net) for the shield, not the effective rate:
  the effective rate mixes in foreign rates, credits and one-off tax items.
- When a tax law change makes one or two years' tax expense swing wildly, compare pre-tax
  profit across those years instead of NI.

## 4. The full split of ROE

- **RNOA** = NOPAT / average NOA = NOPM (NOPAT / sales) × NOAT (sales / average NOA).
- **FLEV** = average NNO / average total equity.
- **NNEP** = NNE / average NNO (the after-tax cost of net debt).
- **Spread** = RNOA − NNEP.
- **ROE = RNOA + FLEV × Spread.** Non-operating return = ROE − RNOA = FLEV × Spread.
- Borrowing raises ROE only while the spread is positive. As debt grows, lenders charge more
  and good uses for the money run out, so the benefit has a ceiling.

Special cases:

- **Cash-rich firms** (NNO negative): FLEV is negative and ROE sits below RNOA. Owners are
  funding idle liquidity. Judge operations on RNOA, owners' return on ROE, and ask why the cash
  is held (flexibility for deals, or cash trapped abroad by tax rules).
- **Non-controlling interest:** parent ROE = [RNOA + FLEV × Spread] × NCI ratio, where NCI ratio
  = (NI to parent / total NI) ÷ (average parent equity / average total equity). RNOA, FLEV and
  spread are computed on totals as usual.
- **Preferred stock:** return on common equity = (NI − preferred dividends) / (average equity −
  average preferred equity). For common holders, preferred is debt-like.
- **Near-zero or negative equity** (large buybacks): ROE is meaningless or inflated. Use RNOA
  (unaffected by buybacks), or add treasury stock back to both equity and total assets.
- **Company-reported ROIC** (NOPAT / average debt plus equity) is close to RNOA when cash is
  small; read the company's definition before comparing across firms.

## 5. IFRS statements

- "Financial assets" lines mix receivables (operating), loans to associates (either), securities
  and derivatives (non-operating). Read the note and split them.
- There is no defined operating subtotal. Equity-method income and gains on operating disposals
  often sit below the operating line: move them up.

## Worked pattern (own numbers)

Sales 5,000; operating income 600; interest expense 80; interest income 20; tax expense 130;
NI 410; statutory rate 25%. Average NOA 3,500, average NNO 1,000, average equity 2,500.

- Pre-tax net non-operating expense = 60; shield = 15; tax on operating profit = 145;
  NOPAT = 455. Check: NNE = 60 × 0.75 = 45; 410 + 45 = 455.
- RNOA = 13.0% (NOPM 9.1% × NOAT 1.43). FLEV = 0.40; NNEP = 4.5%; spread = 8.5%.
- ROE = 13.0% + 0.40 × 8.5% = 16.4%. Check: 410 / 2,500 = 16.4%.
- Reading: about four-fifths of ROE comes from operations. A rival with the same ROE but RNOA of
  9% earns it through borrowing, which is weaker and riskier.
