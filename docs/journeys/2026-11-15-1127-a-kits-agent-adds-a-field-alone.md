# Journey a-kits-agent-adds-a-field: 2026-11-15 11:27

A kit's own agent adds a field to its kit's table, on the maintainer's card

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 10 s, $0.08.


## 1. Installed the kit journeys/fixtures/kits/sourcing-kept, its schedules paused

Took 0.0 s.

- pass: agents: 1 (saw 1)
- pass: Sourcer comes from Sourcing (saw Sourcing 0.1.0)
- pass: errors: 0 (saw 0)

## 2. Said “Add a number field called Staff to Leads, for how many people work at the firm.”

Reply (5.6 s): I haven't added the Staff field yet. Mira maintains the Sourcing module, so changes to Leads need your approval first.

There's now a card waiting for you that adds Staff to Leads as a number field, for how many people work at the firm. Approve it and the field goes in. If you'd rather Mira handled it, I can pass the request to her.

Steps: Added Staff to Leads.

Spent so far: claude-haiku-5-5: in 1188 (cache read 0), out 18; claude-opus-5-5: in 46135 (cache read 40142), out 272; $0.06.

- pass: a question card waiting (saw Mira maintains Sourcing: add Staff (number) to Leads. Ask them to put it in the kit's next version, or do it now and they are told later. | )
- pass: Leads has no field Staff (saw Name, Region)
- pass: errors: 0 (saw 0)

## 3. Answered “Mira maintains Sourcing: add Staff (number) to Leads. Ask them to put it in the kit's next version, or do it now and they are told later.” with Do it now anyway, on its own page

Reply (0.1 s): I haven't added the Staff field yet. Mira maintains the Sourcing module, so changes to Leads need your approval first.

There's now a card waiting for you that adds Staff to Leads as a number field, for how many people work at the firm. Approve it and the field goes in. If you'd rather Mira handled it, I can pass the request to her.

Steps: Added Staff to Leads.

Spent so far: claude-haiku-5-5: in 1188 (cache read 0), out 18; claude-opus-5-5: in 46135 (cache read 40142), out 272; $0.06.

- pass: errors: 0 (saw 0)

## 4. Said “Add a lead called Oat Mill, in Ohio, with 4 staff.”

Reply (3.9 s): I've added Oat Mill to Leads: it's in Ohio and has 4 staff, as you told me. The Staff field you approved is now on Leads.

Steps: Added a row to Leads.

Spent so far: claude-haiku-5-5: in 1188 (cache read 0), out 18; claude-opus-5-5: in 93490 (cache read 86863), out 467; $0.08.

- pass: rows in Leads: 1 (saw 1)
- pass: select name from leads where staff = 4 gives 1 showing /Oat Mill/ (saw [{"name":"Oat Mill"}])
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 19 lines.

## The world after

Leads: Name (text), Region (text), Staff (number)

- name "Oat Mill" [stated], region "Ohio" [stated], staff 4 [stated]
