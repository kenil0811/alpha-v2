# Journey a-kit-brings-its-agents: 2026-11-11 10:28

A kit brings its agent, labelled with the kit; its instructions change only with the kit, and its memory is the firm's

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 41 s, $0.51.


## 1. Installed the kit journeys/fixtures/kits/sourcing, its schedules paused

Took 0.0 s.

- pass: agents: 1 (saw 1)
- pass: Sourcer comes from Sourcing (saw Sourcing 0.1.0)
- pass: errors: 0 (saw 0)

## 2. Said “What do you do?”

Reply (1.8 s): I find small restoration-trade firms for sale in the Midwest and keep each one as a lead in your Leads table.

Spent so far: claude-haiku-5-5: in 1169 (cache read 0), out 19; claude-opus-5-5: in 22821 (cache read 17157), out 38; $0.05.

- pass: the reply matches /restoration/ (saw I find small restoration-trade firms for sale in the Midwest and keep each one as a lead in your Leads table.)
- pass: errors: 0 (saw 0)

## 3. Said “Change Sourcer's instructions so it also looks in Ohio.”

Reply (35.8 s): I couldn't change Sourcer's instructions. Sourcer came with the Sourcing kit, so its instructions can only be changed by a kit update. An edit made here would also be undone the next time the kit updates.

**Sourcer already covers Ohio.** Its instructions say to look "only in the restoration trade, and only in the Midwest", and Ohio is a Midwest state. Sourcer said the same when I asked, so Ohio firms should already come up in its searches.

If you want Ohio named outright, or searched first, I can do either of these:
- **Add a standing note to Sourcer** saying to include Ohio. It sits alongside the kit's instructions and survives kit updates.
- **Make your own copy of Sourcer** with Ohio written into its instructions. You'd control that copy, but it wouldn't pick up future improvements to the kit's version.

Do you want either of these, or is the Midwest coverage enough?

Steps: Kept the agent Sourcer.

Spent so far: claude-haiku-5-5: in 2372 (cache read 0), out 42; claude-opus-5-5: in 415995 (cache read 391542), out 4052; $0.36.

- pass: Sourcer's instructions say ^(?![\s\S]*Ohio)[\s\S]*Midwest (saw You find small firms for sale for the buyer. You look only in the restoration trade, and only in
the Midwest. When someone asks what you do, say so in one sentence, naming the restoration trade
and th)
- pass: the reply matches /Sourcing/ (saw I couldn't change Sourcer's instructions. Sourcer came with the Sourcing kit, so its instructions can only be changed by a kit update. An edit made here would a)
- pass: the reply matches /^[^.!?]*\b(couldn[’']t|could not|can[’']t|cannot|didn[’']t|did not|not|won[’']t)\b/ (saw I couldn't change Sourcer's instructions. Sourcer came with the Sourcing kit, so its instructions can only be changed by a kit update. An edit made here would a)
- pass: errors: 0 (saw 0)

## 4. Said “Remember that the broker for the Harbor deal is Priya Shah.”

Reply (3.8 s): I've saved it to memory: Priya Shah is the broker for the Harbor deal. Harbor isn't in your Leads yet, so the note isn't attached to a lead.

Steps: Noted something to remember.

Spent so far: claude-haiku-5-5: in 3541 (cache read 0), out 61; claude-opus-5-5: in 559582 (cache read 521815), out 5207; $0.51.

- pass: Sourcer remembers Priya (saw The broker for the Harbor deal is Priya Shah.)
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 44 lines.

## The world after

Leads: Name (text), Region (text)
