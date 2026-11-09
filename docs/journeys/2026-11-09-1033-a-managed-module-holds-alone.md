# Journey a-managed-module-holds: 2026-11-09 10:33

A managed module's shape holds against the model and the window, and its data stays the firm's

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 11 s, $0.09.


## 1. Installed the kit journeys/fixtures/kits/case-desk, its agents paused

Took 0.2 s.


## 2. Said “Add a field Priority to Cases.”

Reply (8.7 s): I couldn't add Priority, so Cases is unchanged. Case desk is a managed module, and its structure can only change through a newer pack signed by Kenil. That applies even to a single new field, and only the rows in it can be edited directly.

If you're the Kenil who manages that pack, add Priority there and publish a new version, and it will come through to Cases. If that's someone else, they'd need to make the change.

I'd suggest making Priority a choice of High, Medium or Low, but you can pick different levels when it goes into the pack.

Steps: Added Priority to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 16; claude-opus-5-5: in 41581 (cache read 35325), out 665; $0.07.

- pass: the reply matches /managed/ (saw I couldn't add Priority, so Cases is unchanged. Case desk is a managed module, and its structure can only change through a newer pack signed by Kenil. That appl)
- pass: Cases has no field Priority (saw Number, Status)

## 3. Renamed the table Cases to Matters, as the person does: refused: Case desk is managed by Kenil, so it cannot rename Cases to Matters: only a newer pack signed by Kenil changes it. Its rows are the firm's to change.

Took 0.0 s.

- pass: no table named /^Matters$/ (saw Cases)

## 4. Said “Add case 1042 to Cases, status Open.”

Reply (2.1 s): Case 1042 is now in Cases with status Open.

Steps: Added a row to Cases.

Spent so far: claude-haiku-5-5: in 1176 (cache read 0), out 16; claude-opus-5-5: in 84756 (cache read 77786), out 824; $0.09.

- pass: rows in Cases: 1 (saw 1)

## 5. Typed "Closed" over 1042's Status in Cases

Took 0.0 s.

- pass: Status of 1042 in Cases is Closed (saw "Closed")
- pass: errors: 0 (saw 0)

## The world after

Cases: Number (text), Status (choice)

- number "1042" [stated], status "Closed" [stated]
