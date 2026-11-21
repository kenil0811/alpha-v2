# Startup valuation and deal math

> **Area:** `startup-valuation-and-deal-math` · owned by the CFO skill. **Use when:** Value an early-stage company and work out what an investment buys (pre- and post-money, ownership, share price, dilution, SAFE and note conversion, MOIC, IRR, fund impact). Use when a founder sets the terms of a raise, an investor prices a deal or counter-offers, or anyone asks "is $X for Y% a fair deal?".

**Outcome:** a defensible valuation range for a young company, the equity stake a given cheque should buy, and the return that stake can produce after future dilution.

## When to use

- A founder must decide how much to raise and for what share ("we are raising $500K for 20%").
- An angel or fund is offered terms and must accept, counter or pass.
- Converting SAFEs or convertible notes; checking how a new round dilutes current owners.
- Testing whether a deal can deliver the investor's target return or return a fund.

Pre-revenue startups cannot be valued with a normal DCF: cash flows are years away and highly uncertain. Use the **VC method** (exit value discounted at a high target rate), backed by deal math and scenario thinking.

## Method

### 1. The VC method (single round)

Inputs:
- **V** = terminal (exit) value at the liquidity event (sale or IPO).
- **t** = years to exit (usually 3 to 5; longer for biotech or hardware).
- **r** = investor's target annual return (IRR).
- **I** = amount invested now.
- **x** = shares held by existing owners before the round.

Steps:
1. **Exit value V** = projected metric at year t × multiple from comparables. Use revenue multiples (price ÷ sales) for young firms; EBITDA multiples once profitable. Pick comparables by business model, not just industry; expect a wide range, choose the closest, and run sensitivity.
2. **Choose r.** It is high because the stake is illiquid, the venture is risky, and the investor adds advice and contacts. Typical targets (standard practice): seed 50% or more, early venture 40% to 60%, later stages 25% to 35%. The high rate also absorbs founders' optimistic projections.
3. **Post-money** POST = V ÷ (1 + r)^t.
4. **Pre-money** PRE = POST − I.
5. **Required stake** F = I ÷ POST.
6. **Shares to issue** y = F × x ÷ (1 − F). Price per share = I ÷ y (equals PRE ÷ x).

Reverse check: given an offered stake F, the implied IRR is r = (F × V ÷ I)^(1/t) − 1. Compare it with your target.

### 2. Adjust for future dilution

If later rounds will issue more shares, today's stake shrinks. Let retention R = share of today's stake kept at exit (for example 0.7 if later rounds dilute by 30% in total). Then required stake today = F ÷ R. (Standard extension of the method.)

**Reverse round analysis** (used in investment memos): start from a justified exit value, estimate dilution and valuation step-ups for each later round, work backwards to the ownership you must buy today to hit your target multiple, and from that to the post-money you can pay. Show base, downside and upside cases.

### 3. Deal math basics

- Post-money = pre-money + new money.
- Investor ownership = investment ÷ post-money.
- Dilution: each round lowers everyone's percentage; value can still rise if the price per share rises.
- MOIC = value of stake at exit ÷ amount invested.
- IRR ≈ MOIC^(1/years) − 1 for a single cash-in, single cash-out deal. Time matters: 10x over 2 years is about 216% a year; 10x over 10 years is about 26%.
- Typical seed round (2025 figures; check current data): cheques $250K to $2M, post-money $10M to $20M, investors take 10% to 20%.

### 4. SAFEs and convertible notes

Both defer the price to the next priced round.
- **Valuation cap:** the maximum valuation at which the money converts; protects early investors.
- **Discount:** converts at a percentage below the new round's price (10% to 30% typical).
- Conversion uses whichever gives the investor the lower price.
- Cap conversion price ≈ round price × (cap ÷ round pre-money).
- A convertible note is debt until it converts: it carries interest (often 7% to 12%), a maturity date (6 to 24 months), and terms for what happens at maturity or a sale before conversion (often repayment times 1.5x to 3x).
- A post-money SAFE fixes the holder's percentage before the new money: ownership ≈ investment ÷ post-money cap. Stacking several SAFEs dilutes the founders, not the SAFE holders (standard practice).

See `cfo/references/startup-valuation-and-deal-math/deal-math.md` for full formulas and a cap-table walk-through.

### 5. Fund-level thinking (investor side)

Venture returns follow a power law: a few winners pay for everything. So a fund asks of each deal:
1. Can this company, at my ownership after dilution, **return the whole fund**? Required exit = fund size ÷ ownership at exit.
2. What exit is needed for my target IRR?
3. How much follow-on money keeps my stake from shrinking (pro-rata)?
4. Does the time to exit fit the fund's remaining life (funds usually last 10 years, investing in the first 3 to 4)?
5. Which terms improve the odds (see raising-startup-capital)?

A fund's pitch to its own investors shows the logic: of, say, 30 deals, about a third fail or are written off, a few return the money, and the rest exit at a few hundred million at about 20% ownership; the winners pay for the rest. One analysis of a well-known fund's 468 deals found about 60% of dollars returned less than cost while about 8% of dollars made over 70% of the returns. The best funds fail often because they cut losers early and back winners harder.

The bigger the fund, the bigger the exit (or ownership) each deal needs. A $250M exit at 4% ownership returns a $10M fund but only a tenth of a $100M fund. Founders can use this to pick investors whose fund size fits the business they are building.

### 6. Probability-weighted view

Single-point projections hide risk. Break the venture into stages (early traction, crossing to mainstream customers, mass market, market position) and give each stage a probability for market, product, team and financing risk. Multiply them along each path: small risks compound quickly (four 80% to 95% risks give barely better than even odds). Weight each outcome's value by its probability; target a probability-weighted multiple (some funds target 10x on this basis). This also exposes the questions that matter most for diligence.

For other methods (Berkus, scorecard, PWERM, option pricing), VC haircuts, management top-ups and stage
benchmarks, see `cfo/references/startup-valuation-and-deal-math/valuation-methods.md`.

### 6a. There is no true value, only a negotiated price

A start-up's pre- and post-money are implied by a real trade (cash for shares), not computed. The same company gets different prices in hot and cold markets, with experienced or new founders, and with top-tier or unknown investors. Negotiating valuation is really negotiating two inputs: the investor's hurdle rate (higher when team, technology or model are unproven) and the exit value (higher in a hot market or for a likely home run). Show the founder how sharply the post-money moves with r. Own example: $3M invested, $120M exit in 5 years.

| Target r | Value needed at exit | Stake needed | Post-money |
|---|---|---|---|
| 30% | $11.1M | 9% | $32M |
| 50% | $22.8M | 19% | $16M |
| 70% | $42.6M | 35% | $8.5M |

Two other levers move value without touching the headline price: terms that pay the investor first in weak outcomes (a convertible preferred takes everything below its investment, takes its money back between its investment and the post-money, and converts only above the post-money; see the payout formulas in `cfo/references/startup-valuation-and-deal-math/deal-math.md`), and the structure of the raise (selling safe slices of cash flow to lenders cuts the equity needed; see `cfo/references/raising-startup-capital/debt-and-deal-structuring.md`). Because most exits are modest, the split in low outcomes matters more than founders expect.

A very high first price is not a win if it sets milestones the company cannot meet: the next round may then be a down round. Aim for a run of rising rounds (roughly doubling each time is a common target).

### 7. Negotiating the number

- Founders: the best lever on price is several interested investors. Raise what reaches the next milestone with buffer (12 to 24 months of runway, standard practice).
- Investors: present the counter with your V, t and r so the founder sees the logic; offer a smaller cheque, a lower price, or milestones (tranches).
- Price is only one term: an option pool created before the round, liquidation preferences or warrants can change the real valuation more than the headline.

## Worked pattern

A founder asks $400K for 20%. Projected year-5 revenue $8M; comparable companies trade at 1x to 2x sales; choose 1.5x.
- V = $8M × 1.5 = $12M; t = 5; investor target r = 50%; (1.5)^5 = 7.59.
- POST = 12 ÷ 7.59 = $1.58M; PRE = 1.58 − 0.40 = $1.18M.
- Required stake F = 0.40 ÷ 1.58 = 25.3%.
- The founder's offer implies IRR = (0.20 × 12 ÷ 0.40)^(1/5) − 1 = 6^0.2 − 1 = 43%: below target.
- With 30% expected later dilution, required stake today = 25.3% ÷ 0.7 = 36%.
- With 1,000,000 founder shares: y = 0.253 × 1,000,000 ÷ 0.747 ≈ 339,000 new shares at about $1.18 each.
- Counter: $400K for 25% (no further dilution assumed), or keep 20% but reduce the cheque to about $320K. Sensitivity: at a 1x multiple, V = $8M and the required stake jumps to 38%.

## Common mistakes

- Treating the VC method's output as precise; it is a negotiating anchor. Always show sensitivity on multiple, exit year and r.
- Choosing a flattering comparable (a high-multiple tech firm for a restaurant chain).
- Forgetting future dilution and option pools when computing what the stake will be worth.
- Mixing pre- and post-money ("$1M for 20%": is $5M the pre or the post?). Always state both.
- Ignoring that IRR depends on time; quoting MOIC alone.
- Stacking SAFEs without modelling the conversion.
- Investing in a company that cannot return the fund even if it succeeds.
- Treating a valuation as a fact rather than the result of a negotiation in a given market; pushing the first price so high that the next round is a down round.
- Looking only at the ownership split in a big exit; with preferred stock, low and middle outcomes are split very differently.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps

- No current private-company revenue-multiple table; source comparables for each deal.
- Valuing private equity securities (preferred with complex rights) beyond the payout formulas in deal-math.md is not covered.
