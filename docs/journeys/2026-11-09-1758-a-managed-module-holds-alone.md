# Journey a-managed-module-holds: 2026-11-09 17:58

A managed module's shape holds against the model and the window, and its data stays the firm's

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 12 s, $0.22.


## 1. Installed the kit journeys/fixtures/kits/case-desk, its schedules paused

Took 0.2 s.


## 2. Said “Add a field Priority to Cases.”

Reply (9.7 s): I couldn't add Priority to Cases, and nothing has changed. Case desk is a managed module, so its fields can only change through a newer pack signed by Kenil. Changes made here are refused, though the rows in its tables can still be edited.

You're signed in as Kenil, but that doesn't get around this, because the change has to come as a signed pack. I also didn't want to work around it by editing the module's files.

To make the change, publish a new Case desk pack that adds this to Cases:

- **Field:** Priority, a choice field
- **Choices:** High, Medium, Low (my suggestion, so change them if you use different levels)
- **Meaning:** how urgently the case needs attention

Cases has no rows yet, so no existing case would need a priority filled in.

Steps: Looked through the tables; Added Priority to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 17; claude-opus-5-5: in 66234 (cache read 43858), out 756; $0.20.

- pass: the reply matches /managed/ (saw I couldn't add Priority to Cases, and nothing has changed. Case desk is a managed module, so its fields can only change through a newer pack signed by Kenil. Ch)
- pass: Cases has no field Priority (saw Number, Status)

## 3. Renamed the table Cases to Matters, as the person does: refused: Case desk is managed by Kenil, so it cannot rename Cases to Matters: only a newer pack signed by Kenil changes it. Its rows are the firm's to change.

Took 0.0 s.

- pass: no table named /^Matters$/ (saw Cases)

## 4. Said “Add case 1042 to Cases, status Open.”

Reply (2.3 s): Case 1042 is now in Cases with status Open, as you stated.

Steps: Added a row to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 17; claude-opus-5-5: in 112067 (cache read 89059), out 920; $0.22.

- pass: rows in Cases: 1 (saw 1)

## 5. Typed "Closed" over 1042's Status in Cases

Took 0.0 s.

- pass: Status of 1042 in Cases is Closed (saw "Closed")
- pass: errors: 0 (saw 0)

## The world after

Cases: Number (text), Status (choice)

- number "1042" [stated], status "Closed" [stated]
