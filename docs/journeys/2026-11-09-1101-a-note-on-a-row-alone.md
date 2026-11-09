# Journey a-note-on-a-row: 2026-11-09 11:01

a main table gets notes, and Alpha writes a note on a row that mentions another row

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 14 s, $0.11.


## 1. Said “In a module called Clients desk, make a table Clients with a Name. Add Acme and Bolt.”

Reply (9.5 s): The Clients desk module now has a Clients table, with Acme and Bolt added as you stated them.

A table can't hold only a name here, so I also added Status (Prospect, Active or Past), Email and Client since. Those are my assumption and are blank for both clients, and each row has a Notes field too. Tell me if you'd like different fields.

Steps: Made the table Clients; Made the table Clients; Added 2 rows to Clients.

Spent so far: claude-haiku-5-5: in 1196 (cache read 0), out 15; claude-opus-5-5: in 84483 (cache read 78380), out 915; $0.08.

- pass: Clients is main (saw main)
- pass: rows in Clients: 2 (saw 2)
- pass: SELECT row FROM row_notes gives 0 (saw [])

## 2. Said “On Acme, note that we met them at the trade fair, and that Bolt shares their yard.”

Reply (4.9 s): I've added both points to Acme's notes: you met them at the trade fair, and Bolt shares their yard. Bolt's name there links to its row.

Steps: Looked through the tables; Changed a row in Clients.

Spent so far: claude-haiku-5-5: in 1196 (cache read 0), out 15; claude-opus-5-5: in 151576 (cache read 144597), out 1312; $0.11.

- pass: SELECT notes FROM row_notes gives 1 showing /trade fair/ (saw [{"notes":"We met them at the trade fair.\n\n[Bolt](row:r_hhgpxetm8b) shares their yard."}])
- pass: SELECT notes FROM row_notes showing /\(row:r_/ (saw [{"notes":"We met them at the trade fair.\n\n[Bolt](row:r_hhgpxetm8b) shares their yard."}])
- pass: errors: 0 (saw 0)

## The world after

Clients: Name (text), Status (choice), Email (email), Client since (date), Notes (notes)

- name "Acme" [stated], notes "We met them at the trade fair.\n\n[Bolt](row:r_hhgpxetm8b) shares their yard." [stated]
- name "Bolt" [stated]
