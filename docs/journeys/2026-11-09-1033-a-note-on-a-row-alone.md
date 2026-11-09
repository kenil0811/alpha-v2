# Journey a-note-on-a-row: 2026-11-09 10:33

a main table gets notes, and Alpha writes a note on a row that mentions another row

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 14 s, $0.12.


## 1. Said “In a module called Clients desk, make a table Clients with a Name. Add Acme and Bolt.”

Reply (9.9 s): The Clients desk module now has a Clients table, with Acme and Bolt added.

Alpha doesn't allow a table that holds only a name, so I also added Status (Active, Paused or Former), Email and Client since. A Notes field comes with the table automatically. All of these are blank for both clients for now.

Steps: Made the table Clients; Made the table Clients; Added 2 rows to Clients.

Spent so far: claude-haiku-5-5: in 1196 (cache read 0), out 15; claude-opus-5-5: in 84546 (cache read 77922), out 935; $0.09.

- pass: Clients is main (saw main)
- pass: rows in Clients: 2 (saw 2)
- pass: SELECT row FROM row_notes gives 0 (saw [])

## 2. Said “On Acme, note that we met them at the trade fair, and that Bolt shares their yard.”

Reply (4.3 s): I've added that to Acme's notes: "We met them at the trade fair. Bolt shares their yard." Bolt is linked in the note, so you can click through to its row.

Steps: Looked through the tables; Changed a row in Clients.

Spent so far: claude-haiku-5-5: in 1196 (cache read 0), out 15; claude-opus-5-5: in 151683 (cache read 144205), out 1325; $0.12.

- pass: SELECT notes FROM row_notes gives 1 showing /trade fair/ (saw [{"notes":"We met them at the trade fair. [Bolt](row:r_h9vag07g8a) shares their yard."}])
- pass: SELECT notes FROM row_notes showing /\(row:r_/ (saw [{"notes":"We met them at the trade fair. [Bolt](row:r_h9vag07g8a) shares their yard."}])
- pass: errors: 0 (saw 0)

## The world after

Clients: Name (text), Status (choice), Email (email), Client since (date), Notes (notes)

- name "Acme" [stated], notes "We met them at the trade fair. [Bolt](row:r_h9vag07g8a) shares their yard." [stated]
- name "Bolt" [stated]
