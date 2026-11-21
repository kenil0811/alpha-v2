# Asset-backed and blended finance: depth

Depth for section 8 of `cfo/references/capital-structure-decisions.md`. Everything here is
standard practice. It is for a business whose main asset is a book of
receivables (instalment sales, pay-as-you-go, small loans) and which funds growth against that
book rather than against its own balance sheet.

## 1. Pledge or sell the receivables

- **Pledge (secured loan):** the business borrows and gives the lender a charge over its
  receivables. The loan stays on the business's balance sheet; if the business fails, the
  lender is one creditor among several.
- **Sell (true sale) into an SPV:** a special-purpose vehicle, a separate company with no other
  business, buys the receivables and raises funding against them. If the originator fails, the
  receivables are not part of its estate (bankruptcy-remote), so funders can lend more and cheaper.
  Costs: legal set-up, trustee, audit, a backup servicer ready to collect if the originator stops.
- **Forward flow:** a funder commits in advance to buy (or lend against) new receivables each
  month that meet the eligibility criteria, up to a cap and for a period. It funds growth without
  a new negotiation each time.

**Advance rate** = funding provided ÷ eligible receivables. The gap (for example 20% at an 80%
advance rate) is the originator's own money at risk and the funder's first cushion.

**Eligibility criteria** decide which receivables count. Typical: not more than 30 days past due;
not restructured; at least one instalment paid; borrower and region concentration caps; contract
on the standard form; device lock-out working. Ineligible loans stay with the originator and must
be funded by its equity.

## 2. The waterfall and who loses first

Cash collected each month is paid out in a fixed order (the priority of payments):

1. Servicing fee and trustee costs.
2. Senior interest.
3. Top-up of the reserve account to its target.
4. Senior principal (on schedule, or all excess cash if a trigger has tripped).
5. Mezzanine interest, then mezzanine principal.
6. First-loss tranche return.
7. Whatever is left (residual) to the originator.

Losses run the other way, from the bottom up: originator equity and the first-loss tranche absorb
losses first, then mezzanine, then senior. **Credit enhancement** of a tranche = the share of the
pool below it. A senior tranche with 30% beneath it loses nothing until pool losses exceed 30%.

Sizing rule of thumb: senior enhancement ≥ about 2 × the stressed lifetime loss rate; mezzanine
enhancement ≥ the stressed loss rate; first loss ≥ the base expected loss.

## 3. Reserves, cover ratios and triggers

- **Cash reserve:** typically 3 to 6 months of senior interest, held in a separate account.
- **Collateral cover** = eligible receivables ÷ senior debt outstanding (the inverse of the
  advance rate; for example ≥ 1.25 at an 80% advance rate).
- **Interest or debt service cover** = collections net of servicing ÷ senior debt service (for
  example ≥ 1.3).
- **Performance triggers:** if PAR90, the collection rate or the net loss rate breaches a level,
  cash is trapped (no residual to the originator) and the deal amortises early. Set them from the
  loan-book gates in `cfo/references/credit-analysis/consumer-loan-books.md`.

## 4. Development finance and concessional layers

- **Development-finance institutions (DFIs)** lend or invest where commercial funders will not,
  usually in senior or mezzanine positions at near-market rates, with impact reporting.
- **Concessional capital** (philanthropy, climate funds, donor programmes) takes the first-loss
  position at a low or zero return. Its purpose is to make the senior tranche safe enough for
  local banks or institutional funders.
- **Guarantees:** a third party covers part of the senior lender's losses (for example 50%) for a
  fee (often 1 to 2% a year on the covered amount). The senior rate falls; check the fee is less
  than the saving.
- Blended deals bring extra conditions: impact metrics, environmental and social standards,
  reporting cost, and slower closing. Count these as cost.

## 5. Local-currency versus dollar debt

The loans are repaid in local currency. Borrowing in dollars creates a mismatch: if the local
currency falls 10%, every dollar owed costs 10% more to repay.

- **Hedging cost** ≈ the interest-rate difference between the two currencies (covered interest
  parity): forward premium ≈ (1 + local rate) ÷ (1 + dollar rate) − 1. At 13% local and 5% dollar,
  about 7.6% a year. Frontier-currency hedges are offered by specialist funds and some DFIs.
- A dollar loan at 9% hedged costs about 9% + 7.6% ≈ 17%. Unhedged, the expected cost is about the
  same over time (the currency tends to fall by the rate gap), with a much wider range of outcomes.
- Compare all funding at its local-currency cost. An unhedged dollar rate is not "cheaper".

## 6. Blended cost of funds

Blended cost = Σ (share of the stack × all-in cost of that layer), where all-in cost includes
hedging and annual fees spread over the life.

## Worked pattern

Eligible pool 10m of outstanding principal (base EL 6.3%, drought EL 14.7%, from the credit depth file).

| Layer | Share | Amount | All-in cost | Weighted |
|---|---|---|---|---|
| Senior, local bank, local currency | 70% | 7.0m | 14% | 9.80% |
| Mezzanine, DFI, dollars hedged (9% + 7.6%) | 15% | 1.5m | 17% | 2.55% |
| First loss, concessional climate fund | 10% | 1.0m | 2% | 0.20% |
| Originator equity (retained residual) | 5% | 0.5m | 25% | 1.25% |
| Total | 100% | 10.0m | | 13.8% |

- Add arrangement, trustee and guarantee fees spread over the life (about 0.7% a year): all-in ≈ 14.5%.
- Base loss 0.63m: absorbed by the 0.5m equity and 0.13m of the first-loss tranche. Senior and
  mezzanine untouched.
- Drought loss 1.47m: absorbs all equity (0.5m) and 0.97m of the 1.0m first loss. Mezzanine is
  just untouched; senior enhancement of 30% ≈ 2 × the 14.7% stressed loss. The stack holds, with
  almost no spare.
- Compare with the book's net credit yield of about 8.7% (credit depth file): funding at 14.5%
  leaves a negative spread of about 6% a year that the equipment margin must cover. A cheaper
  first-loss or a guarantee that cuts the senior rate to 12% moves the blend to about 12.4% before fees,
  so the guarantee pays only if its fee costs less than about 1.4% of the pool a year.

## Common mistakes

- Comparing a dollar rate with a local rate without the hedge.
- Sizing the first loss on base expected losses with no correlated-stress case.
- Ignoring eligibility: the ineligible part of the book still needs equity.
- Leaving out fees, reserves held in cash, and the cost of DFI reporting.
- Treating the residual as profit before the triggers and reserves are funded.
- No backup servicer, so the SPV's bankruptcy-remoteness is protection on paper only.
