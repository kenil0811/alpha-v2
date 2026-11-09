# Journey a-note-on-a-row: 2026-11-09 09:18

a main table gets notes, and Alpha writes a note on a row that mentions another row

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 15 s, $0.23.


## 1. Said “In a module called Clients desk, make a table Clients with a Name. Add Acme and Bolt.”

Reply (10.1 s): The Clients desk module now has a Clients table with Acme and Bolt in it.

A table can't hold only a name here, so I also added three fields, all left blank for now: Status (Active, Paused or Former), Contact email and Client since. Each row gets a Notes field automatically as well.

Steps: Made the table Clients; Made the table Clients; Added 2 rows to Clients.

Spent so far: claude-haiku-5-5: in 1196 (cache read 0), out 15; claude-opus-5-5: in 84430 (cache read 62694), out 901; $0.20.

- pass: Clients is main (saw main)
- pass: rows in Clients: 2 (saw 2)
- pass: SELECT row FROM row_notes gives 0 (saw [])

## 2. Said “On Acme, note that we met them at the trade fair, and that Bolt shares their yard.”

Reply (4.6 s): I've added both to Acme's notes: you met them at the trade fair, and Bolt shares their yard. Bolt is linked there, so you can click through to its row.

Steps: Looked through the tables; Changed a row in Clients.

Spent so far: claude-haiku-5-5: in 1196 (cache read 0), out 15; claude-opus-5-5: in 151347 (cache read 128786), out 1309; $0.23.

- pass: SELECT notes FROM row_notes gives 1 showing /trade fair/ (saw [{"notes":"We met them at the trade fair.\n\n[Bolt](row:r_xffd77z860) shares their yard."}])
- pass: SELECT notes FROM row_notes showing /\(row:r_/ (saw [{"notes":"We met them at the trade fair.\n\n[Bolt](row:r_xffd77z860) shares their yard."}])
- pass: errors: 0 (saw 0)

## The world after

Clients: Name (text), Status (choice), Contact email (email), Client since (date), Notes (notes)

- name "Acme" [stated], notes "We met them at the trade fair.\n\n[Bolt](row:r_xffd77z860) shares their yard." [stated]
- name "Bolt" [stated]
