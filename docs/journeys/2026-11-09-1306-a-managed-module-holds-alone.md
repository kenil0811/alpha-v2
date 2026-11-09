# Journey a-managed-module-holds: 2026-11-09 13:06

A managed module's shape holds against the model and the window, and its data stays the firm's

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 12 s, $0.21.


## 1. Installed the kit journeys/fixtures/kits/case-desk, its schedules paused

Took 0.2 s.


## 2. Said “Add a field Priority to Cases.”

Reply (8.1 s): I couldn't add Priority to Cases, so nothing has changed. Case desk is a managed module, so its fields can only change through a newer pack signed by Kenil. Only the rows can be edited here, not the table's structure.

If that's you, or once you have that pack, the field can go in through it. I'd suggest a choice of High, Medium or Low, described as how urgently the desk should deal with the case. Those three levels are my suggestion, so change them if the desk uses different ones.

Steps: Added Priority to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 17; claude-opus-5-5: in 41622 (cache read 20602), out 630; $0.18.

- pass: the reply matches /managed/ (saw I couldn't add Priority to Cases, so nothing has changed. Case desk is a managed module, so its fields can only change through a newer pack signed by Kenil. Onl)
- pass: Cases has no field Priority (saw Number, Status)

## 3. Renamed the table Cases to Matters, as the person does: refused: Case desk is managed by Kenil, so it cannot rename Cases to Matters: only a newer pack signed by Kenil changes it. Its rows are the firm's to change.

Took 0.0 s.

- pass: no table named /^Matters$/ (saw Cases)

## 4. Said “Add case 1042 to Cases, status Open.”

Reply (3.5 s): Case 1042 is now in Cases with status Open.

Steps: Added a row to Cases; Added a row to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 17; claude-opus-5-5: in 106531 (cache read 84682), out 929; $0.21.

- pass: rows in Cases: 1 (saw 1)

## 5. Typed "Closed" over 1042's Status in Cases

Took 0.0 s.

- pass: Status of 1042 in Cases is Closed (saw "Closed")
- pass: errors: 0 (saw 0)

## The world after

Cases: Number (text), Status (choice)

- number "1042" [stated], status "Closed" [stated]
