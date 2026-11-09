# Journey a-managed-module-holds: 2026-11-09 19:25

A managed module's shape holds against the model and the window, and its data stays the firm's

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 12 s, $0.10.


## 1. Installed the kit journeys/fixtures/kits/case-desk, its schedules paused

Took 0.2 s.


## 2. Said “Add a field Priority to Cases.”

Reply (8.0 s): I couldn't add Priority to Cases, and nothing has changed. Case desk is a managed module, so its fields can only change through a newer version of its pack signed by Kenil.

If you publish that pack, add Priority there. I'd suggest a choice of High, Medium or Low, and once the new version is in, the field will show up on Cases.

I haven't tried to get around the lock, because it's there to stop the module being changed locally. Its rows can still be edited, so a priority could go in an existing field for now, but Cases only has Number and Status, and neither suits it. Do you want it kept somewhere else until the pack is updated?

Steps: Added Priority to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 17; claude-opus-5-5: in 44029 (cache read 37580), out 653; $0.07.

- pass: the reply matches /managed/ (saw I couldn't add Priority to Cases, and nothing has changed. Case desk is a managed module, so its fields can only change through a newer version of its pack sign)
- pass: Cases has no field Priority (saw Number, Status)

## 3. Renamed the table Cases to Matters, as the person does: refused: Case desk is managed by Kenil, so it cannot rename Cases to Matters: only a newer pack signed by Kenil changes it. Its rows are the firm's to change.

Took 0.0 s.

- pass: no table named /^Matters$/ (saw Cases)

## 4. Said “Add case 1042 to Cases, status Open.”

Reply (3.5 s): Case 1042 is now in Cases with status Open.

Steps: Added a row to Cases; Added a row to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 17; claude-opus-5-5: in 112692 (cache read 105342), out 952; $0.10.

- pass: rows in Cases: 1 (saw 1)

## 5. Typed "Closed" over 1042's Status in Cases

Took 0.0 s.

- pass: Status of 1042 in Cases is Closed (saw "Closed")
- pass: errors: 0 (saw 0)

## The world after

Cases: Number (text), Status (choice)

- number "1042" [stated], status "Closed" [stated]
