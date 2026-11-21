# Project management

> **Area:** `project-management` · owned by the COO skill. **Use when:** Plan, schedule, staff, contract, monitor and rescue a one-off piece of work with a fixed end (a site move, a system migration, a launch, an event, a plant or fit-out, a merger integration). Use when a business asks "how long will this really take?", "what is the critical path?", "can we finish earlier, and what does it cost?", "are we on budget?", "what could sink this?", "what contract should we sign with the builder or vendor?", or "should we keep funding this troubled project?".

**Outcome:** a scoped, owned and scheduled plan with a realistic finish date and budget stated as ranges, a short list of the risks that matter with prepared responses, a delivery model and contract that line up everyone's incentives, a progress dashboard that tells the truth early, and a clear continue, change or stop call when the project struggles.

## When to use
- Any work that is done once, has a deadline, and draws on several people, firms or functions.
- Before committing a date or a price to a customer, a board or a lender.
- When a project is slipping, over budget, or the team keeps saying "almost there".
- When choosing how to buy a project from outside (fixed price, cost-plus, guaranteed maximum, shared-risk alliance).
- When several projects compete for the same scarce people and money.

Recurring flows (orders, claims, repairs) belong in `process-capacity-and-cycle-time`; that area's critical path is the path one unit takes through a repeating process, this area's is the path through a one-off plan.

## Method

### 1. Classify how much is unknown before choosing how to manage
Projects span a range of uncertainty; manage each type differently:

| Type | What is unknown | How to manage |
|---|---|---|
| Variation | Durations and costs wobble around a known plan | Network schedule with buffers (steps 4 to 6) |
| Foreseen risk | Known events that may or may not happen | Risk register with mitigation and a prepared contingent action (step 8) |
| Unforeseen risk | Problems nobody can list in advance (first-of-its-kind technology, a scale-up far beyond any test) | Plan to learn: pilots, staged scale-up, parallel trials, a reserve of money and time, go/no-go tests (step 9) |
| Chaos | Even the goal may change | Short cycles, frequent re-planning, keep options open; fund in small tranches |

Test: has this team, or anyone it can hire, done this exact thing before at this scale? If not, assume unforeseen problems and say so in the business case. A large jump from lab or pilot to full scale, with no intermediate step, is the classic trap.

### 2. Fix the objective and lock the scope
- Write the goal as one measurable outcome (savings per year, opening date, capacity) and the few constraints that cannot move (budget, a broadcast or legal deadline, a quality bar).
- In an over-constrained project (date, scope and budget all fixed) the only slack is in how the work is done; say so up front.
- Decide what must be true on day one (minimum working service while the change happens), and protect it.
- Name a guardrail on scope: who can request changes, who approves them, and that every change is priced in time and money before it is accepted.
- Run a weekly change-request meeting with finance and every function the change touches; a change enters the plan only once its cost and knock-on effects are known.
- A historical warship that sank on launch shows the failure: the sponsor kept changing size, decks and armament while building, there were no written specifications, the builder fell ill and was replaced, a failed stability test was hushed up, and a fixed launch date overrode the warning. Each change looked small; together they made the result unsafe.

### 3. Break down the work and give every piece a name
- Work breakdown: objective, then areas, then projects, then sub-projects, then tasks small enough to assign and estimate (a common rule is 1 to 10 days each; standard practice).
- Every item has one owner and, for anything material, a senior sponsor who can clear blockers. Do not leave the planning meeting until each item has a name.
- Reuse earlier inventories (a list of critical systems, an asset register) rather than starting blank.
- Map which pieces enable others and which share the same scarce staff; these links become the network in step 4.
- For a large programme, put the 20 to 50 most important cross-team tasks on a one-page executive roadmap, and keep the full task list (it can run to tens of thousands of lines) underneath.

### 4. Schedule with a network and find the critical path (standard practice)
- List activities, durations and predecessors. Draw the network (activities on nodes).
- Forward pass gives earliest start and finish; backward pass from the deadline gives latest start and finish. Slack = latest start minus earliest start.
- **Critical path:** the chain with zero slack; its length is the project duration. Any delay on it delays the finish. Near-critical paths (little slack) need watching too.
- Formulas and a worked network: `coo/references/project-management/scheduling-and-control-formulas.md`.
- Interdependencies across functions hide in silos. Have each function present its plan to the others in turn, naming what it expects from each of them; remove duplicate work and assign each shared task to exactly one owner.

### 5. Put uncertainty into the dates and budget, then hold buffers centrally
- Estimate uncertain activities with three points (optimistic, most likely, pessimistic); the PERT mean and spread give the chance of meeting a date (formula sheet). A single-number plan built from most-likely durations usually has well under a 50% chance of being met (standard practice).
- State outcomes as a service level, not a single number: P10, P50 and P90 values for cost, date or savings (one IT-merger integration did this for the business value of each large sub-project). Building the curve forces the team to name the few value drivers that really move the result.
- Hold contingency in one central pool, owned by the project leader, rather than as padding hidden in each team's budget. Strip inflation factors and department padding into that pool, and track every draw. One large sporting-event project cut a large padding line this way and spent far less of the pool.
- Sort every budget line into must-have and nice-to-have; rank the nice-to-haves so they can be added back in order if money is left.
- Critical-chain style buffers: cut each task estimate to its median, and put part of the removed safety into one buffer at the end of the critical chain and feeding buffers where other paths join it (standard practice).

### 6. Shorten the schedule only where it pays (standard practice)
- **Crashing:** for each critical activity, cost slope = extra cost per period saved. Crash the cheapest critical activity one period at a time; recompute the critical path after each step (a parallel path can become critical). Stop when the cheapest slope exceeds what a period of time is worth (indirect cost per period plus any penalty or bonus).
- **Fast-tracking:** overlap steps that were in series (start building while design finishes). Cheaper in money, dearer in rework risk; one integrated-delivery project overlapped design and construction under one joint team to contain that risk.
- **Resource levelling:** when people are over-booked, move non-critical tasks within their slack first; only then stretch the date. Never level by quietly delaying a critical task.
- Hire or release staff in waves, as late as the plan allows; a temporary hiring freeze plus just-in-time staffing was one of the largest savings in a large sporting-event project.

### 7. Choose the delivery model and contract
| Model | Who carries the cost risk | Watch for |
|---|---|---|
| Fixed price (lump sum) | Contractor, up to any cap | Bids low then claims on every change; contractor refuses for novel work |
| Cost-plus fee | Owner | Weak incentive to save; fine where scope is truly unknown |
| Design-bid-build | Split; designer paid mostly before building | Thin design, rushed bid review, many change orders |
| Design-build | One entity for both | Owner loses some control of design |
| Construction manager at risk (guaranteed maximum price) | Manager above the cap, owner below it | Cap set before design is done; change orders to lift it |
| Integrated delivery or alliance (one contract, no suing, joint management, shared target cost and profit pool) | Shared | Needs trust, the right people, and a clear decision ladder |

Rules from practice:
- Mixing contract types on one site (one party fixed price, another cost-plus, a third both supervisor and lump-sum builder) sets parties against each other; finger-pointing and claims follow. One party should not both supervise and be supervised.
- Suppliers of a first-of-its-kind technology rarely guarantee performance; asking them to take an equity share or a shared profit pool aligns them instead.
- In a shared-risk contract the payout ladder is: savings go into contingency and are split between owner and team; overruns eat contingency first, then the team's at-risk profit, then the owner pays. Tie the profit pool to the few goals (budget, date, a certification, judged quality) and benchmark quality against comparable past projects. Payout arithmetic is in the formula sheet.
- Share the real budget with bidders and require designer and builder to bid as one team; problems start on day one.
- Spend early to remove unknowns that would otherwise become disputes (a site survey or scan before design; involve the future operators in design and safety reviews so access, maintenance and lifting are designed in).
- Watch sub-contracting chains: a key supplier who quietly re-subcontracts work to several small firms loses control of interfaces.

### 8. Run a project risk register and prioritise by value at stake
- Each row: description, category (synergy, day-one, local, global), type of impact (time, money, quality), probability band, money band, impacted parties, owner, mitigation (reduce it before), contingent action (the prepared fast response if it happens), status (assigned, open, mitigated, closed).
- The general register format and expected-loss logic are in `risk-and-compliance` (step 17); choose responses to big single risks with `risk-decisions-under-uncertainty`.
- With hundreds of risks, prioritise projects, not risks: plot each sub-project by value at stake against implementation risk and act by quadrant:

| | Low implementation risk | High implementation risk |
|---|---|---|
| **High value** | Watch: routine status reviews | Engage: senior team digs in and drives fixes |
| **Low value** | Let run | Delegate: the local team owns it, help on request |

- Attack the biggest value driver directly (in one IT-merger integration, locking hardware prices across all countries by central negotiation removed most of the variance and saved money).
- For places with high schedule risk (permits, gatekeepers, unrest), do not start until remaining uncertainty is removed, and plan within explicit buffers.
- Typical top-level project risks: owners of the work not bought in (they do the work and pay for it but did not choose it); too many projects for the same people; security during transition; funding cut if the business climate turns.

### 9. Plan to learn when the risks cannot be listed
- Scale up in steps (lab, pilot, demonstration, full) and size the first full plant between a pilot and a scale-efficient unit only if both partners can absorb a long start-up.
- Run parallel approaches on the hardest problem (a quick fix by the operator and a redesign by the technology owner, with pilot tests at partial scale).
- Audit every piece of equipment or component, build a punch list of small reliability projects, and model overall reliability to know how many must be fixed to hit target.
- Before more money, run a short, cheap test against a written list of go/no-go criteria agreed in advance.
- Keep the leader on site when things are unstable; visits every few weeks are too slow.
- Replace diffused "everyone is empowered" set-ups with clear accountability during a crisis; involvement and accountability can coexist.

### 10. Organise and govern
- Layered governance: an executive team that decides only escalations and changes to budget or date; a management team with one empowered lead from each party that meets weekly and can move money between parties without changing the total; an implementation team whose membership changes with the work. Agree a decision ladder (unanimous, then a two-thirds vote, then mediation).
- A project office tracks enterprise-critical schedules and budgets; one planning cell maintains the integrated schedule and writes action plans for anything late.
- Flatten reporting so the leader is one step from every critical function; decide within a day or a week, because a stalled decision stalls many people.
- Train people to bring a recommendation, and to settle cross-team questions with the affected teams before escalating.
- Hire at least one person who has done this before into each function when the organisation has no memory of the task.
- Near delivery, switch from function-led to site-led (or product-led) management: staff report to the site manager with a dotted line to their function.

### 11. Monitor honestly and report in the board's terms
- One dashboard: physical progress against target (units migrated, sites converted), budget plan versus actual, and benefits captured.
- **Earned value** (standard practice): planned value, earned value and actual cost give cost and schedule variance and indices (CPI, SPI) and a forecast at completion. Formulas in the sheet. Check the critical path as well; the money-based schedule index drifts back to 1 at the end whatever happened.
- Benefits often arrive in jumps (a whole site must be finished before its savings start). Show the stepped forecast, not a smoothed line, or the project will look behind for months; explain this to the steering committee before the first report.
- Report bad news early with its prepared response; a run of small surprises hidden from sponsors turns into panic.

### 12. Verify before the go-live
- Customer reviews of every function at each site, with all customer groups.
- Tabletop sessions: the site team walks through 3 to 5 likely scenarios; log every gap and track it to closure.
- Full-day simulations under live conditions with outside agencies, then quality circles to list fixes.
- Real dress rehearsals (test events), then debriefs.
- A contingency plan for each of about ten key "what ifs" (weather, power loss, protest, an accident), rehearsed with the outside bodies that must respond; cross-train spare staff for the likely choke point.
- For volunteer or temporary crews, over-recruit and screen through training attendance so the committed ones remain.

### 13. Re-decide a troubled project on future numbers only
- Ask: from today, do future benefits exceed the future cash needed (including idle time and a slower ramp-up)? Past spend is sunk (`cost-and-capacity-decisions`, step 8).
- Get an outside view, and test its claims rather than accept or dismiss them.
- Set explicit, testable continue criteria and a cheap test; partners must present one view to their boards or the project dies.
- Make the ramp-up assumptions more conservative than the sceptics' before asking for money.

### 14. Pick projects and the way of working (standard practice)
- **Portfolio:** score candidate projects on value, strategic fit, risk and the scarce resource they use; rank by value per unit of the scarcest resource and cut the list to what the team can staff. Money decisions on each use `capital-budgeting` (CFO).
- **Plan-driven versus agile:** use a full upfront plan where scope is stable and rework is costly (building, compliance, events). Use short iterations with a fixed date and flexible scope where the customer cannot specify in advance (software, new services). Many projects mix them: a fixed outer plan with iterative work inside.

## Worked pattern
A distributor moves to a new warehouse and system. Six activities in weeks: lease and permits A (3), fit-out B (5, after A), system set-up C (4, after A), migrate stock D (6, after B), train staff E (3, after C), go-live F (2, after D and E).
- Paths: A-B-D-F = 16 weeks (critical); A-C-E-F = 12 (4 weeks slack on C and E). Move training staff to help B rather than adding people to C.
- Three-point estimates on the critical path give a mean of 17 weeks and a spread of about 1.5; the 16-week plan has only about a 25% chance, 19 weeks about 90%. Promise 19 to the customer, plan to 17, hold the 2 weeks as a central buffer.
- Overheads are $2,000 a week. Crashing fit-out by a week costs $1,500: do it. Crashing migration costs $2,500 a week: only worth it if a late penalty applies.
- At week 8, planned value $60k, earned $50k, spent $58k on a $120k budget: CPI 0.86, SPI 0.83, forecast at completion about $139k. Report it now with the fix, not at week 14.
Full arithmetic: `coo/references/project-management/scheduling-and-control-formulas.md`.

## Common mistakes
- Accepting scope changes without pricing them in time, money and risk, and without one person deciding.
- One-number dates and budgets built from most-likely estimates; no stated confidence.
- Padding hidden in every team's budget instead of one visible pool.
- Adding people or money to activities off the critical path, or crashing without rechecking which path is critical.
- Treating a first-of-its-kind project as routine: no learning budget, no staged scale-up, no go/no-go tests.
- Designing without the future operators, or a builder who sees the design only weeks before pricing it.
- Mixed contract types that set the parties against each other; one firm both supervising and being supervised.
- Risk registers with no owner or contingent action; ranking hundreds of risks instead of prioritising the projects they sit in.
- Ignoring a failed test because the expert "has done this before"; deadlines that override safety evidence.
- Smoothed benefit forecasts that make a healthy project look late; hiding small surprises until they pile up.
- Leaders running an unstable project from afar; slow decisions that leave teams waiting.
- Pouring more money in to "catch up" without re-deciding on future cash flows.

## Sources
- Method distilled from MBA course material (lectures, notes, textbooks and teaching cases), written in our own words; no course text is reproduced.

## Gaps
- None noted beyond the scope above.
