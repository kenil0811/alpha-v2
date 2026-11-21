# Real options: lessons from teaching cases

Part of `cfo/references/real-options.md`. Generalised lessons from three option cases.
No case answers are given.

## Licensing a product still in development (a drug-licensing case)

- **Map the stages as a tree.** Each stage has a cost (including any milestone payment to the
  licensor), a duration and a chance of passing. A stage can also branch into different outcomes
  (works for use A only, for use B only, for both), each with its own next-stage cost, odds and
  final payoff.
- **Solve backward and allow a stop at each gate.** At every node continue only if the expected
  value of going on beats stopping. A branch whose launch cost exceeds the value of what it
  launches is dropped, even after earlier money was spent.
- **Technical risk goes into the probabilities, not the rate.** Whether a trial succeeds is not
  tied to the market, so it does not raise the discount rate. Discount at the rate for the
  commercial cash flows and weight by the chance of reaching them. (Standard practice.)
- **Compare with committing everything up front.** The static NPV that funds all stages
  regardless understates value; the gap is the value of being able to stop.
- **Licensor payments are part of each stage's cost,** and royalties reduce the final payoff;
  a licensor who asks more up front and less on success shifts risk to the licensee.
- **Patent life caps the payoff.** Value commercial cash flows only to expiry unless there is a
  reason to expect value after.

## Buying the rights to future follow-ons (a film-sequel case)

- **A bundle of options is worth more than an option on the bundle.** Rights to make a sequel to
  each film in a studio's slate are valued film by film: after the first film's results are
  known, make the sequel only if its NPV is then positive. Sum the per-film values.
- **Use the whole distribution, not the average.** A sequel to an average film may be negative
  NPV; the option's value comes from the hits. Valuing the average film's sequel understates the
  rights.
- **Price per film on the full slate.** Buying all films, chosen before release, protects the
  buyer from being sold only the losers; the price per film must be set before anyone knows
  which films succeed.
- **Timing:** the sequel decision comes a year or more after the first release, and the sequel's
  costs and revenues come later still. Discount each piece from when it happens.
- **Check the counterparty's view.** A studio that does not value its own sequel rights may still
  refuse to sell below a floor price per film.

## A purchase option in a lease (a commercial real-estate case)

- **An option out of the money on today's forecast still has value.** If the asset's value can
  move, there is some chance it ends above the strike. Valuing the option as "best case minus
  strike" from a sensitivity table, or as zero because the expected value is below the strike,
  understates it.
- **Value it with a tree.** Build the asset's value path from its volatility, let the holder
  exercise at each allowed date, use risk-neutral probabilities (see
  `cfo/references/real-options.md`, sections 3 and 4).
- **Index terms matter.** A strike that rises with only part of inflation falls in real terms,
  which makes exercise more likely later.
- **The option's cost to you can show up elsewhere.** A lender charging a higher rate because a
  tenant could buy the building (and so trigger an early loan repayment) prices the option's
  nuisance. The most worth paying to cancel the option is its value to the holder plus that
  extra cost; start the negotiation from the holder's value, not a token sum.
- **Small print in long contracts deserves a valuation.** Purchase, renewal and break rights
  often go unpriced when signed and turn out to matter years later.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.
