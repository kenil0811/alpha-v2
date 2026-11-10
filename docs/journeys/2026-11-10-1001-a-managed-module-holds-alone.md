# Journey a-managed-module-holds: 2026-11-10 10:01

A managed module's shape holds against the model and the window, and its data stays the firm's

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 9 s, $0.08.


## 1. Installed the kit journeys/fixtures/kits/case-desk, its schedules paused

Took 0.1 s.


## 2. Said “Add a field Priority to Cases.”

Reply (6.8 s): I couldn't add Priority to Cases, so nothing has changed. Case desk is a managed module, and its fields can only change through a newer version of its pack signed by Kenil.

To get the field in, that signed pack needs to include Priority. I tried it as a choice of High, Medium or Low, which is my suggestion if you don't already have other levels in mind. If you're the one who publishes the pack, you can add it there, and it will appear on Cases once the new version is installed.

Steps: Added Priority to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 17; claude-opus-5-5: in 44379 (cache read 38512), out 586; $0.07.

- pass: the reply matches /managed/ (saw I couldn't add Priority to Cases, so nothing has changed. Case desk is a managed module, and its fields can only change through a newer version of its pack sign)
- pass: Cases has no field Priority (saw Number, Status)

## 3. Renamed the table Cases to Matters, as the person does: refused: Case desk is managed by Kenil, so it cannot rename Cases to Matters: only a newer pack signed by Kenil changes it. Its rows are the firm's to change.

Took 0.0 s.

- pass: no table named /^Matters$/ (saw Cases)

## 4. Said “Add case 1042 to Cases, status Open.”

Reply (2.3 s): Case 1042 is now in Cases with status Open.

Steps: Added a row to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 17; claude-opus-5-5: in 90255 (cache read 83694), out 744; $0.08.

- pass: rows in Cases: 1 (saw 1)

## 5. Typed "Closed" over 1042's Status in Cases

Took 0.0 s.

- pass: Status of 1042 in Cases is Closed (saw "Closed")
- pass: errors: 0 (saw 0)

## The world after

Cases: Number (text), Status (choice)

- number "1042" [stated], status "Closed" [stated]
