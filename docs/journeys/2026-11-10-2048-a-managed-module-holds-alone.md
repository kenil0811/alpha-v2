# Journey a-managed-module-holds: 2026-11-10 20:48

A managed module's shape holds against the model and the window, and its data stays the firm's

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 9 s, $0.08.


## 1. Installed the kit journeys/fixtures/kits/case-desk, its schedules paused

Took 0.1 s.


## 2. Said “Add a field Priority to Cases.”

Reply (5.2 s): I couldn't add Priority to Cases. The Case desk module is managed by you, so its table structure can't be changed directly. A new field can only come from a newer version of the module that you sign. Nothing on the table was changed.

I can still add, edit or remove cases, since the rows aren't locked. If you release an updated Case desk with a Priority field, I'd suggest a choice of High, Normal or Low.

Steps: Added Priority to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 17; claude-opus-5-5: in 44303 (cache read 38491), out 357; $0.06.

- pass: the reply matches /managed/ (saw I couldn't add Priority to Cases. The Case desk module is managed by you, so its table structure can't be changed directly. A new field can only come from a new)
- pass: Cases has no field Priority (saw Number, Status)

## 3. Renamed the table Cases to Matters, as the person does: refused: Case desk is managed by Kenil, so it cannot rename Cases to Matters: only a newer pack signed by Kenil changes it. Its rows are the firm's to change.

Took 0.0 s.

- pass: no table named /^Matters$/ (saw Cases)

## 4. Said “Add case 1042 to Cases, status Open.”

Reply (3.5 s): I added case 1042 to Cases with its status set to Open.

Steps: Added a row to Cases; Added a row to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 17; claude-opus-5-5: in 112511 (cache read 106082), out 612; $0.08.

- pass: rows in Cases: 1 (saw 1)

## 5. Typed "Closed" over 1042's Status in Cases

Took 0.0 s.

- pass: Status of 1042 in Cases is Closed (saw "Closed")
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 17 lines.

## The world after

Cases: Number (text), Status (choice)

- number "1042" [stated], status "Closed" [stated]
