# Journey a-managed-module-holds: 2026-11-06 15:26

A managed module's shape holds against the model and the window, and its data stays the firm's

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 11 s, $0.20.


## 1. Installed the kit journeys/fixtures/kits/case-desk, its agents paused

Took 0.1 s.


## 2. Said “Add a field Priority to Cases.”

Reply (8.0 s): I couldn't add Priority to Cases, and nothing has changed. Case desk is a managed module, so its structure only changes through a newer pack signed by Kenil. Only the rows can be edited here.

If you're the Kenil who manages it, you can add Priority to the pack and publish a new signed version. I had tried it as a choice of Low, Medium or High. If that's someone else, it's a request for them.

I could also keep priorities in a separate small table linked to each case, outside the managed module. They wouldn't appear as a column on Cases, though, so it only makes sense if you need this before a new pack comes out. Do you want me to set that up?

Steps: Added Priority to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 17; claude-opus-5-5: in 41557 (cache read 20598), out 626; $0.18.

- pass: the reply matches /managed/ (saw I couldn't add Priority to Cases, and nothing has changed. Case desk is a managed module, so its structure only changes through a newer pack signed by Kenil. On)
- pass: Cases has no field Priority (saw Number, Status)

## 3. Renamed the table Cases to Matters, as the person does: refused: Case desk is managed by Kenil, so it cannot rename Cases to Matters: only a newer pack signed by Kenil changes it. Its rows are the firm's to change.

Took 0.0 s.

- pass: no table named /^Matters$/ (saw Cases)

## 4. Said “Add case 1042 to Cases, status Open.”

Reply (2.4 s): Case 1042 is now in Cases with status Open, as you stated it.

Steps: Added a row to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 17; claude-opus-5-5: in 84673 (cache read 62996), out 791; $0.20.

- pass: rows in Cases: 1 (saw 1)

## 5. Typed "Closed" over 1042's Status in Cases

Took 0.1 s.

- pass: Status of 1042 in Cases is Closed (saw "Closed")
- pass: errors: 0 (saw 0)

## The world after

Cases: Number (text), Status (choice)

- number "1042" [stated], status "Closed" [stated]
