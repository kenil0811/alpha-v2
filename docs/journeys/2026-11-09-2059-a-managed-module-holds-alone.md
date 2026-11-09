# Journey a-managed-module-holds: 2026-11-09 20:59

A managed module's shape holds against the model and the window, and its data stays the firm's

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 12 s, $0.09.


## 1. Installed the kit journeys/fixtures/kits/case-desk, its schedules paused

Took 0.2 s.


## 2. Said “Add a field Priority to Cases.”

Reply (9.0 s): I couldn't add Priority to Cases, and nothing has changed. Case desk is a managed module, so its fields can only change through a newer pack signed by Kenil. That's you if the pack is under your name, but it has to be done by publishing the pack, not from here.

- **Change the pack:** add Priority to Cases in a new signed version of Case desk. I'd suggest a choice of High, Medium or Low. Once that's installed, the field will appear on Cases.
- **Keep it alongside:** I can make a small table in a separate module with one row per case and its priority, linked to Cases. It would work today, but Priority would sit next to the Cases table rather than in it.

Which would you prefer?

Steps: Added Priority to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 17; claude-opus-5-5: in 44095 (cache read 37591), out 715; $0.07.

- pass: the reply matches /managed/ (saw I couldn't add Priority to Cases, and nothing has changed. Case desk is a managed module, so its fields can only change through a newer pack signed by Kenil. Th)
- pass: Cases has no field Priority (saw Number, Status)

## 3. Renamed the table Cases to Matters, as the person does: refused: Case desk is managed by Kenil, so it cannot rename Cases to Matters: only a newer pack signed by Kenil changes it. Its rows are the firm's to change.

Took 0.0 s.

- pass: no table named /^Matters$/ (saw Cases)

## 4. Said “Add case 1042 to Cases, status Open.”

Reply (2.9 s): Case 1042 is now in Cases with status Open, as you stated it.

Steps: Added a row to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 17; claude-opus-5-5: in 89875 (cache read 82616), out 880; $0.09.

- pass: rows in Cases: 1 (saw 1)

## 5. Typed "Closed" over 1042's Status in Cases

Took 0.0 s.

- pass: Status of 1042 in Cases is Closed (saw "Closed")
- pass: errors: 0 (saw 0)

## The world after

Cases: Number (text), Status (choice)

- number "1042" [stated], status "Closed" [stated]
