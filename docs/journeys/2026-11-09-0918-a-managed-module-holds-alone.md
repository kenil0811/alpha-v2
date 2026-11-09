# Journey a-managed-module-holds: 2026-11-09 09:18

A managed module's shape holds against the model and the window, and its data stays the firm's

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 11 s, $0.20.


## 1. Installed the kit journeys/fixtures/kits/case-desk, its agents paused

Took 0.2 s.


## 2. Said “Add a field Priority to Cases.”

Reply (9.1 s): I couldn't add Priority to Cases, so nothing has changed. Case desk is a managed module, and its structure can only change through a newer pack signed by Kenil. Only the rows can be edited here, so a new field has to come through that pack.

Since that's you, the fix is to add Priority to the pack and issue a new signed version. I'd planned it as a choice of High, Medium or Low, which was my assumption, so change those options if you use different ones. Once the new version is in, Priority will show on Cases.

Steps: Added Priority to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 16; claude-opus-5-5: in 41580 (cache read 20601), out 616; $0.18.

- pass: the reply matches /managed/ (saw I couldn't add Priority to Cases, so nothing has changed. Case desk is a managed module, and its structure can only change through a newer pack signed by Kenil.)
- pass: Cases has no field Priority (saw Number, Status)

## 3. Renamed the table Cases to Matters, as the person does: refused: Case desk is managed by Kenil, so it cannot rename Cases to Matters: only a newer pack signed by Kenil changes it. Its rows are the firm's to change.

Took 0.0 s.

- pass: no table named /^Matters$/ (saw Cases)

## 4. Said “Add case 1042 to Cases, status Open.”

Reply (2.0 s): Case 1042 is now in Cases with status Open, as you stated it.

Steps: Added a row to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 16; claude-opus-5-5: in 84655 (cache read 63011), out 758; $0.20.

- pass: rows in Cases: 1 (saw 1)

## 5. Typed "Closed" over 1042's Status in Cases

Took 0.0 s.

- pass: Status of 1042 in Cases is Closed (saw "Closed")
- pass: errors: 0 (saw 0)

## The world after

Cases: Number (text), Status (choice)

- number "1042" [stated], status "Closed" [stated]
