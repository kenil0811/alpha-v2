# Journey a-note-on-a-row: 2026-11-09 13:06

a main table gets notes, and Alpha writes a note on a row that mentions another row

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 13 s, $0.11.


## 1. Said “In a module called Clients desk, make a table Clients with a Name. Add Acme and Bolt.”

Reply (10.3 s): The Clients desk module now has a Clients table, with Acme and Bolt added.

A table can't hold only a name here, so I also added Status (Prospect, Active or Past), Email, Client since and Notes. Those are my assumptions and are blank for both clients. Tell me if you'd like different fields.

Steps: Made the table Clients; Made the table Clients; Added 2 rows to Clients.

Spent so far: claude-haiku-5-5: in 1196 (cache read 0), out 15; claude-opus-5-5: in 84747 (cache read 78061), out 987; $0.09.

- pass: Clients is main (saw main)
- pass: rows in Clients: 2 (saw 2)
- pass: SELECT row FROM row_notes gives 0 (saw [])

## 2. Said “On Acme, note that we met them at the trade fair, and that Bolt shares their yard.”

Reply (2.5 s): I've added both points to Acme's notes: you met them at the trade fair, and Bolt shares their yard. The mention of Bolt links to its row.

Steps: Changed a row in Clients.

Spent so far: claude-haiku-5-5: in 1196 (cache read 0), out 15; claude-opus-5-5: in 129205 (cache read 122032), out 1195; $0.11.

- pass: SELECT notes FROM row_notes gives 1 showing /trade fair/ (saw [{"notes":"We met them at the trade fair.\n\n[Bolt](row:r_q10j7009sy) shares their yard."}])
- pass: SELECT notes FROM row_notes showing /\(row:r_/ (saw [{"notes":"We met them at the trade fair.\n\n[Bolt](row:r_q10j7009sy) shares their yard."}])
- pass: errors: 0 (saw 0)

## The world after

Clients: Name (text), Status (choice), Email (email), Client since (date), Notes (notes)

- name "Acme" [stated], notes "We met them at the trade fair.\n\n[Bolt](row:r_q10j7009sy) shares their yard." [stated]
- name "Bolt" [stated]
