# Journey a-kit-update-keeps-memory: 2026-11-11 10:29

A kit's update changes its agent's instructions and keeps what the firm told it to remember

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 6 s, $0.12.


## 1. Installed the kit journeys/fixtures/kits/sourcing, its schedules paused

Took 0.0 s.

- pass: agents: 1 (saw 1)

## 2. Said “Remember that the broker for the Harbor deal is Priya Shah.”

Reply (3.7 s): I'll remember that Priya Shah is the broker for the Harbor deal. I saved it as something you told me.

Steps: Noted something to remember.

Spent so far: claude-haiku-5-5: in 1187 (cache read 0), out 19; claude-opus-5-5: in 46019 (cache read 39619), out 183; $0.06.

- pass: Sourcer remembers Priya (saw The broker for the Harbor deal is Priya Shah.)

## 3. Updated to the kit journeys/fixtures/kits/sourcing-2, its schedules paused

Took 0.0 s.

- pass: Sourcer's instructions say Texas (saw You find small firms for sale for the buyer. You look only in the restoration trade, and now only
in Texas. When someone asks where you look, say so in one sentence, naming the restoration trade
and T)
- pass: Sourcer remembers Priya (saw The broker for the Harbor deal is Priya Shah.)
- pass: Sourcer comes from Sourcing 0\.2\.0 (saw Sourcing 0.2.0)
- pass: errors: 0 (saw 0)

## 4. Said “Where do you look for firms?”

Reply (1.8 s): I look only for restoration businesses for sale, and right now only in Texas.

Spent so far: claude-haiku-5-5: in 2360 (cache read 0), out 36; claude-opus-5-5: in 68874 (cache read 55534), out 208; $0.12.

- pass: the reply matches /Texas/ (saw I look only for restoration businesses for sale, and right now only in Texas.)
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 17 lines.

## The world after

Leads: Name (text), Region (text)
