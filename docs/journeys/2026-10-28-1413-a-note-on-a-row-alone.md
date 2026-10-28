# Journey a-note-on-a-row: 2026-10-28 14:13

a main table gets notes, and Alpha writes a note on a row that mentions another row

Fresh tenant, model claude-opus-5-5, Alpha's prompt alone.
**Passed** in 36 s.


## 1. Said “In a module called Clients desk, make a table Clients with a Name. Add Acme and Bolt.”

Reply (29.8 s): I made the Clients desk module with a Clients table and added Acme and Bolt to it.

Besides Name, I gave the table a few fields I thought it would need: Status (Prospect, Active or Past), Contact email, Client since and Notes. Those are all empty for now, because the only thing you've given me for each client is its name. You can rename or remove any of those fields if they don't fit.

Steps: Made the table Clients; Made the table Clients; Added 2 rows to Clients.

Tokens so far in the session: claude-haiku-5-5: in 1196 (cache read 0), out 15; claude-opus-5-5: in 81390 (cache read 60431), out 901.

- pass: Clients is main (saw main)
- pass: rows in Clients: 2 (saw 2)
- pass: SELECT row FROM row_notes gives 0 (saw [])

## 2. Said “On Acme, note that we met them at the trade fair, and that Bolt shares their yard.”

Reply (6.0 s): I added a note to Acme: we met them at the trade fair, and Bolt shares their yard. In the note, Bolt is a link to Bolt's own row, so you can click through to it.

Steps: Changed a row in Clients.

Tokens so far in the session: claude-haiku-5-5: in 1196 (cache read 0), out 15; claude-opus-5-5: in 124090 (cache read 102631), out 1142.

- pass: SELECT notes FROM row_notes gives 1 showing /trade fair/ (saw [{"notes":"We met them at the trade fair. [Bolt](row:r_gb5x8kr36a) shares their yard."}])
- pass: SELECT notes FROM row_notes showing /\(row:r_/ (saw [{"notes":"We met them at the trade fair. [Bolt](row:r_gb5x8kr36a) shares their yard."}])
- pass: errors: 0 (saw 0)

## The world after

Clients: Name (text), Status (choice), Contact email (email), Client since (date), Notes (notes)

- name "Acme" [stated], notes "We met them at the trade fair. [Bolt](row:r_gb5x8kr36a) shares their yard." [stated]
- name "Bolt" [stated]
