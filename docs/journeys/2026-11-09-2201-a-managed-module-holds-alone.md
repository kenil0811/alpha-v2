# Journey a-managed-module-holds: 2026-11-09 22:01

A managed module's shape holds against the model and the window, and its data stays the firm's

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 9 s, $0.08.


## 1. Installed the kit journeys/fixtures/kits/case-desk, its schedules paused

Took 0.1 s.


## 2. Said “Add a field Priority to Cases.”

Reply (6.8 s): I couldn't add Priority, and nothing has changed on Cases. Case desk is a managed module, so its structure can only change through a newer pack signed by Kenil. Only the rows can be edited here.

Since you're Kenil, the fix is to add the field to the module's source and publish a new signed pack. I didn't try to get around the lock by editing the module's files directly.

I tried it as a choice of High, Medium or Low, so that's what I'd put in the pack unless you want different levels.

Steps: Added Priority to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 17; claude-opus-5-5: in 44073 (cache read 38208), out 543; $0.07.

- pass: the reply matches /managed/ (saw I couldn't add Priority, and nothing has changed on Cases. Case desk is a managed module, so its structure can only change through a newer pack signed by Kenil.)
- pass: Cases has no field Priority (saw Number, Status)

## 3. Renamed the table Cases to Matters, as the person does: refused: Case desk is managed by Kenil, so it cannot rename Cases to Matters: only a newer pack signed by Kenil changes it. Its rows are the firm's to change.

Took 0.0 s.

- pass: no table named /^Matters$/ (saw Cases)

## 4. Said “Add case 1042 to Cases, status Open.”

Reply (2.2 s): Case 1042 is now in Cases with status Open.

Steps: Added a row to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 17; claude-opus-5-5: in 89528 (cache read 83039), out 702; $0.08.

- pass: rows in Cases: 1 (saw 1)

## 5. Typed "Closed" over 1042's Status in Cases

Took 0.0 s.

- pass: Status of 1042 in Cases is Closed (saw "Closed")
- pass: errors: 0 (saw 0)

## The world after

Cases: Number (text), Status (choice)

- number "1042" [stated], status "Closed" [stated]
