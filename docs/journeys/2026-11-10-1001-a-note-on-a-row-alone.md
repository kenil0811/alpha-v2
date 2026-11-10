# Journey a-note-on-a-row: 2026-11-10 10:01

a main table gets notes, and Alpha writes a note on a row that mentions another row

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 15 s, $0.12.


## 1. Said “In a module called Clients desk, make a table Clients with a Name. Add Acme and Bolt.”

Reply (9.6 s): The Clients desk module now has a Clients table with Acme and Bolt in it.

A table can't hold only a name here, so I also added Status (Active, Paused or Former), Email and Client since, plus the Notes field every table gets. Those are blank for both clients, and I can change or drop any you don't want.

Steps: Made the table Clients; Made the table Clients; Added 2 rows to Clients.

Spent so far: claude-haiku-5-5: in 1196 (cache read 0), out 16; claude-opus-5-5: in 90260 (cache read 83560), out 905; $0.09.

- pass: Clients is main (saw main)
- pass: rows in Clients: 2 (saw 2)
- pass: SELECT row FROM row_notes gives 0 (saw [])

## 2. Said “On Acme, note that we met them at the trade fair, and that Bolt shares their yard.”

Reply (4.9 s): I've added both to Acme's notes: you met them at the trade fair, and Bolt shares their yard. Bolt's name there links to its row.

Steps: Looked through the tables; Changed a row in Clients.

Spent so far: claude-haiku-5-5: in 1196 (cache read 0), out 16; claude-opus-5-5: in 161750 (cache read 154145), out 1338; $0.12.

- pass: SELECT notes FROM row_notes gives 1 showing /trade fair/ (saw [{"notes":"Met them at the trade fair.\n\n[Bolt](row:r_5fbb6fm0ng) shares their yard."}])
- pass: SELECT notes FROM row_notes showing /\(row:r_/ (saw [{"notes":"Met them at the trade fair.\n\n[Bolt](row:r_5fbb6fm0ng) shares their yard."}])
- pass: errors: 0 (saw 0)

## The world after

Clients: Name (text), Status (choice), Email (email), Client since (date), Notes (notes)

- name "Acme" [stated], notes "Met them at the trade fair.\n\n[Bolt](row:r_5fbb6fm0ng) shares their yard." [stated]
- name "Bolt" [stated]
