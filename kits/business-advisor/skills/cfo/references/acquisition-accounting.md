# Acquisition and investment accounting

> **Area:** `acquisition-accounting` · owned by the CFO skill. **Use when:** Show how buying a stake in another company appears in the buyer's accounts (fair value, equity method or full consolidation with goodwill and non-controlling interest) and how to read group accounts that contain such stakes. Use when planning an acquisition or joint venture, reading a group's consolidated statements, or adjusting ratios and valuations for minority stakes.

**Outcome:** a business knows, before it signs, what a stake or acquisition will do to its
balance sheet, profit and ratios, and can read a group's accounts without double counting.

## When to use

- Buying a minority stake, forming a joint venture, or acquiring a company.
- Reading consolidated accounts that include subsidiaries, joint ventures or minority holders.
- Valuing a group or computing returns when part of a subsidiary belongs to others.

## Method

### 1. Pick the method by influence

| Ownership (guide) | Influence | Method |
|---|---|---|
| Under 20% | Passive | Fair value (mark to market) |
| 20–50% | Significant influence | Equity method |
| Over 50% | Control | Consolidation (equity method in the parent's own books) |

Control and influence, not the percentage alone, decide.

### 2. Equity method

- Purchase: investment asset up, cash down.
- Investee earns profit: investment up by your share; your income up (investment income).
- Investee pays a dividend: cash up, investment down. The dividend is not income.
- Effect: one line on each statement. The investee's assets and sales stay off your books, so
  your margins and ROA can look higher than a consolidated group's.

### 3. Consolidation at acquisition

1. Fair-value the target's identifiable assets and liabilities.
2. **Goodwill = price paid − fair value of identifiable net assets** (for 100%). If the price
   is below fair value, the difference is a gain.
3. Replace "investment in subsidiary" with all of the subsidiary's assets and liabilities (at
   fair value) plus goodwill. Eliminate the subsidiary's own equity.
4. Buying something does not raise the buyer's equity: it swaps cash (or adds debt) for assets.
5. **Less than 100%:** still bring in 100% of the subsidiary's assets and liabilities, and show
   the outside owners' share as **non-controlling interest (NCI)** inside equity. In the simple
   case with no goodwill, NCI = outside share × subsidiary's net assets at fair value.

### 4. Consolidation after acquisition

- Income statement: add all revenues and expenses of parent and subsidiary; remove the parent's
  investment income from the subsidiary (it would be counted twice); then split net income
  between the parent's owners and NCI (NCI = outside share × subsidiary's profit).
- Remove intercompany sales, profits, receivables and payables (standard practice).
- Goodwill is not amortised but tested for impairment: if the unit's fair value falls below
  its book value, goodwill is written down to the implied amount (fair value of the unit − fair
  value of its identifiable net assets). These tests involve heavy judgement.

### 5. Analysis adjustments

- NCI lowers NOPAT margin and ROE measured for the parent's owners but not asset turnover.
- In free cash flow to common equity, subtract dividends paid to NCI.
- Large goodwill or recent impairments: check what was paid for and whether it earns its keep.
- Segment data shows which subsidiaries create or destroy value.
- Parent ROE with NCI: [operating return + leverage × spread] × NCI ratio, where NCI ratio =
  (NI to parent / total NI) ÷ (average parent equity / average total equity)
  (`cfo/references/ratio-analysis/operating-classification.md`). Equity-method income is
  operating; it often sits below the operating line under IFRS, so move it up.
- Growth by acquisition shows up as goodwill and intangibles making up most of total assets on a
  common-size balance sheet, and as amortisation, contingent-consideration and integration costs
  on the income statement. "Adjusted" earnings that exclude purchase-accounting amortisation and
  deal costs overstate the return of a serial acquirer; acquisitions are its strategy, so their
  costs recur (`cfo/references/earnings-quality/non-gaap-and-red-flags.md`).
- A divested business is reported as discontinued only if it marks a strategic shift; otherwise
  its past results stay mixed into continuing operations and must be stripped out by hand.

## Worked pattern

A firm with assets 1,500, liabilities 500, equity 1,000 buys 60% of a target (assets 1,000,
liabilities 750, equity 250, all at fair value) for 150 cash.

- Fair value of 60% of net assets = 150, so no goodwill.
- Consolidated: assets = 1,500 − 150 + 1,000 = 2,350; liabilities = 500 + 750 = 1,250;
  NCI = 40% × 250 = 100; parent equity unchanged at 1,000.
- Next quarter, consolidated NI is 400 and NI attributable to NCI is 30, so the target earned
  30 / 0.4 = 75; the parent's 370 includes 60% × 75 = 45 from the target.
- Leverage jumps: liabilities/equity moves from 0.5 to about 1.1, because 100% of the target's
  debt comes in for a 60% stake. Check loan covenants before closing.

## Common mistakes

- Expecting equity to rise on an acquisition.
- Counting dividends from an equity-method investee as income.
- Bringing in only the owned share of a subsidiary's assets.
- Forgetting NCI when computing returns or free cash flow to the parent's owners.
- Treating goodwill as a safe asset; it is the residue of the price paid.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps

- No worked material on merger valuation (synergies, accretion and dilution), purchase price
  allocation to intangibles in subsequent years, or intercompany eliminations.
