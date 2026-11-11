# Journey a-managed-module-holds: 2026-11-11 00:55

A managed module's shape holds against the model and the window, and its data stays the firm's

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 8 s, $0.08.


## 1. Installed the kit journeys/fixtures/kits/case-desk, its schedules paused

Took 0.0 s.


## 2. Said “Add a field Priority to Cases.”

Reply (5.6 s): I couldn't add Priority to Cases. Case desk is a managed module, owned and signed by you as Kenil, so its tables are locked from here. Its structure only changes when you publish a newer signed version of the module. You can still add and edit the rows in Cases as usual.

To get the field, add Priority to the Cases table in the module's source and publish the new version. I was going to make it a choice of High, Normal and Low. If you'd rather not wait for that, I can keep priority somewhere outside the module, such as a small table of its own that points at each case.

Steps: Added Priority to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 17; claude-opus-5-5: in 44381 (cache read 39002), out 428; $0.06.

- pass: the reply matches /managed/ (saw I couldn't add Priority to Cases. Case desk is a managed module, owned and signed by you as Kenil, so its tables are locked from here. Its structure only change)
- pass: Cases has no field Priority (saw Number, Status)

## 3. Renamed the table Cases to Matters, as the person does: refused: Case desk is managed by Kenil, so it cannot rename Cases to Matters: only a newer pack signed by Kenil changes it. Its rows are the firm's to change.

Took 0.0 s.

- pass: no table named /^Matters$/ (saw Cases)

## 4. Said “Add case 1042 to Cases, status Open.”

Reply (2.3 s): I've added case 1042 to Cases with status Open.

Steps: Added a row to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 17; claude-opus-5-5: in 89948 (cache read 84028), out 564; $0.08.

- pass: rows in Cases: 1 (saw 1)

## 5. Typed "Closed" over 1042's Status in Cases

Took 0.0 s.

- pass: Status of 1042 in Cases is Closed (saw "Closed")
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 15 lines.

## The world after

Cases: Number (text), Status (choice)

- number "1042" [stated], status "Closed" [stated]
