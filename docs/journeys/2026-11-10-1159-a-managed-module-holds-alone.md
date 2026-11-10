# Journey a-managed-module-holds: 2026-11-10 11:59

A managed module's shape holds against the model and the window, and its data stays the firm's

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 9 s, $0.09.


## 1. Installed the kit journeys/fixtures/kits/case-desk, its schedules paused

Took 0.1 s.


## 2. Said “Add a field Priority to Cases.”

Reply (7.3 s): I couldn't add Priority to Cases. Case desk is a managed module, so its fields can only change through a newer pack signed by Kenil. Nothing was changed, and I haven't tried to get around the lock.

To add it, the next signed pack for Case desk needs to include this field. I'd suggest a choice field called Priority with Low, Medium and High, though those options are my assumption, so change them if the desk uses different levels.

Steps: Added Priority to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 17; claude-opus-5-5: in 44448 (cache read 37936), out 584; $0.07.

- pass: the reply matches /managed/ (saw I couldn't add Priority to Cases. Case desk is a managed module, so its fields can only change through a newer pack signed by Kenil. Nothing was changed, and I )
- pass: Cases has no field Priority (saw Number, Status)

## 3. Renamed the table Cases to Matters, as the person does: refused: Case desk is managed by Kenil, so it cannot rename Cases to Matters: only a newer pack signed by Kenil changes it. Its rows are the firm's to change.

Took 0.0 s.

- pass: no table named /^Matters$/ (saw Cases)

## 4. Said “Add case 1042 to Cases, status Open.”

Reply (2.0 s): Case 1042 is now in Cases with status Open.

Steps: Added a row to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 17; claude-opus-5-5: in 90338 (cache read 83185), out 743; $0.09.

- pass: rows in Cases: 1 (saw 1)

## 5. Typed "Closed" over 1042's Status in Cases

Took 0.0 s.

- pass: Status of 1042 in Cases is Closed (saw "Closed")
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 15 lines.

## The world after

Cases: Number (text), Status (choice)

- number "1042" [stated], status "Closed" [stated]
