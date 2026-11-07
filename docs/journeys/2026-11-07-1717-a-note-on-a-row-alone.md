# Journey a-note-on-a-row: 2026-11-07 17:17

a main table gets notes, and Alpha writes a note on a row that mentions another row

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 15 s, $0.22.


## 1. Said “In a module called Clients desk, make a table Clients with a Name. Add Acme and Bolt.”

Reply (13.0 s): I made the Clients desk module with a Clients table, and added Acme and Bolt.

A table can't hold only a name here, so I also added three fields you didn't ask for: Status (Prospect, Active or Past), Email and Client since. A Notes field comes with the table automatically. All of these are empty for both clients for now.

Steps: Made the table Clients; Made the table Clients; Added 2 rows to Clients.

Spent so far: claude-haiku-5-5: in 1196 (cache read 0), out 15; claude-opus-5-5: in 84488 (cache read 62732), out 921; $0.21.

- pass: Clients is main (saw main)
- pass: rows in Clients: 2 (saw 2)
- pass: SELECT row FROM row_notes gives 0 (saw [])

## 2. Said “On Acme, note that we met them at the trade fair, and that Bolt shares their yard.”

Reply (2.3 s): I've added the note to Acme: you met them at the trade fair, and Bolt shares their yard. Bolt's name in the note links to its row.

Steps: Changed a row in Clients.

Spent so far: claude-haiku-5-5: in 1196 (cache read 0), out 15; claude-opus-5-5: in 128794 (cache read 106541), out 1131; $0.22.

- pass: SELECT notes FROM row_notes gives 1 showing /trade fair/ (saw [{"notes":"Met them at the trade fair.\n\n[Bolt](row:r_4kn1axadp8) shares their yard."}])
- pass: SELECT notes FROM row_notes showing /\(row:r_/ (saw [{"notes":"Met them at the trade fair.\n\n[Bolt](row:r_4kn1axadp8) shares their yard."}])
- pass: errors: 0 (saw 0)

## The world after

Clients: Name (text), Status (choice), Email (email), Client since (date), Notes (notes)

- name "Acme" [stated], notes "Met them at the trade fair.\n\n[Bolt](row:r_4kn1axadp8) shares their yard." [stated]
- name "Bolt" [stated]
