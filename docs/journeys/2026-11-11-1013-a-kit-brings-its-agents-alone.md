# Journey a-kit-brings-its-agents: 2026-11-11 10:13

A kit brings its agent, labelled with the kit; its instructions change only with the kit, and its memory is the firm's

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 52 s, $0.56.


## 1. Installed the kit journeys/fixtures/kits/sourcing, its schedules paused

Took 0.0 s.

- pass: agents: 1 (saw 1)
- pass: Sourcer comes from Sourcing (saw Sourcing 0.1.0)
- pass: errors: 0 (saw 0)

## 2. Said “What do you do?”

Reply (2.0 s): I find small restoration-trade firms for sale in the Midwest and add each one as a lead in Leads for you.

Spent so far: claude-haiku-5-5: in 1169 (cache read 0), out 18; claude-opus-5-5: in 22710 (cache read 17112), out 37; $0.05.

- pass: the reply matches /restoration/ (saw I find small restoration-trade firms for sale in the Midwest and add each one as a lead in Leads for you.)
- pass: errors: 0 (saw 0)

## 3. Said “Change Sourcer's instructions so it also looks in Ohio.”

Reply (43.0 s): I couldn't change Sourcer's instructions. Sourcer came with the Sourcing kit, so its instructions can only change when the kit is updated. Any edit I made would be wiped out by the next update.

Ohio may already be covered. Sourcer's instructions say it looks "only in the restoration trade, and only in the Midwest", and Ohio is part of the Midwest. Naming Ohio would just make it certain.

I've put a card in front of you with three choices:
- **Add it yourself:** put a line like "Always include Ohio" in the "How to work" section on Sourcer's page. That's the one place you can add to it, and it stays when the kit updates.
- **Have me make a copy:** I make a new Sourcer agent with the same instructions plus "including Ohio", and you use that one instead. Kit updates won't reach the copy.
- **Leave it as it is,** since "Midwest" already includes Ohio.

Steps: Kept the agent Sourcer; Kept NOTES.md for Sourcer; Asked: Sourcer's instructions are fixed by its kit. How should I add Ohio?.

Spent so far: claude-haiku-5-5: in 2372 (cache read 0), out 42; claude-opus-5-5: in 524867 (cache read 499424), out 4909; $0.40.

- pass: Sourcer's instructions say ^(?![\s\S]*Ohio)[\s\S]*Midwest (saw You find small firms for sale for the buyer. You look only in the restoration trade, and only in
the Midwest. When someone asks what you do, say so in one sentence, naming the restoration trade
and th)
- pass: the reply matches /Sourcing/ (saw I couldn't change Sourcer's instructions. Sourcer came with the Sourcing kit, so its instructions can only change when the kit is updated. Any edit I made would)
- pass: errors: 0 (saw 0)

## 4. Said “Remember that we never contact firms under 2 million in revenue.”

Reply (6.5 s): I've noted it for the whole team: the firm never contacts firms with under 2 million in revenue.

This is a note the team will keep in mind, not a rule the system enforces. A hard rule can only block messages by who they're addressed to, not by a firm's revenue.

I don't contact firms myself, I only find them. If you want, I can also stop adding firms under 2 million as leads.

Steps: Noted something to remember.

Spent so far: claude-haiku-5-5: in 3541 (cache read 0), out 60; claude-opus-5-5: in 643028 (cache read 604511), out 6306; $0.56.

- pass: Sourcer remembers 2 million (saw The firm never contacts firms with under 2 million in revenue.)
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 49 lines.

## The world after

Leads: Name (text), Region (text)
