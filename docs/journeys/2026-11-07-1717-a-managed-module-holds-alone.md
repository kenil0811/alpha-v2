# Journey a-managed-module-holds: 2026-11-07 17:17

A managed module's shape holds against the model and the window, and its data stays the firm's

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 13 s, $0.20.


## 1. Installed the kit journeys/fixtures/kits/case-desk, its agents paused

Took 0.2 s.


## 2. Said “Add a field Priority to Cases.”

Reply (7.8 s): I couldn't add Priority to Cases, and nothing has changed. Case desk is a managed module, so its structure can only change through a newer pack signed by Kenil. Changes made here are refused, though the rows in Cases can still be edited.

If that's your pack, add the field there and publish a new version. If someone else handles the packs for you, this is what I tried to add:

- **Field:** Priority, on Cases
- **Type:** a choice of Low, Medium or High, with High and Medium colour-coded
- **Meaning:** how urgently the desk should deal with the case

I chose those options myself, so change them if you'd like different ones. I could also keep priority in a separate table outside Case desk, with each row pointing at a case. It wouldn't show as a column on Cases, so I'd only do that if you can't wait for a new pack.

Steps: Looked through the tables; Added Priority to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 17; claude-opus-5-5: in 41669 (cache read 20587), out 630; $0.19.

- pass: the reply matches /managed/ (saw I couldn't add Priority to Cases, and nothing has changed. Case desk is a managed module, so its structure can only change through a newer pack signed by Kenil.)
- pass: Cases has no field Priority (saw Number, Status)

## 3. Renamed the table Cases to Matters, as the person does: refused: Case desk is managed by Kenil, so it cannot rename Cases to Matters: only a newer pack signed by Kenil changes it. Its rows are the firm's to change.

Took 0.0 s.

- pass: no table named /^Matters$/ (saw Cases)

## 4. Said “Add case 1042 to Cases, status Open.”

Reply (5.4 s): I've added case 1042 to Cases, with status Open.

Steps: Added a row to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 17; claude-opus-5-5: in 85076 (cache read 63282), out 790; $0.20.

- pass: rows in Cases: 1 (saw 1)

## 5. Typed "Closed" over 1042's Status in Cases

Took 0.0 s.

- pass: Status of 1042 in Cases is Closed (saw "Closed")
- pass: errors: 0 (saw 0)

## The world after

Cases: Number (text), Status (choice)

- number "1042" [stated], status "Closed" [stated]
