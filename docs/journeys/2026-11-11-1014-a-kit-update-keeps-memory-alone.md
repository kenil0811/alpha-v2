# Journey a-kit-update-keeps-memory: 2026-11-11 10:14

A kit's update changes its agent's instructions and keeps what the firm told it to remember

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 9 s, $0.12.


## 1. Installed the kit journeys/fixtures/kits/sourcing, its schedules paused

Took 0.0 s.

- pass: agents: 1 (saw 1)

## 2. Said “Remember that we never contact firms under 2 million in revenue.”

Reply (7.3 s): I've saved this for the whole firm: you never contact firms with under 2 million in revenue. Every conversation will see it from now on.

Right now Leads has only a name and a region for each firm, so there's nowhere to record revenue. Do you want me to add a revenue column, so leads under 2 million are easy to spot?

Steps: Noted something to remember.

Spent so far: claude-haiku-5-5: in 1184 (cache read 0), out 22; claude-opus-5-5: in 46171 (cache read 40003), out 529; $0.07.

- pass: Sourcer remembers 2 million (saw The firm never contacts firms with under 2 million in revenue.)

## 3. Updated to the kit journeys/fixtures/kits/sourcing-2, its schedules paused

Took 0.0 s.

- pass: Sourcer's instructions say Texas (saw You find small firms for sale for the buyer. You look only in the restoration trade, and now only
in Texas. When someone asks where you look, say so in one sentence, naming the restoration trade
and T)
- pass: Sourcer remembers 2 million (saw The firm never contacts firms with under 2 million in revenue.)
- pass: Sourcer comes from Sourcing 0\.2\.0 (saw Sourcing 0.2.0)
- pass: errors: 0 (saw 0)

## 4. Said “Where do you look for firms?”

Reply (2.0 s): I look for small restoration firms for sale, and right now only in Texas.

Spent so far: claude-haiku-5-5: in 2357 (cache read 0), out 39; claude-opus-5-5: in 69108 (cache read 57116), out 553; $0.12.

- pass: the reply matches /Texas/ (saw I look for small restoration firms for sale, and right now only in Texas.)
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 17 lines.

## The world after

Leads: Name (text), Region (text)
