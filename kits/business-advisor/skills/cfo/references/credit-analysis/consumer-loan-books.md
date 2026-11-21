# Consumer and small-business loan books: depth

Depth for section 6 of `cfo/references/credit-analysis.md`. Everything here is standard practice.
It applies to any business that sells on credit to many small borrowers:
pay-as-you-go equipment, instalment sales, buy-now-pay-later, microfinance, merchant cash advances.

## 1. Track the book by monthly cohort (vintage analysis)

A cohort (vintage) is every loan made in one month. Never judge the book from one blended
number: a fast-growing book is mostly young loans that have not had time to go bad, so blended
arrears look low exactly when risk is building.

For each cohort, by months since origination (month on book, MOB):

- **Cumulative collection rate** = cash collected to date ÷ cash contractually due to date.
- **Cumulative loss rate** = principal written off to date ÷ principal originated.
- **PAR30 / PAR90 of the cohort** (see section 2).

Lay cohorts in rows and MOB in columns. Read down a column to compare cohorts at the same age.
A column that worsens from one cohort to the next is the earliest honest signal that
underwriting, product or the borrowers' economy has changed.

| Cohort | Loans | Collection rate MOB 3 | MOB 6 | MOB 12 | Loss rate MOB 12 |
|---|---|---|---|---|---|
| January | 200 | 94% | 91% | 88% | 5% |
| February | 260 | 93% | 89% | 85% | 7% |
| March | 340 | 90% | 84% | (not yet) | (not yet) |

March is worse than January at the same age, while the blended collection rate across all
loans still looks near 90% because January's older loans pull it up. Act on the column, not the blend.

## 2. Arrears and portfolio at risk

- **Days past due (DPD):** days since the oldest unpaid instalment was due.
- **PAR30** = outstanding principal of all loans more than 30 days past due ÷ total outstanding
  principal. **PAR90** likewise at 90 days. Count the whole outstanding balance of a late loan,
  not just the missed instalment: that is what is at risk.
- **Write-off rule:** fix it in writing before the first loan is made, for example: write off when
  180 days past due, or when no payment has been received for 120 days, whichever comes first.
  Write off means remove from the book and from PAR; keep collecting. A book with no written rule
  can keep dead loans "outstanding" forever and report PAR that only ever looks better.
- Report **net loss rate** = (write-offs − recoveries) ÷ average outstanding principal, annualised.

## 3. Collection rate versus on-time rate

- **On-time rate** = share of instalments paid in full by their due date.
- **Collection rate** = cash collected ÷ cash due, regardless of timing.
- Farmers and informal traders often pay late and in lumps. A book can show an on-time rate of
  50% and a collection rate of 92%: borrowers skip a month and catch up. The collection rate
  drives value; the on-time rate drives liquidity and collections workload.
- Watch the gap. On-time falling while collection holds means cash timing stress; both falling
  together means credit losses are coming.

## 4. Recovery: lock-out and repossession

- **Remote lock-out:** a device that stops working when payment lapses (pay-as-you-go solar,
  pumps, phones). It is the main collection tool: most borrowers pay within days of a lock. Track
  the share of locked accounts that pay within 30 days ("cure rate").
- **Repossession** when lock-out fails. Net recovery per repossessed unit = resale or refurbished
  value − cost of finding and transporting it − refurbishment − resale commission.
- Not every default can be repossessed (borrower moved, unit damaged, community resistance). Use
  the share actually recovered from past defaults, not 100%.
- Resale value falls when many units come back at once (section 6). Use a stressed resale price.
- Recovery rate = expected net recovery ÷ exposure at default. LGD = 1 − recovery rate.

## 5. Seasonality

- Borrowers whose income comes at harvest or in a tourist season pay unevenly. Compare cohorts at
  the same calendar month as well as the same MOB, or measure against a seasonal repayment plan
  rather than a flat schedule.
- Better still, match the schedule to income: smaller payments in lean months, larger after harvest.
  Then judge arrears against that schedule, not a flat one.
- Do not read a lean-season jump in PAR30 as a credit failure until the same months last year are
  checked; do not read a harvest-month cure as a fix.

## 6. Correlated stress

Corporate defaults are mostly independent. A small-borrower book in one region and one trade is
not: a drought, a crop price collapse, a currency fall or a disease hits most borrowers in the
same months. Stress test two things together:

1. **Default rate up** (for example doubled).
2. **Recovery down**, because repossessed units flood the resale market and buyers are also short
   of cash.

Diversify by region, crop and income source; cap any one area's share of the book; consider index
insurance (weather-indexed payouts) where it exists. A pilot in one district in one good season
proves little about a drought year: say so in any forecast built on it.

## 7. Early-warning gates for a pilot

Set before launch, in writing, with the decision each one triggers:

| Gate (cohorts at MOB 6) | Go | Pause and fix | Stop |
|---|---|---|---|
| Collection rate vs plan | ≥ 90% | 80 to 90% | < 80% |
| PAR30 | ≤ 10% | 10 to 20% | > 20% |
| PAR90 | ≤ 5% | 5 to 10% | > 10% |
| Lock-out cure rate (30 days) | ≥ 70% | 50 to 70% | < 50% |
| Net recovery per repossession vs plan | ≥ 80% | 60 to 80% | < 60% |

Scale only when at least three consecutive cohorts pass, and none of the later ones is worse than
the earlier ones at the same MOB. The thresholds are examples: set them from the break-even loss
rate in the funding model (`cfo/references/capital-structure-decisions/asset-backed-and-blended-finance.md`).

## 8. Expected loss and the value of the book

**Expected loss (EL)** per loan = PD × LGD × EAD.

- PD: probability of default over the loan's life (from vintage curves, not a guess).
- EAD: exposure at default, the principal outstanding when it defaults (on an amortising loan,
  defaults cluster early, so EAD is often 50 to 60% of the original principal).
- LGD: loss given default, 1 − net recovery ÷ EAD.

**Value of the receivable** = PV of scheduled payments − PV of expected losses − PV of servicing
cost, discounted at the return the holder (or a buyer) requires. The difference between this
value and face principal is what a buyer will discount when buying the book.

## Worked pattern

Pump financed for 900 over 24 months at 45 a month (1,080 scheduled). Servicing 2 a month.
From pilot vintages: lifetime PD 15%; EAD 500; 60% of defaults repossessed; resale 300, finding
and transport 60, refurbishment 40.

- Net recovery per repossession = 300 − 60 − 40 = 200. Expected recovery = 0.6 × 200 = 120.
- LGD = 1 − 120 ÷ 500 = 76%. EL = 0.15 × 0.76 × 500 = 57 per loan (6.3% of the 900 principal).
- Value at a buyer's 1.5% a month: annuity factor for 24 months = 20.03, so PV of payments =
  45 × 20.03 = 901. PV of EL, if losses land around month 9 = 57 ÷ 1.015⁹ ≈ 50. PV of servicing =
  2 × 20.03 ≈ 40. Value ≈ 901 − 50 − 40 = 811, about 90% of face.
- Drought stress: PD doubles to 30% and resale drops to 200, so net recovery per repossession =
  100, expected recovery 60, LGD 88%, EL = 0.30 × 0.88 × 500 = 132 (14.7% of principal), more than
  double the base. The funding stack must absorb this (see the capital-structure depth file).
- Yield check: interest income about 19.6% a year on the average balance (about 480); annual loss
  ≈ 57 ÷ 2 years ÷ 480 ≈ 6%; servicing 24 ÷ 480 = 5%. Net credit yield ≈ 8.7%, below a typical
  blended cost of funds of 13 to 15%. The credit spread alone loses money: the equipment margin
  has to carry the gap. Show both lines separately so nobody mistakes one for the other.

## Common mistakes

- Reporting a blended arrears rate on a fast-growing book.
- Counting only the missed instalment, not the whole balance, as at risk.
- No written write-off rule, so losses never crystallise.
- Using the on-time rate as the loss signal, or the collection rate as the liquidity signal.
- Assuming every default is repossessed at full resale value.
- Stress-testing default and recovery separately when one event moves both.
- Scaling on one good pilot cohort, or a pilot season with good rains.
