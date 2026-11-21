# Cash flow analysis

> **Area:** `cash-flow-analysis` · owned by the CFO skill. **Use when:** Build a statement of cash flows from two balance sheets and an income statement, and read it to judge whether a business funds itself, can pay its way, and reports earnings that are backed by cash. Use when profit and the bank balance tell different stories, when judging a firm's health or a borrower's, or when checking earnings quality.

**Outcome:** a business sees where its cash came from and went, whether operations pay for
investment and payouts, and whether reported profit is turning into cash.

## When to use

- "We are profitable but always short of cash. Why?"
- Judging a company's health from its cash flow statement alone (customer, supplier, borrower,
  acquisition target).
- Preparing a cash flow statement when only balance sheets and profit are available.
- Testing earnings quality: a widening gap between net income and operating cash flow.
- The company belongs to a group, and its own cash looks too low (or too high) to judge alone.

## Method

### 1. The three categories

- **Operating (CFO):** cash from customers; cash to suppliers, employees, landlords, tax.
  Under US GAAP, interest paid and interest and dividends received are operating.
- **Investing (CFI):** buying and selling long-term assets and investments (PPE, securities,
  businesses).
- **Financing (CFF):** borrowing and repaying principal, issuing and buying back shares,
  dividends paid.

Note the classification judgement: one firm's investing outflow (DVDs bought for rental) can be
another's operating outflow (content production). Compare like with like.

### 2. Build it from the balance sheets (indirect method)

1. List every balance sheet line, begin and end, and the change.
2. Explain each non-cash line's change by its flows, and tag each flow O, I or F:
   - Retained earnings: + NI (O), − dividends (F).
   - Receivables, inventory, prepaids up: cash down (O). Down: cash up.
   - Payables, accrued liabilities, deferred revenue up: cash up (O). Down: cash down.
   - PPE (net): − purchases (I), + book value of disposals (I, adjusted below),
     + depreciation added back (O, non-cash).
   - Debt: + issued (F), − repaid (F). Shares: + issued, − repurchased (F).
3. Gains and losses on disposals: NI includes them, but the cash is the sale price. Add back
   a loss (subtract a gain) in operating, and show the full proceeds in investing.
4. Sum each section. Check: CFO + CFI + CFF = change in cash. If not, a flow is missing.
5. Non-cash deals (equipment paid for with new bonds) are disclosed, not counted, unless the
   cash actually passed through.

**Direct method (for insight):** convert each income line to cash.
Cash from customers = sales − increase in AR. Cash to suppliers = cost of sales + increase in
inventory − increase in AP. Cash to employees = wage expense − increase in wages payable.

### 3. Read the pattern of signs

| CFO | CFI | CFF | Usual story |
|---|---|---|---|
| + | − | − | Mature, healthy: operations fund investment and payouts |
| + | − | + | Growing fast: investing more than operations generate |
| − | − | + | Start-up or struggling: outsiders are funding losses and growth |
| − | + | ± | Decline or distress: selling assets to cover operations |
| + | + | − | Shrinking or restructuring: selling assets, paying down claims |

The total change in cash matters least; the pattern matters most.

### 4. Entity versus group (run before any liquidity or cash-poverty conclusion)

Consolidated statements treat a parent and its subsidiaries as one economic entity and
eliminate the balances between them, yet each subsidiary is a separate legal entity with its
own books and its own creditors. So one company's accounts and its group's can tell opposite
cash stories. Never call a group company cash-poor, or liquid, from its own balance alone.

- **Looks poor, is liquid:** the group sweeps each subsidiary's bank balance to the parent
  (a cash pool), so the subsidiary shows near-zero cash but holds a claim on the pool or the
  parent, and may draw on group facilities. Its cash sits on the group's balance sheet.
- **Looks liquid, is not:** cash swept upward is only a claim on the parent, as good as the
  parent and the agreement. And group cash may sit in entities that cannot pass it on
  (cash kept abroad, restricted, or needed by local creditors).

Checklist, entity by entity (standard practice):
1. **Related-party balances:** amounts due from and to the parent and fellow subsidiaries;
   current or long-term; interest-bearing; settled in cash or rolled over year after year.
2. **Cash pool:** is there one; does it sweep balances physically or only offset them
   (notional)? Is there a **written agreement** stating who can withdraw, limits, notice,
   interest, set-off and what happens if the parent fails? No written agreement: treat the
   pool balance as an unsecured claim on the parent that may not be callable.
3. **Loans to or from the parent:** amount, maturity, ranking (subordinated?), interest paid
   in cash or only accrued.
4. **Upstream payments:** dividends and group contributions paid to the parent, against profit
   and CFO. Large payouts that leave the entity thin are the "pay out cash before the end"
   conflict lenders fear (see `credit-analysis`).
5. **Guarantees:** given by the entity for group debt (a contingent outflow, and its assets may
   be pledged) and received from the parent (check: binding guarantee, or only a letter of
   comfort?).
6. **Covenants:** which entity's numbers they test: the borrowing entity, a guarantor group or
   the consolidated group. Group covenants can be met while a subsidiary is starved, and the
   reverse. Debt covenants restrict what the firm may do.

Where to look in filed accounts (standard practice):
- Balance sheet: "amounts owed by / to group companies" or "due from related parties", often
  inside receivables and payables; loans to group in non-current assets.
- Notes: related-party note (who, balances, transactions, dividends); cash note (pool,
  restricted cash); borrowings note (facilities, security, guarantees, covenants); contingent
  liabilities; events after the year end.
- Cash flow statement: cash swept into the pool or lent to the parent often shows as an
  investing or financing outflow, so a subsidiary can report strong CFO and still end with
  no cash.
- Directors' report: the going-concern statement, and whether it relies on a parent's
  support letter; name of the ultimate parent and where its group accounts are filed.

Decision rule: liquidity of a group entity = own cash + pool balance withdrawable on demand
under a written agreement + undrawn committed facilities − group balances repayable on demand
− guarantees likely to be called. Report the entity view and the group view side by side;
judge the parent's own credit (see `credit-analysis`) whenever the answer rests on it.

### 5. Ask the operating and strategy questions

- Is the business generating cash from operations? If not, is the cause low profit or
  working capital (receivables, inventory) growing faster than sales?
- Can operations cover interest and short-term obligations?
- How much is being invested, is that consistent with the strategy, and is it funded
  internally?
- Are dividends and buybacks covered by CFO after the capital spending needed to keep current
  capacity? **Free cash flow = CFO − capital expenditure − dividends** (a simple
  version; some analysts stop before dividends). Persistent negative free cash flow means the
  payout is funded by borrowing or asset sales.
- What external finance is used (debt or equity), and does it suit the risk of the business?
- If cash is piling up, where is it going?

### 6. Ask the accounting quality questions

- **Accruals = NI − CFO.** Large or growing positive accruals deserve an explanation.
  Research found that firms later caught manipulating earnings showed NI
  pulling away from CFO before the manipulation year, and that high-accrual earnings are less
  persistent.
- Find which balance sheet lines drive the gap and map them to the four timing cases (see
  `earnings-quality`): receivables or inventory build-up, capitalised costs, liabilities falling.
- Is the gap explained by the business (a growth spurt, a one-off), or by accounting choices?
- Check investing outflows for operating costs in disguise (capitalised development or content,
  for example). Capitalising moves a cash outflow out of the income statement for now; if it is
  classified as investing, it also flatters CFO.
- The opposite pattern is also a warning: when capitalised spending sits inside CFO (a streamer's
  content additions), NI can grow for years while CFO stays negative. Plot NI, CFO and CFO − capex
  over five to ten years, and compare the capitalised asset's growth with revenue growth (case
  lessons: `cfo/references/ratio-analysis/case-lessons.md`).
- Non-cash swings that move profit but not cash: currency translation of foreign subsidiaries,
  impairments and restructuring write-downs, LIFO liquidation profits. LIFO itself saves real
  cash: cumulative tax deferred = LIFO reserve × tax rate.
- Working-capital days convert to cash: change in days × sales (or cost of sales) per day. Use it
  to size how much of CFO came from collecting faster or paying suppliers later.

## Worked pattern

A distributor reports NI of 400. Over the year receivables rise 250, inventory rises 120,
payables fall 60, depreciation is 90, and it sold a van with book value 30 for 20.
It bought equipment for 200, borrowed 150, repaid 40 and paid dividends of 100.

- CFO = 400 − 250 − 120 − 60 + 90 + 10 (loss added back) = 70.
- CFI = −200 + 20 = −180.
- CFF = 150 − 40 − 100 = 10.
- Change in cash = −100.
- Reading: profit of 400 turned into cash of only 70; working capital absorbed 430. Free cash
  flow = 70 − 200 − 100 = −230, funded by new debt and running cash down. Ask why receivables
  grew so fast: slower collections, looser credit, or sales booked early?

Entity versus group: a subsidiary ends the year with cash of 2 against current liabilities of
400, though CFO was 300. Investing shows 280 "lent to group cash pool"; current assets include
350 due from the pool.
- Cash ratio 0.005 looks alarming. With a written agreement allowing withdrawal on demand and a
  sound parent, available liquidity is 352 against 400: tight, not cash-poor.
- With no written agreement, the 350 is an unsecured claim on the parent: the conclusion now
  depends on the parent's credit, so analyse the parent before deciding.

## Common mistakes

- Putting dividends paid in operating, or interest paid in financing (US GAAP: the reverse).
- Getting working-capital signs backwards (an asset rising uses cash).
- Counting the gain or loss on a sale as the cash from it.
- Netting purchases and disposals of PPE into one number; show both.
- Judging health from the total change in cash.
- Treating high CFO as good news without checking for capitalised operating costs or
  stretched payables.
- Calling a group company cash-poor (or liquid) from its own balance sheet, without the
  related-party note, the cash-pool terms and the covenant entity.
- Counting a cash-pool balance as cash when no written agreement lets the entity draw it.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps

- None noted beyond the scope above.
