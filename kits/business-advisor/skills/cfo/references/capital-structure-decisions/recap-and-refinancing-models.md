# Spreadsheet layouts: leveraged recap and debt refinancing

Two small models, built as reusable layouts. Inputs in one block, one column
per scenario, every later row a formula.

## A. Leveraged recapitalization (borrow and buy back shares)

Columns: current (no debt), then debt at 10%, 20% and 30% of **book** total capital (or any
targets). Rows, in order:

1. **Inputs:** interest rate on the new debt (bank line rate, e.g. reference rate + spread), tax
   rate (current tax ÷ pre-tax income), EBIT including interest income, book equity, market
   value of equity (price × shares), shares outstanding, current equity beta, r_f (10-year
   government yield), market risk premium.
2. **Book view and ROE:** debt = target % × book capital; book equity = book capital − debt;
   interest = rate × debt; net income = (EBIT − interest)(1 − τ); ROE = NI / book equity.
   ROE rises with debt in every column. Show it, then show why it does not settle the question.
3. **On announcement:** tax benefit = τ × D (permanent debt); enterprise value = old equity
   value + τD; price per share = EV / old share count.
4. **After borrowing, before buyback:** cash and debt both up by D; EV including the cash =
   EV + D; equity unchanged; price unchanged.
5. **After buyback:** shares bought = D / announced price; cash used = D; EV back to step 3 value;
   equity = EV − D; shares left = old − bought; price = equity / shares left (same as step 3).
6. **Risk and cost of capital:** market D/E = D / equity after buyback;
   β_E = β_U × [1 + (1 − τ) × D/E] (the fixed-debt form; β_U = current beta if no debt today);
   r_E = r_f + β_E × MRP; EPS = NI / shares left; P/E = price / EPS;
   WACC = E/V × r_E + D/V × r_D × (1 − τ).
7. **What the model leaves out** (write it under the table): distress costs, lost flexibility to
   fund growth, covenant limits, the signal a buyback sends, and whether the earnings can carry
   the interest in a bad year.

Reading the output: price per share rises only by τD / shares; EPS and ROE rise in every
column, r_E and P/E change, WACC falls a little. The decision rests on the distress check in
step 7, not on the EPS line.

## B. Refinancing when the borrower's rate has fallen

Build three blocks on a common timeline (semiannual periods if the bonds pay semiannually).

1. **Loan with prepayment right:** payment from the annuity formula at the original rate;
   amortization table (opening balance, interest = rate × opening, payment, closing). Payoff at
   any date = closing balance = PV of remaining payments at the **original** rate.
2. **Buyback at market value:** PV of the same remaining payments at the **new, lower** rate.
   The gap between 2 and 1 is the gain the lender keeps when there is no prepayment right.
3. **Issue new, retire old (bonds):**
   - New bond: face, coupon = market yield, so its PV equals face (cash raised).
   - Old bond: promised coupons and face; PV at the new yield = price holders would demand;
     premium over face = PV / face − 1.
   - Incremental cash flows by period: column 1 new issue (+ proceeds now, − its coupons and
     face later); column 2 old bond retired (− buyback price now, + coupons and face no longer
     paid). Sum the two, discount at the new yield per period. At a buyback price equal to PV
     the NPV is about zero before costs; it turns positive only if the buyback price is below PV.
4. **Call feature:** if the old bond is callable at about face on a near date, holders know the
   issuer can force redemption, so a tender at a small premium can succeed. Value the call date
   explicitly when it is close.

Add issue costs and any tender fee to period 0 (standard practice).
