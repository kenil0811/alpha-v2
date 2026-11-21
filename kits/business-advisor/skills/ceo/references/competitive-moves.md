# Competitive moves

> **Area:** `competitive-moves` · owned by the CEO skill. **Use when:** Anticipate how rivals will react before making a price, capacity or entry move, using game theory (payoff matrices, game trees, credible commitments) and the standard oligopoly models. Use when a business asks "if we cut price, what will they do?", "should we match their price?", "should we expand first?", or "can we push this competitor out?"

**Outcome:** a prediction of how a few identifiable rivals will respond to a move, the move that does
best given that response, and the commitments or signals that make the plan stick.

**When to use**
- A market with a handful of rivals whose moves affect each other (local services, regional suppliers, niche manufacturers).
- Pricing announcements, capacity expansions, entry or retaliation decisions, bids.
- A rival has just moved and you must decide whether to follow.
Not needed when you are a price-taker among many (use `cost-and-capacity-decisions`) or a true monopoly (use `pricing-strategy`).

## Method

### 1. Check that it is a game
At least two players, deliberate choices, and an outcome that depends on all their choices.

### 2. Describe the real game (five questions)
1. Who are the players? (Include regulators, big customers, potential entrants if they matter.)
2. What do they want? Do not assume profit. A rival may chase market share, volume to fill a plant, or short-term cash.
3. What can they do? The real options, including "wait".
4. What do they know? About costs, your plans, demand.
5. What do they get? Payoffs for each combination, in their terms.
Build the game from the situation; don't force it into a famous textbook game because it is convenient.

### 3. Simultaneous moves: payoff matrix
Use when players choose without seeing the other's choice (sealed bids, prices set for a season).
- Rows = your options, columns = theirs, each cell = (your payoff, their payoff).
- **Dominant strategy:** better for a player whatever the other does. Expect it to be played.
- Remove **dominated** strategies one by one to simplify.
- **Nash equilibrium:** mark each player's best response to each of the other's choices; a cell where both are best-responding is an equilibrium. Test: would anyone, given the others' choices, wish to go back and change? If no one would, it holds.
- State the equilibrium as the strategies (what to do), not the payoffs.
- Several equilibria: look for an obvious focal one; otherwise you need to change the game (commit, signal, move first).
- The prisoner's dilemma (both better off cooperating, each tempted to defect) is one specific case, not all of game theory.

### 4. Sequential moves: game tree and backward induction
Use when one player moves, the other sees it, then responds (announced price lists, building a plant).
- Draw the first mover's options as branches, then the responder's options after each, ending with payoffs.
- Solve from the end: find the last mover's best choice at each point, then the earlier mover's best choice knowing that.
- This shows whether there is a first-mover or second-mover advantage.
- If the situation is really sequential, a matrix will mislead; use the tree.

### 5. Change the game with credible commitments
A threat or promise changes others' choices only if it is **visible**, **understandable**, and **irreversible**
(costly to back down from): signed contracts, capacity already built, a public price-match guarantee,
reputation from past behaviour. A threat that you would not carry out when the moment comes is ignored.

Scope moves are commitments too:
- **Vertical moves for power:** integrate backward to offset a strong supplier or lock up a scarce input (raising
  rivals' costs), forward to offset strong buyers or close a channel to rivals. Check antitrust (restraint of
  trade) first, and expect the lock-out to fade: high returns pull in new suppliers and channels.
- **Preemptive acquisitions:** where demand for new products surges unpredictably, buying a unique target
  before a rival does avoids later hold-up and lowers your cost of repositioning. Ask whether the rival
  could do the same more cheaply.
The efficiency side of these choices (hold-up, leakage, capability) is in `corporate-strategy`.

### 5a. Entering against entrenched incumbents (a new broadcast-network entry)
Before entering a concentrated industry, answer in order:
1. **Which barrier just fell?** (a cheaper delivery technology, deregulation, more independent outlets).
   If none has, earlier failures will repeat; find why past entrants failed.
2. **Where will incumbents not follow quickly?** An audience or slot they neglect, a lower cost base, or a
   rule that binds them but not a small entrant.
3. **Which side must you win first, and what will you pay it?** In a multi-sided business, offer the scarce
   side (outlets, sellers) more than incumbents do; price the other side (advertisers) below them until scale proves out.
4. **How will incumbents respond?** Read their current state: firms busy with takeovers and cost cuts respond
   slowly; a leader with record profits may ignore a small entrant until it is too late (step 4).
5. **Stage the commitment:** start narrow, expand only on evidence, budget the losses up front, and leave
   speculative synergies out of the base plan.

### 6. Use the oligopoly models as benchmarks
All start from two firms, same costs, identical products, short run.
| Model | Firms choose | Result | Fits |
|---|---|---|---|
| **Bertrand** | Price, at the same time | Price falls to marginal cost; no profit | Services, firms with spare capacity |
| **Cournot** | Quantity, at the same time | Total output between monopoly and competitive levels; positive profit | Products with capacity set in advance |
| **Stackelberg** | Quantity, leader first | Leader produces more and earns more than in Cournot; follower less | One firm can commit capacity first |

Bertrand profit comes back when the assumptions break, and each is a strategy lever:
- **Lower cost:** the low-cost firm prices just below the rival's cost and takes the market (process innovation pays).
- **Differentiation:** some customers stick with you at a higher price (product innovation pays).
- **Capacity limits:** neither can serve everyone, so neither undercuts all the way.
Cournot: each firm's best output is found by setting its MR = MC given the rival's output (best-response function); solve the two together. Firms cannot hold the joint monopoly output because each gains from producing a little more. Explicit collusion is illegal; do not recommend it. Closed-form results for linear demand, with a worked check, are in `ceo/references/competitive-moves/oligopoly-formulas.md`.

### 7. Recommend
State the move, the expected rival response, the payoffs under the likely and the worst response, and
what commitment or signal makes your move credible. Present it to an executive as a decision, not a game-theory lesson.

### 8. Guard against bias
- Optimism: solving for your best cell, not the one others' choices allow.
- Overconfidence: assuming rivals can't do what you can. Ask why they couldn't.
- Planning fallacy: underestimating time and cost of your own move.

## Worked pattern
Two HVAC firms in a small city; you have 60% share. You plan to announce next year's service-plan price ($200 or $250); the rival announces after seeing yours. Annual profits ($k, you / rival):
- You $250, rival $250: 300 / 180. Rival $200: 220 / 210.
- You $200, rival $250: 260 / 120. Rival $200: 230 / 160.
Backward induction: if you go $250, the rival picks $200 (210 > 180), you get 220. If you go $200, the rival picks $200 (160 > 120), you get 230. Announce $200 and earn 230.
But check the rival's objective. Suppose it is chasing share to fill new technicians: it prefers $200 in every branch anyway, and nothing changes. Suppose instead it is selling its business soon and wants this year's profit: same answer here, but in many cases a different objective flips the tree.
Commitment option: a public price-match guarantee at $250 makes undercutting worthless to the rival (customers get $200 from you anyway); if the rival then prefers $250 (180 > its matched outcome), you earn 300. The guarantee must be visible and binding to work.
Pushing the rival out with a price war? Even if it fails, its assets sell cheaply to a new owner with lower costs, and customers or regulators may complain. Usually no.

## Common mistakes
- Assuming the rival maximises long-run profit when its real goal is share, volume or short-term cash.
- Using a matrix for a game where moves are seen in sequence.
- Making threats that are cheap to abandon.
- Expecting a price cut to win share permanently in a Bertrand-like market; it usually just lowers everyone's price.
- Trying to drive a competitor out without asking who buys its assets.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- Repeated games, auctions and games with incomplete information are not covered beyond the commitment and signalling notes above.
