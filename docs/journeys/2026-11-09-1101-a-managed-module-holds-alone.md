# Journey a-managed-module-holds: 2026-11-09 11:01

A managed module's shape holds against the model and the window, and its data stays the firm's

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 10 s, $0.08.


## 1. Installed the kit journeys/fixtures/kits/case-desk, its agents paused

Took 0.2 s.


## 2. Said “Add a field Priority to Cases.”

Reply (7.4 s): I couldn't add Priority to Cases, and nothing has changed. Case desk is a managed module, so its fields can only change through a newer pack signed by Kenil. Only the rows in its tables can be changed from here.

Since you're Kenil, you can add it in the next version of the pack. I'd suggest a choice field called Priority with the options Low, Medium and High, though those options are my assumption, so change them if the desk uses different ones.

If you need to track priority before then, I can keep it in a separate table linked to Cases, outside the managed module. Do you want that, or would you rather wait for the pack?

Steps: Added Priority to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 17; claude-opus-5-5: in 41552 (cache read 36226), out 578; $0.06.

- pass: the reply matches /managed/ (saw I couldn't add Priority to Cases, and nothing has changed. Case desk is a managed module, so its fields can only change through a newer pack signed by Kenil. On)
- pass: Cases has no field Priority (saw Number, Status)

## 3. Renamed the table Cases to Matters, as the person does: refused: Case desk is managed by Kenil, so it cannot rename Cases to Matters: only a newer pack signed by Kenil changes it. Its rows are the firm's to change.

Took 0.0 s.

- pass: no table named /^Matters$/ (saw Cases)

## 4. Said “Add case 1042 to Cases, status Open.”

Reply (2.2 s): Case 1042 is now in Cases with status Open, as you stated.

Steps: Added a row to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 17; claude-opus-5-5: in 84581 (cache read 78570), out 742; $0.08.

- pass: rows in Cases: 1 (saw 1)

## 5. Typed "Closed" over 1042's Status in Cases

Took 0.0 s.

- pass: Status of 1042 in Cases is Closed (saw "Closed")
- pass: errors: 0 (saw 0)

## The world after

Cases: Number (text), Status (choice)

- number "1042" [stated], status "Closed" [stated]
