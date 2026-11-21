# Deal math formula sheet

## VC method

| Term | Meaning |
|---|---|
| V | exit value at year t = metric at t × comparable multiple |
| t | years to exit |
| r | target annual return (IRR) |
| I | investment now |
| x | existing shares before the round |
| y | new shares issued to the investor |

- POST = V ÷ (1 + r)^t
- PRE = POST − I
- F (stake needed) = I ÷ POST
- With retention R after later rounds: F_today = F ÷ R
- y = F × x ÷ (1 − F); price per share = I ÷ y = PRE ÷ x
- Implied IRR of an offered stake: r = (F × V ÷ I)^(1/t) − 1

## Returns

- MOIC = stake value at exit ÷ investment
- IRR (single in, single out) = MOIC^(1/years) − 1
- Ownership at exit = ownership today × product of (1 − dilution of each later round)
- Exit needed to return the fund = fund size ÷ ownership at exit
- Probability-weighted multiple = Σ (probability of outcome × multiple in that outcome)

## Reverse round analysis

1. Justify an exit value (comparables × forecast metric).
2. Target multiple M on cheque I → value needed at exit = M × I.
3. Ownership needed at exit = M × I ÷ exit value.
4. Ownership needed today = that ÷ retention R.
5. Maximum post-money = I ÷ ownership today.

Example: exit $300M in 7 years, 10x on $1M, later rounds keep 60% of the stake.
Ownership at exit = 10 ÷ 300 = 3.33%; today = 3.33% ÷ 0.6 = 5.56%; max post-money = $1M ÷ 5.56% = $18M (pre $17M).

## SAFE conversion

- Conversion ratio = valuation cap ÷ priced-round pre-money.
- SAFE price per share = round price × conversion ratio.
- SAFE shares = investment ÷ SAFE price.

Cap table walk-through (own numbers):
- Founders hold 9,000,000 shares. A $500K post-money SAFE with a $5M cap owns 500 ÷ 5,000 = 10% before the Series A, so 1,000,000 SAFE shares; 10,000,000 shares in total.
- Series A: $3M at $12M pre-money → price = $12M ÷ 10M = $1.20; new shares = 2,500,000; total 12,500,000.
- After the A: founders 72%, SAFE 8%, Series A 20%. SAFE price check: $500K ÷ 1,000,000 = $0.50 = $1.20 × 5 ÷ 12.

## Convertible note

- Converts at the lower of: round price × (1 − discount), and the cap price.
- Principal plus accrued interest converts.
- Example: $250K note, 8% simple interest, 20% discount, $4M cap; one year later a round prices at $1.00 on a $10M pre. Discount price $0.80; cap price $0.40 → uses $0.40. Converting amount $270K → 675,000 shares.

## Option pool shuffle

If investors require a pool of p% of the post-money created before the round, the founders' effective pre-money = stated pre − p × post.
Example: $2M on $8M pre ($10M post) with a 15% post-money pool created pre-round → effective pre = 8 − 1.5 = $6.5M.

## Liquidation preference payout (single series)

- Non-participating 1x: investor takes the greater of (investment) and (ownership × sale proceeds).
- Fully participating 1x: investor takes investment + ownership × (proceeds − investment).
- Capped participation at k×: participating payout limited to k × investment; investor converts instead if that is better.

Example: $2M for 25%. Sale at $6M: non-participating takes $2M (beats 25% × 6 = $1.5M). Sale at $20M: non-participating converts for $5M; fully participating gets 2 + 25% × 18 = $6.5M.

## Anti-dilution (down round)

- Full ratchet: new conversion price = new round price.
- Broad-based weighted average: CP2 = CP1 × (A + B) ÷ (A + C)
  - A = fully diluted shares before the new round
  - B = shares the new money would buy at CP1
  - C = shares actually issued in the new round
- Example: CP1 $1.00, A = 10M, new round $2M at $0.50 → B = 2M, C = 4M; CP2 = 1.00 × 12 ÷ 14 = $0.857. Full ratchet would give $0.50.
