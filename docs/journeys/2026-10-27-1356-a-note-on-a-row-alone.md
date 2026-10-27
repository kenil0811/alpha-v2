# Journey a-note-on-a-row: 2026-10-27 13:56

a main table gets notes, and Alpha writes a note on a row that mentions another row

Fresh tenant, model claude-opus-5-5, Alpha's prompt alone.
**Passed** in 12 s.


## 1. Said “In a module called Clients desk, make a table Clients with a Name. Add Acme and Bolt.”

Reply (5.8 s): I made a new module called Clients desk with a Clients table. It has a Name field, plus a Notes field that every table gets automatically. I added Acme and Bolt, recorded as names you gave me.

Steps: Made the table Clients; Added 2 rows to Clients.

Tokens so far in the session: claude-haiku-5-5: in 1196 (cache read 0), out 15; claude-opus-5-5: in 57064 (cache read 37755), out 385.

- pass: Clients is main (saw main)
- pass: rows in Clients: 2 (saw 2)
- pass: SELECT row FROM row_notes gives 0 (saw [])

## 2. Said “On Acme, note that we met them at the trade fair, and that Bolt shares their yard.”

Reply (6.4 s): I added a note to Acme saying you met them at the trade fair and that Bolt shares their yard. Bolt is linked in the note, so you can click through to it. I didn't change Bolt's own notes.

Steps: Looked through the tables; Looked through the tables; Changed a row in Clients.

Tokens so far in the session: claude-haiku-5-5: in 1196 (cache read 0), out 15; claude-opus-5-5: in 136496 (cache read 116351), out 851.

- pass: SELECT notes FROM row_notes gives 1 showing /trade fair/ (saw [{"notes":"We met them at the trade fair. [Bolt](row:r_fygjnv9z9d) shares their yard."}])
- pass: SELECT notes FROM row_notes showing /\(row:r_/ (saw [{"notes":"We met them at the trade fair. [Bolt](row:r_fygjnv9z9d) shares their yard."}])
- pass: errors: 0 (saw 0)

## The world after

Clients: Name (text), Notes (notes)

- name "Acme" [stated], notes "We met them at the trade fair. [Bolt](row:r_fygjnv9z9d) shares their yard." [stated]
- name "Bolt" [stated]
