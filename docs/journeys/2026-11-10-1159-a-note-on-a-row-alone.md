# Journey a-note-on-a-row: 2026-11-10 11:59

a main table gets notes, and Alpha writes a note on a row that mentions another row

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 14 s, $0.12.


## 1. Said “In a module called Clients desk, make a table Clients with a Name. Add Acme and Bolt.”

Reply (9.6 s): The Clients desk module now has a Clients table with Acme and Bolt in it.

A table can't hold only a name here, so I also added Status (Prospect, Active or Past), Email and Client since, plus the standard Notes field. Those are my own picks and are blank for both clients, so tell me if you'd like different ones.

Steps: Made the table Clients; Made the table Clients; Added 2 rows to Clients.

Spent so far: claude-haiku-5-5: in 1196 (cache read 0), out 15; claude-opus-5-5: in 90379 (cache read 83628), out 958; $0.09.

- pass: Clients is main (saw main)
- pass: rows in Clients: 2 (saw 2)
- pass: SELECT row FROM row_notes gives 0 (saw [])

## 2. Said “On Acme, note that we met them at the trade fair, and that Bolt shares their yard.”

Reply (4.1 s): Added to Acme's notes: you met them at the trade fair, and Bolt shares their yard. The mention of Bolt links to its row.

Steps: Looked through the tables; Looked through the tables; Changed a row in Clients.

Spent so far: claude-haiku-5-5: in 1196 (cache read 0), out 15; claude-opus-5-5: in 162065 (cache read 154393), out 1344; $0.12.

- pass: SELECT notes FROM row_notes gives 1 showing /trade fair/ (saw [{"notes":"We met them at the trade fair. [Bolt](row:r_0nkz1pe32y) shares their yard."}])
- pass: SELECT notes FROM row_notes showing /\(row:r_/ (saw [{"notes":"We met them at the trade fair. [Bolt](row:r_0nkz1pe32y) shares their yard."}])
- pass: errors: 0 (saw 0)

The journal verifies, rows included: 23 lines.

## The world after

Clients: Name (text), Status (choice), Email (email), Client since (date), Notes (notes)

- name "Acme" [stated], notes "We met them at the trade fair. [Bolt](row:r_0nkz1pe32y) shares their yard." [stated]
- name "Bolt" [stated]
