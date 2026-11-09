# Journey a-note-on-a-row: 2026-11-09 19:25

a main table gets notes, and Alpha writes a note on a row that mentions another row

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 15 s, $0.12.


## 1. Said “In a module called Clients desk, make a table Clients with a Name. Add Acme and Bolt.”

Reply (10.0 s): The Clients desk module now has a Clients table with Acme and Bolt in it.

A table can't hold only a name here, so I also added two fields you didn't ask for: Status (Active, Paused or Former) and Client since, a date. Both are blank for now. Each row also gets a Notes field automatically.

Steps: Made the table Clients; Made the table Clients; Added 2 rows to Clients.

Spent so far: claude-haiku-5-5: in 1196 (cache read 0), out 15; claude-opus-5-5: in 89620 (cache read 82336), out 944; $0.09.

- pass: Clients is main (saw main)
- pass: rows in Clients: 2 (saw 2)
- pass: SELECT row FROM row_notes gives 0 (saw [])

## 2. Said “On Acme, note that we met them at the trade fair, and that Bolt shares their yard.”

Reply (5.2 s): I've added that to Acme's notes: you met them at the trade fair, and Bolt shares their yard. Bolt is linked in the note, so you can click through to its row.

Steps: Looked through the tables; Changed a row in Clients.

Spent so far: claude-haiku-5-5: in 1196 (cache read 0), out 15; claude-opus-5-5: in 160569 (cache read 152390), out 1413; $0.12.

- pass: SELECT notes FROM row_notes gives 1 showing /trade fair/ (saw [{"notes":"We met them at the trade fair.\n\n[Bolt](row:r_av7sgt0pxj) shares their yard."}])
- pass: SELECT notes FROM row_notes showing /\(row:r_/ (saw [{"notes":"We met them at the trade fair.\n\n[Bolt](row:r_av7sgt0pxj) shares their yard."}])
- pass: errors: 0 (saw 0)

## The world after

Clients: Name (text), Status (choice), Client since (date), Notes (notes)

- name "Acme" [stated], notes "We met them at the trade fair.\n\n[Bolt](row:r_av7sgt0pxj) shares their yard." [stated]
- name "Bolt" [stated]
