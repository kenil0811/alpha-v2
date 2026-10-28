# Journey a-note-on-a-row: 2026-10-27 20:11

a main table gets notes, and Alpha writes a note on a row that mentions another row

Fresh tenant, model claude-opus-5-5, Alpha's prompt alone.
**Passed** in 22 s.


## 1. Said “In a module called Clients desk, make a table Clients with a Name. Add Acme and Bolt.”

Reply (15.4 s): I made the Clients desk module with a Clients table, and added Acme and Bolt to it.

The table wouldn't accept just a name, so I added three more columns: Status (Prospect, Active, Paused or Former), Contact email and Client since. These are my guesses and they're empty for now. The table also gets a Notes field automatically. Tell me if you'd like different columns, or give me the details for Acme and Bolt and I'll fill them in.

Steps: Made the table Clients; Made the table Clients; Added 2 rows to Clients.

Tokens so far in the session: claude-haiku-5-5: in 1196 (cache read 0), out 18; claude-opus-5-5: in 61052 (cache read 55456), out 984.

- pass: Clients is main (saw main)
- pass: rows in Clients: 2 (saw 2)
- pass: SELECT row FROM row_notes gives 0 (saw [])

## 2. Said “On Acme, note that we met them at the trade fair, and that Bolt shares their yard.”

Reply (6.2 s): I added a note on Acme saying we met them at the trade fair and that Bolt shares their yard. "Bolt" in the note is a link to Bolt's row.

Steps: Changed a row in Clients.

Tokens so far in the session: claude-haiku-5-5: in 1196 (cache read 0), out 18; claude-opus-5-5: in 104177 (cache read 98043), out 1199.

- pass: SELECT notes FROM row_notes gives 1 showing /trade fair/ (saw [{"notes":"We met them at the trade fair.\n\n[Bolt](row:r_t8arkn30f9) shares their yard."}])
- pass: SELECT notes FROM row_notes showing /\(row:r_/ (saw [{"notes":"We met them at the trade fair.\n\n[Bolt](row:r_t8arkn30f9) shares their yard."}])
- pass: errors: 0 (saw 0)

## The world after

Clients: Name (text), Status (choice), Contact email (email), Client since (date), Notes (notes)

- name "Acme" [stated], notes "We met them at the trade fair.\n\n[Bolt](row:r_t8arkn30f9) shares their yard." [stated]
- name "Bolt" [stated]
